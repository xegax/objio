import { OBJIOStore, WriteResult, CreateObjectsArgs, CreateResult, Requestor } from 'objio';

interface OBJIORemoteStoreArgs {
  root?: string;
  prj?: string;
  req: Requestor;
}

export class OBJIORemoteStore implements OBJIOStore {
  private req: Requestor;
  private root: string = 'objio/';
  private prj: { prj?: string };

  constructor(args: OBJIORemoteStoreArgs) {
    this.req = args.req;
    this.root = args.root || this.root;
    this.prj = args.prj ? { prj: args.prj } : {};
  }

  createObjects(arr: CreateObjectsArgs): Promise<CreateResult> {
    return this.req.sendJSON(`${this.root}create-object`, this.prj, arr);
  }

  writeObjects(arr: Array<{id: string, json: Object}>): Promise<WriteResult> {
    return this.req.sendJSON(`${this.root}write-objects`, this.prj, arr);
  }

  readObject(id: string): Promise<any> {
    return this.req.sendJSON(`${this.root}read-object`, this.prj, {id});
  }

  readObjects(id: string): Promise<any> {
    return this.req.sendJSON(`${this.root}read-objects`, this.prj, {id});
  }

  methodInvoker(id: string, method: string, args: Object): Promise<any> {
    return null;
  }
}
