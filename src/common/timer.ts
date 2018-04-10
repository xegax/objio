export class Timer {
  private timerId: number = -1;
  private repeat: boolean = false;
  private callbacks: (() => void)[] = [];
  private time: number;

  constructor(callback?: () => void) {
    if (callback)
      this.callbacks = [callback];
  }

  runRepeat(time: number) {
    this.stop();

    this.repeat = true;
    this.timerId = setInterval(() => this.doRunCallbacks(), time) as any;
    this.time = time;
    return this;
  }

  run(time: number) {
    this.stop();

    this.repeat = false;
    this.timerId = setTimeout(() => {
      this.timerId = -1;
      this.doRunCallbacks();
    }, time) as any;
    this.time = time;
    return this;
  }

  stop() {
    if (this.timerId != -1) {
      if (this.repeat) {
        clearInterval(this.timerId);
      } else {
        clearTimeout(this.timerId);
      }
      this.timerId = -1;
    }
    return this;
  }

  isRunning() {
    return this.timerId != -1;
  }

  runCallbacks() {
    if (this.isRunning()) {
      if (this.repeat) {
        this.runRepeat(this.time);
      } else {
        this.stop();
      }
    }

    this.doRunCallbacks();
    return this;
  }

  addUniqueCallback(callback: () => void) {
    if (!callback)
      return false;

    let i = this.callbacks.indexOf(callback);
    if (i !== -1)
      return false;

    this.callbacks.push(callback);
    return true;
  }

  removeCallback(callback: () => void) {
    let i = this.callbacks.indexOf(callback);
    if (i === -1)
      return false;

    this.callbacks.splice(i, 1);
    return true;
  }

  findCallback(callback: () => void) {
    return this.callbacks.indexOf(callback);
  }

  getCallbacksCount() {
    return this.callbacks.length;
  }

  private doRunCallbacks() {
    this.callbacks.forEach((callback) => callback());
  }
}
