import {
  OBJIOItem,
  SERIALIZER
} from '../../index';
import { StateObject } from './state-object';

export interface SortPair {
  column: string;
  dir: 'asc' | 'desc';
}

export interface ValueCond {
  column: string;
  value: string;
}

export interface CompoundCond {
  values: Array<Condition>;
  op: 'or' | 'and';
}

export type Condition = ValueCond | CompoundCond;

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
  columns?: Array<ColumnAttr>;
  srcId?: string;   // FileObject id
  idColumn?: string;
  // idColumn defined, column is not found - create primary key column with name = idColumn
  // idColumn defined, column is found - this column will be primary key
  // idColumn not defined - we will try to create and insert idColumn = 'row-uid' or 'row-uid-%%%%%' 
}

export interface SubtableAttrs {
  sort: Array<SortPair>;
  cols: Array<string>;
  filter?: Condition;
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

export interface LoadCellsArgs extends Range {
  table?: string;
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
  protected state = new StateObject();

  protected totalRowsNum: number = 0;

  getState(): StateObject {
    return this.state;
  }

  execute(args: TableArgs): Promise<any> {
    return this.holder.invokeMethod('execute', args);
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

  loadCells(args: LoadCellsArgs): Promise<Cells> {
    return this.holder.invokeMethod('loadCells', args);
  }

  pushCells(args: PushRowArgs): Promise<number> {
    return this.holder.invokeMethod('pushCells', args);
  }

  updateCells(args: UpdateRowArgs): Promise<void> {
    return this.holder.invokeMethod('updateCell', args);
  }

  removeRows(args: RemoveRowsArgs): Promise<any> {
    return this.holder.invokeMethod('removeRows', args);
  }

  getIdColumn(): string {
    return this.idColumn;
  }

  static TYPE_ID = 'Table';
  static SERIALIZE: SERIALIZER = () => ({
    'state': { type: 'object' },
    'table': { type: 'string' },
    'columns': { type: 'json' },
    'totalRowsNum': { type: 'integer' },
    'idColumn': { type: 'integer' },
    'srcId': {type: 'string'}
  });
}
