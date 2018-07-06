import { TableHolder as TableHolderBase } from '../client-object/table-holder';
import { SERIALIZER } from '../objio/item';
import { Cells, LoadCellsArgs } from '../client-object/table';

export class TableHolder extends TableHolderBase {
  private subtable: string = '';

  loadCells(args: LoadCellsArgs): Promise<Cells> {
    if (this.subtable)
      args.table = this.subtable;

    return this.table.loadCells(args);
  }

  static SERIALIZE: SERIALIZER = () => ({
    ...TableHolderBase.SERIALIZE(),
    'subtable': {type: 'string'}
  });
}
