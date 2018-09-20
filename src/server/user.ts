import { User as Base, AccessType } from '../client/user';
import { SERIALIZER } from '../objio/item';
import { UserGroup } from './user-group';

export { AccessType };

export interface UserArgs {
  login: string;
  password: string;
  rights: Array<AccessType>;
  groups: Array<string>;
}

export class User extends Base {
  protected password: string;
  protected userId: string = [0, 0].map(() => Math.random().toString(32).substr(2)).join('');
  protected group: Array<string> = [];
  protected rights: Array<AccessType> = [];

  constructor(args?: UserArgs) {
    super();

    if (args) {
      this.password = args.password;
      this.login = args.login;
      this.rights = args.rights.slice();
      this.group = args.groups.slice();
    }
  }

  getPassword(): string {
    return this.password;
  }

  getUserId(): string {
    return this.userId;
  }

  getGroups(): Array<string> {
    return this.group;
  }

  hasRight(accessType: AccessType, allGroups: Array<UserGroup>): boolean {
    const groups = allGroups.filter(group => this.group.indexOf(group.getName()) != -1);
    return this.rights.indexOf(accessType) != -1 || groups.some(group => group.hasRight(accessType));
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...Base.SERIALIZE(),
    password: { type: 'string', tags: [ 'sr' ] },
    userId:   { type: 'string', tags: [ 'sr' ] },
    group:    { type: 'json', tags: [ 'sr' ] },
    rights:   { type: 'json', tags: [ 'sr' ] }
  })
}
