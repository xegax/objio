import { UserObjectBase, UserObjectDesc, SessionStat, ModifyArgs } from '../../base/user-object';

export { UserObjectDesc, SessionStat };

export class UserObject extends UserObjectBase {
  getLastSessionStat(): Promise<SessionStat> {
    return this.holder.invokeMethod({ method: 'getLastSessionStat', args: {} });
  }

  getTotalStat(): Promise<SessionStat> {
    return this.holder.invokeMethod({ method: 'getTotalStat', args: {} });
  }

  modify(args: Partial<ModifyArgs>): Promise<void> {
    return this.holder.invokeMethod({ method: 'modify', args });
  }
}
