export class SerialPromise {
  private arr = new Array<() => Promise<any>>();
  private task: Promise<any>;

  append(task: () => Promise<any>): Promise<any> {
    this.arr.push(task);

    return this.runOrGet();
  }

  private runOrGet() {
    if (this.task)
      return this.task;

    return this.task = new Promise(async resolve => {
      while (this.arr.length) {
        await this.arr.splice(0, 1)[0]();
      }
      this.task = null;
      resolve();
    });
  }
}
