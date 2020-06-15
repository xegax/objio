import { TaskBase } from '../base/task';
import { OBJIOItem, SERIALIZER } from '../objio/item';
import { OBJIOArray } from '../objio/array';

export class TaskManagerBase extends OBJIOItem {
  protected taskQueue = new OBJIOArray<TaskBase>();
  protected pool = new OBJIOArray<TaskBase>();
  protected poolSize: number = 3;

  constructor(poolSize?: number) {
    super();
    if (poolSize != null)
      this.poolSize = poolSize;
  }

  setPoolSize(size: number) {
    this.poolSize = size;
  }

  getMaxPoolSize() {
    return this.poolSize;
  }

  getPool() {
    return this.pool;
  }

  getQueue() {
    return this.taskQueue;
  }

  static TYPE_ID = 'TaskManager';
  static SERIALIZE: SERIALIZER = () => ({
    taskQueue:  { type: 'object', const: true },
    pool:       { type: 'object', const: true },
    poolSize:   { type: 'number', const: true }
  })
}

export class TaskClientBaseManager extends TaskManagerBase {
}
