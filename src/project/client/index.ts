import { Project, UserObjectDesc } from './project';
import { ServerInstance } from './server-instance';
import { UserObject } from './user-object';

export { Project, ServerInstance, UserObject, UserObjectDesc };

export function getClasses() {
  return [
    Project,
    ServerInstance,
    UserObject
  ];
}
