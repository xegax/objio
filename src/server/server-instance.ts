import { SERIALIZER } from '../objio/item';
import { ServerInstance as Base } from '../client/server-instance';
import { User } from './user';
import { UserGroup, AdminGroup } from './user-group';
import { AccessType } from '../client/user';

export class ServerInstance extends Base<User, UserGroup> {
  protected adminGroup = new AdminGroup();

  constructor() {
    super();

    this.holder.addEventHandler({
      onCreate: () => {
        return (
          Promise.resolve()
          .then(() => this.addNewUser(new User({
            login: 'admin',
            password: '',
            rights: [ 'write', 'read', 'create' ],
            groups: [ this.adminGroup.getName() ]
          })))
        );
      }
    });
  }

  getUserGroups(user?: User): Array<UserGroup> {
    let groups = [this.adminGroup, ...this.groups.getArray()];
    if (!user)
      return groups;

    const userGroups = user.getGroups();
    return groups.filter(group => userGroups.some(name => name == group.getName()) );
  }

  addUserGroup(group: UserGroup): Promise<void> {
    if (this.findGroup( { name: group.getName() }))
      return Promise.reject(`Group "${group.getName()}" already exists`);
    
    return (
      this.holder.createObject(group)
      .then(() => {
        this.groups.push(group).save();
      })
    );
  }

  removeUserGroup(name: string): boolean {
    const i = this.groups.find(group => group.getName() == name);
    if (i == -1)
      return false;

    this.groups.remove(i);
    return true;
  }

  addNewUser(user: User): Promise<void> {
    if (this.findUser({ login: user.login }))
      return Promise.reject(`User login = ${user.login} already exists`);

    if (!user.getGroups().every(name => this.findGroup({ name }) != null))
      return Promise.reject(`Undefined user group`);
    
    return (
      this.holder.createObject(user)
      .then(() => {
        this.users.push(user).save();
      })
    );
  }

  findGroup(args: { name: string }): UserGroup {
    return this.getUserGroups().find(group => group.getName() == args.name);
  }

  findUser(args: { login: string; password?: string }): User {
    const pred = (user: User) => {
      if (user.login != args.login)
        return false;

      if (!('password' in args))
        return true;

      return user.getPassword() == args.password;
    };
    return this.users.get( this.users.find( pred ) );
  }

  hasRight(user: User, accessType: AccessType): boolean {
    return user.hasRight(accessType, this.getUserGroups());
  }

  isAdmin(user: User): boolean {
    const groups = this.getUserGroups(user);
    return groups.some(group => group.isAdmin());
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...Base.SERIALIZE()
  })
}
