import { SERIALIZER } from '../../objio/item';
import { UserGroup as Base, AdminGroup } from '../client/user-group';

export {
  AdminGroup
};

export interface UserGroupArgs {
  name: string;
  rights: Array<string>;
}

export class UserGroup extends Base {
  constructor(args?: UserGroupArgs) {
    super();

    if (args) {
      this.name = args.name;
      this.rights = args.rights.slice();
    }
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...Base.SERIALIZE()
  })
}
