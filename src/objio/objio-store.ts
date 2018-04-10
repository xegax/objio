import {
  OBJIOFactory,
  OBJIOStore,
  OBJIOItemClass,
  OBJIOLocalStore,
  WriteResult,
  CreateResult,
  ReadResult
} from 'objio';
import {cloneDeep} from 'lodash';
import { OBJIOArray } from './objio-array';

export function nextVersion(ver: string) {
  let newVer = '';
  while ((newVer = Math.round(Math.random() * 1e17).toString(16)) != newVer) {
  }
  return newVer;
}

export class OBJIOStoreBase implements OBJIOStore {
  private storeImpl: OBJIOStore;
  private writes: Array<Promise<any>> = [];

  constructor(impl: OBJIOStore) {
    this.storeImpl = impl;
  }

  private pushWrite(promise: Promise<any>) {
    this.writes.push(promise);
    console.log('write add', this.writes.length);
    const remove = () => {
      this.writes.splice(this.writes.indexOf(promise), 1);
      console.log('write remove', this.writes.length);
    };
    promise.then(remove).catch(remove);
    return promise;
  }

  createObjects(arr: Array<{classId: string, json: Object}>): Promise<Array<CreateResult>> {
    return this.pushWrite(this.storeImpl.createObjects(arr));
  }

  writeObjects(arr: Array<{id: string, json: Object}>): Promise<WriteResult> {
    return this.pushWrite(this.storeImpl.writeObjects(arr));
  }

  readObject(id: string): Promise<ReadResult> {
    return this.storeImpl.readObject(id);
  }

  readObjects(id: string): Promise<ReadResult> {
    return this.storeImpl.readObjects(id);
  }

  methodInvoker(id: string, method: string, args: Object): Promise<any> {
    return this.storeImpl.methodInvoker(id, method, args);
  }

  getWrites() {
    return this.writes;
  }
} 

interface ObjStore {
  data: Object;
  classId: string;
  version: string;
}

interface StoreData {
  idCounter: number;
  objects: {[id: string]: ObjStore};
}

interface StoreState {
  idCounter: number;
}

export class OBJIOLocalStoreImpl implements OBJIOLocalStore {
  private _idCounter: number = 0;
  private objects: {[id: string]: ObjStore} = {};
  private factory: OBJIOFactory;
  private lastChanged = Array<string>();
  private lastChangedVersion = 0;

  constructor(factory: OBJIOFactory) {
    this.factory = factory;
  }

  private markAsChanged(id: string) {
    let i = this.lastChanged.indexOf(id);
    if (i != -1)
      this.lastChanged.splice(i, 1);

    this.lastChanged.push(id);
    this.lastChangedVersion++;
  }

  getLastChanged() {
    return this.lastChanged.slice();
  }

  getLastChangedVersion() {
    return this.lastChangedVersion;
  }

  loadAll(obj: StoreData) {
    this._idCounter = obj.idCounter;
    this.objects = cloneDeep<{}>(obj.objects);
  }

  saveAll(clone: boolean): StoreData {
    return {
      idCounter: this._idCounter,
      objects: clone ? cloneDeep(this.objects) : this.objects
    };
  }

  saveStoreState(): StoreState {
    return {
      idCounter: this._idCounter
    };
  }

  loadStoreState(obj: StoreState) {
    this._idCounter = obj.idCounter;
  }

  createObjects(arr: Array<{classId: string, json: Object}>): Promise<Array<CreateResult>> {
    let res = Array<CreateResult>();

    const createObjectImpl = (classId: string, json?: Object) => {
      const newId = '' + this._idCounter++;
      const storeItem = this.objects[newId] = {
        data: json || {},
        classId,
        version: nextVersion('')
      };
      res.push({id: newId, json: storeItem.data, version: storeItem.version});
    };

    arr.forEach(obj => {
      createObjectImpl(obj.classId, obj.json);
    });
    return Promise.resolve(res);
  }

  writeObjects(arr: Array<{id: string, json: Object}>): Promise<WriteResult> {
    const removed = Array<string>();
    // запоминаем id объектов
    const getIDS = () => {
      const ids: {[id: string]: number} = {};
      try {
        arr.forEach(obj => {
          const {classId, data} = this.objects[obj.id];
          const classItem = this.factory.findItem(classId);
          if (!classItem)
            throw `classItem for ${classId} not found`;

          if (!classItem.getIDSFromStore)
            throw `getIDSFromStore for ${classId} not found`;
          const idsArr = classItem.getIDSFromStore(data);
          if (!idsArr)
            throw `getIDSFromStore return ${idsArr} for ${classId}`;
          idsArr.forEach(id => {
            ids[id] = (ids[id] || 0) + 1;
         });
        });
      } catch(e) {
        console.log(e);
      }
      return ids;
    };
    let firstCheckIds = getIDS();

    // TODO: добавить проверку полей по typeId
    const res = arr.map(item => {
      this.markAsChanged(item.id);
      const currData = this.objects[item.id];
      let newData = {...currData.data, ...item.json};
      let upd = 0;
      Object.keys(newData).forEach(key => {
        if (currData.data[key] == newData[key])
          return;
        
        upd++;
        currData.data[key] = newData[key];
      });

      if (upd)
        currData.version = nextVersion(currData.version);
      return {version: currData.version, json: newData, id: item.id};
    });

    const secondCheckIds = getIDS();

    const removedIds: {[id: string]: number} = {};
    Object.keys(firstCheckIds).forEach(id => {
      if (!secondCheckIds[id])
        removedIds[id] = 0;
    });

    if (Object.keys(removedIds).length == 0)
      return Promise.resolve({items: res, removed: []});

    Object.keys(this.objects).forEach(id => {
      const {classId, data} = this.objects[id];
      const classItem = this.factory.findItem(classId);
      classItem.getIDSFromStore(data).forEach(id => {
        if (id in removedIds)
          removedIds[id]++;
      });
    });

    Object.keys(removedIds).forEach(id => {
      if (removedIds[id] == 0) {
        removed.push(id);
        delete this.objects[id];
      }
    });

    return Promise.resolve({items: res, removed});
  }

  private readObjectResult(id: string, res: ReadResult, deep: boolean) {
    const objStore = this.getObjectData(id);
    if (!objStore)
      throw `Object with id=${id} not found`;

    const classItem = this.factory.findItem(objStore.classId);
    if (!classItem)
      throw `classItem not found`;

    res[id] = {
      classId: objStore.classId,
      version: objStore.version,
      json: objStore.data
    };

    if (!deep)
      return;

    if (classItem.getIDSFromStore)
      classItem.getIDSFromStore(objStore.data).forEach(id => this.readObjectResult(id, res, deep));

    const fields = classItem.SERIALIZE();
    Object.keys(fields).forEach(name => {
      if (fields[name].type != 'object')
        return;

      const nextId = objStore.data[name];
      if (nextId)
        this.readObjectResult(nextId, res, deep);
    });
  }

  readObjects(id: string): Promise<ReadResult> {
    const res: ReadResult = {};
    this.readObjectResult(id, res, true);

    return Promise.resolve(res);
  }

  readObject(id: string): Promise<ReadResult> {
    const res: ReadResult = {};
    this.readObjectResult(id, res, false);

    return Promise.resolve(res);
  }

  methodInvoker(id: string, method: string, args: Object): Promise<any> {
    return null;
  }

  hasObject(id: string): boolean {
    return this.objects[id] != null;
  }

  getObjectData(id: string): ObjStore {
    return this.objects[id];
  }

  setObjectData(id: string, data: ObjStore) {
    this.objects[id] = data;
  }
}

export function createLocalStore(factory: OBJIOFactory): Promise<OBJIOLocalStore> {
  return Promise.resolve(new OBJIOLocalStoreImpl(factory));
}
