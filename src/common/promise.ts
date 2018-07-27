import { Timer } from './timer';

let tid = 0;
export function timer(ms: number): Promise<void> {
  let t = tid++;
  return new Promise(resolve => {
    console.log('setTimeout', t);
    setTimeout(() => {
      console.log('resolve', t);
      resolve();
    }, ms);
    /*try {
      process.nextTick(() => {
        resolve();
        console.log('resolve');
      });
    } catch (e) {
      setTimeout(() => {
        console.log('resolve', t);
        resolve();
      }, ms);
    }*/
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
