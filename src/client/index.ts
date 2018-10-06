import { OBJIOItemClass } from '../objio/item';
import { Project } from './project';
import { User } from './user';
import { UserGroup } from './user-group';
import { ServerInstance } from './server-instance';

export function getClasses(): Array<OBJIOItemClass> {
  return [
    Project,
    User,
    UserGroup,
    ServerInstance
  ];
}
