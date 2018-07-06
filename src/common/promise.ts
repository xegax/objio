import { Timer } from './timer';

export class ExtPromise<T = void> implements Promise<T> {
  private promise: Promise<T>;
  private parent: ExtPromise<T>;
  private cancelPromise: boolean = false;

  constructor( r: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void,
               p?: ExtPromise<any>) {
    this.promise = new Promise(r);
    this.parent = p;
  }

  static resolve<T = any>(value: T | Promise<T>): ExtPromise<T> {
    return new ExtPromise<T>(resolve => resolve(value));
  }

  then<TResult>(
    onfulfilled?: (value: T) => TResult | PromiseLike<TResult>,
    onrejected?: (reason: any) => void | TResult | PromiseLike<TResult>
  ): ExtPromise<TResult> {
    return new ExtPromise<TResult>((resolve, reject) => {
      this.promise.then(value => {
        if (this.cancelPromise)
          return;

        resolve(onfulfilled(value));
      });

      this.promise.catch(value => {
        if (this.cancelPromise)
          return;

        reject(onrejected(value));
      });
    }, this);
  }

  catch(onrejected?: (reason: any) => void | T | PromiseLike<T>): Promise<T> {
    return this.promise.catch(reason => {
      if (this.cancelPromise)
        return;

      onrejected(reason);
    });
  }

  cancel(): void {
    if (this.cancelPromise)
      return;

    let p: ExtPromise<T> = this;
    while (p) {
      p.cancelPromise = true;
      p = p.parent;
    }
  }
}

export function timer(t: number): ExtPromise {
  return new ExtPromise(resolve => {
    new Timer(resolve).run(t);
  });
}
