import { expect } from 'chai';
import { Table } from '../src/server-object/table';
import { existsSync, unlinkSync } from 'fs';

describe('server Table', () => {
  before(() => {
    unlinkSync('test.sqlite3');
  });
  it('Table.create', async () => {
    await Table.create({db: 'test.sqlite3', table: 'Table1', columns: [
      { name: 'col1', type: 'INTEGER' },
      { name: 'col2', type: 'TEXT' }
    ]});

    expect(existsSync('test.sqlite3')).eq(true, 'test.sqlite3 file must exists');
  });

  it('Table.load', async () => {
    const t = new Table({table: 'Table1', columns: []});
    await t.holder.onLoaded();
    expect(t.getColumns()).eqls([{name: 'col1', type: 'INTEGER'}, {name: 'col2', type: 'TEXT'}]);
  });
});
