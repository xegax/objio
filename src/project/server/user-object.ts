import { UserObjectBase, AccessType, SessionStat, UserArgs, ModifyArgs } from '../../base/user-object';
import { SERIALIZER } from '../../objio/item';
import { Timer } from '../../common/timer';
import { ServerInstance } from './server-instance';

export { AccessType };

export class UserObject extends UserObjectBase {
  protected password: string;
  protected userId: string = [0, 0].map(() => Math.random().toString(32).substr(2)).join('');
  protected lastSessStat: SessionStat = {
    startTime: 0,
    time: 0,
    invokesNum: 0,
    writesNum: 0,
    readsNum: 0,
    createsNum: 0,
    requestsNum: 0,
    sessionsNum: 0
  };
  protected saveTimer = new Timer(() => this.holder.save());

  protected totalStat: SessionStat = {
    startTime: 0,
    time: 0,
    invokesNum: 0,
    writesNum: 0,
    readsNum: 0,
    createsNum: 0,
    requestsNum: 0,
    sessionsNum: 0
  };

  constructor(args?: UserArgs) {
    super(args);

    if (args) {
      this.login = args.login;
      this.email = args.email;
      this.password = args.password;
    }

    this.holder.setMethodsToInvoke({
      getLastSessionStat: {
        method: () => this.getLastSessionStat(),
        rights: 'read'
      },
      getTotalStat: {
        method: () => this.getTotalStat(),
        rights: 'read'
      },
      modify: {
        method: (args: ModifyArgs) => this.modify(args),
        rights: 'write'
      }
    });
  }

  getUserId(): string {
    return this.userId;
  }

  getPasswd(): string {
    return this.password;
  }

  modify(args: ModifyArgs) {
    let save = 0;
    if (args.login && args.login != this.login) {
      const user = ServerInstance.get().getUsers().find(u => {
        return u.getLogin() == args.login;
      });

      if (user)
        return Promise.reject(`user ${user.getLogin()} already exists`);

      this.login = args.login;
      save++;
    }

    if (args.email && args.email != this.email) {
      const user = ServerInstance.get().getUsers().find(u => {
        return u.getEmail() == args.email;
      });

      if (user)
        return Promise.reject(`user with email ${user.getEmail()} already exists`);

      this.email = args.email;
      save++;
    }

    if (args.name && args.name != this.name) {
      this.name = args.name;
      save++;
    }

    if (args.password != null && args.password != this.password) {
      this.password = '' + args.password;
      save++;
    }

    if (save)
      this.holder.save();

    return Promise.resolve();
  }

  onStartSession() {
    this.lastSessStat = {
      startTime: Date.now(),
      sessionsNum: 0,
      writesNum: 0,
      readsNum: 0,
      createsNum: 0,
      invokesNum: 0,
      requestsNum: 0,
      time: 0
    };
    this.totalStat.sessionsNum++;
    this.setOnline(true);
    this.save();
  }

  onEndSession() {
    this.lastSessStat.time = Date.now() - this.lastSessStat.startTime;
    this.totalStat.time += this.lastSessStat.time;
    this.setOnline(false);
    this.save();
  }

  pushRequestStat(type: AccessType | 'invoke' | 'other') {
    if (type == 'write') {
      this.lastSessStat.writesNum++;
      this.totalStat.writesNum++;
    } else if (type == 'read') {
      this.lastSessStat.readsNum++;
      this.totalStat.readsNum++;
    } else if (type == 'create') {
      this.lastSessStat.createsNum++;
      this.totalStat.createsNum++;
    } else if (type == 'invoke') {
      this.lastSessStat.invokesNum++;
      this.totalStat.invokesNum++;
    }
    this.lastSessStat.requestsNum++;
    this.totalStat.requestsNum++;

    this.lastSessStat.time = Date.now() - this.lastSessStat.startTime;
    this.save(type == 'read' ? 5000 : 1);
  }

  save(ms: number = 1) {
    if (this.saveTimer.isRunning())
      return;

    this.saveTimer.run(ms);
  }

  getLastSessionStat(): Promise<SessionStat> {
    return Promise.resolve({...this.lastSessStat});
  };

  getTotalStat(): Promise<SessionStat> {
    return Promise.resolve({...this.totalStat});
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...UserObjectBase.SERIALIZE(),
    password:     { type: 'string', tags: [ 'sr' ] },
    userId:       { type: 'string', tags: [ 'sr' ] },
    lastSessStat: { type: 'json',   tags: [ 'sr' ] },
    totalStat:    { type: 'json',   tags: [ 'sr' ] }
  })
}
