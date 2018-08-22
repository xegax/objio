import {
  CreateObjectsArgs,
  CreateResult,
  OBJIOStore,
  WriteResult,
  ReadResult
} from './store';
import { OBJIO, OBJIOArgs } from './objio';
import { OBJIOFactory } from './factory';
import { OBJIOItem, SERIALIZE, FieldFilter } from './item';

// objio client -> remote-store -> objio server -> db-store

export interface ServerStoreArgs extends OBJIOArgs {
  includeFilter?: FieldFilter;
}

// the store send and receive client json data
export class OBJIOServerStore implements OBJIOStore {
  private objio: OBJIO;
  private factory: OBJIOFactory;
  private includeFilter?: FieldFilter;

  static async create(args: ServerStoreArgs): Promise<OBJIOServerStore> {
    let ss = new OBJIOServerStore();

    const { includeFilter, ...objioArgs } = args;

    ss.includeFilter = includeFilter;
    ss.factory = args.factory;
    ss.objio = await OBJIO.create({...objioArgs, saveTime: args.saveTime || 1});

    return ss;
  }

  async createObjects(args: CreateObjectsArgs): Promise<CreateResult> {
    let objsMap: {[id: string]: OBJIOItem} = {};
    let tasks: Array<Promise<any>> = [];
    Object.keys(args.objs).forEach(id => {
      const item = args.objs[id];
      const objClass = this.factory.findItem(item.classId);
      objsMap[id] = this.objio.getObject(id) || objClass.create();
    });

    await Promise.all(tasks);

    tasks = [];
    Object.keys(objsMap).forEach(id => {
      const obj = objsMap[id];
      const store = args.objs[id].json;
      const objClass = OBJIOItem.getClass(obj);
      if (this.objio.getObject(id))
        return;
      const task = objClass.loadStore({
        obj,
        store,
        getObject: id => objsMap[id] || this.objio.loadObject(id)
      });
      if (task)
        tasks.push(task);
    });

    await Promise.all(tasks);
    await this.objio.createObject(objsMap[args.rootId]);

    let res: CreateResult = {};
    Object.keys(objsMap).forEach(id => {
      const obj = objsMap[id];
      res[id] = {
        newId: obj.holder.getID(),
        json: obj.holder.getJSON(this.includeFilter),
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

    let tasks = Array<Promise<any>>();
    arr.forEach(item =>  {
      const obj = objsMap[item.id];
      const objClass = OBJIOItem.getClass(obj);
      const task = objClass.loadStore({
        fieldFilter: this.includeFilter,
        obj,
        store: item.json,
        getObject: id => this.objio.loadObject(id)
      });
      if (task instanceof Promise) {
        tasks.push(task.then(() => {
          return obj.holder.save();
        }));
      } else {
        tasks.push(obj.holder.save());
      }
    });

    await Promise.all(tasks);

    let res: WriteResult = {items: [], removed: []};
    arr.forEach(item => {
      const obj = objsMap[item.id];
      res.items.push({
        id: item.id,
        json: obj.holder.getJSON(this.includeFilter),
        version: obj.holder.getVersion()
      });
    });

    return res;
  }

  private async readObjectResult(id: string, res: ReadResult, deep: boolean) {
    if (res[id])
      return;

    const obj = await this.objio.loadObject(id);
    if (!obj)
      throw `Object with id=${id} not found`;

    const classItem = OBJIOItem.getClass(obj);
    if (!classItem)
      throw `classItem not found`;

    res[id] = {
      classId: classItem.TYPE_ID,
      version: obj.holder.getVersion(),
      json: obj.holder.getJSON(this.includeFilter)
    };

    if (!deep)
      return;

    const json = obj.holder.getJSON(this.includeFilter);
    if (classItem.getRelObjIDS)
      await Promise.all(classItem.getRelObjIDS(json).map(id => this.readObjectResult(id, res, deep)));

    const fields = SERIALIZE(classItem, this.includeFilter);
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

  invokeMethod(id: string, methodName: string, args: Object): Promise<any> {
    return Promise.resolve(this.objio.getObject(id))
    .then(obj => {
      if (obj)
        return obj;

      return this.objio.loadObject(id);
    })
    .then(obj => {
      if (!obj)
        throw new Error(`object ${id} not found`);

      const methods = obj.holder.getMethodsToInvoke();
      const method = methods[methodName];
      if (!method)
        throw new Error(`method ${methodName} not found`);

      return method(args);
    });
  }

  getAllObjIDS(): Promise<Set<string>> {
    return Promise.resolve( new Set( Object.keys(this.objio.getObjectsMap()) ) );
  }

  removeObjs(ids: Set<string>): Promise<any> {
    return this.objio.removeObjs(ids);
  }

  clean(): Promise<Array<{type: string, id: string}>> {
    let objs = Array<{type: string, id: string}>();
    return Promise.all([
      this.getOBJIO().findLinkedObjs(),
      this.getAllObjIDS()
    ]).then(res => {
      res[0].forEach(id => {
        res[1].delete(id);
      });
      res[1].forEach(id => {
        const obj = this.getOBJIO().getObject(id);
        if (!obj)
          return;
        objs.push({ id: obj.holder.getID(), type: OBJIOItem.getClass(obj).TYPE_ID});
      });
      console.log('removing', res[1]);
      return this.removeObjs(res[1]).then(() => objs);
    });
  }
}
