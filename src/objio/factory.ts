import { OBJIOArray } from './array';
import { OBJIOItemClass } from './item';

export class OBJIOFactory {
  private map: { [objType: string]: OBJIOItemClass } = {};

  registerItem(itemClass: OBJIOItemClass) {
    if (itemClass.TYPE_ID == null || typeof itemClass.TYPE_ID != 'string')
      throw 'TYPE_ID is invalid or undefined';

    this.map[itemClass.TYPE_ID] = itemClass;
  }

  findItem(objType: string): OBJIOItemClass {
    if (this.map[objType] == null)
      throw `unregistered ${objType} class`;
    return this.map[objType];
  }

  findItemSilent(objType: string) {
    return this.map[objType];
  }

  getTypes(): Array<string> {
    return Object.keys(this.map);
  }
}

export function createFactory(): Promise<OBJIOFactory> {
  let factory = new OBJIOFactory();
  factory.registerItem(OBJIOArray);

  return Promise.resolve(factory);
}
