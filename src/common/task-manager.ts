interface TaskItem {
  runner: () => Promise<void>;
  resolve(res: any): void;
  reject(res: any): void;
}

export interface TaskManagerI {
  pushTask<T>(runner: () => Promise<any>, userId?: string): Promise<T>;
}

export class TaskManager implements TaskManagerI {
  private parallelTasks = Array< Promise<any> >();
  private taskQueue = Array<TaskItem>();
  private maxParallelTasks: number = 3;

  constructor(maxParallelTasks?: number) {
    if (maxParallelTasks != null)
      this.maxParallelTasks = maxParallelTasks;
  }

  setMaxParallelTasks(max: number) {
    this.maxParallelTasks = max;
  }

  getMaxParallelTasks() {
    return this.maxParallelTasks;
  }

  pushTask<T>(runner: () => Promise<any>, userId?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ runner, resolve, reject });
      this.runParallel();
    });
  }

  private runParallel() {
    if (!this.taskQueue.length)
      return;

    while (this.taskQueue.length && this.parallelTasks.length < this.maxParallelTasks) {
      let taskArr = this.taskQueue.splice(0, 1);
      let p = taskArr[0].runner();
      p.then(taskArr[0].resolve);
      p.catch(taskArr[0].reject);
      p.finally(() => {
        this.parallelTasks.splice(this.parallelTasks.indexOf(p), 1);
        this.runParallel();
      });

      this.parallelTasks.push(p);
    }

    console.log('parallel tasks', this.parallelTasks.length);
  }
}
