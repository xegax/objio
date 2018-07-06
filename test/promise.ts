import { expect } from 'chai';
import { timer } from '../src/common/promise';

describe('promise.ts', () => {
  it('timer', async () => {
    let timeStart = Date.now();
    await timer(100);
    expect(Date.now() - timeStart).closeTo(100, 10);
  });

  it('then', async () => {
    let p = timer(20);
    let arr = Array<number>();
    p.then(() => {
      arr.push(0);
    }).then(() => {
      arr.push(1);
    }).then(() => {
      return timer(20).then(() => {
        return 2;
      }).then((n: number) => {
        return [n, 3];
      });
    }).then((v: Array<number>) => {
      arr.push(...v, 4);
    });

    await timer(50);
    expect(arr).eqls([0, 1, 2, 3, 4]);
  });

  it('cancel', async () => {
    let p = timer(100);
    let called = 0;
    p.then(() => called++).then(() => called++);
    p.cancel();
    await timer(150);
    expect(called).eq(0);
  });
});
