declare module 'objio' {
  type Type = 'string' | 'number' | 'integer' | 'json' | 'object';
  type SERIALIZER = () => {[key: string]: {type: Type; classId?: string}};

  interface LoadStoreArgs {
    obj: OBJIOItem;
    store: {arr: Array<string>};
    getObject: (id: string) => OBJIOItem;
  }

  interface WriteResult {
    items: Array<{id: string, json: Object, version: string}>;
    removed: Array<string>;
  }

  interface ReadResult {
    [id: string]: {classId: string; version: string; json: Object};
  }
  
  interface CreateResult {
    [id: string]: {
      newId: string;
      json: Object;
      version: string;
    }
  }

  type CreateObjectsArgs = {[id: string]: {classId: string, json: Object}};
  type WriteObjectsArgs = Array<{id: string, json: Object, version: string}>;

  class OBJIOStore {
    createObjects(args: CreateObjectsArgs): Promise<CreateResult>;
    writeObjects(args: WriteObjectsArgs): Promise<WriteResult>;

    // read all objects tree
    readObjects(id: string): Promise<ReadResult>;
    
    // read only one object
    readObject(id: string): Promise<ReadResult>;

    methodInvoker(id: string, method: string, args: Object): Promise<any>;
  }

  class OBJIOLocalStore extends OBJIOStore {
    constructor(factory: OBJIOFactory);

    saveAll(clone?: boolean): Object;
    loadAll(ob: Object);

    saveStoreState(): Object;
    loadStoreState(obj: Object);

    hasObject(id: string): boolean;
    getObjectData(id: string): Object;
    setObjectData(id: string, data: Object);
  }

  interface Requestor {
    getJSON<T>(url: string, params?: Object): Promise<T>;
    sendJSON<T>(url: string, params?: Object, postData?: Object): Promise<T>;
  }

  interface OBJIORemoteStoreArgs {
    root?: string;
    prj?: string;
    req: Requestor;
  }

  class OBJIORemoteStore extends OBJIOStore {
    constructor(args: OBJIORemoteStoreArgs);
  }

  interface Observer {
    onSave?: () => void;
  }

  interface WatchResult {
    subscribe(f: (arr: Array<OBJIOItem>) => void);
    unsubscribe(f: () => void);
    stop();
  }

  interface WatchArgs {
    req: Requestor;
    timeOut: number;
    baseUrl?: string;
    prj?: string;
  }

  interface OBJIO {
    createObject<T extends OBJIOItem>(objOrClass: OBJIOItem | string): Promise<T>;
    loadObject<T extends OBJIOItem>(id: string): Promise<T>;
    updateObjects(objs: Array<{id: string, version: string}>): Promise<Array<OBJIOItem>>;

    getFactory(): OBJIOFactory;
    addObserver(obj: Observer);
    getWrites(): Array<Promise<any>>;

    startWatch(args: WatchArgs): WatchResult;
  }

  class OBJIOItem {
    getHolder(): OBJIOItemHolder;
  }

  class OBJIOArray<T = OBJIOItem> extends OBJIOItem {
    getLength(): number;
    get(n: number): T;
    remove(n: number);
    push(item: T): OBJIOItemHolder;
    insert(item: T, n: number): OBJIOItemHolder;
    find(f: ((v: T) => boolean) | T): number;
  }

  interface OBJIOItemHolder extends Publisher {
    getID(): string;
    save(): Promise<any>;
    getJSON(): Object;
    getVersion(): string;
  }

  interface OBJIOItemClass {
    TYPE_ID: string;
    SERIALIZE: SERIALIZER;
    loadStore?: (args: LoadStoreArgs) => void;
    saveStore?: (obj: OBJIOItem) => {[key: string]: number | string | Array<number|string>};
    getIDSFromStore?: (store: Object) => Array<string>;
  }

  interface OBJIOFactory {
    registerItem(itemClass: OBJIOItemClass);
    findItem(objType: string): OBJIOItemClass;
  }

  class Publisher {
    subscribe(o: () => void);
    unsubscribe(o: () => void);
  
    notify();
  }
  

  function createLocalStore(factory: OBJIOFactory): Promise<OBJIOLocalStore>;

  function createOBJIO(factory: OBJIOFactory, store: OBJIOStore): Promise<OBJIO>;
  function createFactory(): Promise<OBJIOFactory>;
}
