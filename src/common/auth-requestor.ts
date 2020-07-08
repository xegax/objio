import { Requestor, RequestArgs } from './requestor';

interface AuthCheckArgs {
  req: Requestor;
  onAuthError(err: XMLHttpRequest): Promise<any>;
}

export class AuthCheckRequestor implements Requestor {
  private args: AuthCheckArgs;

  constructor(args: AuthCheckArgs) {
    this.args = {...args};
  }

  private onError = (err: XMLHttpRequest) => {
    if (err.status == 401 || err.status == 403)
      return this.args.onAuthError(err);

    return Promise.reject(err);
  }

  setRequestor(req: Requestor) {
    this.args.req = req;
  }

  getData(args: RequestArgs): Promise<string> {
    return this.args.req.getData(args).catch(err => {
      return this.onError(err).then(() => this.args.req.getData(args));
    });
  }

  getJSON(args: RequestArgs): Promise<any> {
    return this.args.req.getJSON(args).catch(err => {
      return this.onError(err).then(() => this.args.req.getJSON(args));
    });
  }

  getRaw(args: RequestArgs) {
    return this.args.req.getRaw(args).catch(err => {
      return this.onError(err).then(() => this.args.req.getRaw(args));
    });
  }
}
