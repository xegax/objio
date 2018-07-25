import { LineReader, Bunch, ReadArgs, LRReadResult } from './line-reader';

export interface CSVBunch extends Bunch {
  rows: Array<Array<string>>;
}

export interface CSVReadArgs extends ReadArgs {
  onNextBunch(bunch: CSVBunch): void | Promise<any>;
}

export class CSVReader {
  static parseRow(row: string): Array<string> {
    const cols = Array<string>();
    let from = 0;
    let open = 0;
    for (let n = 0; n <= row.length; n++) {
      const chr = row[n] || ',';
      if (chr == '"') {
        if (row[n + 1] == '"') {
          n++;
          continue;
        }

        open = open ? 0 : 1;
        continue;
      }

      if (open)
        continue;

      if (chr == ',') {
        cols.push(row.substr(from, n - from));
        from = n + 1;
      }
    }
    return cols;
  }

  private constructor() {}

  static read(args: CSVReadArgs): Promise<LRReadResult> {
    return LineReader.read({
      ...args,
      onNextBunch: res => {
        const rows = res.lines.filter(line => line.trim().length > 0).map(line => CSVReader.parseRow(line));
        return args.onNextBunch({...res, rows});
      }
    });
  }
}
