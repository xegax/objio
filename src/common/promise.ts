import { Timer } from './timer';

export function timer(ms: number): Promise<void> {
  return new Promise(resolve => {
    new Timer(resolve).run(ms);
  });
}

export type Cancelable<T = any> = Promise<T> & { cancel: () => void };

export function cancelable<T>(p: Promise<T>): Cancelable<T> {
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
