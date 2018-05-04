import {
  Requestor
} from './common';
import {
  CreateObjectsArgs,
  CreateResult,
  OBJIOStore,
  WriteResult
} from './store';

export interface OBJIORemoteStoreArgs {
  root?: string;
  req: Requestor;
}

export class OBJIORemoteStore implements OBJIOStore {
  private req: Requestor;
  private root: string = 'objio/';

  constructor(args: OBJIORemoteStoreArgs) {
    this.req = args.req;
    this.root = args.root || this.root;
  }

  createObjects(arr: CreateObjectsArgs): Promise<CreateResult> {
    return this.req.sendJSON(`${this.root}create-object`, {}, arr);
  }

  writeObjects(arr: Array<{id: string, json: Object}>): Promise<WriteResult> {
    return this.req.sendJSON(`${this.root}write-objects`, {}, arr);
  }

  readObject(id: string): Promise<any> {
    return this.req.sendJSON(`${this.root}read-object`, {}, {id});
  }

  readObjects(id: string): Promise<any> {
    return this.req.sendJSON(`${this.root}read-objects`, {}, {id});
  }

  methodInvoker(id: string, method: string, args: Object): Promise<any> {
    return null;
  }
}
