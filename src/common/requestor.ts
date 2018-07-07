import { Encryptor } from '../common/encryptor';
import * as axios from 'axios';
import  * as env from './env';

export interface RequestArgs {
  url: string;
  params?: Object;
  postData?: Object | string;
  encryptor?: Encryptor;
}

export interface Requestor {
  setCookie(cookie: Object);

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

  setCookie(value: Object) {
    this.requestor.setCookie(value);
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
  private cookie: Object = {};

  setCookie(value: Object) {
    this.cookie = {...this.cookie, ...value};
  }

  getData(args: RequestArgs): Promise<string> {
    const url = makeUrl(args.url, args.params);
    let postData = args.postData;
    if (postData != null && typeof postData != 'string' && !(postData instanceof File))
      postData = JSON.stringify(postData);

    const headers: Object = {};
    if (env.isNode())
      headers['Cookie'] = Object.keys(this.cookie).map(key => [key, this.cookie[key]].join('=')).join('; ');

    if (postData)
      return (
        axios.default.post<string>(url, postData, { headers })
        .then((res: axios.AxiosResponse<string>) => {
          return (typeof res.data == 'string') ? res.data : JSON.stringify(res.data);
        })
        .catch(res => {
          throw res.response;
        })
      );

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
