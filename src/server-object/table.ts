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
  return srPromise(db, (resolve, reject) => {
    db.exec(sql, err => {
      if (!err) {
        resolve();
      } else {
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
        reject(err);
      }
    });
  });
}

function all<T = Object>(db: Database, sql: string): Promise<Array<T>> {
  return srPromise(db, (resolve, reject) => {
    db.all(sql, (err, rows: Array<T>) => {
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

function insert(db: Database, table: string, columns: Array<string>, cells: Cells): Promise<any> {
  const valsHolder = cells.map(row => `(${row.map(() => '?').join(', ')})`).join(', ');

  const values = [];
  cells.forEach(row => {
    values.push(...row);
  });
  const sql = `insert into ${table}(${columns.join(',')}) VALUES ${valsHolder};`;
  return run(db, sql, values);
}

interface TableArgsExt extends TableArgs {
  db: string;
}

export class Table extends TableBase {
  constructor(args?: TableArgs) {
    super(args);

    this.holder.setMethodsToInvoke({
      loadCells: (range: Range) => this.loadCells(range),
      pushCells: (cells: Cells) => this.pushCells(cells)
    });

    this.holder.setEventHandler({
      onLoaded: () => {
        return (
          openDB('test.sqlite3')
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
      }
    });
  }

  loadCells(range: Range): Promise<Cells> {
    return (
      openDB('test.sqlite3')
      .then(db => {
        return all<Object>(db, `select * from ${this.table} limit ${range.count} offset ${range.first}`);
      }).then(rows => {
        return rows.map(row => Object.keys(row).map(key => row[key]));
      })
    );
  }

  pushCells(cells: Cells): Promise<number> {
    let db: Database;
    return (
      openDB('test.sqlite3')
      .then(dbobj => db = dbobj)
      .then(() => insert(db, this.table, this.columns.map(col => col.name), cells))
      .then(() => loadRowsCount(db, this.table))
      .then(rows => {
        this.totalRowsNum = rows;
        this.holder.save();
        return rows;
      })
    );
  }

  static create(json: TableArgsExt): Table | Promise<Table> {
    return openDB(json.db || 'test.sqlite3')
    .then(db => createTable(db, json.table, json.columns))
    .then(() => new Table(json));
  }
}
