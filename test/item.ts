import { OBJIOItem } from '../src/objio/item';
import { expect } from 'chai';

class Dummy extends OBJIOItem {
  static TYPE_ID = 'Dummy';
  static SERIALIZE = () => ({
  });
}

class DummyCont extends OBJIOItem {
  child = new Dummy();
  child2 = new Dummy();

  static TYPE_ID = 'DummyCont';
  static SERIALIZE = () => ({
    'child': {type: 'object'},
    'child2': {type: 'object'}
  });
}

describe('OBJIOItem', () => {
  it('OBJItem.create', () => {
    const obj = OBJIOItem.create(Dummy);
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
});
