import { OBJIOItemClass } from '../../objio/item';
import { Project } from './project';
import { UserObject } from './user-object';
import { UserGroup } from './user-group';
import { ServerInstance } from './server-instance';

export function getClasses(): Array<OBJIOItemClass> {
  return [
    Project,
    UserObject,
    UserGroup,
    ServerInstance
  ];
}
