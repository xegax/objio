import * as http from 'http';
import * as url from 'url';
import {Encryptor, EmptyEncryptor} from '../common/encryptor';

export interface Params<GET, POST, COOKIE> {
  get: GET;
  post?: POST;
  cookie: COOKIE;
  done(data: any);
  error(text: string, statusCode?: number);
}

export type Handler<GET, POST, COOKIE> = (
  params: Params<GET, POST, COOKIE>,
  addOnClose?: (handler: () => void) => void
) => void;

export type DataHandler<GET> = (
  params: {get: GET, offs: number, count: number, post: Buffer},
  resolve: (result: any) => void,
  reject: (err: any) => void
) => void;

export interface HandlerHolder {
  type: 'json' | 'data';
  handler: Handler<any, any, any> | DataHandler<any>;
  addOnClose: (handler: () => void) => void;
}

export interface Server {
  addJsonHandler<GET, POST, COOKIE>( url: string,
                                     handler: Handler<GET, POST, COOKIE>,
                                    addOnClose?: (handler: () => void) => void );
  addDataHandler<GET>(url: string, handler: DataHandler<GET>);
}

function parseUrl(str) {
  let parsed = url.parse(str, true);
  let params = {};
  Object.keys(parsed.query).forEach((key) => {
    params[key.trim()] = parsed.query[key].toString().trim();
  });

  return {
    url: parsed.pathname,
    params
  };
}

function parseCookie(str: string): {[key: string]: string} {
  const map = {};
  (str || '').split(';').forEach(keyValue => {
    let [name, value] = keyValue.split('=');
    name = (name || '').trim();
    if (!name)
      return;

    map[name] = unescape((value || '').trim());
  });

  return map;
}

function cookiesToStr(cookies: {[key: string]: string}): Array<string> {
  return Object.keys(cookies).map(key => {
    const value = escape(cookies[key]);
    return `${key}=${value}`;
  });
}

export interface ServerParams {
  encryptor?: Encryptor;
  port: number;
  baseUrl?: string;
}

export class ServerImpl implements Server  {
  private encryptor: Encryptor;
  private handlerMap: {[url: string]: HandlerHolder} = {};
  private baseUrl: string = '';

  constructor(params: ServerParams) {
    this.encryptor = params.encryptor || new EmptyEncryptor();
    this.baseUrl = params.baseUrl || '';
  }

  private encrypt(s: string): string {
    return this.encryptor.encrypt(s);
  }

  private decrypt(s: string): string {
    return this.encryptor.decrypt(s);
  }

  addJsonHandler<GET, POST, COOKIE>( url: string,
                                     handler: Handler<GET, POST, COOKIE>,
                                     addOnClose: (handler: () => void) => void) {
    this.handlerMap[url] = {type: 'json', handler, addOnClose};
  }

  addDataHandler<GET>(url: string, handler: DataHandler<GET>) {
    this.handlerMap[url] = {type: 'data', handler, addOnClose: () => {}};
  }

  findHandler(url: string): HandlerHolder {
    if (this.baseUrl.length)
      if (url.substr(0, this.baseUrl.length) == this.baseUrl)
        url = url.substr(this.baseUrl.length);

    return this.handlerMap[this.decrypt(url)];
  }

  handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    let {url, params} = parseUrl(request.url);

    let holder = this.findHandler(url);
    if (!holder) {
      response.writeHead(404, {'Content-Type': 'application/json'});
      response.write(`${url} handler not found`);
      return response.end();
    }

    let cookie = parseCookie(request.headers.cookie as string || '');

    const writeOK = (data: string | Object) => {
      response.setHeader('Set-Cookie', cookiesToStr(cookie));

      let res = typeof data == 'string' ? data : JSON.stringify(data);
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.write(this.encrypt(res));
      response.end();
    };

    const writeErr = (err: string, statusCode?: number) => {
      statusCode = statusCode == null ? 500 : statusCode;
      response.writeHead(statusCode, {'Content-Type': 'application/json'});
      response.write(err.toString());
      response.end();
    };

    const closes = [];
    request.connection.on('close', () => {
      closes.forEach(handler => handler());
    });

    if (request.method == 'POST') {
      const jsonHandler = holder.handler as Handler<any, any, any>;
      const dataHandler = holder.handler as DataHandler<any>;

      let postData = '';
      let postJSON: any;
      let offsData = 0;

      request.on('data', (data: Buffer) => {
        if (holder.type == 'json') {
          postData += data.toString();
        } else {
          dataHandler({get: params, post: data, offs: offsData, count: data.byteLength}, writeOK, writeErr);
          offsData += data.byteLength;
        }
      });
      request.on('end', () => {
        if (holder.type == 'json' && postData.length) {
          try {
            postJSON = JSON.parse(this.decrypt(postData.toString()));
          } catch (e) {
            console.log(e);
          }
        }

        try {
          if (holder.type == 'json') {
            jsonHandler({
              get: params,
              post: postJSON,
              cookie,
              done: writeOK,
              error: writeErr
            }, handler => closes.push(handler));
          } else {
            dataHandler({get: params, offs: offsData, count: 0, post: null}, writeOK, writeErr);
          }
        } catch (err) {
          writeErr(err);
        }
      });
    } else {
      try {
        (holder.handler as Handler<any, any, any>)(
          {
            get: params,
            cookie,
            done: writeOK,
            error: writeErr
          }, handler => closes.push(handler));
      } catch (err) {
        writeErr(err);
      }
    }
  }
}

export function createServer(params: ServerParams): Server {
  let impl = new ServerImpl(params);
  let server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
    impl.handleRequest(request, response);
  });
  server.listen(params.port);

  return impl;
}
