import { OBJIOFactory } from './factory';
import { OBJIOStoreBase } from './store';
import {
  OBJIOItem,
  OBJIOItemHolder
} from './item';
import { Timer } from '../common/timer';
import { SerialPromise } from '../common/serial-promise';
import { OBJIOArray } from './array';
import {
  OBJIOStore,
  CreateObjectsArgs
} from './store';
import { Requestor } from '../common/requestor';

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
  private timer: Timer;
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

    return this.savePromise = new Promise((resolve, reject) => {
      this.timer && this.timer.stop();
      this.timer = new Timer(() => {
        this.saveImpl().then(() => {
          this.savePromise = null;
          resolve();
        }).catch(() => {
          this.savePromise = null;
          reject();
        });
      }).run(this.timeToSave);
    });
  }

  async saveImpl() {
    const queue = this.queue;
    this.queue = [];

    console.log('saving started', queue.length);
    const objs = await this.store.writeObjects(queue.map(item => {
      const holder = item.getHolder();
      return {
        id: holder.getID(),
        json: holder.getJSON(),
        version: holder.getVersion()
      };
    }));

    objs.items.forEach((obj, i: number) => {
      const holder = queue[i].getHolder() as OBJIOItemHolder;
      holder.updateVersion(obj.version);
    });

    this.objio.notifyOnSave(queue);
    console.log('saving complete');
  }
}

export interface Observer {
  onSave?: (saved: Array<OBJIOItem>) => void;
}

export class OBJIO {
  private factory: OBJIOFactory;
  private store: OBJIOStoreBase;
  private objectMap: { [key: string]: OBJIOItem } = {};
  private savingQueue: SavingQueue;
  private observers: Array<Observer> = Array<Observer>();

  static create(factory: OBJIOFactory, store: OBJIOStore, saveTime?: number): Promise<OBJIO> {
    let obj = new OBJIO();
    obj.store = new OBJIOStoreBase(store);
    obj.factory = factory;
    obj.savingQueue = new SavingQueue(saveTime || 100, store, obj);

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
        invoke: (obj, name, args) => this.invokeMethod(obj, name, args)
      }
    });
    this.objectMap[objId] = obj;
  }

  private saveImpl = (obj: OBJIOItem) => {
    return this.savingQueue.addToSave(obj);
  }

  getFactory(): OBJIOFactory {
    return this.factory;
  }

  getObject<T extends OBJIOItem>(id: string): T {
    return this.objectMap[id] as T;
  }

  invokeMethod(obj: OBJIOItem, name: string, args: Object): Promise<any> {
    return this.store.invokeMethod(obj.holder.getID(), name, args);
  }

  async createObject<T>(obj: OBJIOItem): Promise<T> {
    const objs = OBJIOItem.getRelObjs(obj, [obj]);
    const objsJSONMap: CreateObjectsArgs = {};
    const objsMap: { [id: string]: OBJIOItem } = {};
    objs.forEach(obj => {
      const objClass = OBJIOItem.getClass(obj);

      const holder = obj.getHolder();
      const id = holder.getID();

      objsMap[id] = obj;
      objsJSONMap[id] = {
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

    return obj as any as T;
  }

  async loadObject<T extends OBJIOItem>(id: string): Promise<T> {
    const objsMap = await this.store.readObjects(id);

    const loadObjectImpl = async (objId: string) => {
      const store = objsMap[objId];
      const objClass = this.factory.findItem(store.classId);
      let newObj: OBJIOItem;

      if (!(newObj = this.objectMap[objId])) {
        const newObjOrPromise = objClass.create(store.json);
        if (newObjOrPromise instanceof Promise) {
          newObj = await newObjOrPromise;
        } else {
          newObj = newObjOrPromise;
        }

        this.initNewObject(newObj, objId, store.version);
      }

      await objClass.loadStore({
        obj: newObj,
        store: store.json,
        getObject: loadObjectImpl
      });
      await newObj.holder.onLoaded();
      newObj.holder.updateVersion(store.version);

      return newObj;
    };

    return await loadObjectImpl(id) as T;
  }

  private updateTasks = new SerialPromise();

  updateObjects(objs: Array<{ id: string, version: string }>): Promise<Array<OBJIOItem>> {
    const writes = this.store.getWrites();
    if (writes.length)
      this.updateTasks.append(() => Promise.all(writes));

    return this.updateTasks.append(() => this.updateObjectsImpl(objs));
  }

  private async updateObjectsImpl(versions: Array<{ id: string, version: string }>): Promise<Array<OBJIOItem>> {
    console.log('updateObjects before filter', versions);
    const objs = versions.filter(item => {
      const obj = this.objectMap[item.id];
      return obj == null || obj.getHolder().getVersion() != item.version;
    });

    console.log('updateObjects', objs);

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

export function createOBJIO(factory: OBJIOFactory, store: OBJIOStore): Promise<OBJIO> {
  return OBJIO.create(factory, store);
}
