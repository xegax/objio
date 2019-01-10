import { ServerInstanceBase, TargetUserArgs, NewUserArgs } from '../../base/server-instance';

export class ServerInstance extends ServerInstanceBase {
  kickUser(args: TargetUserArgs): Promise<void> {
    return this.holder.invokeMethod({ method: 'kickUser', args });
  }

  addUser(args: NewUserArgs): Promise<void> {
    return this.holder.invokeMethod({ method: 'addUser', args });
  }

  removeUser(args: TargetUserArgs): Promise<void> {
    return this.holder.invokeMethod({ method: 'removeUser', args });
  }
}
