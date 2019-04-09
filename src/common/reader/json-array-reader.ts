import { lstatSync, openSync, read } from 'fs';
import { createParser, spaces, braces, comma, onValue } from './simple-parser';

export interface ReadJSONArrayArgs {
  file: string;
  itemsPerBunch?: number;
  bufferSize?: number;
  exclude?: Set<string>;
  onBunch?(args: BunchArgs): Promise<any> | 'stop' | void;
}

export interface ReadJSONArrayRes {
  time: number;
}

export interface BunchArgs {
  items: Array<Object>;
  progress: number;
}

export function readJSONArray(args: ReadJSONArrayArgs): Promise<ReadJSONArrayRes> {
  const startTime = Date.now();
  const itemsPerBunch = args.itemsPerBunch || 100;
  return new Promise((resolve, reject) => {
    const stat = lstatSync(args.file);
    const fd = openSync(args.file, 'r+');
    const buf = new Buffer(args.bufferSize || 65535);
    let totalRead = 0;
    let progress = 0;
    let bunch = Array<Object>();
    let bunchTask: Promise<any>;
    let stop = false;

    let tokens = [];
    tokens.push(
      spaces,
      onValue(
        braces,
        v => {
          if (stop)
            return;

          const row = JSON.parse(v);
          if (args.exclude) {
            args.exclude.forEach(c => {
              delete row[c];
            });
          }

          bunch.push(row);
          flushBunch(readNext, false);
        }
      ),
      spaces,
      comma,
      tokens
    );
    const parser = createParser(tokens);

    const flushBunch = (next: () => void, force: boolean) => {
      if ((!force && bunch.length < itemsPerBunch) || bunchTask || bunch.length == 0)
        return;

      let items = bunch.splice(0, itemsPerBunch);
      let r = args.onBunch && args.onBunch({ items, progress });
      if (r == 'stop')
        return onFinish(true);

      if (!(r instanceof Promise))
        return flushBunch(next, force);

      bunchTask = r;
      bunchTask.then(res => {
        bunchTask = null;
        if (res == 'stop')
          return onFinish(true);

        flushBunch(next, force);
        if (!bunchTask)
          next();
      });
    };

    const parseNext = (buf: Buffer, size: number) => {
      if (size != buf.length)
        buf = buf.slice(0, size);

      parser.parse(buf.toString(), totalRead);
      if (!bunchTask)
        readNext();
    };

    const readNext = () => {
      if (stop)
        return;

      read(fd, buf, 0, buf.byteLength, null, (err, bytes, buff) => {
        progress = (totalRead + bytes) / stat.size;
        if (bytes == 0)
          onFinish(false);
        else
          parseNext(buff, bytes);
        totalRead += bytes;
      });
    };

    const onFinish = (s: boolean) => {
      const res: ReadJSONArrayRes = {
        time: Date.now() - startTime
      };

      if (stop = s)
        return resolve(res);

      flushBunch(() => {
        resolve(res);
      }, true);

      if (!bunchTask)
        resolve(res);
    };
    readNext();
  });
}
