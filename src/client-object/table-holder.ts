import { Table, TableArgs, Cells, Range, Row, inRange } from './table';
import { SERIALIZER, OBJIOItem } from '../objio/item';
import { ExtPromise } from '../common/promise';

export class TableHolder extends OBJIOItem {
  private cells: Cells = [];
  protected table: Table;
  private columns: Array<string> = [];
  private selRowsRange: Range = { first: 0, count: 1000 };
  private cellsLoading: ExtPromise<void> = null;

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

  private updateCells(): ExtPromise<Cells> {
    return ExtPromise.resolve<Cells>(
      this.table.loadCells(this.selRowsRange)
      .then((cells: Cells) => {
        return this.cells = cells;
      })
    );
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

  getOrLoadRow(rowIdx: number): ExtPromise<void> | Row {
    if (!this.cellsLoading) {
      const row = this.cells[rowIdx - this.selRowsRange.first];
      if (row)
        return row;
    }

    if (inRange(rowIdx, this.selRowsRange) && this.cellsLoading)
      return this.cellsLoading;

    this.selRowsRange.first = Math.max(0, Math.round(rowIdx - this.selRowsRange.count / 2));

    if (this.cellsLoading)
      this.cellsLoading.cancel();

    return this.cellsLoading = this.updateCells().then(() => {
      this.cellsLoading = null;
    });
  }

  getCells(): Cells {
    return this.cells;
  }

  get(): Table {
    return this.table;
  }

  static TYPE_ID = 'TableHolder';
  static SERIALIZE: SERIALIZER = () => ({
    table: {type: 'object'},
    columns: {type: 'json'}
  });
}
