import {
  OBJIOItem,
  LoadStoreArgs,
  SERIALIZER,
  OBJIOItemHolder,
  SaveStoreResult,
  LoadStoreResult,
  GetRelObjIDSResult
} from './item';

export class OBJIOArray<T = OBJIOItem> extends OBJIOItem {
  private arr: Array<T> = Array<T>();
  constructor(arr?: Array<T>) {
    super();
    this.arr = arr || this.arr;
  }

  getArray(): Array<T> {
    return this.arr;
  }

  getLength(): number {
    return this.arr.length;
  }

  get(n: number): T {
    return this.arr[n];
  }

  remove(n: number) {
    this.arr.splice(n, 1);
  }

  push(item: T): OBJIOItemHolder {
    this.arr.push(item);
    return this.holder;
  }

  insert(item: T, n: number): OBJIOItemHolder {
    this.arr.splice(n, 0, item);
    return this.holder;
  }

  find(f: ((v: T) => boolean) | T): number {
    if (!(f instanceof Function))
      return this.arr.findIndex(v => v == f);
    return this.arr.findIndex(f as (v: T) => boolean);
  }

  static TYPE_ID = 'OBJIOArray';
  static SERIALIZE: SERIALIZER = () => ({
    'arr': { type: 'json' }
  });

  static loadStore(args: LoadStoreArgs): LoadStoreResult {
    const obj = args.obj as OBJIOArray;
    const store = args.store as { arr: string };
    const arr = JSON.parse(store.arr) as Array<string>;
    obj.arr = arr.map(id => args.getObject(id) as OBJIOItem);
  }

  static saveStore(obj: OBJIOArray): SaveStoreResult {
    return {
      arr: JSON.stringify(obj.arr.map(item => item.getHolder().getID()))
    };
  }

  static getRelObjIDS(store: {arr: string}): GetRelObjIDSResult {
    return JSON.parse(store.arr) as Array<string>;
  }
}
