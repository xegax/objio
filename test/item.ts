import { OBJIOItem, SERIALIZER } from '../index';
import { expect } from 'chai';

class Dummy extends OBJIOItem {
  static TYPE_ID = 'Dummy';
  static SERIALIZE = () => ({
  });
}

class DummyCont extends OBJIOItem {
  counter: number;
  child = new Dummy();
  child2 = new Dummy();

  constructor() {
    super();

    this.holder.setMethodsToInvoke({
      increase: () => {
        this.counter++;
        this.holder.save();
      }
    });
  }

  static TYPE_ID = 'DummyCont';
  static SERIALIZE: SERIALIZER<DummyCont> = () => ({
    'child': {type: 'object'},
    'child2': {type: 'object'},
    'counter': {type: 'number'}
  });
}

describe('OBJIOItem', () => {
  it('OBJItem.create', () => {
    const obj = Dummy.create();
    expect(obj).instanceof(Dummy);
  });

  it('OBJItem.getClass', () => {
    const obj = new Dummy();
    expect(OBJIOItem.getClass(obj) == Dummy).to.eq(true);
    expect(Dummy.getClass() == Dummy).to.eq(true);
  });

  it('OBJItem.getRelObjIDS', () => {
    expect(DummyCont.getRelObjIDS({
      'child': 'id1',
      'child2': 'id2'
    })).eqls(['id1', 'id2']);
  });

  it('OBJItem.invokeMethod', () => {});
});
