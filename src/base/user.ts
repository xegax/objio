import { Requestor, createRequestor } from '../common/requestor';
import { AccessType } from './security';
import { AuthCheckRequestor } from '../common/auth-requestor';

let authUser: User;
let sessReq: Requestor;

interface OpenSessionResult {
  userName: string;
  sessId: string;
  rights: Array<AccessType>;
}

interface OpenSessionArgs {
  req: Requestor;
  login?: string;
  pass?: string;
  onAuthError?(): Promise<any>;
}

export class User {
  private name: string;
  private rights = new Set<AccessType>();

  getName() {
    return this.name;
  }

  canCreate() {
    return this.rights.has('create');
  }

  canWrite() {
    return this.rights.has('write');
  }

  canRead() {
    return this.rights.has('read');
  }

  isGuest() {
    return this.rights.has('read') && this.rights.size == 1;
  }

  static get(): User {
    return authUser;
  }

  static openSession(args: OpenSessionArgs): Promise<{ user: User, req: Requestor }> {
    if (authUser)
      return Promise.resolve({ user: authUser, req: sessReq });

    let sessId = localStorage.getItem('sessId');
    const { req, login, pass } = args;
    return (
      req.getJSON<OpenSessionResult>({ url: 'objio/open-session', postData: { login, pass, sessId } })
      .then(res => {
        authUser = new User();
        authUser.name = res.userName;
        authUser.rights = new Set(res.rights);
        localStorage.setItem('sessId', res.sessId);

        sessReq = createRequestor({
          requestor: req,
          headers: {
            'objio-sess-id': res.sessId
          }
        });

        return {
          user: authUser,
          req: args.onAuthError ? new AuthCheckRequestor({
            req: sessReq,
            onAuthError: args.onAuthError
          }) : sessReq
        };
      })
      .catch(err => {
        return Promise.reject(err ? err.data : err);
      })
    );
  }
}
