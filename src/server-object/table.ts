import {
  Table as TableBase,
  TableArgs,
  Range,
  Cells,
  Columns,
  NameType
} from '../client-object/table';
import { Database } from 'sqlite3';

let db: Database;

function openDB(file: string): Promise<Database> {
  if (db)
    return Promise.resolve(db);

  return new Promise((resolve, reject) => {
    const newdb = new Database(file, (err => {
      if (!err) {
        resolve(newdb);
      } else {
        reject(newdb);
      }
    }));
  });
}

function exec(db: Database, sql: string): Promise<any> {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => {
      if (!err) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

function all<T = Object>(db: Database, sql: string): Promise<Array<T>> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows: Array<T>) => {
      if (err)
        return reject(err);
      resolve(rows);
    });
  });
}

function get<T = Object>(db: Database, sql: string): Promise<T> {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row: T) => {
      if (err)
        return reject(err);
      resolve(row);
    });
  });
}

function createTable(db: Database, table: string, columns: Columns): Promise<any> {
  const sql = columns.map(column => {
    return `${column.name} ${column.type}`;
  }).join(', ');
  return exec(db, `create table ${table} (${sql})`);
}

function loadTableInfo(db: Database, table: string): Promise<Columns> {
  return all<NameType>(db, `pragma table_info(${table})`).then(res => {
    return res.map(row => ({name: row['name'], type: row['type']}));
  });
}

function loadRowsCount(db: Database, table: string): Promise<number> {
  return get<{count: number}>(db, `select count(*) as count from ${table}`)
    .then(res => res.count);
}

interface TableArgsExt extends TableArgs {
  db: string;
}

export class Table extends TableBase {
  constructor(args?: TableArgs) {
    super(args);

    this.holder.setMethodsToInvoke({
      loadCells: (range: Range) => this.loadCells(range)
    });

    this.holder.setEventHandler({
      onLoaded: () => {
        return openDB('test.sqlite3')
          .then(db => {
            return Promise.all([
              loadTableInfo(db, this.table),
              loadRowsCount(db, this.table) as any
            ]);
          }).then(res => {
            this.columns = res[0];
            this.totalRowsNum = res[1];
          });
      }
    });
  }

  loadCells(range: Range): Promise<Cells> {
    return Promise.resolve([]);
  }

  static create(json: TableArgsExt): Table | Promise<Table> {
    return openDB(json.db || 'test.sqlite3')
    .then(db => createTable(db, json.table, json.columns))
    .then(() => new Table(json));
  }
}
