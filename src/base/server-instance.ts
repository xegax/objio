import { SERIALIZER, OBJIOItem } from '../objio/item';
import { OBJIOArray } from '../objio/array';
import { UserObjectBase } from './user-object';

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

  getUsers(): Array<UserObjectBase> {
    return this.users.getArray();
  }

  abstract kickUser(args: TargetUserArgs): Promise<void>;
  abstract addUser(args: NewUserArgs): Promise<void>;
  abstract removeUser(args: TargetUserArgs): Promise<void>;

  static TYPE_ID = 'SpecialServerInstanceObject';
  static SERIALIZE: SERIALIZER = () => ({
    users:  { type: 'object', const: true }
  })
}
