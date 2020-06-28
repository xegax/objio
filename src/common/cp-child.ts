import { IMsgHolder, AnyFunc } from './cp-host';

interface IChild<TWatch> {
  invoke<K extends keyof TWatch, TF extends AnyFunc = TWatch[K] extends AnyFunc ? TWatch[K] : never>(key: K, args: Parameters<TF>[0]): Promise<ReturnType<TF>>;
}

export function cpChild<TWatchHandler, THandler>(h: THandler) {
  process.on('message', (msg: IMsgHolder) => {
    if (!msg.msgData)
      return;

    const handler = h[msg.msgData.handler];
    if (!handler)
      return;

    if (msg.type == 'get') {
      Promise.resolve(handler(msg.msgData.args))
      .then(res => {
        let ret: IMsgHolder = {
          type: 'result',
          id: msg.id,
          msgData: {
            handler: msg.msgData.handler,
            args: res
          }
        };
        process.send(ret);
      });
    } else if (msg.type == 'invoke') {
      handler(msg.msgData.args);
    }
  });

  let child = {
    invoke: (handler: string, args: any) => {
      let msg: IMsgHolder = {
        type: 'watch',
        msgData: {
          handler,
          args
        }
      };
      process.send(msg);
    }
  } as IChild<TWatchHandler>;

  return child;
}
