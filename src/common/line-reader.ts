import { openSync, closeSync, read, lstatSync } from 'fs';

interface ParseResult {
  lines: Array<string>;
  lineEnd: boolean;
}

export interface LRReadResult {
  readBufSize: number;
  lineBufSize: number;
  totalLines: number;
  totalRead: number;
}

export interface Bunch {
  progress: number;
  firstLineIdx: number;
  lines: Array<string>;
  done(): void;
}

export interface ReadArgs {
  file: string;
  onNextBunch?(args: Bunch): void | Promise<void>;

  lineBufSize?: number;
  readBufSize?: number;
  linesPerBunch?: number;
}

export class LineReader {
  static read(args: ReadArgs): Promise<LRReadResult> {
    args = {
      onNextBunch: () => Promise.resolve(),
      lineBufSize: 1024 * 32,
      readBufSize: 1024 * 32,
      linesPerBunch: 32,
      ...args
    };

    const stat = lstatSync(args.file);
    const fd = openSync(args.file, 'r+');
    let lineBuf = new Buffer(args.lineBufSize);
    let lineSize = 0;
    let readBuf = new Buffer(args.readBufSize);

    const resizeBuf = (buf: Buffer, newSize: number): Buffer => {
      let newBuf = new Buffer(newSize);
      buf.copy(newBuf);
      return newBuf;
    };

    const parseLines = (readSize: number): ParseResult => {
      let lines: Array<string> = [];
      let from = 0;
      let lineEnd = false;
      while (from < readSize) {
        const to = readBuf.indexOf('\x0d\x0a', from);
        if (to == -1 || to >= readSize) {
          lineEnd = false;
          const size = readSize - from;
          if (lineSize + size > lineBuf.byteLength) {
            lineBuf = resizeBuf(lineBuf, lineBuf.byteLength * 2);
          }

          readBuf.copy(lineBuf, lineSize, from, readSize);
          lineSize += size;
          break;
        } else {
          const size = to - from;
          if (lineSize + size > lineBuf.byteLength) {
            lineBuf = resizeBuf(lineBuf, lineBuf.byteLength * 2);
          }

          readBuf.copy(lineBuf, lineSize, from, to);
          lineSize += size;
          from = to + 2;
          lines.push(lineBuf.slice(0, lineSize).toString());
          lineSize = 0;
          lineEnd = true;
        }
      }
      return { lines, lineEnd };
    };

    let totalLines = 0;
    let totalRead = 0;
    let readPos = 0;
    let lastLines: ParseResult;
    let stop = false;
    let bunch: Bunch = {
      progress: 0,
      lines: [],
      firstLineIdx: 0,
      done: () => {}
    };

    const nextBunch = (): Promise<any> => {
      try {
        return nextBunchImpl();
      } catch (e) {
        return Promise.reject(e);
      }
    };

    const nextBunchImpl = (): Promise<any> => {
      const b: Bunch = {
        progress: totalRead / stat.size,
        firstLineIdx: bunch.firstLineIdx,
        lines: bunch.lines.splice(0, args.linesPerBunch),
        done: () => {
          stop = true;
        }
      };
      totalLines += b.lines.length;
      bunch.firstLineIdx += b.lines.length;

      let task = args.onNextBunch(b);
      if (!(task instanceof Promise))
        task = Promise.resolve();

      return (
        task.then(() => {
          if (stop)
            return;

          if (bunch.lines.length >= args.linesPerBunch)
            return nextBunch();
        })
        .catch(err => {
          console.log(err);
          stop = true;
        })
      );
    };

    let parseNext: (
      err: Error,
      readSize: number,
      resolve: (res: LRReadResult) => void,
      reject: (err: any) => void
    ) => void;

    const readNext = (resolve: (res: LRReadResult) => void, reject: (err: any) => void) => {
      if (stop) {
        closeSync(fd);
        return resolve({
          totalLines,
          totalRead,
          readBufSize: readBuf.byteLength,
          lineBufSize: lineBuf.byteLength
        });
      }

      read(fd, readBuf, 0, readBuf.byteLength, readPos, (err, read) => parseNext(err, read, resolve, reject));
    };

    parseNext = (err: Error, readSize: number, resolve: (res: LRReadResult) => void, reject: (err: any) => void) => {
      if (err || readSize == 0) {
        closeSync(fd);
        if (lastLines.lineEnd)
          bunch.lines.push('');

        let task: Promise<any> = Promise.resolve();
        if (bunch.lines.length) {
          nextBunch();
        }

        return task.then(() => resolve({
          totalLines,
          totalRead,
          readBufSize: readBuf.byteLength,
          lineBufSize: lineBuf.byteLength
        })).catch(reject);
      }

      if (readSize == readBuf.byteLength && readBuf.readUInt8(readBuf.byteLength - 1) == 0x0d) {
        readBuf = new Buffer(readBuf.byteLength + 1);
        return readNext(resolve, reject);
      }

      readPos += readSize;
      totalRead += readSize;
      lastLines = parseLines(readSize);
      bunch.lines.push(...lastLines.lines);
      if (bunch.lines.length >= args.linesPerBunch) {
        nextBunch()
        .then(() => readNext(resolve, reject))
        .catch(reject);
      } else {
        readNext(resolve, reject);
      }
    };

    return new Promise(readNext);
  }
}
