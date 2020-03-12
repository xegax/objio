import { readJSONArray } from './common/reader/json-array-reader';

let rows = 0;
readJSONArray({
  file: '../fb2.json',
  calcRanges: true,
  itemsPerBunch: 1,
  onBunch: res => {
    if (rows == 647) {
      console.log(res);
    }
    rows += res.items.length;
  }
});
