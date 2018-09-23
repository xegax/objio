import { Requestor, RequestArgs } from '../common/requestor';

export type LoginFormCallback = (error?: string) => Promise<{ login: string; pass: string }>;

export interface AuthRequestorArgs {
  req: Requestor;
  showLogin: LoginFormCallback;
  loginUrl?: string;
}

export class AuthRequestor implements Requestor {
  private req: Requestor;
  private requests = Array<{
    request: () => Promise<any>,
    resolve: (data: any) => void,
    reject: (err: any) => void
  }>();
  private showLoginForm: LoginFormCallback;
  private loginUrl: string;

  constructor(args: AuthRequestorArgs) {
    this.req = args.req;
    this.showLoginForm = args.showLogin;
    this.loginUrl = args.loginUrl || 'objio/login';
    this.onAuthRequired = this.onAuthRequiredImpl();
  }

  private onAuthRequired: () => Promise<any>;

  private pushRequest(request: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      request().then(resolve).catch((err: XMLHttpRequest) => {
        if (err.status != 401)
          return reject(err);

        this.requests.push({ request, resolve, reject });
        if (this.requests.length == 1)
          this.tryToAuthorize();
      });
    });
  }

  private tryToAuthorize = () => {
    return this.onAuthRequired()
      .then(this.authorized)
      .catch(this.tryToAuthorize);
  }

  authorized = () => {
    if (this.requests.length == 0)
      return Promise.resolve();

    const req = this.requests[0];
    return (
      req.request()
      .then(data => {
        this.requests.splice(0, 1);
        req.resolve(data);
        return this.authorized();
      })
      .catch(err => {
        if ([401, 403].indexOf(err.status) != -1) {
          req.reject(err.responseText);
        } else {
          this.tryToAuthorize();
        }
      })
    );
  }

  private login(login: string, passwd: string) {
    return this.req.getJSON({
      url: this.loginUrl,
      postData: { login, passwd }
    }).then((res: { error: string, sessId: string }) => {
      if (!res.error) {
        this.req.setCookie({ sessId: res.sessId });
        return {};
      }

      throw res.error;
    });
  }

  private onAuthRequiredImpl(): () => Promise<any> {
    let error: string;
    return () => this.showLoginForm(error)
      .then(args => this.login(args.login, args.pass))
      .then(() => {
        error = null;
      }).catch((res: string) => {
        error = res;
        throw error;
      });
  }

  getData(args: RequestArgs): Promise<string> {
    return this.pushRequest(() => this.req.getData(args));
  }

  getJSON(args: RequestArgs): Promise<any> {
    return this.pushRequest(() => this.req.getJSON(args));
  }

  setCookie(value: Object) {
    this.req.setCookie(value);
  }

  isAuthorized(): boolean {
    return this.requests.length == 0;
  }
}
