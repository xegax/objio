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

  static async create(ssFactory: OBJIOFactory, store: OBJIOStore): Promise<OBJIOServerStore> {
    let proxyStore = new OBJIOServerStore();
    proxyStore.objio = await OBJIO.create(ssFactory, store);
    return proxyStore;
  }

  createObjects(arr: CreateObjectsArgs): Promise<CreateResult> {
    return null;
  }

  async writeObjects(arr: Array<{id: string, json: Object}>): Promise<WriteResult> {
    const objs = await Promise.all(arr.map(item => this.objio.loadObject(item.id)));
    const objsMap: {[id: string]: OBJIOItem} = {};
    objs.forEach(obj => objsMap[obj.holder.getID()] = obj);

    let write: Array<Promise<any>> = [];
    arr.forEach(item => {
      const obj = objsMap[item.id];
      OBJIOItem.loadStore({obj, store: item.json, getObject: id => this.objio.loadObject(id)});
      write.push(obj.holder.save());
    });

    await Promise.all(write);
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

    if (classItem.getRelObjIDS)
      classItem.getRelObjIDS(obj.holder.getJSON()).forEach(async id => await this.readObjectResult(id, res, deep));

    const fields = classItem.SERIALIZE();
    const json = obj.holder.getJSON();
    Object.keys(fields).forEach(async name => {
      if (fields[name].type != 'object')
        return;

      const nextId = json[name] as string;
      if (nextId)
        await this.readObjectResult(nextId, res, deep);
    });
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

  methodInvoker(id: string, method: string, args: Object): Promise<any> {
    return null;
  }
}
