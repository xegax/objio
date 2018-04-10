import * as d3 from 'd3';
import {Encryptor, EmptyEncryptor} from 'common/encryptor';

interface Options {
  header?: Object;
  progress?: (event: ProgressEvent, type: 'download' | 'upload' | 'uploadend') => void;
}

interface RequestorCore {
  sendData(url: string, params?: Object, postData?: string, opts?: Options): Promise<string>;
  getData(url: string, params?: Object): Promise<string>;
}

export abstract class Requestor implements RequestorCore {
  private headers: Object = {};

  constructor(headers?: Object) {
    this.headers = headers || {};
  }

  protected getHeaders(params: string, post: string, hdrs?: Object): Object {
    hdrs = hdrs || {};
    hdrs = {...this.headers, ...hdrs};

    Object.keys(hdrs).forEach(k => {
      const hdr = hdrs[k];
      if (typeof hdr == 'function')
        hdrs[k] = hdr(params, post);
    });
    return hdrs;
  }

  abstract sendData(url: string, params?: Object, postData?: string, opts?: Options): Promise<string>;
  abstract getData(url: string, params?: Object): Promise<string>;

  async getJSON<T extends any>(url: string, params?: Object): Promise<T> {
    return this.getData(url, params).then(s => JSON.parse(s));
  }

  async sendJSON<T extends any>(url: string, params?: Object, postData?: Object): Promise<T> {
    return this.sendData(url, params, JSON.stringify(postData)).then(s => JSON.parse(s));
  }
}

export function getParams(params: Object, enc: boolean = true) {
  const encoder = enc ? encodeURIComponent : s => s;
  let l = Object.keys(params || {}).map(key => [key, encoder(params[key])].join('='));
  return l;
}

function getUrl(url: string, params: Object): string {
  let l = getParams(params);
  if (l.length > 0) {
    return url + '?' + l.join('&');
  } else {
    return url;
  }
}

interface RequestorParams {
  requestor?: Requestor;
  urlBase?: string;
  params?: Object;
  headers?: Object;
  encrypor?: Encryptor;
}

export class BaseRequestor extends Requestor {
  private urlBase: string = '';
  private params: Object = {};
  private requestor: Requestor;
  private encrypor: Encryptor;

  constructor(params: RequestorParams) {
    super(params.headers);

    this.urlBase = params.urlBase || '';
    this.params = params.params || {};
    this.requestor = params.requestor;
    this.encrypor = params.encrypor || new EmptyEncryptor();
  }

  private getUrl(url: string) {
    return this.urlBase + '/' + this.encrypt(url);
  }

  private encrypt(s: string): string {
    return this.encrypor.encrypt(s);
  }

  private decrypt(s: string): string {
    return this.encrypor.decrypt(s);
  }

  private getParams(params?: Object) {
    return {...this.params, ...params};
  }

  async sendData(url: string, params?: Object, postData?: string, opts?: Options): Promise<string> {
    return this.requestor.sendData(this.getUrl(url), this.getParams(params), this.encrypt(postData), opts);
  }

  async getData(url: string, params?: Object): Promise<string> {
    return this.requestor.getData(this.getUrl(url), this.getParams(params)).then(data => this.decrypt(data));
  }

  async getJSON<T extends any>(url: string, params?: Object): Promise<T> {
    return this.getData(url, params).then(s => JSON.parse(this.decrypt(s)));
  }

  async sendJSON<T extends any>(url: string, params?: Object, postData?: Object): Promise<T> {
    return this.sendData(url, params, JSON.stringify(postData)).then(s => JSON.parse(this.decrypt(s)));
  }
}

class RequestorImpl extends Requestor {
  async sendData(url: string, params?: Object, postData?: string, opts?: Options): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      params = params || {};
      postData = postData || '';

      url = getUrl(url, params);
      let req = d3.csv(url);

      opts = {
        ...opts,
        ...{
          header: this.getHeaders(
            getParams(params).join('&'),
            postData,
            {
              'Cache-Control': 'no-cache',
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          )
        }
      };

      req.on('beforesend', (xhr) => {
        if (opts.progress) {
          xhr.upload.addEventListener('progress', (evt) => opts.progress(evt, 'upload'));
          xhr.upload.addEventListener('loadend', (evt) => opts.progress(evt, 'uploadend'));
          xhr.addEventListener('progress', (evt) => opts.progress(evt, 'download'));
        }
      });

      Object.keys(opts.header).forEach(k => {
        req.header(k, opts.header[k]);
      });

      req.post(postData, (err, data: XMLHttpRequest) => {
        if (err) {
          reject(err);
        } else {
          resolve(data.response);
        }
      });
    });
  }

  async getData(url: string, params?: Object): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      url = getUrl(url, params);
      let req = d3.text(url);
      
      let header = this.getHeaders(getParams(params).join('&'), '');
      Object.keys(header).forEach(k => {
        req.header(k, header[k]);
      });

      req.get((err, data: string) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
}

export function createRequestor(params: RequestorParams): Requestor {
  params.requestor = params.requestor || new RequestorImpl(params.headers);
  return new BaseRequestor(params);
}

let globalRequestor: Requestor;

export function getGlobalRequestor(): Requestor {
  if (globalRequestor == null) {
   globalRequestor = new RequestorImpl();
  }
  return globalRequestor;
}