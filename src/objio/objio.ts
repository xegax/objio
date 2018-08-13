import { OBJIOFactory } from './factory';
import { OBJIOStoreBase } from './store';
import {
  OBJIOItem,
  OBJIOItemHolder,
  OBJIOContext
} from './item';
import { SerialPromise } from '../common/serial-promise';
import { OBJIOArray } from './array';
import {
  ReadResult,
  OBJIOStore,
  CreateObjectsArgs
} from './store';
import { Requestor } from '../common/requestor';
import { timer } from '../common/promise';

export interface WatchResult {
  subscribe(f: (arr: Array<OBJIOItem>) => void);
  unsubscribe(f: () => void);
  stop();
}

export interface WatchArgs {
  req: Requestor;
  timeOut: number;
  baseUrl?: string;
}

class SavingQueue {
  private queue = Array<OBJIOItem>();
  private timeToSave: number = 0;
  private store: OBJIOStore;
  private savePromise: Promise<any>;
  private objio: OBJIO;

  constructor(timeToSave: number, store: OBJIOStore, objio: OBJIO) {
    this.timeToSave = timeToSave;
    this.store = store;
    this.objio = objio;
  }

  addToSave(obj: OBJIOItem) {
    if (this.queue.indexOf(obj) == -1)
      this.queue.push(obj);

    if (this.timeToSave == 0)
      return this.saveImpl();

    if (this.savePromise)
      return this.savePromise;

    return this.savePromise = timer(this.timeToSave).then(() => {
      return this.saveImpl().then(() => {
        this.savePromise = null;
      });
    });
  }

  saveImpl(): Promise<any> {
    const queue = this.queue;
    this.queue = [];

    console.log('saving', queue.length, 'objects');
    return this.store.writeObjects(queue.map(item => {
      const holder = item.getHolder();
      return {
        id: holder.getID(),
        json: holder.getJSON(),
        version: holder.getVersion()
      };
    })).then(objs => {
      objs.items.forEach((obj, i: number) => {
        const holder = queue[i].getHolder() as OBJIOItemHolder;
        holder.updateVersion(obj.version);
      });

      this.objio.notifyOnSave(queue);
    });
  }
}

export interface Observer {
  onSave?: (saved: Array<OBJIOItem>) => void;
}

export interface OBJIOArgs {
  factory: OBJIOFactory;
  store: OBJIOStore;
  saveTime?: number;
  context?: OBJIOContext;
}

export class OBJIO {
  private factory: OBJIOFactory;
  private store: OBJIOStoreBase;
  private objectMap: { [key: string]: OBJIOItem } = {};
  private savingQueue: SavingQueue;
  private observers: Array<Observer> = Array<Observer>();
  private context: OBJIOContext = {
    path: '',
    db: 'db'
  };

  static create(args: OBJIOArgs): Promise<OBJIO> {
    let obj = new OBJIO();
    obj.store = new OBJIOStoreBase(args.store);
    obj.factory = args.factory;
    obj.savingQueue = new SavingQueue(args.saveTime || 100, args.store, obj);
    obj.context = {...obj.context, ...(args.context || {})};

    return Promise.resolve(obj);
  }

  addObserver(obj: Observer) {
    if (this.observers.indexOf(obj) == -1)
      this.observers.push(obj);
  }

  getWrites() {
    return this.store.getWrites();
  }

  notifyOnSave(saved: Array<OBJIOItem>) {
    this.observers.forEach(item => {
      try {
        item.onSave && item.onSave(saved);
      } catch (e) {
        console.log(e);
      }
    });
  }

  private initNewObject(obj: OBJIOItem, objId: string, version: string) {
    OBJIOItemHolder.initialize(obj.holder, {
      obj,
      id: objId,
      version,
      owner: {
        save: obj => this.saveImpl(obj),
        create: obj => this.createObject(obj),
        invoke: (obj, name, args) => this.invokeMethod(obj, name, args),
        context: () => this.context,
        getObject: id => this.loadObject(id)
      }
    });
    this.objectMap[objId] = obj;
  }

  private saveImpl = (obj: OBJIOItem) => {
    return this.savingQueue.addToSave(obj);
  }

  getContext(): OBJIOContext {
    return this.context;
  }

  getFactory(): OBJIOFactory {
    return this.factory;
  }

  getObject<T extends OBJIOItem>(id: string): T {
    return this.objectMap[id] as T;
  }

  getObjectsMap(): { [id: string]: OBJIOItem } {
    return this.objectMap;
  }

  invokeMethod(obj: OBJIOItem, name: string, args: Object): Promise<any> {
    return this.store.invokeMethod(obj.holder.getID(), name, args);
  }

  removeObjs(ids: Set<string>): Promise<any> {
    let removeTask: Promise<any> = Promise.resolve();
    ids.forEach(id => {
      const obj = this.objectMap[id];
      if (!obj)
        return;

      obj.holder.getEventHandler().forEach(h => {
        if (!h.onDelete)
          return;

        removeTask = removeTask.then(() => h.onDelete());
      });

      removeTask = removeTask.then(() => {
        delete this.objectMap[id];
      });
    });

    removeTask = removeTask.then(() => this.store.removeObjs(ids));
    return removeTask;
  }

  findLinkedObjs(): Promise<Set<string>> {
    const usedObjs = new Set<string>();
    function checkChildren(parent: OBJIOItem) {
      if (usedObjs.has(parent.holder.getID()))
        return;

      usedObjs.add(parent.holder.getID());

      const objClass = OBJIOItem.getClass(parent);
      const arr = objClass.getRelObjs(parent);
      arr.forEach(obj => checkChildren(obj));
    }

    return this.loadObject('0').then(obj => {
      checkChildren(obj);
      return usedObjs;
    });
  }

  async createObject<T>(obj: OBJIOItem): Promise<T> {
    const objs = OBJIOItem.getRelObjs(obj, [obj]);
    const objsJSONMap: CreateObjectsArgs = {
      rootId: obj.holder.getID(),
      objs: {}
    };
    const objsMap: { [id: string]: OBJIOItem } = {};
    objs.forEach(obj => {
      const objClass = OBJIOItem.getClass(obj);

      const holder = obj.getHolder();
      const id = holder.getID();

      objsMap[id] = obj;
      objsJSONMap.objs[id] = {
        classId: objClass.TYPE_ID,
        json: holder.getJSON()
      };
    });

    const res = await this.store.createObjects(objsJSONMap);

    Object.keys(res).forEach(id => {
      const obj = objsMap[id];
      const item = res[id];
      this.initNewObject(obj, item.newId, item.version);
    });

    await Promise.all(Object.keys(res).map(id => objsMap[id].holder.onCreate()));
    return obj as any as T;
  }

  loadObject<T extends OBJIOItem>(id?: string): Promise<T> {
    id = id || '0';

    if (id.startsWith('loc-'))
      return Promise.reject();

    if (this.objectMap[id])
      return Promise.resolve(this.objectMap[id] as T);

    const loadObjectImpl = (objId: string, objsMap: ReadResult) => {
      const store = objsMap[objId];
      const objClass = this.factory.findItem(store.classId);
      let newObj: OBJIOItem;

      if (!(newObj = this.objectMap[objId])) {
        newObj = objClass.create();
        this.initNewObject(newObj, objId, store.version);
      }

      return Promise.resolve(objClass.loadStore({
        obj: newObj,
        store: store.json,
        getObject: (id: string) => loadObjectImpl(id, objsMap)
      })).then(() => {
        newObj.holder.updateVersion(store.version);
        return newObj;
      });
    };

    let res: ReadResult;
    let resObj: T;
    return (
      this.store.readObjects(id)
      .then(objsMap => {
        res = objsMap;
        return loadObjectImpl(id, objsMap) as T;
      }).then(obj => {
        resObj = obj;
        return Promise.all(Object.keys(res).map(id => 
          this.objectMap[id].holder.onLoaded()
        ));
      }).then(() => resObj)
    );
  }

  private updateTasks = new SerialPromise();

  updateObjects(objs: Array<{ id: string, version: string }>): Promise<Array<OBJIOItem>> {
    const writes = this.store.getWrites();
    if (writes.length)
      this.updateTasks.append(() => Promise.all(writes));

    return this.updateTasks.append(() => this.updateObjectsImpl(objs));
  }

  private async updateObjectsImpl(versions: Array<{ id: string, version: string }>): Promise<Array<OBJIOItem>> {
    const objs = versions.filter(item => {
      const obj = this.objectMap[item.id];
      return obj == null || obj.getHolder().getVersion() != item.version;
    });

    const updateObject = async (item: { id: string, version: string }) => {
      const obj = this.objectMap[item.id];
      if (!obj) {
        await this.loadObject(item.id);
        return { id: item.id, json: null };
      }

      const res = await this.store.readObject(item.id);
      const { classId, version, json } = res[item.id];
      const objClass = this.factory.findItem(classId);
      const extraObjs = objClass.getRelObjIDS(json).filter(id => this.objectMap[id] == null);
      if (extraObjs.length)
        await Promise.all(extraObjs.map(id => this.loadObject(id)));

      await objClass.loadStore({
        obj,
        getObject: id => this.objectMap[id] || this.loadObject(id),
        store: json
      });
      obj.holder.updateVersion(version);
      obj.holder.onObjChanged();
      obj.holder.notify();

      return { id: item.id, json };
    };

    const jsonArr = await Promise.all(objs.map(updateObject));

    jsonArr.forEach(item => {
      if (item.json == null)
        return;

      const obj = this.objectMap[item.id];
      OBJIOItem.getClass(obj).loadStore({
        obj,
        store: item.json,
        getObject: id => this.objectMap[id]
      });
    });

    return objs.map(item => this.objectMap[item.id]);
  }

  startWatch(args: WatchArgs): WatchResult {
    const baseUrl = args.baseUrl || 'objio/watcher/';
    const timeOut = args.timeOut;
    const req = args.req;

    let prev = { version: -1 };
    let run = true;
    let subscribers = Array<(arr: Array<OBJIOItem>) => void>();

    const loop = async () => {
      if (!run)
        return;

      let w: { version: number };
      try {
        w = await req.getJSON<{ version: number }>({url: `${baseUrl}version`, postData: prev});
      } catch (e) {
        return setTimeout(loop, timeOut);
      }

      if (prev && w.version == prev.version)
        return setTimeout(loop, timeOut);

      await this.getWrites();

      prev = w;
      const items = await req.getJSON<Array<{ id: string, version: string }>>({url: `${baseUrl}items`});
      const res = await this.updateObjects(items);

      subscribers.forEach(s => {
        try {
          s(res);
        } catch (e) {
          console.log(e);
        }
      });

      setTimeout(loop, timeOut);
    };

    loop();

    return {
      stop: () => run = false,
      subscribe: (f: (arr: Array<OBJIOArray>) => void) => {
        subscribers.indexOf(f) == -1 && subscribers.push(f);
      },
      unsubscribe: f => {
        subscribers.splice(subscribers.indexOf(f), 1);
      }
    };
  }
}

export function createOBJIO(args: OBJIOArgs): Promise<OBJIO> {
  return OBJIO.create(args);
}
