import { createRequestor, Requestor } from '../common/requestor';
import { AuthCheckRequestor } from '../common/auth-requestor';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function authorize(req: Requestor) {
  return req.getRaw({
    url: '/login',
    postData: `uname=administrator&pwd=&useLDAP=0&svr=&useCreds=0&delegateCreds=0&locale=eng`
  }).then(res => {
    const cookies = res.headers['set-cookie'] as Array<string>;
    let [sid] = cookies.filter(s => s.startsWith('sid='));
    if (sid)
      sid = sid.split(';')[0];
    return sid;
  });
}

export class WRRequestor {
  private req: Requestor;

  constructor(urlBase: string) {
    const req = createRequestor({ urlBase  });
    const authoReq = this.req = new AuthCheckRequestor({
      req,
      onAuthError: () => {
        return (
          authorize(req)
          .then(sid => {
            const req = createRequestor({ urlBase, headers: { 'Cookie': sid } });
            authoReq.setRequestor(req);
          })
        );
      }
    });
  }

  reportParams(reportUUID: string) {
    return this.req.getJSON<{ reportUUID: string; prjUUID: string }>({
      url: 'dbmanager/report-params',
      params: { uuid: reportUUID }
    });
  }

  dbItemList(filter: number) {
    return this.req.getJSON<{ folders: string[], items: any[]}>({
      url: 'dbmanager/list',
      params: { filter }
    });
  }

  dbItemEdit(args: { filter: number; item: string; name: string }) {
    const { filter, ...other } = args;
    return this.req.getJSON({
      url: 'dbmanager/edit',
      params: { filter },
      postData: other
    });
  }

  dbItemDelete(args: { filter: number; items: Array<string>, recursive: boolean; unload: boolean }) {
    const { filter, ...other } = args;
    return this.req.getJSON({
      url: 'dbmanager/delete',
      params: { filter },
      postData: other
    });
  }

  createReport(args: { folder: string; prjUUID: string }) {
    return this.req.getJSON<{ id: string; name: string }>({
      url: 'wr/report/create',
      params: args
    });
  }

  loadProject(prjUUID: string) {
    return this.req.getJSON<{ name: string }>({
      url: 'project/load',
      params: { prjUUID }
    })
  }

  nodeList(prjUUID: string) {
    return this.req.getJSON<{
      links: [],
      nodes: Array<{ id: string; type: string; name: string }>
    }>
    ({
      url: 'project/nodes/list',
      params: { prjUUID }
    });
  }
}
