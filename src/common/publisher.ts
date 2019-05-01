import { Timer } from './timer';

export class Publisher<T = string> {
  private observers = Array<{handler: () => void, type: T}>();
  private delayedTypes: Set<T> = new Set();
  private timer: Timer;

  constructor() {
    this.timer = new Timer(this.notify);
  }

  subscribe(handler: () => void, type?: T): void {
    if (this.observers.find(item => handler == item.handler && item.type == type))
      return;
    this.observers.push({handler, type});
  }

  unsubscribe(handler: () => void, type?: T): void {
    const i = this.observers.findIndex(item => handler == item.handler && item.type == type);
    if (i != -1)
      this.observers.splice(i, 1);
  }

  notify = (type?: T): void => {
    this.timer.stop();

    this.observers.forEach(item => {
      try {
        if (!item.type || item.type == type || this.delayedTypes.has(item.type))
          item.handler();
      } catch (e) {
        console.log(e);
      }
    });
    this.delayedTypes.clear();
  }

  delayedNotify(args?: {ms?: number, type?: T}): void {
    args = args || {
      ms: 10
    };

    if (this.timer.isRunning() && this.delayedTypes.has(args.type))
      return;

    this.delayedTypes.add(args.type);
    this.timer.run(args.ms || 10);
  }
}
