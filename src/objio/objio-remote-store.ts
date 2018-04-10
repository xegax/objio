import { OBJIOStore, CreateResult, WriteResult } from 'objio';
import { Requestor } from 'requestor/requestor';

export class OBJIORemoteStore implements OBJIOStore {
  private req: Requestor;

  constructor(req: Requestor) {
    this.req = req;
  }

  createObjects(arr: Array<{classId: string, json: Object}>): Promise<Array<CreateResult>> {
    return this.req.sendJSON('create-object', {}, arr);
  }

  writeObjects(arr: Array<{id: string, json: Object}>): Promise<WriteResult> {
    return this.req.sendJSON('write-objects', {}, arr);
  }

  readObject(id: string): Promise<any> {
    return this.req.sendJSON('read-object', {}, {id});
  }

  readObjects(id: string): Promise<any> {
    return this.req.sendJSON('read-objects', {}, {id});
  }

  methodInvoker(id: string, method: string, args: Object): Promise<any> {
    return null;
  }
}
