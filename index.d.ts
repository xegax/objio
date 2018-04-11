declare module 'objio' {
  type Type = 'string' | 'number' | 'integer' | 'json' | 'object';
  type SERIALIZER = () => {[key: string]: {type: Type; classId?: string}};

  interface LoadStoreArgs {
    obj: OBJIOItem;
    store: {arr: Array<string>};
    getObject: (id: string) => OBJIOItem;
  }

  interface WriteResult {
    items: Array<CreateResult>;
    removed: Array<string>;
  }

  interface ReadResult {
    [id: string]: {classId: string; version: string; json: Object};
  }
  
  interface CreateResult {
    id: string;
    json: Object;
    version: string;
  }

  type CreateObjectsArgs = Array<{classId: string, json: Object}>;
  type WriteObjectsArgs = Array<{id: string, json: Object, version: string}>;

  class OBJIOStore {
    createObjects(args: CreateObjectsArgs): Promise<Array<CreateResult>>;
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
    sendJSON<T>(url: string, params?: Object, postData?: Object): Promise<T>;
  }

  class OBJIORemoteStore extends OBJIOStore {
    constructor(requestor: Requestor, root?: string);
  }

  interface Observer {
    onSave?: () => void;
  }

  interface OBJIO {
    createObject<T extends OBJIOItem>(objOrClass: OBJIOItem | string): Promise<T>;
    loadObject<T extends OBJIOItem>(id: string): Promise<T>;
    updateObjects(objs: Array<{id: string, version: string}>): Promise<Array<OBJIOItem>>;

    getFactory(): OBJIOFactory;
    addObserver(obj: Observer);
    getWrites(): Array<Promise<any>>;
  }

  class OBJIOItem {
    getHolder(): OBJIOItemHolder;
  }

  class OBJIOArray<T = OBJIOItem> extends OBJIOItem {
    getLength(): number;
    get(n: number): T;
    remove(n: number);
    push(item: T);
  }

  interface OBJIOItemHolder {
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

  function createLocalStore(factory: OBJIOFactory): Promise<OBJIOLocalStore>;

  function createOBJIO(factory: OBJIOFactory, store: OBJIOStore): Promise<OBJIO>;
  function createFactory(): Promise<OBJIOFactory>;
}
