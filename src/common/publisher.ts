import { Timer } from './timer';

export class Publisher<T extends string = string> {
  private observers = Array<{handler: (args?: Object) => void, type: T}>();
  private delayedTypes: {[t: string]: Object} = {};
  private timer: Timer;

  constructor() {
    this.timer = new Timer(this.notify);
  }

  subscribe(handler: (args?: Object) => void, type?: T): void {
    if (this.observers.find(item => handler == item.handler && item.type == type))
      return;
    this.observers.push({handler, type});
  }

  unsubscribe(handler: (args?: Object) => void, type?: T): void {
    const i = this.observers.findIndex(item => handler == item.handler && item.type == type);
    if (i != -1)
      this.observers.splice(i, 1);
  }

  notify = (type?: T, args?: Object): void => {
    this.timer.stop();

    this.observers.forEach(observer => {
      try {
        if (observer.type == type || observer.type in this.delayedTypes)
          observer.handler(args || this.delayedTypes[type]);
      } catch (e) {
        console.log(e);
      }
    });
    this.delayedTypes = {};
  }

  delayedNotify(args?: {ms?: number, type?: T, args?: Object}): void {
    args = { ms: 10, ...args };

    if (!this.timer.isRunning())
      this.timer.run(args.ms);

    if (!args.type)
      return;

    this.delayedTypes[args.type] = {...args.args};
  }
}
