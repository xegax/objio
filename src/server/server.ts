import * as http from 'http';
import * as URL from 'url';
import {Encryptor, EmptyEncryptor} from '../common/encryptor';
import { Readable } from 'stream';

export interface Params<GET, POST, HEADERS> {
  get: GET;
  post?: POST;
  url: string;
  headers: HEADERS;
  size: number;
  done(data: Object | string): string;  // sent data
  error(text: string, statusCode?: number): string;
}

export type Handler<GET, POST, HEADERS> = (
  params: Params<GET, POST, HEADERS>,
  addOnClose?: (handler: () => void) => void
) => void;

export interface DataParams<GET, HEADERS> {
  get: GET;
  stream: Readable;
  headers: HEADERS;
}

export type DataHandler<GET, HEADERS> = (
  params: DataParams<GET, HEADERS>,
  resolve: (result: any) => void,
  reject: (err: any) => void
) => void;

export interface HandlerHolder {
  type: 'json' | 'data';
  handler: Handler<any, any, any> | DataHandler<any, any>;
  addOnClose: (handler: () => void) => void;
}

export interface Server {
  addJsonHandler<GET, POST, HEADER>( url: string,
                                     handler: Handler<GET, POST, HEADER>,
                                    addOnClose?: (handler: () => void) => void );
  addDataHandler<GET, HEADER>(url: string, handler: DataHandler<GET, HEADER>);
}

function parseUrl(str: string, baseUrl?: string) {
  let parsed = URL.parse(str, true);
  let params = {};
  Object.keys(parsed.query).forEach((key) => {
    params[key.trim()] = parsed.query[key].toString().trim();
  });

  let url = parsed.pathname;
  if (baseUrl && url.startsWith(baseUrl))
      url = url.substr(baseUrl.length);

  return {
    url,
    params
  };
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

  addJsonHandler<GET, POST, HEADER>( url: string,
                                     handler: Handler<GET, POST, HEADER>,
                                     addOnClose: (handler: () => void) => void) {
    this.handlerMap[url] = {type: 'json', handler, addOnClose};
  }

  addDataHandler<GET, HEADER>(url: string, handler: DataHandler<GET, HEADER>) {
    this.handlerMap[url] = {type: 'data', handler, addOnClose: () => {}};
  }

  findHandler(url: string): HandlerHolder {
    let handler = this.handlerMap[ this.decrypt(url) ];
    if (!handler)
      handler = this.handlerMap[ this.decrypt(url.split('/')[0]) ];

    return handler;
  }

  handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
    let {url, params} = parseUrl(request.url, this.baseUrl);

    let holder = this.findHandler(url);
    if (!holder) {
      response.writeHead(404, {'Content-Type': 'application/json'});
      response.write(`${url} handler not found`);
      return response.end();
    }

    const writeOK = (data: string | Object) => {
      let res = this.encrypt(typeof data == 'string' ? data : JSON.stringify(data));
      response.writeHead(200, {'Content-Type': 'application/json'});
      response.write(res);
      response.end();

      return res;
    };

    const writeErr = (err: string, statusCode?: number) => {
      err = err.toString();
      statusCode = statusCode == null ? 500 : statusCode;
      response.writeHead(statusCode, {'Content-Type': 'application/json'});
      response.write(err);
      response.end();

      return err;
    };

    const closes = [];
    request.connection.on('close', () => {
      closes.forEach(handler => handler());
    });

    if (request.method == 'POST') {
      const jsonHandler = holder.handler as Handler<any, any, any>;
      const dataHandler = holder.handler as DataHandler<any, any>;

      let postData = '';
      let postJSON: any;

      if (holder.type == 'json') {
        request.on('data', (data: Buffer) => {
          postData += data.toString();
        });
      } else {
        dataHandler({
            get: params,
            stream: request,
            headers: request.headers
          },
          writeOK,
          writeErr
        );
      }

      if (holder.type == 'json')
        request.on('end', () => {
          if (postData.length) {
            try {
              postJSON = JSON.parse(this.decrypt(postData.toString()));
            } catch (e) {
              console.log(e);
            }
          }

          try {
              jsonHandler({
                size: postData.length + request.url.length,
                get: params,
                url,
                post: postJSON,
                headers: request.headers,
                done: writeOK,
                error: writeErr
              }, handler => closes.push(handler));
          } catch (err) {
            writeErr(err);
          }
        });
    } else {
      try {
        (holder.handler as Handler<any, any, any>)(
          {
            size: 0,
            get: params,
            headers: request.headers,
            url,
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
