import { createInterface } from 'readline';
import { createReadStream, lstatSync } from 'fs';

export interface CSVRow {
  cols: Array<string>;
  rowIdx: number;
  progress: number;     // 0 - 1
  done?(): void;
}

export class CSVReader {
  static parseRow(row: string): Array<string> {
    const cols = [];
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

  static read(file: string, onNextRow: (row: CSVRow) => Promise<void>): Promise<void> {
    const fileInfo = lstatSync(file);
    const rl = createInterface({ input: createReadStream(file) });

    let totalRead = 0;
    let rowIdx = 0;
    let closed = false;

    let waitToNext: Array<CSVRow> = [];
    let task: Promise<void>;
    const nextLine = (resume?: () => void, resolve?: () => void) => {
      if (task || closed)
        return;

      if (waitToNext.length == 0)
        return resume && resume();

      const [ row ] = waitToNext.splice(0, 1);
      task = onNextRow({...row, done: () => {
        closed = true;
        rl.close();
        resolve && resolve();
      }});

      task.then(() => {
        if (closed)
          return;

        task = null;
        nextLine(resume, resolve);
      });
    };

    return new Promise(resolve => {
      rl.on('line', (line: string) => {
        if (closed)
          return;

        totalRead += line.length + 2;
        const progress = totalRead / fileInfo.size;
        const cols = CSVReader.parseRow(line);
        waitToNext.push({
          cols,
          progress,
          rowIdx
        });

        if (waitToNext.length > 50) {
          rl.pause();
          nextLine(() => {
            rl.resume();
          }, resolve);
        }

        rowIdx++;
      });

      rl.on('close', () => {
        console.log('rows', rowIdx);
      });
    });
  }
}
