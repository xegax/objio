import { Publisher } from '../common/publisher';
import { InvokeMethodArgs, JSONObj } from './store';
import { User, AccessType } from '../client/user';

export type Tags = Array<string>;
export type Type = 'string' | 'number' | 'integer' | 'json' | 'object';
export type Field = {
  type: Type;
  classId?: string;
  userCtx?: string;
  const?: boolean;  // this value can not be modified
  tags?: Tags;      // if not defined it is suitable for all tags
};

export type FieldsMap<T = any> = {
  [key in keyof T]?: Field;
};

export type SERIALIZER<T = any> = () => FieldsMap<T>;

export type FieldFilter = (field: Field) => boolean;

export function SERIALIZE(objClass: OBJIOItemClass, includeFilter?: FieldFilter): FieldsMap {
  const fields = objClass.SERIALIZE();
  if (!includeFilter)
    return fields;

  const res: FieldsMap = {};
  Object.keys(fields).forEach(name => {
    const field = fields[name];
    if (includeFilter(field))
      res[name] = field;
  });

  return res;
}

export function EXTEND<T = any>(fields: FieldsMap<T>, add: Partial<Field>): FieldsMap<T> {
  const res: FieldsMap<T> = {};
  Object.keys(fields).forEach(name => {
    res[name] = {...fields[name], ...add};
  });

  return res;
}

interface OBJItemConstructor extends ObjectConstructor {
  new(json?: any): OBJIOItem;
}

export interface WriteToObjectArgs {
  checkConst?: boolean;   //  writeToObject to initialize
  userId: string;
  fieldFilter?: FieldFilter;
  obj: OBJIOItem;
  store: Object;
  getObject: (id: string) => Promise<OBJIOItem> | OBJIOItem;
}

export type SaveStoreResult = { [key: string]: number | string };
export type WriteToObjResult = Promise<any> | void;
export type GetRelObjIDSResult = Array<string>;

export interface OBJIOItemClass {
  TYPE_ID: string;
  SERIALIZE: SERIALIZER;

  writeToObject?(args: WriteToObjectArgs): WriteToObjResult;
  saveStore?(obj: OBJIOItem): SaveStoreResult;
  getRelObjIDS?(store: Object, replaceID?: (id: string) => string): GetRelObjIDSResult;
  getRelObjs(obj: OBJIOItem, arr?: Array<OBJIOItem>): Array<OBJIOItem>;
  invokeMethod?(obj: OBJIOItem, args: InvokeArgs): Promise<any>;
  create?(args?: any): OBJIOItem;
}

export interface OBJIOContext {
  path: string;
}

export interface OBJIOItemHolderOwner {
  save(obj: OBJIOItem): Promise<any>;
  create(obj: OBJIOItem): Promise<void>;
  getObject(id: string): Promise<OBJIOItem>;
  invoke(args: InvokeMethodArgs & {obj: OBJIOItem}): Promise<any>;
  context(): OBJIOContext;
  getUserById(userId: string): Promise<User>;
  isClient(): boolean;
}

export interface InitArgs {
  id: string;
  obj: OBJIOItem;
  version: string;
  owner: OBJIOItemHolderOwner;
}

export interface MethodsToInvoke {
  [method: string]: {
    method: (args: Object, userId: string) => any,
    rights: AccessType;
  };
}

export interface InvokeArgs {
  method: string;
  args: Object;
  userId?: string;
  onProgress?(value: number): void;
}

export interface GetJsonArgs {
  fieldFilter?: FieldFilter;
  userId?: string;
  diff?: boolean;
  skipConst?: boolean;
}

export interface UpdateSrvDataArgs {
  json: JSONObj;
  version: string;
}

export interface OBJIOEventHandler {
  onLoad(): Promise<any>;
  onCreate(): Promise<any>;
  onObjChange(): void;
  onDelete(): Promise<any>;
}

export class OBJIOItemHolder extends Publisher {
  private id: string;
  private obj: OBJIOItem;
  private owner: OBJIOItemHolderOwner;
  private methodsToInvoke: MethodsToInvoke = {};
  private eventHandler: Array<Partial<OBJIOEventHandler>> = [];

  private srvVersion: string = '';
  private srvJson: {[name: string]: string | number} = {};

  constructor(args?: InitArgs) {
    super();
    if (args)
      OBJIOItemHolder.initialize(this, args);
  }

  static initialize(holder: OBJIOItemHolder, args: InitArgs) {
    holder.id = args.id;
    holder.obj = args.obj;
    holder.srvVersion = args.version;
    holder.owner = args.owner;
  }

  isClient(): boolean {
    return this.owner.isClient();
  }

  setMethodsToInvoke(methods: MethodsToInvoke) {
    this.methodsToInvoke = methods;
  }

  getMethodsToInvoke(): MethodsToInvoke {
    return this.methodsToInvoke;
  }

  addEventHandler(handler: Partial<OBJIOEventHandler>) {
    this.eventHandler.push({...handler});
  }

  getEventHandler(): Array<Partial<OBJIOEventHandler>> {
    return this.eventHandler;
  }

  getUserById<T extends User = User>(userId: string): Promise<T> {
    return this.owner.getUserById(userId) as Promise<T>;
  }

  getID(): string {
    return this.id;
  }

  onLoaded(): Promise<any> {
    return Promise.all(this.eventHandler.filter(item => item.onLoad).map(handler => handler.onLoad()));
  }

  onCreate(): Promise<any> {
    return Promise.all(this.eventHandler.filter(item => item.onCreate).map(handler => handler.onCreate()));
  }

  onDelete(): Promise<any> {
    return Promise.all(this.eventHandler.filter(item => item.onDelete).map(handler => handler.onDelete()));
  }

  onObjChanged(): void {
    this.eventHandler.forEach(handler => handler.onObjChange && handler.onObjChange());
  }

  save(): Promise<any> {
    if (!this.owner)
      return Promise.reject('owner not defined');

    return this.owner.save(this.obj);
  }

  createObject<T extends OBJIOItem>(obj: T): Promise<void> {
    if (!this.owner)
      return Promise.reject('owner not defined');

    return this.owner.create(obj);
  }

  getObject<T extends OBJIOItem>(id: string): Promise<T> {
    return this.owner.getObject(id) as Promise<T>;
  }

  getJSON(args?: GetJsonArgs): { [key: string]: number | string } {
    args = args || {};
    const objClass: OBJIOItemClass = OBJIOItem.getClass(this.obj);
    if (objClass.saveStore) {
      return objClass.saveStore(this.obj);
    }

    const userId = args.userId;
    let field = SERIALIZE(objClass, args.fieldFilter);
    let json = {};
    Object.keys(field).forEach(name => {
      const fieldItem = field[name];
      const userCtxMap = this.obj[fieldItem.userCtx];

      let value = this.obj[name];
      if (value == null)
        return;

      let newValue: string;
      if (fieldItem.type == 'object') {
        newValue = (value as OBJIOItem).getHolder().getID();
      } else if (fieldItem.type == 'json') {
        if (userCtxMap && userCtxMap[userId])
          value = userCtxMap[userId];

        newValue = JSON.stringify(value);
      } else {
        newValue = value;
      }

      if (args.diff && this.srvJson[name] == newValue)
        return;

      if (args.skipConst && fieldItem.const)
        return;

      json[ name ] = newValue;
    });

    return json;
  }

  updateSrvData(args: UpdateSrvDataArgs): void {
    Object.keys(args.json).forEach(key => {
      this.srvJson[key] = args.json[key];
    });
    this.srvVersion = args.version;
  }

  static getFilePath(ctx: OBJIOContext, f: string): string {
    return ctx.path + f;
  }

  getFilePath(file: string): string {
    return OBJIOItemHolder.getFilePath(this.owner.context(), file);
  }

  getVersion(): string {
    return this.srvVersion;
  }

  invokeMethod(args: InvokeArgs): Promise<any> {
    if (!this.owner)
      return Promise.reject('owner not defined');

    return this.owner.invoke({
      id: this.id,
      obj: this.obj,
      methodName: args.method,
      args: args.args,
      userId: args.userId,
      onProgress: args.onProgress
    });
  }
}

let localIdCounter = 0;
export class OBJIOItem {
  holder: OBJIOItemHolder = new OBJIOItemHolder({
    id: 'loc-' + (localIdCounter++),
    obj: this,
    owner: null,
    version: ''
  });

  getHolder(): OBJIOItemHolder {
    return this.holder;
  }

  static writeToObject(args: WriteToObjectArgs): WriteToObjResult {
    const fields = SERIALIZE(this.getClass(), args.fieldFilter);
    const names = Object.keys(fields);
    let promises = Array<Promise<any>>();
    for (let n = 0; n < names.length; n++) {
      const name = names[n];
      const field = fields[ name ];
      const valueOrID = args.store[ name ];

      if (args.checkConst == true && field.const && args.obj[ name ]) {
        console.error('trying to modify constant field', this.getClass().TYPE_ID + '.' + name);
        continue;
      }

      if (field.type == 'object') {
        // it may be new fields
        if (valueOrID == null)
          continue;

        const obj = args.getObject(valueOrID);
        if (obj instanceof OBJIOItem) {
          args.obj[ name ] = obj;
        } else {
          promises.push(obj);
          obj.then(obj => args.obj[ name ] = obj);
          obj.catch( err => {
            args.obj[ name ] = null;
            console.log(err);
          });
        }
      } else if (field.type == 'json' && typeof valueOrID == 'string') {
        args.obj[ name ] = JSON.parse(valueOrID);
      } else if (valueOrID != null) {
        args.obj[ name ] = valueOrID;
      }
    }
    return Promise.all(promises);
  }

  static getRelObjIDS(store: Object, replaceID?: (id: string) => string ): GetRelObjIDSResult {
    const fields = this.getClass().SERIALIZE();
    const names = Object.keys(fields);

    const ids: Array<string> = [];
    for (let n = 0; n < names.length; n++) {
      const name = names[n];

      if (fields[ name ].type != 'object')
        continue;

      const id = store[ name ];
      if (id == null)
        continue;

      if (replaceID)
        store[name] = replaceID(id);

      if (ids.indexOf(id) != -1)
        continue;

      ids.push(id);
    }

    return ids;
  }

  static getRelObjs(obj: OBJIOItem, arr?: Array<OBJIOItem>): Array<OBJIOItem> {
    arr = arr || [];

    const fields = OBJIOItem.getClass(obj).SERIALIZE();
    Object.keys(fields).forEach(name => {
      if (fields[name].type != 'object')
        return;

      const childObj: OBJIOItem = obj[name];
      if (childObj == null || arr.indexOf(childObj) != -1)
        return;
      arr.push(childObj);
      OBJIOItem.getClass(childObj).getRelObjs(childObj, arr);
    });

    return arr;
  }

  static create(args?: any): OBJIOItem {
    const objClass: OBJIOItemClass = this.getClass();
    if (args) {
      return new (objClass as any as OBJItemConstructor)(args);
    }

    return new (objClass as any as OBJItemConstructor)();
  }

  static getClass(obj?: OBJIOItem): OBJIOItemClass {
    if (!obj)
      return this as any;
    return obj.constructor as any as OBJIOItemClass;
  }

  static invokeMethod(obj: OBJIOItem, args: InvokeArgs): Promise<any> {
    return obj.holder.invokeMethod(args);
  }
}
