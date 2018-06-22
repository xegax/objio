import {
  CreateObjectsArgs,
  CreateResult,
  OBJIOStore,
  WriteResult,
  ReadResult
} from './store';
import { OBJIO } from './objio';
import { OBJIOFactory } from './factory';
import { OBJIOItem } from './item';

// objio client -> remote-store -> objio server -> db-store

export class OBJIOServerStore implements OBJIOStore {
  private objio: OBJIO;
  private ssFactory: OBJIOFactory;

  static async create(ssFactory: OBJIOFactory, store: OBJIOStore, saveTime?: number): Promise<OBJIOServerStore> {
    let proxyStore = new OBJIOServerStore();
    proxyStore.ssFactory = ssFactory;
    proxyStore.objio = await OBJIO.create(ssFactory, store, saveTime || 1);
    return proxyStore;
  }

  async createObjects(ids: CreateObjectsArgs): Promise<CreateResult> {
    let objsMap: {[id: string]: OBJIOItem} = {};
    let firstId: string;
    Object.keys(ids).forEach(id => {
      const item = ids[id];
      const objClass = this.ssFactory.findItem(item.classId);
      const obj = this.objio.getObject(id) || OBJIOItem.create(objClass);
      objsMap[id] = obj;
      !firstId && (firstId = id);
    });

    let tasks: Array<Promise<any>> = [];
    Object.keys(objsMap).forEach(id => {
      const obj = objsMap[id];
      const store = ids[id].json;
      const objClass = OBJIOItem.getClass(obj);
      if (this.objio.getObject(id))
        return;
      const task = objClass.loadStore({ obj, store, getObject: id => objsMap[id] || this.objio.loadObject(id)});
      if (task)
        tasks.push(task);
    });

    await Promise.all(tasks);
    await this.objio.createObject(objsMap[firstId]);

    let res: CreateResult = {};
    Object.keys(objsMap).forEach(id => {
      const obj = objsMap[id];
      res[id] = {
        newId: obj.holder.getID(),
        json: obj.holder.getJSON(),
        version: obj.holder.getVersion()
      };
    });

    return res;
  }

  getOBJIO(): OBJIO {
    return this.objio;
  }

  async writeObjects(arr: Array<{id: string, json: Object}>): Promise<WriteResult> {
    const objs = await Promise.all(arr.map(item => this.objio.loadObject(item.id)));
    const objsMap: {[id: string]: OBJIOItem} = {};
    objs.forEach(obj => objsMap[obj.holder.getID()] = obj);

    arr.forEach(item => {
      const obj = objsMap[item.id];
      const objClass = OBJIOItem.getClass(obj);
      objClass.loadStore({obj, store: item.json, getObject: id => this.objio.loadObject(id)});
      obj.holder.save();
    });

    let res: WriteResult = {items: [], removed: []};
    arr.forEach(item => {
      const obj = objsMap[item.id];
      res.items.push({
        id: item.id,
        json: obj.holder.getJSON(),
        version: obj.holder.getVersion()
      });
    });

    return res;
  }

  private async readObjectResult(id: string, res: ReadResult, deep: boolean) {
    const obj = await this.objio.loadObject(id);
    if (!obj)
      throw `Object with id=${id} not found`;

    const classItem = OBJIOItem.getClass(obj);
    if (!classItem)
      throw `classItem not found`;

    res[id] = {
      classId: classItem.TYPE_ID,
      version: obj.holder.getVersion(),
      json: obj.holder.getJSON()
    };

    if (!deep)
      return;

    const json = obj.holder.getJSON();
    if (classItem.getRelObjIDS)
      await Promise.all(classItem.getRelObjIDS(json).map(id => this.readObjectResult(id, res, deep)));

    const fields = classItem.SERIALIZE();
    let tasks: Array<Promise<any>> = [];
    Object.keys(fields).forEach(name => {
      if (fields[name].type != 'object')
        return;

      const nextId = json[name] as string;
      if (nextId)
        tasks.push(this.readObjectResult(nextId, res, deep));
    });

    return Promise.all(tasks);
  }

  async readObjects(id: string): Promise<ReadResult> {
    const res: ReadResult = {};
    await this.readObjectResult(id, res, true);

    return res;
  }

  async readObject(id: string): Promise<ReadResult> {
    const res: ReadResult = {};
    await this.readObjectResult(id, res, false);

    return res;
  }

  async invokeMethod(id: string, methodName: string, args: Object): Promise<any> {
    const obj = this.objio.getObject(id);
    if (!obj)
      throw new Error(`object ${id} not found`);

    const methods = obj.holder.getMethodsToInvoke();
    const method = methods[methodName];
    if (!method)
      throw new Error(`method ${methodName} not found`);

    return method(args);
  }
}
