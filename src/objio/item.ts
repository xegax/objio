import { Publisher } from '../common/publisher';
import { InvokeMethodArgs, JSONObj } from './store';
import { UserObjectBase, AccessType } from '../base/user-object';
import { ITaskManager } from '../server/task-manager';
import { FileDesc } from '../base/file-system';
import { TaskBase } from '../base/task';

export type Tags = Array<string>;
export type Type = 'string' | 'number' | 'integer' | 'json' | 'object' | 'object-deferred';
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
  writeDeffered?: boolean;
  userId: string;
  fieldFilter?: FieldFilter;
  obj: OBJIOItem;
  store: Object;
  getObject: (id: string) => Promise<OBJIOItem> | OBJIOItem;
}

export type SaveStoreResult = { [key: string]: number | string };
export type WriteToObjResult = Promise<any> | void;
export type GetRelObjIDSResult = Array<string>;

export interface GetRelObjIDSArgs {
  store: Object;
  skipDeferred?: boolean;
  mapID?(id: string): string;
}

export interface OBJIOItemClass {
  TYPE_ID: string;
  SERIALIZE: SERIALIZER;

  writeToObject?(args: WriteToObjectArgs): WriteToObjResult;
  saveStore?(obj: OBJIOItem): SaveStoreResult;
  getRelObjIDS?(args: GetRelObjIDSArgs): GetRelObjIDSResult;
  getRelObjs(obj: OBJIOItem, arr?: Array<OBJIOItem>): Array<OBJIOItem>;
  invokeMethod?(obj: OBJIOItem, args: InvokeArgs): Promise<any>;
  create?(args?: any): OBJIOItem;
}

export interface OBJIOContext {
  objectsPath: string;    // path to private data
  filesPath: string;      // path to public data
  getTaskManager?(): ITaskManager;
}

export interface OBJIOItemHolderOwner {
  save(obj: OBJIOItem, force?: boolean): Promise<any>;
  create(obj: OBJIOItem): Promise<void>;
  getObject(id: string): Promise<OBJIOItem>;
  invoke(args: InvokeMethodArgs & {obj: OBJIOItem}): Promise<any>;
  context(): OBJIOContext;
  getUserById(userId: string): Promise<UserObjectBase>;
  isClient(): boolean;
  pushTask<T = any>(task: TaskBase, userId: string): Promise<T>;
}

export interface InitArgs {
  id: string;
  obj: OBJIOItem;
  version: string;
  owner: OBJIOItemHolderOwner;
}

export interface SendFileInvoke {
  'sendFile': {
    method: (args: Object, userId: string) => any,
    rights: AccessType
  };
}

export interface MethodsToInvoke {
  [method: string]: {
    method: (args: Object, userId: string, user: UserObjectBase) => any,
    rights: AccessType
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

export interface UploadArgs {
  userId: string;
  key: string;
  path: string;
  file: FileDesc;
}

export interface OBJIOEventHandler {
  onLoad(): Promise<any>;
  onCreate(userId?: string): Promise<any>;
  onUpload(args: UploadArgs): void;
  onObjChange(): void;
  onDelete(): Promise<any>;
}

export const eventType = {
  invokesInProgress: 'invokesInProgress'
};

export class OBJIOItemHolder extends Publisher {
  private id: string;
  private obj: OBJIOItem;
  private owner: OBJIOItemHolderOwner;
  private methodsToInvoke: (MethodsToInvoke | SendFileInvoke) = {};
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

  pushTask<T = any>(task: TaskBase, userId: string) {
    if (this.isClient())
      return Promise.reject('pushTask is allowed only for server side');

    return this.owner.pushTask<T>(task, userId);
  }

  setMethodsToInvoke(methods: MethodsToInvoke) {
    this.methodsToInvoke = methods;
  }

  getMethodsToInvoke(): MethodsToInvoke | SendFileInvoke {
    return this.methodsToInvoke;
  }

  addEventHandler(handler: Partial<OBJIOEventHandler>) {
    if (this.eventHandler.indexOf(handler) == -1)
      this.eventHandler.push(handler);
  }

  removeEventHandler(handler: Partial<OBJIOEventHandler>) {
    this.eventHandler.splice(this.eventHandler.indexOf(handler), 1);
  }

  getEventHandler(): Array<Partial<OBJIOEventHandler>> {
    return this.eventHandler;
  }

  getUserById(userId: string): Promise<UserObjectBase> {
    return this.owner.getUserById(userId) as Promise<UserObjectBase>;
  }

  getID(): string {
    return this.id;
  }

  onLoaded(): Promise<any> {
    return Promise.all(this.eventHandler.filter(item => item.onLoad).map(handler => handler.onLoad()));
  }

  onCreate(userId?: string): Promise<any> {
    return Promise.all(this.eventHandler.filter(item => item.onCreate).map(handler => handler.onCreate(userId)));
  }

  onUpload(args: UploadArgs): void {
    this.eventHandler.filter(item => item.onUpload).map(handler => handler.onUpload(args));
  }

  onDelete(): Promise<any> {
    return Promise.all(this.eventHandler.filter(item => item.onDelete).map(handler => handler.onDelete()));
  }

  onObjChanged(): void {
    this.eventHandler.forEach(handler => handler.onObjChange && handler.onObjChange());
  }

  save(force?: boolean): Promise<any> {
    // it is ok, after create a local copy some fields can be modified
    if (!this.owner)
      return;

    return this.owner.save(this.obj, force);
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
      if (fieldItem.type == 'object' || fieldItem.type == 'object-deferred') {
        if (value instanceof OBJIOItem) {
          newValue = (value as OBJIOItem).holder.getID();
        } else {
          newValue = value;
        }
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

  static getPublicPath(ctx: OBJIOContext, f: string): string {
    return ctx.filesPath + f;
  }

  static getPrivatePath(ctx: OBJIOContext, f: string): string {
    return ctx.objectsPath + f;
  }

  getPublicPath(file: string): string {
    return OBJIOItemHolder.getPublicPath(this.owner.context(), file);
  }

  getPrivatePath(file: string): string {
    return OBJIOItemHolder.getPrivatePath(this.owner.context(), file);
  }

  getVersion(): string {
    return this.srvVersion;
  }

  protected invokesInProgress: number = 0;

  protected addInvokesCounter(add: number) {
    this.invokesInProgress = Math.max(0, this.invokesInProgress + add);
    this.delayedNotify({ type: eventType.invokesInProgress });
  }

  getInvokesInProgress(): number {
    return this.invokesInProgress;
  }

  invokeMethod<T = any>(args: InvokeArgs): Promise<T> {
    if (!this.owner)
      throw 'owner not defined';

    const p = this.owner.invoke({
      id: this.id,
      obj: this.obj,
      methodName: args.method,
      args: args.args,
      userId: args.userId,
      onProgress: args.onProgress
    }).finally(() => {
      this.addInvokesCounter(-1);
    });

    this.addInvokesCounter(1);

    return p;
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

  getInvokesInProgress(): number {
    return this.holder.getInvokesInProgress();
  }

  // restore object from store
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

      if (field.type == 'object' || field.type == 'object-deferred') {
        // it may be new fields
        if (valueOrID == null)
          continue;

        if (!args.writeDeffered && field.type == 'object-deferred') {
          args.obj[name] = valueOrID;
          continue;
        }

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

  static getRelObjIDS(args: GetRelObjIDSArgs ): GetRelObjIDSResult {
    const fields = this.getClass().SERIALIZE();
    const names = Object.keys(fields);

    const ids: Array<string> = [];
    for (let n = 0; n < names.length; n++) {
      const name = names[n];

      if (fields[ name ].type != 'object' && fields[ name ].type != 'object-deferred')
        continue;

      if (args.skipDeferred && fields[name].type == 'object-deferred')
        continue;

      const id = args.store[ name ];
      if (id == null)
        continue;

      if (args.mapID)
        args.store[name] = args.mapID(id);

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
      if (fields[name].type != 'object' && fields[name].type != 'object-deferred')
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
}
