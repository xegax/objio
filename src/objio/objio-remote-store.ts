import { OBJIOStore, WriteResult, CreateResult, Requestor } from 'objio';

export class OBJIORemoteStore implements OBJIOStore {
  private req: Requestor;
  private root: string = 'objio/';

  constructor(req: Requestor, root?: string) {
    this.req = req;
    this.root = root || this.root;
  }

  createObjects(arr: Array<{classId: string, json: Object}>): Promise<Array<CreateResult>> {
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
