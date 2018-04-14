import * as objio from 'objio';
import {Publisher} from 'common/publisher';

interface InitArgs {
  id: string;
  obj: objio.OBJIOItem;
  version: string;
  saveImpl: (obj: objio.OBJIOItem) => Promise<any>;
}

export class OBJIOItemHolderImpl extends Publisher implements objio.OBJIOItemHolder  {
  private id: string;
  private obj: objio.OBJIOItem;
  private saveImpl: (obj: objio.OBJIOItem) => Promise<any>;
  private srvVersion: string = '';

  constructor(args?: InitArgs) {
    super();
    if (!args)
      return;

    this.id = args.id;
    this.obj = args.obj;
    this.srvVersion = args.version;
    this.saveImpl = args.saveImpl;
  }

  getID(): string {
    return this.id;
  }

  save(): Promise<any> {
    if (!this.saveImpl)
      return Promise.reject('saveImpl not defined');

    return this.saveImpl(this.obj);
  }

  getJSON(): {[key: string]: number | string | Array<number|string>} {
    const objClass: objio.OBJIOItemClass = this.obj.constructor as any;
    if (objClass.saveStore) {
      return objClass.saveStore(this.obj);
    }

    let field = objClass.SERIALIZE();
    let json = {};
    Object.keys(field).forEach(name => {
      const value = this.obj[name];
      if (value == null)
        return;

      if (field[name].type == 'object') {
        json[name] = (value as objio.OBJIOItem).getHolder().getID();
      } else if (field[name].type == 'json') {
        json[name] = JSON.stringify(value);
      } else {
        json[name] = value;
      }
    });

    return json;
  }

  setJSON(json: Object, srvVersion: string) {
    const objClass: objio.OBJIOItemClass = this.obj.constructor as any;

    const srDesc = objClass.SERIALIZE();
    Object.keys(srDesc).forEach(k => {
      if (json[k] == null)
        return;

      if (srDesc[k].type != 'object') {
        this.obj[k] = json[k];
      }
    });

    this.srvVersion = srvVersion;
  }

  updateVersion(version: string) {
    this.srvVersion = version;
  }

  getVersion(): string {
    return this.srvVersion;
  }
}

let localIdCounter = 0;
export class OBJIOItem implements objio.OBJIOItem {
  holder: objio.OBJIOItemHolder = new OBJIOItemHolderImpl({
    id: 'loc-' + (localIdCounter++),
    obj: this,
    saveImpl: null,
    version: ''
  });

  getHolder(): objio.OBJIOItemHolder {
    return this.holder;
  }

  static getClassDesc(obj: OBJIOItem): objio.OBJIOItemClass {
    return obj.constructor as any as objio.OBJIOItemClass;
  }

  static loadStore(args: objio.LoadStoreArgs) {
    const { SERIALIZE } = OBJIOItem.getClassDesc(args.obj as OBJIOItem);
    const fields = SERIALIZE();
    Object.keys(args.store).forEach(name => {
      if (fields[name].type == 'object')
        args.obj[name] = args.getObject(args.store[name]);
    });
  }

  static getIDSFromStore(store: Object) {
    const classItem: objio.OBJIOItemClass = this as any;
    const { SERIALIZE } = classItem;
    const fields = SERIALIZE();
    const ids: Array<string> = [];

    Object.keys(fields).forEach(key => {
      if (fields[key].type == 'object' && store[key] != null && ids.indexOf(store[key]) == -1)
         ids.push(store[key]);
    });

    return ids;
  }
}

export function findAllObjFields(root: OBJIOItem, lst?: Array<OBJIOItem>): Array<OBJIOItem> {
  if (!root)
    return;

  lst = lst || Array<OBJIOItem>();
  const holder = root.getHolder() as OBJIOItemHolderImpl;
  const classItem = root.constructor as any as objio.OBJIOItemClass;
  const fields = classItem.SERIALIZE();
  Object.keys(fields).forEach(name => {
    const type = fields[name].type;
    if (type == 'object') {
      findAllObjFields(root[name], lst);
      lst.push(root[name]);
    }
  });

  return lst;
}
