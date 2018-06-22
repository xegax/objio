import { OBJIOFactory} from './factory';
import { cloneDeep } from 'lodash';

export interface WriteResult {
  items: Array<{ id: string, json: Object, version: string }>;
  removed: Array<string>;
}

export interface ReadResult {
  [id: string]: { classId: string; version: string; json: Object };
}

export interface CreateResult {
  [id: string]: {
    newId: string;
    json: Object;
    version: string;
  };
}

export type CreateObjectsArgs = { [id: string]: { classId: string, json: Object } };
export type WriteObjectsArgs = Array<{ id: string, json: Object, version: string }>;

export interface OBJIOStore {
  createObjects(args: CreateObjectsArgs): Promise<CreateResult>;
  writeObjects(args: WriteObjectsArgs): Promise<WriteResult>;

  // read all objects tree
  readObjects(id: string): Promise<ReadResult>;

  // read only one object
  readObject(id: string): Promise<ReadResult>;

  invokeMethod(id: string, method: string, args: Object): Promise<any>;
}

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

  createObjects(args: CreateObjectsArgs): Promise<CreateResult> {
    return this.pushWrite(this.storeImpl.createObjects(args));
  }

  writeObjects(args: WriteObjectsArgs): Promise<WriteResult> {
    return this.pushWrite(this.storeImpl.writeObjects(args));
  }

  readObject(id: string): Promise<ReadResult> {
    return this.storeImpl.readObject(id);
  }

  readObjects(id: string): Promise<ReadResult> {
    return this.storeImpl.readObjects(id);
  }

  invokeMethod(id: string, method: string, args: Object): Promise<any> {
    return this.storeImpl.invokeMethod(id, method, args);
  }

  getWrites() {
    return this.writes;
  }
}

export interface ObjStore {
  data: Object;
  classId: string;
  version: string;
}

export interface StoreData {
  idCounter: number;
  objects: {[id: string]: ObjStore};
}

export interface StoreState {
  idCounter: number;
}

export class OBJIOLocalStore implements OBJIOStore {
  private idCounter: number = 0;
  protected objects: {[id: string]: ObjStore} = {};
  private factory: OBJIOFactory;

  constructor(factory: OBJIOFactory) {
    this.factory = factory;
  }

  loadAll(obj: StoreData) {
    this.idCounter = obj.idCounter;
    this.objects = cloneDeep<{}>(obj.objects);
  }

  saveAll(clone: boolean): StoreData {
    return {
      idCounter: this.idCounter,
      objects: clone ? cloneDeep(this.objects) : this.objects
    };
  }

  saveStoreState(): StoreState {
    return {
      idCounter: this.idCounter
    };
  }

  loadStoreState(obj: StoreState) {
    this.idCounter = obj.idCounter;
  }

  createObjects(objMap: CreateObjectsArgs): Promise<CreateResult> {
    const res: CreateResult = {};

    Object.keys(objMap).forEach(id => {
      const obj = objMap[id];

      if (this.objects[id])
        return;

      const newId = '' + this.idCounter++;
      const storeItem = this.objects[newId] = {
        data: obj.json || {},
        classId: obj.classId,
        version: nextVersion('')
      };

      res[id] = {
        newId: newId,
        json: storeItem.data,
        version: storeItem.version
      };
    });

    Object.keys(res).forEach(id => {
      const { newId, json } = res[id];
      const objClass = this.factory.findItem(this.objects[newId].classId);
      const replaceID = id => {
        if (this.objects[id])
          return id;

        return res[id].newId;
      };
      objClass.getRelObjIDS(json, replaceID);
    });

    return Promise.resolve(res);
  }

  writeObjects(arr: WriteObjectsArgs): Promise<WriteResult> {
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

          if (!classItem.getRelObjIDS)
            throw `getIDSFromStore for ${classId} not found`;
          const idsArr = classItem.getRelObjIDS(data);
          if (!idsArr)
            throw `getIDSFromStore return ${idsArr} for ${classId}`;
          idsArr.forEach(id => {
            ids[id] = (ids[id] || 0) + 1;
         });
        });
      } catch (e) {
        console.log(e);
      }
      return ids;
    };

    const firstCheckIds = getIDS();

    const items = this.writeObjectsImpl(arr);

    const secondCheckIds = getIDS();

    const removedIds: {[id: string]: number} = {};
    Object.keys(firstCheckIds).forEach(id => {
      if (!secondCheckIds[id])
        removedIds[id] = 0;
    });

    if (Object.keys(removedIds).length == 0)
      return Promise.resolve({items, removed: []});

    Object.keys(this.objects).forEach(id => {
      const {classId, data} = this.objects[id];
      const classItem = this.factory.findItem(classId);
      classItem.getRelObjIDS(data).forEach(id => {
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

    return Promise.resolve({items, removed});
  }

  private writeObjectsImpl(arr: WriteObjectsArgs) {
    // TODO: добавить проверку полей по typeId
    return arr.map(item => {
      const currData = this.objects[item.id];
      const newData = {...currData.data, ...item.json};

      let upd = 0;
      Object.keys(newData).forEach(key => {
        if (currData.data[key] == newData[key])
          return;

        if (item.version != currData.version)
          return console.log('concurrent modifying');

        upd++;
        currData.data[key] = newData[key];
      });

      if (upd)
        currData.version = nextVersion(currData.version);

      return {
        version: currData.version,
        json: newData,
        id: item.id
      };
    });
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

    if (classItem.getRelObjIDS)
      classItem.getRelObjIDS(objStore.data).forEach(id => this.readObjectResult(id, res, deep));

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

  invokeMethod(id: string, method: string, args: Object): Promise<any> {
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
  return Promise.resolve(new OBJIOLocalStore(factory));
}
