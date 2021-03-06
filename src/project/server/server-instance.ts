import { SERIALIZER } from '../../objio/item';
import { ServerInstanceBase, TargetUserArgs, NewUserArgs } from '../../base/server-instance';
import { UserObject, AccessType } from './user-object';
import { RequestStat, createEmptyRequestStat } from '../../base/statistics';
import { Timer } from '../../common/timer';

export interface FindUserArgs {
  login: string;
  password: string;
}

export interface Handler {
  kickUser(user: UserObject): Promise<void>;
}

let instance: ServerInstance;

export class ServerInstance extends ServerInstanceBase {
  private handler: Handler = null;
  private saveTimer = new Timer(() => this.holder.save());

  static get(): ServerInstance {
    return instance;
  }

  static createNew(): ServerInstance {
    let srv = new ServerInstance();

    srv.users.push(new UserObject({
      login: 'admin',
      email: '',
      password: '',
      rights: ['create', 'read', 'write'],
      type: 'admin'
    }));

    srv.users.push(UserObject.guest = new UserObject({
      login: 'guest',
      email: '',
      password: '',
      rights: ['read'],
      type: 'guest'
    }));

    return srv;
  }

  constructor() {
    super();

    instance = this;

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

    this.holder.addEventHandler({
      onLoad: () => {
        this.sessStat = createEmptyRequestStat();
        this.sessStat.time = Date.now();
        this.totalStat.startCount++;

        const users = this.users.getArray() as Array<UserObject>;
        UserObject.guest = users.find(user => user.getType() == 'guest');
        UserObject.admin = users.find(user => user.getType() == 'admin');

        return Promise.resolve();
      }
    });
  }

  onClose(): Promise<void> {
    this.totalStat.time += Date.now() - this.sessStat.time;
    return this.holder.save();
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
      return Promise.reject('User name can not be empty');

    const idx = this.users.find(u => u.getLogin() == args.login || u.getEmail() == args.email);
    if (idx != -1)
      return Promise.reject(`user ${args.login} already exists`);

    let newUser = new UserObject({
      login: args.login,
      password: args.password || '',
      email: args.email,
      rights: ['write', 'create', 'read']
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
      return Promise.reject('User not found');

    const usr = this.users.get(idx) as UserObject;
    if (usr.getType() != 'regular')
      return Promise.reject('This type of user could not be deleted');

    this.users.remove(idx);
    this.users.holder.save();
    return Promise.resolve();
  }

  hasRight(user: UserObject, right: AccessType): boolean {
    return user.getRights().indexOf(right) != -1;
  }

  findUser(args: FindUserArgs): UserObject {
    const idx = this.users.find((v: UserObject) => v.getLogin() == args.login && v.getPasswd() == args.password );
    return this.users.get(idx) as UserObject;
  }

  getUserById(userId: string): UserObject {
    const idx = this.users.find((v: UserObject) => v.getUserId() == userId);
    return this.users.get(idx) as UserObject;
  }

  pushRequestStat(stat: Partial<RequestStat>) {
    if (stat.createNum) {
      this.sessStat.createNum += stat.createNum;
      this.totalStat.createNum += stat.createNum;
    }

    if (stat.getFilesNum) {
      this.sessStat.getFilesNum += stat.getFilesNum;
      this.totalStat.getFilesNum += stat.getFilesNum;
    }

    if (stat.invokeNum) {
      this.sessStat.invokeNum += stat.invokeNum;
      this.totalStat.invokeNum += stat.invokeNum;
    }

    if (stat.readNum) {
      this.sessStat.readNum += stat.readNum;
      this.totalStat.readNum += stat.readNum;
    }

    if (stat.recvBytes) {
      this.sessStat.recvBytes += stat.recvBytes;
      this.totalStat.recvBytes += stat.recvBytes;
    }

    if (stat.sentBytes) {
      this.sessStat.sentBytes += stat.sentBytes;
      this.totalStat.sentBytes += stat.sentBytes;
    }

    if (stat.requestNum) {
      this.sessStat.requestNum += stat.requestNum;
      this.totalStat.requestNum += stat.requestNum;
    }

    if (stat.writeNum) {
      this.sessStat.writeNum += stat.writeNum;
      this.totalStat.writeNum += stat.writeNum;
    }

    if (stat.taskNum) {
      this.sessStat.taskNum += stat.taskNum;
      this.totalStat.taskNum += stat.taskNum;
    }

    if (!this.saveTimer.isRunning())
      this.saveTimer.run(5000);
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...ServerInstanceBase.SERIALIZE()
  })
}
