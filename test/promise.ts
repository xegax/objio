import { expect } from 'chai';
import { ExtPromise } from '../src/common/ext-promise';

describe('promise.ts', () => {
  it('timer', async () => {
    let timeStart = Date.now();
    await ExtPromise().timer(100);
    expect(Date.now() - timeStart).closeTo(100, 10);
  });

  it('then', async () => {
    let p = ExtPromise().timer(20);
    let arr = Array<number>();
    p.then(() => {
      arr.push(0);
    }).then(() => {
      arr.push(1);
    }).then(() => {
      return ExtPromise().timer(20).then(() => {
        return 2;
      }).then((n: number) => {
        return [n, 3];
      });
    }).then((v: Array<number>) => {
      arr.push(...v, 4);
    });

    await ExtPromise().timer(50);
    expect(arr).eqls([0, 1, 2, 3, 4]);
  });

  it('cancel', async () => {
    let p = ExtPromise().cancelable(ExtPromise().timer(100));
    let called = 0;
    p.then(() => called++).then(() => called++);
    p.cancel();
    await ExtPromise().timer(150);
    expect(called).eq(0);
  });
});
