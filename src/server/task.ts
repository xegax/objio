import { TaskBase } from '../base/task';
import { Timer } from '../common/timer';

export abstract class TaskServerBase extends TaskBase {
  private p: Promise<any>;
  private t = new Timer(() => {
    this.holder.save();
    this.holder.notify('save', this);
  });

  constructor() {
    super();

    this.holder.setMethodsToInvoke({
      'stop': {
        method: () => this.stop(),
        rights: 'write'
      },
      'pause': {
        method: () => this.pause(),
        rights: 'write'
      },
      'resume': {
        method: () => this.resume(),
        rights: 'write'
      }
    });

    this.p = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  private resolve = (res: any) => {};
  private reject = (res: any) => {};

  promise() {
    return this.p;
  }

  save() {
    if (!this.t.isRunning())
      this.t.run(2000);
  }

  run() {
    if (this.status == 'running')
      return Promise.reject('Task is already running');

    return (
      this.runImpl()
      .then(res => {
        this.status = 'running';
        this.holder.save();

        return (
          res.task.then(res => {
            this.progress = 1;
            this.status = 'stop';
            this.holder.save();
            this.resolve(res);
          })
          .catch(err => {
            this.progress = 0;
            this.status = 'stop';
            this.errors.push(err);
            this.holder.save();
            this.reject(err);
          })
        );
      })
    );
  }

  protected abstract runImpl(): Promise< { task: Promise<void> } >;
  protected abstract stopImpl(): Promise<void>;
  protected abstract pauseImpl(): Promise<void>;
  protected abstract resumeImpl(): Promise<void>;

  stop(): Promise<void> {
    if (this.status != 'running')
      return Promise.reject('Task is not running');

    return (
      this.stopImpl()
      .then(() => {
        this.progress = 0;
        this.status = 'stop';
        this.holder.save();
      })
    );
  }

  pause(): Promise<void> {
    if (this.status != 'running')
      return Promise.reject('Task is not running');

    return (
      this.pauseImpl()
      .then(() => {
        this.status = 'pause';
        this.holder.save();
      })
    );
  }

  resume(): Promise<void> {
    if (this.status != 'pause')
      return Promise.reject('Task is not paused');

    return (
      this.resumeImpl()
      .then(() => {
        this.status = 'running';
        this.holder.save();
      })
    );
  }
}
