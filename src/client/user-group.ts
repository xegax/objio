import { OBJIOItem, SERIALIZER } from '../objio/item';

export class UserGroup extends OBJIOItem {
  protected name: string;
  protected rights: Array<string> = [];

  getName(): string {
    return this.name;
  }

  hasRight(right: string): boolean {
    return this.rights.indexOf(right) != -1;
  }

  isAdmin(): boolean {
    return false;
  }

  static TYPE_ID = 'UserGroup';
  static SERIALIZE: SERIALIZER = () => ({
    'name':   { type: 'string', const: true },
    'rights': { type: 'json', const: true }
  })
}

export class AdminGroup extends UserGroup {
  isAdmin(): boolean {
    return true;
  }

  hasRight(): boolean {
    return true;
  }

  getName(): string {
    return AdminGroup.getName();
  }

  static getName(): string {
    return 'Administrator';
  }

  static TYPE_ID = 'AdminGroup';
  static SERIALIZE: SERIALIZER = () => ({
  });
}
