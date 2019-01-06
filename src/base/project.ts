import { OBJIOItem, SERIALIZER } from '../objio/item';
import { OBJIOArray } from '../objio/array';
import { UserObjectDesc } from './user-object';

export { UserObjectDesc };

export abstract class ProjectBase extends OBJIOItem {
  protected objects = new OBJIOArray<OBJIOItem>();
  protected name: string = 'unnamed';

  getObjects(): OBJIOArray<OBJIOItem> {
    return this.objects;
  }

  async appendObject(obj: OBJIOItem) {
    await this.holder.createObject(obj);
    this.objects.push(obj).save();
    this.holder.save();
  }

  setName(name: string) {
    if (this.name == name)
      return;

    this.name = name;
    this.holder.save();
  }

  getName(): string {
    return this.name;
  }

  abstract getCurrUserDesc(): Promise<UserObjectDesc>;

  static TYPE_ID = 'SpecialProjectObject';
  static SERIALIZE: SERIALIZER = () => ({
    'objects': { type: 'object' },
    'name':    { type: 'string' }
  })
}
