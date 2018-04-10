import { OBJIOItemHolderImpl, OBJIOItem } from '../objio/objio-item';
import { SERIALIZER } from 'objio';

class Node extends OBJIOItem {
  a: string = 'defA';
  b: number = 11;
  
  static TYPE_ID = 'Node';
  static SERIALIZE: SERIALIZER = () => ({
    'a': {type: 'string'},
    'b': {type: 'number'}
  });
}

describe('OBJIOItemHolderImpl', () => {
  describe('setJSON', () => {
    let obj: Node;
    let holder: OBJIOItemHolderImpl;

    beforeEach(() => {
      obj = new Node();
      holder = new OBJIOItemHolderImpl({obj, id: '?', saveImpl: () => null, version: ''});
    });

    it('equal json', () => {
      const json = {a: 'loadA', b: 22};
      const newVersion = '2';
      holder.setJSON({...json}, newVersion);

      expect(obj.a).toEqual(json.a);
      expect(obj.b).toEqual(json.b);
      expect(holder.getVersion()).toEqual(newVersion);
    });

    it('different json', () => {
      const json = {b: 44};
      const defVals = {a: obj.a, b: obj.b};
      holder.setJSON(json, '2');

      expect(obj.a).toBe(defVals.a);
      expect(obj.b).toEqual(json.b);
    });
  });
});