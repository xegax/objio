import { OBJIOItem, SERIALIZER } from '../objio/item';

export type AccessType = 'write' | 'read' | 'create';

export class User extends OBJIOItem {
  login: string;
  email: string;

  static TYPE_ID = 'User';
  static SERIALIZE: SERIALIZER = () => ({
    'login': { type: 'string', const: true },
    'email': { type: 'string', const: true }
  })
}
