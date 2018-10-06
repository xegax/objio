import { OBJIOItem, SERIALIZER } from '../objio/item';
import { AccessType } from './user';

export interface UserDesc {
  name: string;
  permissions: Array<AccessType>;
}

export class Project<T extends OBJIOItem = OBJIOItem> extends OBJIOItem {
  protected root: T;
  protected name: string;
  protected watchingUsers = Array<string>();

  getRoot(): T {
    return this.root;
  }

  setRoot(root: T): void {
    if (this.root)
      throw 'root already set';

    this.root = root;
    this.holder.save();
  }

  setName(name: string) {
    if (this.name == name)
      return;

    this.name = name;
    this.holder.save();
  }

  getName(): string {
    return this.name;
  }

  getUserDesc = (): Promise<UserDesc> => {
    return this.holder.invokeMethod({ method: 'getUserDesc', args: {} });
  }

  getWatchers(): Array<string> {
    return this.watchingUsers;
  }

  static TYPE_ID = 'Project';
  static SERIALIZE: SERIALIZER = () => ({
    'watchingUsers':  { type: 'json',   const: true },
    'root':           { type: 'object' },
    'name':           { type: 'string' }
  })
}
