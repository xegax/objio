import { ChildProcess, fork } from 'child_process';
import { delay } from './common';

export type AnyFunc = (...args: any) => any;

export interface INode<T, T2> {
  watch(handler: T): INode<T, T2>;
  get<K extends keyof T2, TF extends AnyFunc = T2[K] extends AnyFunc ? T2[K] : never>(key: K, args: Parameters<TF>[0]): ReturnType<TF> extends Promise<any> ? ReturnType<TF> : Promise<ReturnType<TF>>;
  invoke<K extends keyof T2, TF extends AnyFunc = T2[K] extends AnyFunc ? T2[K] : never>(key: K, args: Parameters<TF>[0]): void;
  exit(): void;
  promise: Promise<void>;
}

interface IHostArgs<T> {
  module: T;
  path?: string;
}

export interface IModuleDef<TWatch, TCtrl> {
  watch: TWatch;
  ctrl: TCtrl;
}

type IModuleKey<T> = {[K in keyof T]: IModuleDef<any, any>};
interface ICPHost<TMsg extends IModuleKey<TMsg>> {
  run<
    TMsgKey extends keyof TMsg,
    TMsgHandler extends TMsg[TMsgKey]['watch'],
    TCtrlHandler extends TMsg[TMsgKey]['ctrl'],
    TNode extends INode<TMsgHandler, TCtrlHandler>
  >(args: IHostArgs<TMsgKey>): TNode;
}

export interface IMsgHolder {
  type: 'get' | 'invoke' | 'watch' | 'result';
  id?: number;
  msgData?: {
    handler: string;
    args?: Object;
  };
}

class CPHostImpl {
  private nodes = new Set<ChildProcess>();
  private msgIdCounter = 0;
  private waitResult = new Map<number, (args: any) => {}>();

  run<T1, T2>(args: IHostArgs<string>): INode<T1, T2> {
    const cp = fork(`${args.path || ''}${args.module}`);
    this.nodes.add(cp);

    let handlers = Array<T1>();
    let invoke: any = (name: string, args: any) => {
      const msg: IMsgHolder = {
        type: 'invoke',
        msgData: { handler: name, args }
      };
      cp.send(msg);
    };

    let get: any = (name: string, args: any) => {
      const msg: IMsgHolder = {
        type: 'get',
        id: this.msgIdCounter++,
        msgData: { handler: name, args }
      };

      const p = new Promise(resolve => {
        this.waitResult.set(msg.id, resolve as any);
      });

      cp.send(msg);
      return p;
    };

    const exit = () => {
      cp.kill();
    };

    let node: INode<T1, T2> = {
      watch(h: T1) {
        const notAFunc = Object.keys(h).find(k => typeof h[k] != 'function');
        if (notAFunc)
          throw new Error(`"${notAFunc}" must be a function`);

        handlers.push(h);
        return node;
      },
      exit,
      invoke,
      get,
      promise: Promise.resolve()
    };

    cp.on('message', (msg: IMsgHolder) => {
      if (msg.type == 'watch') {
        let unhandled = true;
        for (let n = 0; n < handlers.length; n++) {
          const hObj = handlers[n];
          const hFunc = hObj[msg.msgData.handler] as Function;
          if (!hFunc)
            continue;

          hFunc(msg.msgData.args);
          unhandled = false;
        }

        if (unhandled)
          console.log(`Unhandled message ${msg.msgData}`);
      } else if (msg.type == 'result') {
        this.waitResult.get(msg.id)(msg.msgData.args);
        this.waitResult.delete(msg.id);
      }
    });

    node.promise = new Promise(resolve => {
      const onClose = () => {
        if (this.nodes.delete(cp)) {
          console.log('on close cp');
          delay(10).then(resolve);
        }
      };

      cp.on('close', onClose);
      cp.on('disconnect', onClose);
    });

    return node;
  }
}

export function cpHost<TMsg extends IModuleKey<TMsg>>(): ICPHost<TMsg> {
  return new CPHostImpl() as any;
}
