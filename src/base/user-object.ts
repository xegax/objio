import { OBJIOItem, SERIALIZER } from '../objio/item';
import { AccessType } from './security';

export { AccessType };

export interface UserObjectDesc {
  login: string;
  name: string;
}

export abstract class UserObjectBase extends OBJIOItem {
  protected name: string;
  protected login: string;

  setName(name: string) {
    if (this.name == name)
      return;

    this.name = name;
    this.holder.save();
  }

  getUserDesc(): UserObjectDesc {
    return {
      name: this.name,
      login: this.login
    };
  }

  static TYPE_ID = 'SpecialUserObject';
  static SERIALIZE: SERIALIZER = () => ({
    'name': { type: 'string' },
    'login': { type: 'string', const: true }
  });
}
