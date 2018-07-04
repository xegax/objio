import { Publisher } from '../common/publisher';

export type Tags = Array<string>;
export type Type = 'string' | 'number' | 'integer' | 'json' | 'object';
export type Field = {
  type: Type;
  classId?: string;
  tags?: Tags;      // if not defined it is suitable for all tags
};

export type FieldsMap<T = any> = {
  [key in keyof T]?: Field;
}

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
  new(json?: Object): OBJIOItem;
}

export interface LoadStoreArgs {
  fieldFilter?: FieldFilter;
  obj: OBJIOItem;
  store: Object;
  getObject: (id: string) => Promise<OBJIOItem> | OBJIOItem;
}

export type SaveStoreResult = { [key: string]: number | string };
export type LoadStoreResult = Promise<any> | void;
export type GetRelObjIDSResult = Array<string>;

export interface OBJIOItemClass {
  TYPE_ID: string;
  SERIALIZE: SERIALIZER;

  loadStore?(args: LoadStoreArgs): LoadStoreResult;
  saveStore?(obj: OBJIOItem): SaveStoreResult;
  getRelObjIDS?(store: Object, replaceID?: (id: string) => string): GetRelObjIDSResult;
  getRelObjs(obj: OBJIOItem, arr?: Array<OBJIOItem>): Array<OBJIOItem>;
  invokeMethod?(obj: OBJIOItem, name: string, args: Object): Promise<any>;
  create?(): OBJIOItem | Promise<OBJIOItem>;
}

export interface OBJIOContext {
  path: string;
  db: string;
}

export interface OBJIOItemHolderOwner {
  save(obj: OBJIOItem): Promise<any>;
  create(obj: OBJIOItem): Promise<OBJIOItem>;
  invoke(obj: OBJIOItem, name: string, args: Object): Promise<any>;
  context(): OBJIOContext;
}

export interface InitArgs {
  id: string;
  obj: OBJIOItem;
  version: string;
  owner: OBJIOItemHolderOwner;
}

export interface MethodsToInvoke {
  [method: string]: (args: Object) => any;
}

export interface OBJIOEventHandler {
  onLoaded(): Promise<any>;
  onCreate(): Promise<any>;
  onObjChanged(): void;
}

export class OBJIOItemHolder extends Publisher {
  private id: string;
  private obj: OBJIOItem;
  private owner: OBJIOItemHolderOwner;
  private methodsToInvoke: MethodsToInvoke = {};
  private eventHandler: Array<Partial<OBJIOEventHandler>> = [];

  private srvVersion: string = '';

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

  getID(): string {
    return this.id;
  }

  onLoaded(): Promise<any> {
    return Promise.all(this.eventHandler.filter(item => item.onLoaded).map(handler => handler.onLoaded()));
  }

  onCreate(): Promise<any> {
    return Promise.all(this.eventHandler.filter(item => item.onCreate).map(handler => handler.onCreate()));
  }

  onObjChanged(): void {
    this.eventHandler.filter(item => item.onObjChanged).map(handler => handler.onObjChanged());
  }

  save(): Promise<any> {
    if (!this.owner)
      return Promise.reject('owner not defined');

    return this.owner.save(this.obj);
  }

  createObject<T extends OBJIOItem>(obj: T): Promise<T> {
    if (!this.owner)
      return Promise.reject<T>('owner not defined');

    return this.owner.create(obj) as Promise<T>;
  }

  getJSON(fieldFilter?: FieldFilter): { [key: string]: number | string | Array<number | string> } {
    const objClass: OBJIOItemClass = OBJIOItem.getClass(this.obj);
    if (objClass.saveStore) {
      return objClass.saveStore(this.obj);
    }

    let field = SERIALIZE(objClass, fieldFilter);
    let json = {};
    Object.keys(field).forEach(name => {
      const value = this.obj[name];
      if (value == null)
        return;

      if (field[name].type == 'object') {
        json[name] = (value as OBJIOItem).getHolder().getID();
      } else if (field[name].type == 'json') {
        json[name] = JSON.stringify(value);
      } else {
        json[name] = value;
      }
    });

    return json;
  }

  static getFilePath(ctx: OBJIOContext, f: string): string {
    return ctx.path + f;
  }

  getDBPath(): string {
    const ctx = this.owner.context();
    return this.getFilePath(ctx.db);
  }

  getFilePath(file: string) {
    return OBJIOItemHolder.getFilePath(this.owner.context(), file);
  }

  updateVersion(version: string) {
    this.srvVersion = version;
  }

  getVersion(): string {
    return this.srvVersion;
  }

  invokeMethod(name: string, args: Object) {
    if (!this.owner)
      return Promise.reject('owner not defined');

    return this.owner.invoke(this.obj, name, args);
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

  static loadStore(args: LoadStoreArgs): LoadStoreResult {
    const fields = SERIALIZE(this.getClass(), args.fieldFilter);
    const names = Object.keys(fields);
    let promises = Array<Promise<any>>();
    for (let n = 0; n < names.length; n++) {
      const name = names[n];
      const field = fields[ name ];
      const valueOrID = args.store[ name ];

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
      OBJIOItem.getClass(childObj).getRelObjs(childObj, arr);
      arr.push(childObj);
    });

    return arr;
  }

  static create(): OBJIOItem | Promise<OBJIOItem> {
    const objClass: OBJIOItemClass = this.getClass();
    return new (objClass as any as OBJItemConstructor)();
  }

  static getClass(obj?: OBJIOItem): OBJIOItemClass {
    if (!obj)
      return this as any;
    return obj.constructor as any as OBJIOItemClass;
  }

  static invokeMethod(obj: OBJIOItem, name: string, args: Object): Promise<any> {
    return obj.holder.invokeMethod(name, args);
  }
}
