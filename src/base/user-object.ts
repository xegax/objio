import { OBJIOItem, SERIALIZER } from '../objio/item';
import { AccessType } from './security';

export { AccessType };

export interface UserObjectDesc {
  login: string;
  name: string;
}

export interface UserArgs {
  login: string;
  password: string;
  email: string;
  rights: Array<AccessType>;
}

export interface ModifyArgs {
  email: string;
  name: string;
  login: string;
  password: string;
}

export interface SessionStat {
  startTime: number;
  time: number;
  sessionsNum: number;
  invokesNum: number;
  writesNum: number;
  readsNum: number;
  createsNum: number;
  requestsNum: number;
  taskNum: number;
}

export abstract class UserObjectBase extends OBJIOItem {
  protected name: string;
  protected login: string;
  protected email: string;
  protected online: number = 0;
  protected rights = new Array<AccessType>();

  constructor(args?: UserArgs) {
    super();

    if (args) {
      this.login = args.login;
      this.email = args.email;
      this.rights = args.rights;
    }
  }

  isOnline() {
    return !!this.online;
  }

  setOnline(online: boolean) {
    let value = online ? 1 : 0;
    if (this.online == value)
      return false;

    this.online = value;
    this.holder.save();
  }

  getName() {
    return this.name;
  }

  getRights() {
    return this.rights;
  }

  getLogin() {
    return this.login;
  }

  getEmail() {
    return this.email;
  }

  getUserDesc(): UserObjectDesc {
    return {
      login: this.login,
      name: this.name
    };
  }

  abstract getLastSessionStat(): Promise<SessionStat>;
  abstract getTotalStat(): Promise<SessionStat>;
  abstract modify(args: Partial<ModifyArgs>): Promise<void>;

  static TYPE_ID = 'SpecialUserObject';
  static SERIALIZE: SERIALIZER = () => ({
    'name': { type: 'string' },
    'login': { type: 'string', const: true },
    'email': { type: 'string', const: true },
    'online': { type: 'number', const: true },
    'rights': { type: 'json', const: true }
  });
}
