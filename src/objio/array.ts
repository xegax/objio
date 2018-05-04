import {
  OBJIOItem,
  LoadStoreArgs,
  SERIALIZER,
  OBJIOItemHolder
} from './item';

export class OBJIOArray<T = OBJIOItem> extends OBJIOItem {
  private arr: Array<T> = Array<T>();

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

  static loadStore(args: LoadStoreArgs) {
    const obj = args.obj as OBJIOArray;
    obj.arr = args.store.arr.map(id => args.getObject(id));
  }

  static saveStore(obj: OBJIOArray): { [key: string]: number | string | Array<number | string> } {
    return {
      arr: obj.arr.map(item => item.getHolder().getID())
    };
  }

  static getIDSFromStore(store: { arr: Array<string> }): Array<string> {
    return store.arr;
  }
}
