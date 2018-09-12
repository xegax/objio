import {
  CreateObjectsArgs,
  CreateResult,
  OBJIOStore,
  WriteResult,
  WriteObjectsArgs,
  ReadResult,
  ReadObjectArgs
} from './store';
import { OBJIO, OBJIOArgs } from './objio';
import { OBJIOFactory } from './factory';
import { OBJIOItem, SERIALIZE, FieldFilter } from './item';
import { InvokeMethodArgs } from './store';

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
    ss.objio = await OBJIO.create({...objioArgs, saveTime: args.saveTime || 1, server: true});

    return ss;
  }

  async createObjects(args: CreateObjectsArgs): Promise<CreateResult> {
    let objsMap: {[id: string]: OBJIOItem} = {};
    // create all uncreated objects
    Object.keys(args.objs).forEach(id => {
      const item = args.objs[id];
      const objClass = this.factory.findItem(item.classId);
      objsMap[id] = this.objio.getObject(id) || objClass.create();
    });

    let tasks = [];
    // initialize just created objects by the values passed from client
    Object.keys(objsMap).forEach(id => {
      const obj = objsMap[id];
      const store = args.objs[id].json;
      const objClass = OBJIOItem.getClass(obj);
      if (this.objio.getObject(id))
        return;

      const task = objClass.writeToObject({
        create: true,
        userId: args.userId,
        obj,
        store,
        getObject: id => objsMap[id] || this.objio.loadObject(id)
      });

      if (task)
        tasks.push(task);
    });

    await Promise.all(tasks);
    // wait for objio to write all object to store
    await this.objio.createObject(objsMap[args.rootId], args.userId);

    let res: CreateResult = {};
    Object.keys(objsMap).forEach(id => {
      const obj = objsMap[id];
      res[id] = {
        newId: obj.holder.getID(),
        // json: obj.holder.getJSON({fieldFilter: this.includeFilter}),
        version: obj.holder.getVersion()
      };
    });

    return res;
  }

  getOBJIO(): OBJIO {
    return this.objio;
  }

  async writeObjects(args: WriteObjectsArgs): Promise<WriteResult> {
    const objs = await Promise.all(args.arr.map(item => this.objio.loadObject(item.id, args.userId)));
    const objsMap: {[id: string]: OBJIOItem} = {};
    objs.forEach(obj => objsMap[obj.holder.getID()] = obj);

    let tasks = Array<Promise<any>>();
    args.arr.forEach(item =>  {
      const obj = objsMap[item.id];
      const objClass = OBJIOItem.getClass(obj);
      const task = objClass.writeToObject({
        userId: args.userId,
        fieldFilter: this.includeFilter,
        obj,
        store: item.json,
        getObject: id => this.objio.loadObject(id, args.userId)
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
    args.arr.forEach(item => {
      const obj = objsMap[item.id];
      res.items.push({
        id: item.id,
        // json: obj.holder.getJSON({fieldFilter: this.includeFilter}),
        version: obj.holder.getVersion()
      });
    });

    return res;
  }

  private async readObjectResult(args: ReadObjectArgs, res: ReadResult, deep: boolean) {
    const id = args.id;
    if (res[id])
      return;

    const obj = await this.objio.loadObject(id, args.userId);
    if (!obj)
      throw `Object with id=${id} not found`;

    const classItem = OBJIOItem.getClass(obj);
    if (!classItem)
      throw `classItem not found`;

    res[id] = {
      classId: classItem.TYPE_ID,
      version: obj.holder.getVersion(),
      json: obj.holder.getJSON({fieldFilter: this.includeFilter, userId: args.userId})
    };

    if (!deep)
      return;

    const json = obj.holder.getJSON({fieldFilter: this.includeFilter, userId: args.userId});
    if (classItem.getRelObjIDS)
      await Promise.all(classItem.getRelObjIDS(json).map(id => this.readObjectResult({ ...args, id }, res, deep)));

    const fields = SERIALIZE(classItem, this.includeFilter);
    let tasks: Array<Promise<any>> = [];
    Object.keys(fields).forEach(name => {
      if (fields[name].type != 'object')
        return;

      const nextId = json[name] as string;
      if (nextId)
        tasks.push(this.readObjectResult({ ...args, id: nextId }, res, deep));
    });

    return Promise.all(tasks);
  }

  async readObjects(args: ReadObjectArgs): Promise<ReadResult> {
    const res: ReadResult = {};
    await this.readObjectResult(args, res, true);

    return res;
  }

  async readObject(args: ReadObjectArgs): Promise<ReadResult> {
    const res: ReadResult = {};
    await this.readObjectResult(args, res, false);

    return res;
  }

  invokeMethod(args: InvokeMethodArgs): Promise<any> {
    return Promise.resolve(this.objio.getObject(args.id))
    .then(obj => {
      if (obj)
        return obj;

      return this.objio.loadObject(args.id, args.userId);
    })
    .then(obj => {
      if (!obj)
        throw new Error(`object ${args.id} not found`);

      const methods = obj.holder.getMethodsToInvoke();
      const method = methods[args.methodName];
      if (!method)
        throw new Error(`method ${args.methodName} not found`);

      return method(args.args, args.userId);
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
