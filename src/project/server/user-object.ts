import { UserObjectBase, AccessType } from '../../base/user-object';
import { SERIALIZER } from '../../objio/item';

export { AccessType };

export interface UserArgs {
  login: string;
  password: string;
}

export class UserObject extends UserObjectBase {
  protected password: string;
  protected userId: string = [0, 0].map(() => Math.random().toString(32).substr(2)).join('');

  constructor(args?: UserArgs) {
    super();

    if (args) {
      this.login = args.login;
      this.password = args.password;
    }
  }

  getUserId(): string {
    return this.userId;
  }

  getPasswd(): string {
    return this.password;
  }

  getLogin(): string {
    return this.login;
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...UserObjectBase.SERIALIZE(),
    password: { type: 'string', tags: [ 'sr' ] },
    userId:   { type: 'string', tags: [ 'sr' ] }
  })
}
