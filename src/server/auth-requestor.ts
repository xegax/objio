import { Requestor } from './requestor';

export type LoginFormCallback = (error?: string) => Promise<{login: string; pass: string}>;

export class AuthRequestor extends Requestor {
  private req: Requestor;
  private requests = Array<{
    request: () => Promise<any>,
    resolve: (data: any) => void,
    reject: (err: any) => void
  }>();
  private showLoginForm: LoginFormCallback;

  constructor(req: Requestor, showLogin: LoginFormCallback) {
    super();

    this.req = req;
    this.showLoginForm = showLogin;
    this.onAuthRequired = this.onAuthRequiredImpl();
  }

  private onAuthRequired: () => Promise<any>;

  private pushRequest(request: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      request().then(resolve).catch((err: ProgressEvent) => {
        const target = err.currentTarget as XMLHttpRequest;
        if (target.status != 401)
          return reject(err);

        this.requests.push({request, resolve, reject});
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

  authorized = async () => {
    while (this.requests.length) {
      const req = this.requests[0];
      try {
        const data = await req.request();
        this.requests.splice(0, 1);
        req.resolve(data);
      } catch (err) {
        const target = err.currentTarget as XMLHttpRequest;
        if (target.status != 401) {
          req.reject(target.responseText);
        } else {
          this.tryToAuthorize();
        }
      }
    }
  }

  private login(login: string, passwd: string) {
    return this.req.sendJSON('objio/login', {}, {login, passwd}).then((res: {error: string}) => {
      if (res.error)
        throw res.error;
      return null;
    });
  }

  private onAuthRequiredImpl(): () => Promise<any> {
    let error: string;
    return () => new Promise((resolve, reject) => {
      this.showLoginForm(error)
      .then(args => this.login(args.login, args.pass))
      .then(() => {
        error = null;
        resolve();
      }).catch((res: string) => {
        error = res;
        reject();
      });
    });
  }

  sendData(url: string, params?: Object, postData?: string, opts?): Promise<string> {
    return this.pushRequest(() => this.req.sendData(url, params, postData));
  }

  getData(url: string, params?: Object): Promise<string> {
    return this.pushRequest(() => this.req.getData(url, params));
  }

  isAuthorized(): boolean {
    return this.requests.length == 0;
  }
}
