import {
  OBJIOLocalStore,
  OBJIOFactory,
  WriteResult,
  CreateResult,
  WriteObjectsArgs,
  CreateObjectsArgs,
  ObjStore
} from '../index';
import {
  writeFileSync,
  readFileSync,
  unlink,
  existsSync,
  unlinkSync
} from 'fs';
import { promisify } from 'util';

export class OBJIOFSLocalStore extends OBJIOLocalStore {
  private rootDir: string;

  constructor(f: OBJIOFactory, dir: string) {
    super(f);
    this.rootDir = dir;

    try {
      this.loadStoreState(
        JSON.parse(
          readFileSync(this.getStorePath()).toString()
        )
      );
    } catch (e) {
      console.log(e);
    }
  }

  getStorePath(): string {
    return `${this.rootDir}/store.json`;
  }

  getObjPath(id: string) {
    return `${this.rootDir}/${id}.json`;
  }

  createObjects(args: CreateObjectsArgs): Promise<CreateResult> {
    return super.createObjects(args).then(objMap => {
      Object.keys(objMap).forEach(id => {
        const obj = objMap[id];
        writeFileSync(this.getObjPath(obj.newId), JSON.stringify(this.getObjectData(obj.newId)));
      });

      writeFileSync(this.getStorePath(), JSON.stringify(this.saveStoreState()));
      return objMap;
    });
  }

  writeObjects(arr: WriteObjectsArgs): Promise<WriteResult> {
    arr.forEach(obj => this.loadObjectIfNeed(obj.id));

    return super.writeObjects(arr).then(res => {
      res.items.forEach((obj, i) => {
        const id = arr[i].id;
        writeFileSync(this.getObjPath(id), JSON.stringify(this.getObjectData(id)));
      });

      const unlinkAsync = promisify(unlink);
      return Promise.all(res.removed.map(id => {
        return unlinkAsync(this.getObjPath(id));
      })).then(() => res);
    });
  }

  private loadObjectIfNeed(id: string) {
    if (this.hasObject(id))
      return;

    try {
      const path = this.getObjPath(id);
      if (existsSync(path))
        this.setObjectData(id, JSON.parse(readFileSync(path).toString()));
    } catch (e) {
      console.log(e);
    }
  }

  getObjectData(id: string): ObjStore {
    this.loadObjectIfNeed(id);
    return super.getObjectData(id);
  }

  removeObjs(ids: Set<string>): Promise<any> {
    ids.forEach(id => {
      const file = this.getObjPath(id);
      if (!existsSync(file))
        return;
      
      console.log('remove obj file', file);
      unlinkSync(file);
    });

    return super.removeObjs(ids);
  }
}
