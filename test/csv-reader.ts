import { CSVReader } from '../src/common/csv-reader';
import { expect } from 'chai';

describe('CSVreader', () => {
  it('parseRow', () => {
    expect(CSVReader.parseRow('1,2,3,"4,5,6"')).eqls(['1', '2', '3', '"4,5,6"']);
    expect(CSVReader.parseRow('1,2,3,"4,""5"",6"')).eqls(['1', '2', '3', '"4,""5"",6"']);
    expect(CSVReader.parseRow(',,,,')).eqls(['', '', '', '', '']);
    expect(CSVReader.parseRow('1,2,,,3')).eqls(['1', '2', '', '', '3']);
  });
});
