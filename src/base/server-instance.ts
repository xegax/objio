import { SERIALIZER, OBJIOItem } from '../objio/item';
import { OBJIOArray } from '../objio/array';
import { UserObjectBase } from './user-object';

export abstract class ServerInstanceBase extends OBJIOItem {
  protected users = new OBJIOArray<UserObjectBase>();

  getUsers(): Array<UserObjectBase> {
    return this.users.getArray();
  }

  static TYPE_ID = 'SpecialServerInstanceObject';
  static SERIALIZE: SERIALIZER = () => ({
    users:  { type: 'object', const: true }
  })
}
