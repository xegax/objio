import { TableHolder as TableHolderBase } from '../client-object/table-holder';
import { SERIALIZER } from '../objio/item';
import { TableArgs, Cells, LoadCellsArgs, SortPair, SubtableAttrs } from '../client-object/table';
import { Table } from './table';

export class TableHolder extends TableHolderBase<Table> {
  private subtable: string = '';
  private tableCounter: number = 0;

  constructor(args?: TableArgs) {
    super(args);

    this.holder.setMethodsToInvoke({
      updateSubtable: (args: SubtableAttrs) => this.updateSubtable(args),
      loadCells: (args: LoadCellsArgs) => this.loadCells(args)
    });
  }

  loadCells(args: LoadCellsArgs): Promise<Cells> {
    if (this.subtable)
      args.table = this.subtable;

    return this.table.loadCells(args);
  }

  protected onLoad() {
    return super.onLoad().then(() => {
    });
  }

  protected onCreate() {
    return super.onCreate().then(() => {
    });
  }

  updateSubtable(args: SubtableAttrs): Promise<any> {
    this.tableCounter++;
    this.subtable = `${this.getTable()}_${this.tableCounter}`;
    return this.table.createSubtable({
      table: this.subtable,
      attrs: args
    });
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...TableHolderBase.SERIALIZE()
  });
}
