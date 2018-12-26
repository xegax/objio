import { OBJIOArray } from '../src/objio/array';
import { OBJIOItem } from '../src/objio/item';
import { expect } from 'chai';

function getArray(arr: Array<OBJIOItem>): OBJIOArray {
  let obj = new OBJIOArray();
  arr.forEach(item => obj.push(item));
  return obj;
}

function getIDS(arr: Array<OBJIOItem>): Array<string> {
  return arr.map(obj => obj.holder.getID());
}

function getMap(arr: Array<OBJIOItem>) {
  let map = {};
  arr.forEach(item => map[item.holder.getID()] = item);
  return map;
}

describe('OBJIOArray', () => {
  it('static functions', async () => {
    const obj1 = new OBJIOItem();
    const obj2 = new OBJIOItem();
    const objsArr = [obj1, obj2];
    const map = getMap(objsArr);

    const obj = getArray(objsArr);
    const store = {
      arr: JSON.stringify( getIDS(objsArr) )
    };

    const res = OBJIOArray.writeToObject({
      userId: '?',
      obj,
      store,
      getObject: id => map[id]
    });
    expect(res).instanceof(Promise, 'must be a promise');

    await res;
    expect(OBJIOArray.saveStore(obj)).eql(store, 'check saveStore');

    expect(obj.getLength()).eq(objsArr.length);

    expect([ obj.get(0), obj.get(1) ]).eql(objsArr, 'All objects must be equal');

    expect(OBJIOArray.getRelObjIDS(store)).eql( getIDS(objsArr), 'check getRelObjIDS');
  });
});
