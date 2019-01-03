import { OBJIOFactory } from './factory';
import { OBJIOStoreBase, InvokeMethodArgs } from './store';
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
import { UserObject } from '../object/client/user-object';

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

    return (
      this.savePromise = Promise.delay(this.timeToSave)
      .then(() => {
        return this.saveImpl().then(() => {
          this.savePromise = null;
        });
      })
    );
  }

  saveImpl(): Promise<any> {
    const queue = this.queue;
    this.queue = [];

    const arr = queue.map(item => {
      return {
        id: item.holder.getID(),
        json: item.holder.getJSON({diff: true, skipConst: true}),
        version: item.holder.getVersion()
      };
    }).filter(item => Object.keys(item.json).length != 0);

    if (arr.length == 0)
      return Promise.resolve();

    console.log('saving', queue.length, 'objects');
    return (
      this.store.writeObjects({ arr })
      .then(objs => {
        objs.items.forEach((obj, i: number) => {
          queue[i].holder.updateSrvData({
            json: queue[i].holder.getJSON(), // obj.json,
            version: obj.version
          });
        });

        this.objio.notifyOnSave(queue);
      })
    );
  }
}

export type ErrorType = 'invoke' | 'loadObject' | 'createObject';
export interface ErrorArgs {
  type: ErrorType;
  error: any;
  obj?: OBJIOItem;
  args?: any;
}

export type ErrorHandler = (args: ErrorArgs) => void;

export interface Observer {
  onSave?: (saved: Array<OBJIOItem>) => void;
}

export interface OBJIOArgs {
  factory: OBJIOFactory;
  store: OBJIOStore;
  saveTime?: number;
  context?: OBJIOContext;
  server?: boolean;
  getUserById?: (userId: string) => Promise<UserObject>;
}

export class OBJIO {
  private factory: OBJIOFactory;
  private store: OBJIOStoreBase;
  private objectMap: { [key: string]: OBJIOItem } = {};
  private savingQueue: SavingQueue;
  private observers: Array<Observer> = Array<Observer>();
  private context: OBJIOContext = {
    filesPath: '',
    objectsPath: ''
  };
  private errorHandler: ErrorHandler;
  private server: boolean = false;
  private getUserByIdImpl: (userId: string) => Promise<UserObject>;

  static create(args: OBJIOArgs): Promise<OBJIO> {
    let obj = new OBJIO();
    obj.store = new OBJIOStoreBase(args.store);
    obj.factory = args.factory;
    obj.savingQueue = new SavingQueue(args.saveTime || 100, args.store, obj);
    obj.context = {...obj.context, ...(args.context || {})};
    obj.server = args.server == true;
    obj.getUserByIdImpl = args.getUserById;

    return Promise.resolve(obj);
  }

  addObserver(obj: Observer) {
    if (this.observers.indexOf(obj) == -1)
      this.observers.push(obj);
  }

  setErrorHandler(handler: ErrorHandler): void {
    this.errorHandler = handler;
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
        invoke: args => this.invokeMethod(args),
        context: () => this.context,
        getObject: id => this.loadObject(id),
        getUserById: (userId: string) => this.getUserById(userId),
        isClient: () => this.isClient()
      }
    });
    this.objectMap[objId] = obj;
  }

  private saveImpl = (obj: OBJIOItem) => {
    return this.savingQueue.addToSave(obj);
  }

  getUserById(userId: string): Promise<UserObject> {
    if (!this.getUserByIdImpl)
      return Promise.reject('getUserById not defined');

    return Promise.resolve(this.getUserByIdImpl(userId));
  }

  isClient(): boolean {
    return !this.server;
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

  invokeMethod(args: InvokeMethodArgs & { obj: OBJIOItem }): Promise<any> {
    const { obj, ...invokeArgs } = args;
    return (
      this.store.invokeMethod(invokeArgs)
      .catch(error => {
        if (!this.errorHandler)
          return;

        this.errorHandler({
          type: 'invoke',
          error,
          obj,
          args: { method: name, args: args.args }
        });
      })
    );
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

  createObject(obj: OBJIOItem, userId?: string): Promise<void> {
    const objs = OBJIOItem.getRelObjs(obj, [obj]);
    const objsJSONMap: CreateObjectsArgs = {
      userId,
      rootId: obj.holder.getID(),
      objs: {}
    };
    const objsMap: { [id: string]: OBJIOItem } = {};
    objs.forEach(obj => {
      if (!obj.holder.getID().startsWith('loc-'))
        return;

      const objClass = OBJIOItem.getClass(obj);

      const holder = obj.holder;
      const id = holder.getID();

      objsMap[id] = obj;
      objsJSONMap.objs[id] = {
        classId: objClass.TYPE_ID,
        json: holder.getJSON()
      };
    });

    return (
      this.store.createObjects(objsJSONMap)
      .then(res => {
        Object.keys(res).forEach(id => {
          const obj = objsMap[id];
          const item = res[id];
          this.initNewObject(obj, item.newId, item.version);
        });

        return Promise.all(Object.keys(res).map(id => objsMap[id].holder.onCreate(userId)));
      })
      .then(() => null)
      .catch(error => {
        this.errorHandler && this.errorHandler({
          type: 'createObject',
          error,
          args: { obj: OBJIOItem.getClass(obj).TYPE_ID }
        });

        return Promise.reject(error);
      })
    );
  }

  loadObject<T extends OBJIOItem>(id?: string, userId?: string): Promise<T> {
    id = id || '0';

    if (id.startsWith('loc-')) {
      const error = `local object id=${id} detected`;
      this.errorHandler && this.errorHandler({ type: 'loadObject', error, args: { id } });
      return Promise.reject(error);
    }

    if (this.objectMap[id])
      return Promise.resolve(this.objectMap[id] as T);

    const loadObjectImpl = (objId: string, objsMap: ReadResult) => {
      if (this.objectMap[objId])
        return Promise.resolve(this.objectMap[objId]);

      const store = objsMap[objId];
      const objClass = this.factory.findItem(store.classId);
      let newObj: OBJIOItem;

      if (!(newObj = this.objectMap[objId])) {
        newObj = objClass.create();
        this.initNewObject(newObj, objId, store.version);
      }

      return Promise.resolve(objClass.writeToObject({
        userId,
        obj: newObj,
        store: store.json,
        getObject: (id: string) => loadObjectImpl(id, objsMap)
      })).then(() => {
        newObj.holder.updateSrvData({ json: store.json, version: store.version });
        return newObj;
      }).catch(error => {
        this.errorHandler && this.errorHandler({ type: 'loadObject', error, args: { id } });
        return Promise.reject(error);
      });
    };

    let res: ReadResult;
    let resObj: T;
    return (
      this.store.readObjects({ id, userId })
      .then(objsMap => {
        res = objsMap;
        return loadObjectImpl(id, objsMap) as T;
      }).then(obj => {
        resObj = obj;
        return Promise.all(Object.keys(res).map(id => this.objectMap[id].holder.onLoaded()));
      }).then(() => resObj)
      .catch(error => {
        this.errorHandler && this.errorHandler({ type: 'loadObject', error, args: { id } });
        return Promise.reject(error);
      })
    );
  }

  private updateTasks = new SerialPromise();

  updateObjects(objs: Array<{ id: string, version: string }>): Promise<Array<OBJIOItem>> {
    const writes = this.store.getWrites();
    if (writes.length)
      this.updateTasks.append(() => Promise.all(writes));

    return new Promise(resolve => {
      return this.updateTasks.append(() => (
        this.updateObjectsImpl(objs)
        .then(resolve)
      ));
    });
  }

  private updateObjectsImpl(versions: Array<{ id: string, version: string }>): Promise<Array<OBJIOItem>> {
    const objs = versions.filter(item => {
      const obj = this.objectMap[item.id];
      return obj == null || obj.holder.getVersion() != item.version;
    });

    const updateObject = (item: { id: string, version: string }) => {
      const obj = this.objectMap[item.id];
      if (!obj) {
        return (
          this.loadObject(item.id)
          .then(() => {
            return { id: item.id, json: null };
          })
        );
      }

      return this.store.readObject({id: item.id})
      .then(res => res[item.id])
      .then(res => {
        const { classId, version, json } = res;
        const objClass = this.factory.findItem(classId);
        const extraObjs = objClass.getRelObjIDS(json).filter(id => this.objectMap[id] == null);
        if (!extraObjs.length)
          return res;

        return Promise.all(extraObjs.map(id => this.loadObject(id))).then(() => res);
      })
      .then(res => {
        const { classId, json} = res;
        const objClass = this.factory.findItem(classId);
        return Promise.resolve(
          objClass.writeToObject({
            userId: null,
            obj,
            getObject: id => this.objectMap[id] || this.loadObject(id),
            store: json
          })
        ).then(() => res);
      })
      .then(res => {
        obj.holder.updateSrvData({json: res.json, version: res.version});
        obj.holder.onObjChanged();
        obj.holder.notify();

        return { id: item.id, json: res.json };
      });
    };

    return (
      Promise.all(objs.map(updateObject))
      .then(jsonArr => {
        jsonArr.forEach(item => {
          if (item.json == null)
            return;

          const obj = this.objectMap[item.id];
          OBJIOItem.getClass(obj).writeToObject({
            userId: null,
            obj,
            store: item.json,
            getObject: id => this.objectMap[id]
          });
        });

        return objs.map(item => this.objectMap[item.id]);
      })
    );
  }

  startWatch(args: WatchArgs): WatchResult {
    const baseUrl = args.baseUrl || 'objio/watcher/';
    const timeOut = args.timeOut;
    const req = args.req;

    let prev = { version: -1 };
    let run = true;
    let subscribers = Array<(arr: Array<OBJIOItem>) => void>();

    const getVersion = () => {
      return (
        req.getJSON<{ version: number }>({url: `${baseUrl}version`, postData: prev})
        .then((res: { version: number }) => {
          if (res.version == prev.version) {
            setTimeout(loop, timeOut);
            return Promise.reject(null);
          }

          prev = { ...res };
        })
      );
    };

    const update = (tryCounter: number) => {
      return (
        req.getJSON<Array<{ id: string, version: string }>>({url: `${baseUrl}items`})
        .catch(err => {
          console.log('get items err', tryCounter - 1, err);
          if (tryCounter <= 0)
            return;

          return Promise.delay(1000).then(() => update(tryCounter - 1));
        })
      );
    };

    const loop = () => {
      if (!run)
        return;

      getVersion()
      .then(() => {
        return this.getWrites();
      })
      .then(() => {
        return update(5);
      })
      .then(items => {
        return this.updateObjects(items);
      })
      .then(res => {
        subscribers.forEach(s => {
          try {
            s(res);
          } catch (e) {
            console.log(e);
          }
        });

        setTimeout(loop, timeOut);
      })
      .catch(err => {
        console.log(err);
        setTimeout(loop, 1000);
      });
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
