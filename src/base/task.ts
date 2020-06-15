import { OBJIOItem, SERIALIZER } from '../objio/item';

export abstract class TaskBase extends OBJIOItem {
  protected name?: string;
  protected desc?: string;
  protected progress: number = 0;
  protected errors = Array<string>();
  protected status: 'running' | 'pause' | 'stop';

  abstract stop(): Promise<void>;
  abstract pause(): Promise<void>;
  abstract resume(): Promise<void>;

  getStatus() {
    return this.status;
  }

  getProgress() {
    return this.progress;
  }

  setProgress(p: number) {
    this.progress = p;
  }

  getErrors() {
    return this.errors;
  }

  getDesc() {
    return this.desc || '';
  }

  getName() {
    return this.name || '';
  }

  static TYPE_ID = 'Task';
  static SERIALIZE: SERIALIZER = () => ({
    name:     { type: 'string', const: true },
    progress: { type: 'number', const: true },
    desc:     { type: 'string', const: true },
    errors:   { type: 'json', const: true },
    status:   { type: 'string', const: true }
  })
}

export class TaskClientBase extends TaskBase {
  stop(): Promise<void> {
    return this.holder.invokeMethod({ method: 'stop', args: {} });
  }

  pause(): Promise<void> {
    return this.holder.invokeMethod({ method: 'pause', args: {} });
  }

  resume(): Promise<void> {
    return this.holder.invokeMethod({ method: 'resume', args: {} });
  }
}
