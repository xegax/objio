import { FileSystemSimple as Base, SendFileClientArgs } from '../base/file-system';
import { Readable } from 'stream';
import {
  createWriteStream,
  lstatSync,
  existsSync
} from 'fs';
import { getExt } from '../common/common';

export interface SendFileArgs {
  name: string;
  size: number;
  mime: string;
  fileId?: string;
  data: Readable;
  other?: string;
  key?: string; // 'content' by default
  crc?: string;
}

export interface FSArgs {
  files: {
    [key: string]: string
  };
}

export interface FSHandler {
  getUploadFileName(args: SendFileArgs): string;
}

export class FileSystemSimple extends Base {
  private handler: FSHandler;

  constructor(args?: FSArgs) {
    super();

    this.holder.addEventHandler({
      onCreate: () => {
        args && this.updateFiles(args.files);
        return Promise.resolve();
      }
    });

    this.holder.setMethodsToInvoke({
      sendFile: {
        method: this.sendFileImpl,
        rights: 'write'
      }
    });
  }

  setHandler(handler: FSHandler) {
    this.handler = handler;
  }

  sendFile(args: SendFileClientArgs) {
    return Promise.reject('not implemented');
  }

  private sendFileImpl = (args: SendFileArgs, userId: string) => {
    const key = args.key || 'content';

    let file = this.filesMap[key];
    let opts = { flags: 'w', start: 0 };
    const fileSize = +args.size;
    if (!file || file.fileSize != fileSize || file.name != args.name || file.uploadSize >= fileSize) {
      file = this.filesMap[key] = {
        name: args.name,
        mime: args.mime,
        other: args.other,
        fileSize: +args.size,
        uploadSize: 0,
        progress: 0,
        crc: args.crc,
        time: Date.now(),
        v: ((file || { v: 0 }).v || 0)
      };
    } else {
      opts.flags = 'r+';
      opts.start = file.uploadSize;
    }

    const fileName = this.handler ? this.handler.getUploadFileName({...args, key}) : this.getPath(key);
    let ws = createWriteStream(fileName, opts);

    this.holder.save(true);
    return new Promise<number>(resolve => {
      args.data.pipe(ws);
      args.data.on('data', chunk => {
        file.uploadSize += chunk.length;

        let p = file.uploadSize / file.fileSize;
        p = Math.floor(p * 10) / 10;
        if (p == file.progress)
          return;

        file.progress = Math.min(1, p);
        this.holder.save();
      });
      ws.on('close', () => {
        if (file.fileSize == file.uploadSize) {
          file.v += 1;
        }
        this.holder.save();
        resolve(file.uploadSize);
        this.holder.onUpload({
          key,
          userId,
          path: fileName,
          file: {...file}
        });
      });
    });
  }

  updateFilesByKeys(keys: Set<string>) {
    keys.forEach(key => {
      const file = this.filesMap[key];
      if (!file)
        return;

      const path = this.getPath(key);
      if (!existsSync(path)) {
        file.fileSize = file.uploadSize = 0;
        file.v = (file.v || 0) + 1;
        this.holder.save();
      } else {
        const stat = lstatSync(path);
        if (stat.size == file.fileSize && stat.size == file.uploadSize)
          return;

        file.fileSize = stat.size;
        file.uploadSize = stat.size;
        file.progress = 1;
        file.v = (file.v || 0) + 1;
        this.holder.save();
      }
    });
  }

  updateFiles(args: {[key: string]: string}) {
    args = args || {};
    Object.keys(args)
    .forEach(key => {
      const name = args[key];
      const path = this.getPathForNew(key, getExt(name));
      const file = this.filesMap[key] || { fileSize: 0, uploadSize: 0, v: 0 };
      if (!existsSync(path)) {
        file.fileSize = file.uploadSize = 0;
        this.holder.save();
        return;
      }

      const stat = lstatSync(path);
      this.filesMap[key] = {
        ...file,
        name,
        crc: null,
        uploadSize: stat.size,
        fileSize: stat.size,
        time: stat.ctimeMs,
        progress: 1,
        mime: '',
        v: (file.v || 0) + 1
      };
      this.holder.save();
    });
  }
}
