import {
  OBJIOItem,
  SERIALIZER
} from '../../index';

export interface NameType {
  name: string;
  type: string;
}

export interface TableArgs {
  table: string;
  columns: Array<NameType>;
}

export interface Range {
  first: number;
  count: number;
}

export type Columns = Array<NameType>;
export type Cells = Array<Array<string>>;

export class Table extends OBJIOItem {
  protected table: string;
  protected columns: Columns = Array<NameType>();
  protected totalRowsNum: number = 0;

  private selRowsRange: Range = { first: 0, count: 0 };
  private cells: Cells = [];

  constructor(args?: TableArgs) {
    super();

    if (!args)
      return;

    this.table = args.table;
    this.columns = args.columns.map(column => ({...column}));
  }

  getTotalRowsNum(): number {
    return this.totalRowsNum;
  }

  getTable(): string {
    return this.table;
  }

  getColumns(): Array<NameType> {
    return this.columns;
  }

  getCells(): Cells {
    return this.cells;
  }

  getSelRowsRange(): Range {
    return this.selRowsRange;
  }

  selectCells(rowsRange: Range): void {
    this.selRowsRange = {...rowsRange};
    this.loadCells(this.selRowsRange).then(data => {
      this.cells = data;
    }).catch(err => {
      console.log(err);
    });
  }

  loadCells(rowsRange: Range): Promise<Cells> {
    return this.holder.invokeMethod('loadCells', rowsRange);
  }

  pushCells(cells: Cells): Promise<number> {
    return this.holder.invokeMethod('pushCells', cells);
  }

  static TYPE_ID = 'Table';
  static SERIALIZE: SERIALIZER = () => ({
    'table': { type: 'string' },
    'columns': { type: 'json' },
    'totalRowsNum': { type: 'integer' }
  });
}
