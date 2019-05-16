import { ProjectBase } from '../../base/project';
import { SERIALIZER } from '../../objio/item';
import { ServerInstance } from './server-instance';
import { UserObjectDesc } from '../../base/user-object';

export class Project extends ProjectBase {
  constructor() {
    super();

    this.holder.setMethodsToInvoke({
      'getCurrUserDesc': {
        method: (args: Object, userId: string) => this.getCurrUserDesc(userId),
        rights: 'read'
      }
    });

    this.holder.addEventHandler({
      onLoad: () => {
        return Promise.resolve();
      }
    });
  }

  getCurrUserDesc(userId?: string): Promise<UserObjectDesc> {
    return Promise.resolve(ServerInstance.get().getUserById(userId).getUserDesc());
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...ProjectBase.SERIALIZE()
  })
}