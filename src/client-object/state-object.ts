import { OBJIOItem, SERIALIZER } from '../objio/item';

export type StateType = 'notConfigured' | 'valid' | 'inProgress' | 'error';

export class StateObject extends OBJIOItem {
  protected progressMsg: string = '';
  protected progress: number = 0;
  protected state: StateType = 'notConfigured';

  isValid(): boolean {
    return this.state == 'valid';
  }

  getType(): StateType {
    return this.state;
  }

  getProgress(): number {
    return this.progress;
  }

  getProgressMsg(): string {
    return this.progressMsg;
  }

  setProgress(p: number): StateObject {
    this.progress = p;
    return this;
  }

  setProgressMsg(msg: string): StateObject {
    this.progressMsg = msg;
    return this;
  }

  setStateType(type: StateType): StateObject {
    this.state = type;
    return this;
  }

  save(): void {
    this.holder.save();
  }

  static TYPE_ID = 'StateObject';
  static SERIALIZE: SERIALIZER = () => ({
    'progressMsg': { type: 'string' },
    'progress': { type: 'number' },
    'state': { type: 'string' }
  });
}
