import {
  OBJIOItem,
  SERIALIZER
} from '../../index';
import { Promise } from 'bluebird';

export interface ColumnAttr {
  name: string;
  type: string;
  notNull?: boolean;
  unique?: boolean;
  primary?: boolean;
  autoInc?: boolean;
}

export interface TableArgs {
  table: string;
  columns: Array<ColumnAttr>;

  idColumn?: string;
  // idColumn defined, column is not found - create primary key column with name = idColumn
  // idColumn defined, column is found - this column will be primary key
  // idColumn not defined - we will try to create and insert idColumn = 'row-uid' or 'row-uid-%%%%%' 
}

export interface Range {
  first: number;
  count: number;
}

export interface PushRowArgs {
  values: {[column: string]: Array<string>};
}

export interface UpdateRowArgs {
  rowId: string;
  values: {[column: string]: string};
}

export interface RemoveRowsArgs {
  rowIds: Array<string>;
}

export function inRange(idx: number, range: Range): boolean {
  return idx >= range.first && idx < range.first + range.count;
}

export type Columns = Array<ColumnAttr>;
export type Row = Array<string>;
export type Cells = Array<Row>;

export class Table extends OBJIOItem {
  protected table: string;
  protected columns: Columns = Array<ColumnAttr>();
  protected idColumn: string = 'row_uid';

  protected totalRowsNum: number = 0;

  constructor(args?: TableArgs) {
    super();

    if (!args)
      return;

    this.table = args.table;
    this.columns = args.columns.map(column => ({...column}));

    let idCol: ColumnAttr;
    if (!args.idColumn) {
      while (idCol = this.findColumn(this.idColumn)) {
        this.idColumn = 'row_uid_' + Math.round(Math.random() * 100000).toString(16);
      }
    } else {
      this.idColumn = args.idColumn;
      idCol = this.findColumn(args.idColumn);
    }

    if (!idCol) {
      const idCol: ColumnAttr = {
        name: this.idColumn,
        type: 'INTEGER',
        autoInc: true,
        notNull: true,
        primary: true,
        unique: true
      };
      this.columns.splice(0, 0, idCol);
    } else {
      idCol.type = 'INTEGER';
      idCol.autoInc = true;
      idCol.notNull = true;
      idCol.primary = true;
      idCol.unique = true;
    }
  }

  findColumn(name: string): ColumnAttr {
    return this.columns.find(col => col.name == name);
  }

  getTotalRowsNum(): number {
    return this.totalRowsNum;
  }

  getTable(): string {
    return this.table;
  }

  getColumns(): Array<ColumnAttr> {
    return this.columns;
  }

  loadCells(rowsRange: Range): Promise<Cells> {
    return this.holder.invokeMethod('loadCells', rowsRange);
  }

  pushCells(args: PushRowArgs): Promise<number> {
    return this.holder.invokeMethod('pushCells', args);
  }

  updateCells(args: UpdateRowArgs): Promise<void> {
    return this.holder.invokeMethod('updateCell', args);
  }

  removeRows(args: RemoveRowsArgs) {
    return this.holder.invokeMethod('removeRows', args);
  }

  getIdColumn(): string {
    return this.idColumn;
  }

  static TYPE_ID = 'Table';
  static SERIALIZE: SERIALIZER = () => ({
    'table': { type: 'string' },
    'columns': { type: 'json' },
    'totalRowsNum': { type: 'integer' },
    'idColumn': { type: 'integer' }
  });
}
