import { Encryptor } from '../common/encryptor';
import * as axios from 'axios';
import  * as env from './env';

export interface RequestArgs {
  url: string;
  params?: Object;
  postData?: Object | string;
  headers?: Object;
  encryptor?: Encryptor;

  onProgress?(value: number): void;
}

export interface Requestor {
  getData(args: RequestArgs): Promise<string>;
  getJSON<T = any>(args: RequestArgs): Promise<T>;
  getRaw(args: RequestArgs): Promise<axios.AxiosResponse>;
}

// return ['key1=value1', 'key2=value2', ...]
export function objectToParams(params: Object, encode?: boolean): Array<string> {
  const encoder = encode ? encodeURIComponent : s => s;
  return Object.keys(params || {}).map(key => [key, encoder(params[key])].join('='));
}

export function makeUrl(url: string, params: Object): string {
  const l = objectToParams(params);
  if (!l.length)
    return url;

  return url + '?' + l.join('&');
}

export interface RequestorBaseArgs {
  requestor?: Requestor;
  urlBase?: string;
  params?: Object;
  headers?: Object;
}

export class RequestorBase implements Requestor {
  private urlBase: string = '';
  private params: Object = {};
  private headers: Object = {};
  private requestor: Requestor;

  constructor(params: Partial<RequestorBaseArgs>) {
    this.urlBase = params.urlBase || '';
    this.params = params.params || {};
    this.headers = params.headers || {};
    this.requestor = params.requestor;
  }

  getData(args: RequestArgs): Promise<string> {
    return this.requestor.getData(this.getArgs(args));
  }

  getJSON<T = any>(args: RequestArgs): Promise<T> {
    return this.requestor.getJSON(this.getArgs(args));
  }

  getRaw(args: RequestArgs) {
    return this.requestor.getRaw(this.getArgs(args));
  }

  private getUrl(url: string): string {
    if (!this.urlBase)
      return url;

    const sep = this.urlBase.endsWith('/') || url.startsWith('/') ? '' : '/';
    return this.urlBase + sep + url;
  }

  private getArgs(args: RequestArgs): RequestArgs {
    const newArgs: RequestArgs = {
      ...args,
      url: this.getUrl(args.url)
    };

    if (this.params)
      newArgs.params = { ...this.params };

    if (args.params)
      newArgs.params = { ...newArgs.params, ...args.params };

    if (this.headers)
      newArgs.headers = { ...this.headers };

    if (args.headers || this.headers)
      newArgs.headers = { ...this.headers, ...args.headers };

    return newArgs;
  }
}

class RequestorImpl implements Requestor {
  getData(args: RequestArgs): Promise<string> {
    let url = makeUrl(args.url, args.params);

    let postData = args.postData;
    if (postData != null && postData.constructor == Object)
      postData = JSON.stringify(postData);

    const headers: Object = {...args.headers};
    if (postData) {
      return (
        axios.default.post<string>(url, postData, {
          headers,
          onUploadProgress: (evt: ProgressEvent) => {
            args.onProgress && args.onProgress(evt.loaded / evt.total);
          }
        })
        .then((res: axios.AxiosResponse<string>) => {
          return (typeof res.data == 'string') ? res.data : JSON.stringify(res.data);
        })
        .catch(res => {
          throw res.response;
        })
      );
    }

    return (
      axios.default.get<string>(url, { headers })
      .then((res: axios.AxiosResponse<string>) => {
        return (typeof res.data == 'string') ? res.data : JSON.stringify(res.data);
      })
      .catch(res => {
        throw res.response;
      })
    );
  }

  getJSON<T = any>(args: RequestArgs): Promise<T> {
    args.headers = {
      'Content-Type': 'text/plain',
      ...args.headers
    };

    return this.getData(args).then(data => {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.log('getJSON error', makeUrl(args.url, args.params), e);
      }
    });
  }

  getRaw(args: RequestArgs) {
    let url = makeUrl(args.url, args.params);

    let postData = args.postData;
    if (postData != null && postData.constructor == Object)
      postData = JSON.stringify(postData);

    const headers: Object = {...args.headers};
    if (postData) {
      return (
        axios.default.post<string>(url, postData, {
          headers,
          onUploadProgress: (evt: ProgressEvent) => {
            args.onProgress && args.onProgress(evt.loaded / evt.total);
          }
        })
        .catch(res => {
          throw res.response;
        })
      );
    }

    return (
      axios.default.get(url, { headers })
      .catch(res => {
        throw res.response;
      })
    );
  }
}

export function createRequestor(args?: Partial<RequestorBaseArgs>): Requestor {
  let requestor = new RequestorImpl();
  if (!args)
    return requestor;

  return new RequestorBase({ requestor, ...args });
}
