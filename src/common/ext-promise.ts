import { Timer } from './timer';

export interface DeferedPromise<T> extends Promise<T> {
  resolve?(res: T): void;
  reject?(err?: any): void;
}

function deferred<T>(): DeferedPromise<T> {
  let resolve = (res: T): void => { throw 'promise not initialized'; };
  let reject = (err?: any): void => { throw 'promise not initialized'; };
  let p = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const res: DeferedPromise<T> = p;
  res.resolve = resolve;
  res.reject = reject;

  return res;
}

function timer(ms: number): Promise<void> {
  return new Promise(resolve => {
    new Timer(resolve).run(ms);
  });
}

export type Cancelable<T = any> = Promise<T> & { cancel: () => void };

function cancelable<T>(p: Promise<T>): Cancelable<T> {
  let cancel = false;
  const promise = new Promise((resolve, reject) => {
    p.then(data => {
      if (!cancel)
        return resolve(data);
    });

    p.catch(err => {
      if (!cancel)
        reject(err);
    });
  }) as Cancelable<T>;

  promise.cancel = () => {
    cancel = true;
  };

  return promise;
}

export function ExtPromise<T = any>() {
  return {
    ...Promise,
    deferred: () => deferred<T>(),
    timer: (ms: number) => timer(ms),
    cancelable: (p: Promise<T>) => cancelable<T>(p)
  };
}
