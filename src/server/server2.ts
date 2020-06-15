import * as http from 'http';
import { Readable, Writable } from 'stream';
import { delay } from '../common/common';
import * as URL from 'url';

export interface HandlerArgs {
  in: {
    headers: Set<string>;
    strm: Readable;
    url: string;
    params: {[key: string]: string};
    readonly req: http.IncomingMessage;
  },
  out: {
    headers: {[key: string]: string};
    strm: Writable;
    write(args: { data: string | Buffer, status?: number }): void;
  }
}

export type Handler = (args: HandlerArgs) => 'next' | void | Promise<'next' | void>;

export interface Server {
  addHandler(h: Handler): void;
}

class ServerImpl implements Server {
  private handlers = Array<Handler>();
  private defaultHandler: Handler = args => {
    args.out.write({ data: `url "${args.in.url}" not found`, status: 404 });
  };

  addHandler(h: Handler): void {
    this.handlers.push(h);
  }

  handle(req: http.IncomingMessage, resp: http.ServerResponse) {
    const { url, params } = parseUrl(req.url);
    const args: HandlerArgs = {
      in: {
        headers: new Set(req.rawHeaders),
        url,
        params,
        strm: req,
        req,
      },
      out: {
        headers: {},
        strm: resp,
        write: wargs => {
          resp.writeHead(wargs.status != null ? wargs.status : 200, args.out.headers);
          resp.write(wargs.data);
          resp.end();
        }
      }
    };

    let p: Promise<void | 'next'>;
    for (let n = 0; n <= this.handlers.length; n++) {
      try {
        if (!p) {
          const res = (this.handlers[n] || this.defaultHandler)(args);
          if (res == 'next')
            continue;

          if (res instanceof Promise) {
            p = res;
          } else {
            break;
          }
        } else if (p) {
          p = p.then((r: void | 'next') => {
            if (r != 'next')
              return;

            return (this.handlers[n] || this.defaultHandler)(args);
          });
        }
      } catch (e) {
        console.log(e);
        break;
      }
    }
  }
}

export function createServer(args: { host?: string; port: number }): Server {
  let impl = new ServerImpl();
  const srv = http.createServer((req, resp) => {
    impl.handle(req, resp);
  });

  srv.listen({
    host: args.host,
    port: args.port
  });

  return impl;
}

type URLMatcher = (args: HandlerArgs) => boolean;
function matchURL(url: string): URLMatcher {
  return args => {
    return args.in.url == url;
  };
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

function addJSON(srv: Server, url: (string | URLMatcher)) {
  const match: URLMatcher = typeof url == 'string' ? matchURL(url) : url;  
  return {
    callback<TGET = any, TPOST = any>(h: (_: { get: TGET, post: TPOST }) => Object | void | Promise<any>) {
      srv.addHandler(args => {
        if (!match(args))
          return 'next';

        const data = h({ get: args.in.params as any, post: {} as any });
        const write = (data: any) => {
          if (typeof data == 'string')
            args.out.write({ data });
          else
            args.out.write({ data: JSON.stringify(data) });
        };

        if (data instanceof Promise) {
          data.then(write);
        } else {
          write(data);
        }
      });
    }
  };
}


const srv = createServer({ port: 8080, host: '127.0.0.1' });
srv.addHandler(args => {
  console.log(args.in.req.url);

  // return delay(1000).then(() => 'next') as Promise<'next'>;
  // return delay<'next'>(1000).then(() => 'next');
  return 'next';
});

addJSON(srv, '/node/cfg')
.callback<{ name: string, id: number }>(args => {
  return { ...args.get, random: Math.random() };
});
