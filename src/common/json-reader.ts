import { LineReader, Bunch, ReadArgs, LRReadResult } from './line-reader';

export type JSONRow = { [key: string]: string };
export interface JSONBunch extends Bunch {
  rows: Array<JSONRow>;
}

export interface JSONReadArgs extends ReadArgs {
  onNextBunch(bunch: JSONBunch): void | Promise<any>;
}

export class JSONReader {
  static parseRow(row: string): JSONRow {
    if (['[', ']', ','].indexOf(row.trim()) != -1)
      return null;

    row = row.trim();
    if (row.endsWith(','))
      row = row.substr(0, row.length - 1);
    
    if (row.startsWith(','))
      row = row.substr(1);

    try {
      return JSON.parse(row);
    } catch (e) {
    }

    return null;
  }

  private constructor() {}

  static read(args: JSONReadArgs): Promise<LRReadResult> {
    args.linesPerBunch = args.linesPerBunch || 10;
    let rows = [];
    let bunch: Bunch;
    const flush = () => {
      let tasks: Array<Promise<any> | void> = [];
      while (rows.length >= args.linesPerBunch) {
        tasks.push( args.onNextBunch({...bunch, rows: rows.splice(0, args.linesPerBunch)}) );
      }

      return Promise.all(tasks).then(arr => arr[arr.length - 1]);
    }

    return LineReader.read({
      ...args,
      onNextBunch: res => {
        bunch = res;
        rows.push(...res.lines
        .map(line => JSONReader.parseRow(line))
        .filter(rowObj => rowObj));

        return flush();
      }
    })
    .then(res => {
      return flush().then(() => res);
    });
  }
}
