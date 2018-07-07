import {
  Table as TableBase,
  TableArgs,
  Range,
  Cells,
  Columns,
  ColumnAttr,
  UpdateRowArgs,
  PushRowArgs,
  RemoveRowsArgs,
  SubtableAttrs,
  LoadCellsArgs,
  Condition,
  CompoundCond
} from '../client-object/table';
import { Database } from 'sqlite3';
import { SERIALIZER, EXTEND } from '../objio/item';
import { ValueCond } from '../client-object/table';

let db: Database;

export interface CreateSubtableArgs {
  table: string;
  attrs: SubtableAttrs;
}

function srPromise(db: Database, callback: (resolve, reject) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      callback(resolve, reject);
    });
  });
}

function openDB(file: string): Promise<Database> {
  if (db)
    return Promise.resolve(db);

  return new Promise((resolve, reject) => {
    db = new Database(file, (err => {
      if (!err) {
        resolve(db);
      } else {
        reject(db);
      }
    }));
  });
}

function exec(db: Database, sql: string): Promise<any> {
  return srPromise(db, (resolve, reject) => {
    db.exec(sql, err => {
      if (!err) {
        resolve();
      } else {
        console.log('error at', sql);
        reject(err);
      }
    });
  });
}

function run(db: Database, sql: string, params: Array<any>): Promise<any> {
  return srPromise(db, (resolve, reject) => {
    db.run(sql, params, err => {
      if (!err) {
        resolve();
      } else {
        console.log('error at', sql);
        reject(err);
      }
    });
  });
}

function all<T = Object>(db: Database, sql: string, params?: Array<any>): Promise<Array<T>> {
  return srPromise(db, (resolve, reject) => {
    db.all(sql, params || [], (err, rows: Array<T>) => {
      if (err)
        return reject(err);
      resolve(rows);
    });
  });
}

function get<T = Object>(db: Database, sql: string): Promise<T> {
  return srPromise(db, (resolve, reject) => {
    db.get(sql, (err, row: T) => {
      if (err)
        return reject(err);
      resolve(row);
    });
  });
}

export function getCompSqlCondition(cond: CompoundCond): string {
  return cond.values.map(cond => {
    return `( ${getSqlCondition(cond)} )`;
  }).join(` ${cond.op} `);
}

export function getSqlCondition(cond: Condition): string {
  const comp = cond as CompoundCond;

  if (comp.op && comp.values && comp.values.length)
    return getCompSqlCondition(comp);

  const value = cond as ValueCond;
  return `${value.column}="${value.value}"`;
}

function createTable(db: Database, table: string, columns: Columns): Promise<any> {
  const sql = columns.map(column => {
    let value = `${column.name} ${column.type}`;
    if (column.notNull)
      value += ' NOT NULL';
    if (column.primary)
      value += ' PRIMARY KEY';
    if (column.autoInc)
      value += ' AUTOINCREMENT';
    if (column.unique)
      value += ' UNIQUE';
    return value;
  }).join(', ');
  return exec(db, `create table ${table} (${sql})`);
}

function loadTableInfo(db: Database, table: string): Promise<Columns> {
  return all<ColumnAttr>(db, `pragma table_info(${table})`).then(res => {
    return res.map(row => ({name: row['name'], type: row['type']}));
  });
}

function loadRowsCount(db: Database, table: string): Promise<number> {
  return get<{count: number}>(db, `select count(*) as count from ${table}`)
    .then(res => res.count);
}

function insert(db: Database, table: string, values: {[col: string]: Array<string>}): Promise<any> {
  const cols = Object.keys(values);
  const valsHolder = cols.map(() => '?').join(', ');
  const allValsHolder = values[cols[0]].map(() => `( ${valsHolder} )`).join(', ');

  const valuesArr = [];
  cols.forEach(col => {
    valuesArr.push(...values[col]);
  });
  const sql = `insert into ${table}(${cols.join(',')}) values ${allValsHolder};`;
  return run(db, sql, valuesArr);
}

export class Table extends TableBase {
  constructor(args?: TableArgs) {
    super(args);

    this.holder.setMethodsToInvoke({
      loadCells: (args: LoadCellsArgs) => this.loadCells(args),
      pushCells: (args: PushRowArgs) => this.pushCells(args),
      updateCells: (args: UpdateRowArgs) => this.updateCells(args),
      removeRows: (args: RemoveRowsArgs) => this.removeRows(args)
    });

    this.holder.addEventHandler({
      onLoad: () => {
        return (
          this.openDB()
          .then(db => {
            return Promise.all([
              loadTableInfo(db, this.table),
              loadRowsCount(db, this.table) as any
            ]);
          })
          .then(res => {
            this.columns = res[0];
            this.totalRowsNum = res[1];
          })
        );
      },
      onCreate: () => {
        return (
          this.openDB()
          .then(db => createTable(db, this.table, this.columns))
        );
      }
    });
  }

  loadCells(args: LoadCellsArgs): Promise<Cells> {
    const table = args.table || this.table;
    return (
      this.openDB()
      .then(db => {
        return all<Object>(db, `select * from ${table} limit ? offset ?`, [args.count, args.first]);
      }).then(rows => {
        return rows.map(row => Object.keys(row).map(key => row[key]));
      })
    );
  }

  pushCells(args: PushRowArgs): Promise<number> {
    const values = {...args.values};
    delete values[this.getIdColumn()];

    let db: Database;
    return (
      this.openDB()
      .then(dbobj => db = dbobj)
      .then(() => insert(db, this.table, values))
      .then(() => this.updateRowNum(db))
    );
  }

  removeRows(args: RemoveRowsArgs): Promise<number> {
    const holders = args.rowIds.map(() => `${this.getIdColumn()} = ?`).join(' or ');
    let db: Database;
    return (
      this.openDB()
      .then(dbTmp => (db = dbTmp) && run(dbTmp, `delete from ${this.table} where ${holders}`, args.rowIds))
      .then(() => this.updateRowNum(db))
    );
  }

  createSubtable(args: CreateSubtableArgs): Promise<any> {
    const cols = (args.attrs.cols && args.attrs.cols.length) ? args.attrs.cols.join(', ') : '*';
    const cond = args.attrs.filter ? getSqlCondition(args.attrs.filter) : null;
    const where = cond ? ` where ${cond}` : '';
    const orderBy = args.attrs.sort && args.attrs.sort.length ? `order by ${args.attrs.sort[0].column} ${args.attrs.sort[0].dir}` : '';

    return (
      this.openDB().
      then(db => exec(db, `create temp table ${args.table} as select ${cols} from ${this.table} ${where} ${orderBy}`))
    );
  }

  private openDB(): Promise<Database> {
    return openDB(this.holder.getDBPath());
  }

  private updateRowNum(db: Database): Promise<number> {
    return (
      loadRowsCount(db, this.table)
      .then(rows => {
        this.totalRowsNum = rows;
        this.holder.save();
        return rows;
      })
    );
  }

  updateCells(args: UpdateRowArgs): Promise<void> {
    return (
      this.openDB()
      .then(db => {
        const set = Object.keys(args.values).map(col => {
          return `${col}=?`;
        }).join(', ');
        const values = Object.keys(args.values).map(col => args.values[col]);
        return run(db, `update ${this.table} set ${set} where ${this.getIdColumn()}`, [...values, args.rowId]);
      })
    );
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...TableBase.SERIALIZE(),
    ...EXTEND({
    }, { tags: ['sr'] })
  });
}
