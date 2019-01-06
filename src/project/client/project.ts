import { ProjectBase, UserObjectDesc } from '../../base/project';
export { UserObjectDesc };
 
export class Project extends ProjectBase {
  getCurrUserDesc(): Promise<UserObjectDesc> {
    return this.holder.invokeMethod({ method: 'getCurrUserDesc', args: {} });
  }
}
