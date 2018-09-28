import { OBJIOFactory} from './factory';
import { cloneDeep } from 'lodash';
import { SERIALIZE, FieldFilter } from './item';
import { User } from '../client/user';

export interface JSONObj {
  [key: string]: string | number;
}

export interface WriteResult {
  items: Array<{ id: string, version: string }>;
  removed: Array<string>;
}

export interface ReadResult {
  [id: string]: { classId: string; version: string; json: JSONObj };
}

export interface CreateResult {
  [id: string]: {
    newId: string;
    version: string;
  };
}

export type CreateObjectsArgs = {
  userId: string;
  rootId: string;
  objs: {[id: string]: { classId: string, json: JSONObj }};
};

export type WriteObjectsArgs = {
  arr: Array<{ id: string, json: JSONObj, version: string }>;
  userId?: string;
};

export type ReadObjectArgs = {
  id: string;
  userId?: string;
};

export type InvokeMethodArgs = {
  id: string;
  methodName: string;
  userId: string;
  user?: User;
  args: Object;
  onProgress?(value: number): void;
};

export interface OBJIOStore {
  createObjects(args: CreateObjectsArgs): Promise<CreateResult>;
  writeObjects(args: WriteObjectsArgs): Promise<WriteResult>;

  // read all objects tree
  readObjects(args: ReadObjectArgs): Promise<ReadResult>;

  // read only one object
  readObject(args: ReadObjectArgs): Promise<ReadResult>;

  invokeMethod(args: InvokeMethodArgs): Promise<any>;

  getAllObjIDS(): Promise<Set<string>>;
  removeObjs(ids: Set<string>): Promise<any>;
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

  readObject(args: ReadObjectArgs): Promise<ReadResult> {
    return this.storeImpl.readObject(args);
  }

  readObjects(args: ReadObjectArgs): Promise<ReadResult> {
    return this.storeImpl.readObjects(args);
  }

  invokeMethod(args: InvokeMethodArgs): Promise<any> {
    return this.storeImpl.invokeMethod(args);
  }

  getAllObjIDS(): Promise<Set<string>> {
    return this.storeImpl.getAllObjIDS();
  }

  removeObjs(ids: Set<string>): Promise<any> {
    return this.storeImpl.removeObjs(ids);
  }

  getWrites() {
    return this.writes;
  }
}

export interface ObjStore {
  data: JSONObj;
  classId: string;
  version: string;
  userId: string;
  time: number;
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
  private fieldFilter: FieldFilter; // filters for incoming and outcoming fields

  constructor(factory: OBJIOFactory, fieldFilter?: FieldFilter) {
    this.factory = factory;
    this.fieldFilter = fieldFilter;
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

  createObjects(args: CreateObjectsArgs): Promise<CreateResult> {
    const res: CreateResult = {};

    let jsonMap: {[id: string]: JSONObj} = {};
    Object.keys(args.objs).forEach(id => {
      const obj = args.objs[id];

      if (this.objects[id])
        return;

      const newId = '' + this.idCounter++;
      const storeItem = this.objects[newId] = {
        data: obj.json || {},
        classId: obj.classId,
        version: nextVersion(''),
        userId: args.userId,
        time: Date.now()
      };

      res[id] = {
        newId,
        version: storeItem.version
      };

      jsonMap[id] = obj.json;
    });

    // replace loc-id to new ids
    Object.keys(res).forEach(id => {
      const json = jsonMap[id];
      const { newId } = res[id];
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

  writeObjects(args: WriteObjectsArgs): Promise<WriteResult> {
    const removed = Array<string>();

    // запоминаем id объектов
    /*const getIDS = () => {
      const ids: {[id: string]: number} = {};
      try {
        args.arr.forEach(obj => {
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

    const firstCheckIds = getIDS();*/

    const items = this.writeObjectsImpl(args);

    /*const secondCheckIds = getIDS();

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
    });*/

    return Promise.resolve({items, removed});
  }

  private writeObjectsImpl(args: WriteObjectsArgs) {
    // TODO: добавить проверку полей по typeId
    return args.arr.map(item => {
      const currData = this.objects[item.id];
      const newData: JSONObj = {...currData.data, ...item.json};

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

  private readObjectResult(args: ReadObjectArgs, res: ReadResult, deep: boolean) {
    const id = args.id;
    if (res[id])
      return;

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
      classItem.getRelObjIDS(objStore.data).forEach(id => this.readObjectResult({ ...args, id }, res, deep));

    const fields = SERIALIZE(classItem, this.fieldFilter);
    Object.keys(fields).forEach(name => {
      if (fields[name].type != 'object')
        return;

      const nextId: string = objStore.data[name] + '';
      if (nextId)
        this.readObjectResult({ ...args, id: nextId }, res, deep);
    });
  }

  readObjects(args: ReadObjectArgs): Promise<ReadResult> {
    const res: ReadResult = {};
    this.readObjectResult(args, res, true);

    return Promise.resolve(res);
  }

  readObject(args: ReadObjectArgs): Promise<ReadResult> {
    const res: ReadResult = {};
    this.readObjectResult(args, res, false);

    return Promise.resolve(res);
  }

  invokeMethod(args: InvokeMethodArgs): Promise<any> {
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

  getAllObjIDS(): Promise<Set<string>> {
    return Promise.resolve( new Set(Object.keys(this.objects)) );
  }

  removeObjs(ids: Set<string>): Promise<any> {
    ids.forEach(id => {
      delete this.objects[id];
    });

    return Promise.resolve();
  }
}

export function createLocalStore(factory: OBJIOFactory): Promise<OBJIOLocalStore> {
  return Promise.resolve(new OBJIOLocalStore(factory));
}
