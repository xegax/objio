import { OBJIOItem, SERIALIZER } from '../objio/item';
import { UserGroup } from './user-group';

export type AccessType = 'write' | 'read' | 'create';

export class User extends OBJIOItem {
  login: string;
  email: string;

  hasRight(accessType: AccessType, allGroups: Array<UserGroup>): boolean {
    return false;
  }

  static TYPE_ID = 'User';
  static SERIALIZE: SERIALIZER = () => ({
    'login': { type: 'string', const: true },
    'email': { type: 'string', const: true }
  })
}
