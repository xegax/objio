import { SERIALIZER, OBJIOItem } from '../objio/item';
import { User } from './user';
import { UserGroup } from './user-group';
import { OBJIOArray } from '../objio/array';

export class ServerInstance<TUser extends User = User, TGroup extends UserGroup = UserGroup> extends OBJIOItem {
  protected users = new OBJIOArray<TUser>();
  protected groups = new OBJIOArray<TGroup>();

  static TYPE_ID = 'ServerInstance';
  static SERIALIZE: SERIALIZER = () => ({
    users:  { type: 'object', const: true },
    groups: { type: 'object', const: true }
  })
}
