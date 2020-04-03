import { Requestor, RequestArgs } from './requestor';

interface AuthCheckArgs {
  req: Requestor;
  onAuthError(err: XMLHttpRequest): Promise<any>;
}

export class AuthCheckRequestor implements Requestor {
  private args: AuthCheckArgs;

  constructor(args: AuthCheckArgs) {
    this.args = args;
  }

  private onError = (err: XMLHttpRequest) => {
    if (err.status == 401 || err.status == 403)
      return this.args.onAuthError(err);

    return Promise.reject(err);
  }

  getData(args: RequestArgs): Promise<string> {
    return this.args.req.getData(args).catch(this.onError);
  }

  getJSON(args: RequestArgs): Promise<any> {
    return this.args.req.getJSON(args).catch(this.onError);
  }
}
