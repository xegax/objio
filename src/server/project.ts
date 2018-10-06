import { Project as Base } from '../client/project';
import { SERIALIZER, OBJIOItem } from '../objio/item';
import { User } from './user';
import { Timer } from '../common/timer';

export class Project<T extends OBJIOItem = OBJIOItem> extends Base {
  private watchingUserIds: { [userId: string]: { user: User } } = {};
  private saveTimer = new Timer(() => {
    this.watchingUsers = [];
    const time = Date.now();
    Object.keys(this.watchingUserIds).forEach(userId => {
      const item = this.watchingUserIds[userId];
      const stat = item.user.getStatistics();

      if (item.user.isWatching() || time - stat.watchingStartTime < 10000)
        this.watchingUsers.push(item.user.login);
      else
        delete this.watchingUserIds[userId];
    });

    console.log(this.watchingUsers);
    this.holder.save();
  });

  constructor() {
    super();

    this.holder.setMethodsToInvoke({
      'getUserDesc': {
        method: this.getUserDesc,
        rights: 'read'
      }
    });

    this.holder.addEventHandler({
      onLoad: () => {
        this.watchingUserIds = {};
        this.watchingUsers = [];
        return Promise.resolve();
      }
    });
  }

  getUserDesc = () => {
    return Promise.resolve(null);
  }

  onWatchingStart(user: User) {
    const userId = user.getUserId();
    this.watchingUserIds[userId] = { user };
    this.saveTimer.run(1000);
  }

  onWatchingEnd(user: User): void {
    this.saveTimer.run(10000);
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...Base.SERIALIZE(),
    'watchingUsers':  { type: 'json' }
  })
}
