import { SERIALIZER } from '../../objio/item';
import { ServerInstanceBase } from '../../base/server-instance';
import { UserObject, AccessType } from './user-object';

export interface FindUserArgs {
  login: string;
  password: string;
}

export class ServerInstance extends ServerInstanceBase {
  private static instance: ServerInstance;

  static get(): ServerInstance {
    return ServerInstance.instance;
  }

  static createNew(): ServerInstance {
    let srv = new ServerInstance();
    srv.users.push(new UserObject({ login: 'admin', password: '' }));
    return srv;
  }

  constructor() {
    super();
    ServerInstance.instance = this;
  }

  hasRight(user: UserObject, right: AccessType): boolean {
    return true;
  }

  findUser(args: FindUserArgs): UserObject {
    const idx = this.users.find((v: UserObject) => v.getLogin() == args.login && v.getPasswd() == args.password );
    return this.users.get(idx) as UserObject;
  }

  getUserById(userId: string): UserObject {
    const idx = this.users.find((v: UserObject) => v.getUserId() == userId);
    return this.users.get(idx) as UserObject;
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...ServerInstanceBase.SERIALIZE()
  })
}
