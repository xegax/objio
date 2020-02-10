import { getExt } from '../common/common';
import { OBJIOItem, SERIALIZER } from '../objio/item';

export interface FileDesc {
  crc: string;
  name: string;
  fileSize: number;
  uploadSize: number;
  progress: number;
  time: number;
  mime: string;
  other?: string;
  v?: number;
}

export interface SendFileClientArgs {
  file: File;
  fileSize: number;
  fileId?: string;
  key?: string;
  crc?: string;
  other?: string;
  dest?: any;       // getFileDropDest
  onProgress?(value: number): void;
}

export interface IFileSystem {
  sendFile(args: SendFileClientArgs): Promise<any>;
  getPath(file?: string): string;
}

export interface FilesMap {
  [key: string]: FileDesc;
}

export class FileSystemSimple extends OBJIOItem implements IFileSystem {
  protected filesMap: FilesMap = {};

  static getFileName(args: {objId: string, key: string, ext: string}) {
    return `${args.objId}-${args.key}${args.ext || ''}`;
  }

  sendFile(args: SendFileClientArgs): Promise<void> {
    return this.holder.invokeMethod({
      method: 'sendFile',
      args: {
        file: args.file,
        fileSize: args.fileSize,
        fileId: args.fileId,
        other: args.other,
        crc: args.crc,
        key: args.key
      },
      onProgress: args.onProgress
    });
  }

  getFileDesc(key: string) {
    return this.filesMap[key];
  }

  // usage:
  // if key exists:
  //   obj.getPath('content') => 'files/1234-content.jpg'
  //   obj.getPath('preview') => 'files/1234-preview.jpg'
  // if key doesn't exist:
  //   obj.getPath('test') => null
  // before files should be uploaded by calling sendFile({ key: 'content', name: 'some-file.jpg', ... })
  getPath(key?: string): string | null {
    if (key) {
      const file = this.filesMap[key];
      if (!file || file.fileSize == 0)
        return null;

      key = FileSystemSimple.getFileName({
        objId: this.holder.getID(),
        key,
        ext: getExt(file.name)
      });

      if (this.holder.isClient() && file.v)
        key += ('?v=' + file.v);
    } else {
      key = '';
    }

    return this.holder.getPublicPath(key);
  }

  // if file doesn't exists yet
  getPathForNew(key: string, ext: string) {
    return this.getPath() + FileSystemSimple.getFileName({ objId: this.holder.getID(), key, ext });
  }

  getTotalSize() {
    let size = 0;
    Object.keys(this.filesMap)
    .forEach(f => {
      size += this.filesMap[f].uploadSize;
    });

    return size;
  }

  getTotalFiles() {
    return Object.keys(this.filesMap).length;
  }

  static TYPE_ID = 'FileSystemSimple';
  static SERIALIZE: SERIALIZER = () => ({
    filesMap: { type: 'json', const: true }
  })
}
