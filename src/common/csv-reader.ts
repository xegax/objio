import { createInterface } from 'readline';
import { createReadStream, lstatSync } from 'fs';

export interface CSVRow {
  cols: Array<string>;
  rowIdx: number;
  progress: number;     // 0 - 1
  done(): void;
}

export interface Handler {
  onNextRow(row: CSVRow): void;
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

  static read(file: string, onNextRow: (row: CSVRow) => void): Promise<void> {
    const fileInfo = lstatSync(file);
    const rl = createInterface({ input: createReadStream(file) });

    let totalRead = 0;
    let rowIdx = 0;
    let closed = false;
    let skip = 0;
    return new Promise(resolve => {
      rl.on('line', (line: string) => {
        if (closed) {
          skip++;
          return;
        }

        totalRead += line.length + 2;
        const progress = totalRead / fileInfo.size;
        const cols = CSVReader.parseRow(line);
        onNextRow({
          cols,
          progress,
          rowIdx,
          done: () => {
            closed = true;
            resolve();
            rl.close();
          }
        });
        rowIdx++;
      });

      rl.on('close', () => {
        console.log('skip', skip);
        if (!closed)
          resolve();
      });
    });
  }
}
