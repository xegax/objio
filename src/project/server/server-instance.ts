import { SERIALIZER } from '../../objio/item';
import { ServerInstanceBase, TargetUserArgs, NewUserArgs } from '../../base/server-instance';
import { UserObject, AccessType } from './user-object';

export interface FindUserArgs {
  login: string;
  password: string;
}

export interface Handler {
  kickUser(user: UserObject): Promise<void>;
}

export class ServerInstance extends ServerInstanceBase {
  private static instance: ServerInstance;
  private handler: Handler = null;

  static get(): ServerInstance {
    return ServerInstance.instance;
  }

  static createNew(): ServerInstance {
    let srv = new ServerInstance();
    srv.users.push(new UserObject({ login: 'admin', password: '', email: '' }));
    return srv;
  }

  constructor() {
    super();
    ServerInstance.instance = this;

    this.holder.setMethodsToInvoke({
      kickUser: {
        method: (args: TargetUserArgs) => this.kickUser(args),
        rights: 'write'
      },
      addUser: {
        method: (args: NewUserArgs) => this.addUser(args),
        rights: 'write'
      },
      removeUser: {
        method: (args: TargetUserArgs) => this.removeUser(args),
        rights: 'write'
      }
    });
  }
  
  setHandler(handler: Handler) {
    this.handler = handler;
  }

  kickUser(args: TargetUserArgs) {
    if (!this.handler)
      return Promise.reject('handler not defined');

    const user = this.users.get(this.users.find(f => f.holder.getID() == args.id)) as UserObject;
    if (!user)
      return Promise.reject('object not found');

    return this.handler.kickUser(user);
  }

  addUser(args: NewUserArgs) {
    if (!args.login.trim())
      return Promise.reject('user name can not be empty');

    const idx = this.users.find(u => u.getLogin() == args.login || u.getEmail() == args.email);
    if (idx != -1)
      return Promise.reject(`user ${args.login} already exists`);

    let newUser = new UserObject({
      login: args.login,
      password: args.password || '',
      email: args.email
    });
    return this.holder.createObject(newUser)
    .then(() => {
      this.users.push(newUser);
      this.users.holder.save();
    });
  }

  removeUser(args: TargetUserArgs) {
    const idx = this.users.find(u => u.holder.getID() == args.id);
    if (idx == -1)
      return Promise.reject('object not found');

    this.users.remove(idx);
    this.users.holder.save();
    return Promise.resolve();
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
