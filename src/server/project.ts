import { Project as Base } from '../client/project';
import { SERIALIZER, OBJIOItem } from '../objio/item';
import { User } from './user';
import { Timer } from '../common/timer';

export class Project<T extends OBJIOItem = OBJIOItem> extends Base {
  private watchingUserIds: { [userId: string]: User } = {};
  private saveTimer = new Timer(() => this.holder.save());

  constructor() {
    super();

    this.holder.setMethodsToInvoke({
      'getUserDesc': {
        method: this.getUserDesc,
        rights: 'read'
      }
    });
  }

  getUserDesc = () => {
    return Promise.resolve(null);
  }

  addWatchingUser(user: User): void {
    const userId = user.getUserId();
    if (this.watchingUserIds[ userId ])
      return;

    this.watchingUserIds[userId] = user;
    this.watchingUsers.push(user.login);
    this.saveTimer.run(2000);
  }

  removeWatchingUser(user: User): void {
    const userId = user.getUserId();
    if (!this.watchingUserIds[ userId ])
      return;

    delete this.watchingUserIds[userId];
    this.watchingUsers.splice( this.watchingUsers.indexOf(user.login), 1 );
    this.saveTimer.run(2000);
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...Base.SERIALIZE(),
    'watchingUsers':  { type: 'json' }
  })
}
