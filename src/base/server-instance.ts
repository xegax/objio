import { SERIALIZER, OBJIOItem } from '../objio/item';
import { OBJIOArray } from '../objio/array';
import { UserObjectBase } from './user-object';
import { RequestStat, createEmptyRequestStat } from './statistics';

export interface TargetUserArgs {
  id: string;
}

export interface NewUserArgs {
  login: string;
  email: string;
  password?: string;
}

export abstract class ServerInstanceBase extends OBJIOItem {
  protected users = new OBJIOArray<UserObjectBase>();
  protected sessStat: RequestStat = createEmptyRequestStat();
  protected totalStat: RequestStat = createEmptyRequestStat();

  getUsers(): Array<UserObjectBase> {
    return this.users.getArray();
  }

  abstract kickUser(args: TargetUserArgs): Promise<void>;
  abstract addUser(args: NewUserArgs): Promise<void>;
  abstract removeUser(args: TargetUserArgs): Promise<void>;

  getSessStat(): RequestStat {
    return this.sessStat;
  }

  getTotalStat(): RequestStat {
    return this.totalStat;
  }

  static TYPE_ID = 'SpecialServerInstanceObject';
  static SERIALIZE: SERIALIZER = () => ({
    users:  { type: 'object', const: true },
    sessStat:   { type: 'json', const: true },
    totalStat:  { type: 'json', const: true }
  })
}
