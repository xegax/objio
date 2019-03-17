import * as CSV from 'csv-parser';
import { Writable, Transform } from 'stream';
import { lstatSync, createReadStream } from 'fs';

export interface Row {
  [column: string]: string;
}

export interface CSVBunch {
  progress: number;
  rows: Array<Row>;
  stop(): void;
}

export interface CSVReadArgs {
  rowsPerBunch?: number;
  file: string;
  onNextBunch(bunch: CSVBunch): void | Promise<any>;
}

class Progress extends Transform {
  private fileSize: number = 0;
  private progress: number = 0;
  private totalRead: number = 0;
  private onSetProgress: (p: number) => void;

  constructor(file: string, setProgress?: (p: number) => void) {
    super();

    this.onSetProgress = setProgress || (() => { });
    this.fileSize = lstatSync(file).size;
    this.totalRead = 0;
  }

  _transform(chunk: Buffer, env, cb: () => void) {
    this.totalRead += chunk.length;
    this.progress = this.totalRead / this.fileSize;
    this.onSetProgress(this.progress);
    this.push(chunk);
    cb();
  }
}

class Output extends Writable {
  private stop = false;
  private rows = Array<Row>();
  private rowsPerBunch: number = 100;
  private progress: number = 0;

  private onNextBunch = (args: CSVBunch): Promise<any> | void => {
  };

  private onFinish = () => void {};
  setFinishCallback(callback: () => void) {
    this.onFinish = callback;
  }

  constructor(args: CSVReadArgs) {
    super({ objectMode: true });
    this.onNextBunch = args.onNextBunch || this.onNextBunch;
    this.rowsPerBunch = this.rowsPerBunch || args.rowsPerBunch;
    this.rows = [];
    this.on('finish', () => {
      if (!this.rows.length)
        return this.onFinish();

      let p = this.onNextBunch({
        rows: this.rows,
        stop: this.stopImpl,
        progress: this.progress
      });

      if (!p)
        this.onFinish();
      else
        p.then(this.onFinish);

    });
  }

  setProgress = (p: number) => {
    this.progress = p;
  }

  stopImpl = () => {
    if (this.stop)
      return;

    setTimeout(() => this.emit('finish'), 1);
    this.stop = true;
  }

  _write(chunk: Row, env, cb: () => void) {
    this.rows.push(chunk);
    if (this.rows.length < this.rowsPerBunch)
      return cb();

    const rows = this.rows.splice(0, this.rowsPerBunch);
    const args = {
      rows,
      stop: this.stopImpl,
      progress: this.progress
    };

    const task = this.onNextBunch(args);
    if (!task) {
      !this.stop && cb();
    } else {
      task.then(() => !this.stop && cb());
    }
  }
}

export class CSVReader {
  static read(args: CSVReadArgs): Promise<any> {
    let out = new Output(args);
    let strm = createReadStream(args.file);
    strm.pipe(new Progress(args.file, out.setProgress))
      .pipe(CSV())
      .pipe(out);

    return new Promise(resolve => {
      out.setFinishCallback(resolve);
    });
  }
}
