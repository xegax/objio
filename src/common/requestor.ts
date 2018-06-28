import { text } from 'd3-request';
import {Encryptor, EmptyEncryptor} from '../common/encryptor';

export interface RequestArgs {
  url: string;
  params?: Object;
  postData?: Object | string;
  encryptor?: Encryptor;
}

export interface Requestor {
  getData(args: RequestArgs): Promise<string>;
  getJSON<T = any>(args: RequestArgs): Promise<T>;
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
}

export class RequestorBase implements Requestor {
  private urlBase: string = '';
  private params: Object = {};
  private requestor: Requestor;

  constructor(params: Partial<RequestorBaseArgs>) {
    this.urlBase = params.urlBase || '';
    this.params = params.params || {};
    this.requestor = params.requestor;
  }

  getData(args: RequestArgs): Promise<string> {
    return this.requestor.getData(this.getArgs(args));
  }

  getJSON<T = any>(args: RequestArgs): Promise<T> {
    return this.requestor.getJSON(this.getArgs(args));
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

    return newArgs;
  }
}

class RequestorImpl implements Requestor {
  getData(args: RequestArgs): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const url = makeUrl(args.url, args.params);
      const req = text(url);

      const callback = (err, data: string) => {
        if (err)
          return reject(err);

        try {
          resolve(data);
        } catch (e) {
          console.log('getData error', e, url);
        }
      };

      let postData = args.postData;
      if (postData != null && typeof postData != 'string')
        postData = JSON.stringify(postData);

      if (postData != null)
        return req.post(postData, callback);

      req.get(callback);
    });
  }

  getJSON<T = any>(args: RequestArgs): Promise<T> {
    return this.getData(args).then(data => {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.log('getJSON error', makeUrl(args.url, args.params), e);
      }
    });
  }
}

export function createRequestor(args?: Partial<RequestorBaseArgs>): Requestor {
  const requestor = new RequestorImpl();
  if (!args)
    return requestor;

  return new RequestorBase({...args, requestor});
}
