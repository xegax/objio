import { OBJIOItem, SERIALIZER } from '../objio/item';

export interface FileArgs {
  originName: string;
  originSize: number;
  type: string;
}

export class FileObject extends OBJIOItem {
  protected originName: string = '';
  protected originSize: number = 0;
  protected loadSize: number = 0;
  protected type: string = '';

  constructor(args?: FileArgs) {
    super();

    if (!args)
      return;

    this.originName = args.originName;
    this.originSize = args.originSize;
    this.type = args.type;
  }

  getName(): string {
    return this.originName;
  }

  getSize(): number {
    return this.originSize;
  }

  getType(): string {
    return this.type;
  }

  getLoadSize(): number {
    return this.loadSize;
  }

  sendFile(file: File): Promise<any> {
    return this.holder.invokeMethod('send-file', file);
  }

  static TYPE_ID: string = 'File';
  static SERIALIZE: SERIALIZER = () => ({
    'originName': { type: 'string' },
    'originSize': { type: 'number' },
    'loadSize': { type: 'number' },
    'type': { type: 'string' }
  });
}
