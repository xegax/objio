import { TaskManagerBase } from '../common/task-manager';
import { TaskBase } from '../base/task';
import { TaskServerBase } from './task';

export interface ITaskManager {
  pushTask<T = any>(task: TaskBase, userId?: string): Promise<T>;
}

export class TaskManagerServer extends TaskManagerBase {
  pushTask(task: TaskServerBase, userId?: string): Promise<any> {
    return (
      this.holder.createObject(task)
      .then(() => {
        this.taskQueue.push(task).save();
        this.checkPool();

        return task.promise();
      })
    );
  }

  private checkPool = () => {
    if (!this.taskQueue.getLength() && !this.pool.getLength())
      return;

    let save = 0;
    for (let n = this.pool.getLength() - 1; n >= 0; n--) {
      const task = this.pool.get(n);
      if (task.getStatus() == 'stop') {
        this.pool.remove(n);
        save++;
      }
    }

    while (this.taskQueue.getLength() && this.pool.getLength() < this.poolSize) {
      const task = this.taskQueue.remove(0)[0] as TaskServerBase;
      task.run().finally(this.checkPool);
      this.pool.push(task);
      save++;
    }

    if (save) {
      this.pool.holder.save(true);
      this.taskQueue.holder.save(true);
    }
    console.log('Parallel tasks', this.pool.getLength());
  }
}
