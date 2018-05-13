import { OBJIOFactory } from './factory';
import { OBJIOStoreBase } from './store';
import {
  OBJIOItem,
  OBJIOItemClass,
  OBJIOItemHolder,
  findAllObjFields
} from './item';
import { Timer } from '../common/timer';
import { SerialPromise } from '../common/serial-promise';
import { OBJIOArray } from './array';
import {
  OBJIOStore,
  CreateObjectsArgs
} from './store';
import { Requestor } from './common';

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
    let queue = this.queue;
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

    this.objio.notifyOnSave();
    console.log('saving complete');
  }
}

export interface Observer {
  onSave?: () => void;
}

export class OBJIO {
  private factory: OBJIOFactory;
  private store: OBJIOStoreBase;
  private objectMap: { [key: string]: OBJIOItem } = {};
  private savingQueue: SavingQueue;
  private observers: Array<Observer> = Array<Observer>();

  static create(factory: OBJIOFactory, store: OBJIOStore): Promise<OBJIO> {
    let obj = new OBJIO();
    obj.store = new OBJIOStoreBase(store);
    obj.factory = factory;
    obj.savingQueue = new SavingQueue(100, store, obj);

    return Promise.resolve(obj);
  }

  addObserver(obj: Observer) {
    if (this.observers.indexOf(obj) == -1)
      this.observers.push(obj);
  }

  getWrites() {
    return this.store.getWrites();
  }

  notifyOnSave() {
    this.observers.forEach(item => {
      try {
        item.onSave && item.onSave();
      } catch (e) {
        console.log(e);
      }
    });
  }

  private initNewObject(obj: OBJIOItem, objId: string, version: string) {
    obj.holder = new OBJIOItemHolder({
      obj,
      id: objId,
      version,
      saveImpl: this.saveImpl
    });
    this.objectMap[objId] = obj;
  }

  private saveImpl = (obj: OBJIOItem) => {
    return this.savingQueue.addToSave(obj);
  }

  getFactory(): OBJIOFactory {
    return this.factory;
  }

  async createObject<T>(objOrClass: OBJIOItem | string): Promise<T> {
    let obj: OBJIOItem;
    if (typeof objOrClass == 'string') {
      const objClass = this.factory.findItem(objOrClass) as any;
      obj = OBJIOItem.create(objClass);
    } else {
      obj = objOrClass;
    }

    const objs = findAllObjFields(obj, [obj]);
    const objsJSONMap: CreateObjectsArgs = {};
    const objsMap: { [id: string]: OBJIOItem } = {};
    objs.forEach(obj => {
      const objClass = obj.constructor as any as OBJIOItemClass;

      const holder = obj.getHolder();
      const id = obj.getHolder().getID();

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

    const loadObjectImpl = (objId: string) => {
      const store = objsMap[objId];
      const objClass = this.factory.findItem(store.classId);
      let newObj: OBJIOItem;

      if (!(newObj = this.objectMap[objId])) {
        newObj = OBJIOItem.create(objClass);
        this.initNewObject(newObj, objId, store.version);
      }

      objClass.loadStore({
        obj: newObj,
        store: store.json,
        getObject: loadObjectImpl
      });
      newObj.getHolder().updateVersion(store.version);

      return newObj;
    };

    return loadObjectImpl(id) as T;
  }

  private updateTasks = new SerialPromise();

  updateObjects(objs: Array<{ id: string, version: string }>): Promise<Array<OBJIOItem>> {
    const writes = this.store.getWrites();
    if (writes.length)
      this.updateTasks.append(() => Promise.all(writes));

    return this.updateTasks.append(() => this.updateObjectsImpl(objs));
  }

  private async updateObjectsImpl(objs: Array<{ id: string, version: string }>): Promise<Array<OBJIOItem>> {
    objs = objs.filter(item => {
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

      objClass.loadStore({
        obj,
        getObject: id => this.loadObject(id),
        store: json
      });
      obj.getHolder().updateVersion(version);
      obj.getHolder().notify();

      return { id: item.id, json };
    };

    const jsonArr = await Promise.all(objs.map(updateObject));

    jsonArr.forEach(item => {
      if (item.json == null)
        return;

      const obj = this.objectMap[item.id];
      const { loadStore } = OBJIOItem.getClass(obj);
      loadStore({
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
        w = await req.sendJSON<{ version: number }>(`${baseUrl}version`, {}, prev);
      } catch (e) {
        return setTimeout(loop, timeOut);
      }

      if (prev && w.version == prev.version)
        return setTimeout(loop, timeOut);

      await this.getWrites();

      prev = w;
      const items = await req.getJSON<Array<{ id: string, version: string }>>(`${baseUrl}items`, {});
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
