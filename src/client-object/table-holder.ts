import { Table, TableArgs, Cells, Range, Row, inRange } from './table';
import { SERIALIZER, OBJIOItem } from '../objio/item';

class Promise2<T> implements Promise<T> {
  private prom: Promise<any>;
  private isCancel: boolean;

  constructor(prom: Promise<any>) {
    this.prom = prom;
  }

  then<TResult>(
    onfulfilled?: (value: T) => TResult | PromiseLike<TResult>,
    onrejected?: (reason: any) => TResult | PromiseLike<TResult>): Promise<TResult> {
    return this.prom.then(onfulfilled, onrejected);
  }

  catch(onrejected?: (reason: any) => T | void | PromiseLike<T>): Promise<T> {
    return this.prom.catch(onrejected);
  }

  cancel(): void {
    this.isCancel = true;
  }
}

export class TableHolder extends OBJIOItem {
  private cells: Cells = [];
  private table: Table;
  private selRowsRange: Range = { first: 0, count: 1000 };
  private loadingPromise: Promise<Row> = null;

  constructor(args?: TableArgs) {
    super();

    this.holder.addEventHandler({
      onLoad: () => {
        this.subscribeOnTable();
        return this.updateCells();
      },
      onCreate: () => {
        this.subscribeOnTable();
        return Promise.resolve();
      }
    });

    this.table = new Table(args);
  }

  private subscribeOnTable() {
    this.table.holder.addEventHandler({
      onObjChange: () => {
        this.updateCells().then(() => this.holder.notify());
      }
    });
  }

  private updateCells(): Promise<Cells> {
    return new Promise((resolve, reject) => {
      this.table.loadCells(this.selRowsRange)
      .then((cells: Cells) => {
        if (resolve)
        return this.cells = cells;
      });
    });
  }

  getSelRowsRange(): Range {
    return {
      first: this.selRowsRange.first,
      count: Math.min(
        this.selRowsRange.first + this.selRowsRange.count,
        this.table.getTotalRowsNum()
      ) - this.selRowsRange.first
    };
  }

  getRowOrLoad(rowIdx: number): Promise<Row> | Row {
    if (!this.loadingPromise) {
      const row = this.cells[rowIdx - this.selRowsRange.first];
      if (row)
        return row;
    }

    if (inRange(rowIdx, this.selRowsRange) && this.loadingPromise)
      return this.loadingPromise;

    this.selRowsRange.first = Math.max(0, Math.round(rowIdx - this.selRowsRange.count / 2));
    this.loadingPromise = this.updateCells().then(cells => null);
  }

  getCells(): Cells {
    return this.cells;
  }

  get(): Table {
    return this.table;
  }

  static TYPE_ID = 'TableHolder';
  static SERIALIZE: SERIALIZER = () => ({
    table: {type: 'object'}
  });
}
