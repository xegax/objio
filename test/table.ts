import { expect } from 'chai';
import { Table } from '../src/server-object/table';
import { existsSync, unlinkSync } from 'fs';

describe('server Table', () => {
  before(() => {
    if (existsSync('test.sqlite3'))
      unlinkSync('test.sqlite3');
  });

  it('Table.create', async () => {
    const t: Table = new Table({
      table: 'Table1',
      columns: [
        {name: 'col1', type: 'INTEGER'},
        {name: 'col2', type: 'TEXT'}
      ]
    });
    t.holder.getDBPath = () => 'test.sqlite3';
    await t.holder.getEventHandler()[0].onCreate();

    expect(existsSync('test.sqlite3')).eq(true, 'test.sqlite3 file must exists');
  });

  it('Table.pushCells', async () => {
    const t = new Table({table: 'Table1', columns: []});
    t.holder.save = () => Promise.resolve();
    t.holder.getDBPath = () => 'test.sqlite3';

    await t.holder.onLoaded();
    await t.pushCells([
      ['10', 'ten'],
      ['20', 'twenty'],
      ['30', 'thirty']
    ]);
  });

  it('Table.load', async () => {
    const t = new Table({table: 'Table1', columns: []});
    t.holder.getDBPath = () => 'test.sqlite3';
    await t.holder.onLoaded();
    expect(t.getTotalRowsNum()).eq(3);
    expect(t.getColumns()).eqls([{name: 'col1', type: 'INTEGER'}, {name: 'col2', type: 'TEXT'}]);

    const read = await t.loadCells({first: 0, count: 3});
    expect(read).eqls([
      [10, 'ten'],
      [20, 'twenty'],
      [30, 'thirty']
    ]);
  });
});
