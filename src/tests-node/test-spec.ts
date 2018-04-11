import {TestClass, testFunc} from '../common/test';

describe('TestClass, testFunc', () => {
  it('testFunc', () => {
    expect(testFunc('!!!')).toEqual('!!!');
  });

  it('TestClass', () => {
    expect(new TestClass().test('!')).toEqual('!');
  });
});
