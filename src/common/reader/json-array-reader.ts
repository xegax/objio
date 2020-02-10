import { lstatSync, openSync, read } from 'fs';
import { createParser, spaces, braces, comma, onValue } from './simple-parser';

export interface ReadJSONArrayArgs {
  file: string;
  itemsPerBunch?: number;
  bufferSize?: number;
  exclude?: Set<string>;
  calcRanges?: boolean;
  onBunch?(args: BunchArgs): Promise<any> | 'stop' | void;
}

export interface ReadJSONArrayRes {
  time: number;
}

export interface BunchArgs {
  items: Array<{ obj: Object, str: string; range: Array<number> }>;
  progress: number;
}

export function readJSONArray(args: ReadJSONArrayArgs): Promise<ReadJSONArrayRes> {
  const startTime = Date.now();
  const itemsPerBunch = args.itemsPerBunch || 100;
  return new Promise((resolve, reject) => {
    const stat = lstatSync(args.file);
    const fd = openSync(args.file, 'r');
    const buf = new Buffer(args.bufferSize || 65535);
    let totalRead = 0;
    let progress = 0;
    let bunch = Array<{ obj: Object; str: string; range: Array<number> }>();
    let bunchTask: Promise<any>;
    let stop = false;

    let tokens = [];
    tokens.push(
      spaces,
      onValue(
        braces,
        (v, range) => {
          if (stop)
            return;

          const raw = JSON.parse(v);
          let row: Object;
          if (args.exclude && args.exclude.size) {
            row = {};
            for (const k of Object.keys(raw)) {
              if (!args.exclude.has(k))
                row[k] = raw[k];
            }
          } else {
            row = raw;
          }

          bunch.push({
            obj: row,
            str: v,
            range
          });
          flushBunch(readNext, false);
        }
      ),
      spaces,
      comma,
      tokens
    );
    const parser = createParser(tokens, args.calcRanges);

    const flushBunch = (next: () => void, force: boolean) => {
      if ((!force && bunch.length < itemsPerBunch) || bunchTask || bunch.length == 0)
        return;

      let items = bunch.splice(0, itemsPerBunch);
      let r = args.onBunch && args.onBunch({ items, progress });
      if (r == 'stop')
        return onFinish(true);

      if (!(r instanceof Promise))
        r = Promise.resolve();

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

    const readNext = () => {
      if (stop)
        return;

      const onRead = (err, bytes: number) => {
        if (bytes && (buf[bytes - 1] & 0xE0) == 0xC0) {
          bytes--;
        }

        progress = (totalRead + bytes) / stat.size;

        const offset = totalRead;
        totalRead += bytes;

        if (bytes) {
          parser.parse(buf.toString(undefined, 0, bytes), offset);
          if (!bunchTask)
            readNext();
        } else {
          onFinish(false);
        }
      };

      read(fd, buf, 0, buf.byteLength, totalRead, onRead);
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
