import { Requestor } from '../common/requestor';
import {
  CreateObjectsArgs,
  CreateResult,
  OBJIOStore,
  WriteResult,
  ReadResult
} from './store';

export interface OBJIORemoteStoreArgs {
  root?: string;
  req: Requestor;
}

export class OBJIORemoteStore implements OBJIOStore {
  private req: Requestor;
  private root: string = 'objio/';

  constructor(args: Partial<OBJIORemoteStoreArgs>) {
    this.req = args.req;

    if (args.root != null)
      this.root = args.root;
  }

  createObjects(arr: CreateObjectsArgs): Promise<CreateResult> {
    return this.req.getJSON({
      url: this.getUrl('create-object'),
      postData: arr
    });
  }

  writeObjects(arr: Array<{id: string, json: Object}>): Promise<WriteResult> {
    return this.req.getJSON({
      url: this.getUrl('write-objects'),
      postData: arr
    });
  }

  readObject(id: string): Promise<ReadResult> {
    return this.req.getJSON({
      url: this.getUrl('read-object'),
      postData: {id}
    });
  }

  readObjects(id: string): Promise<ReadResult> {
    return this.req.getJSON({
      url: this.getUrl('read-objects'),
      postData: {id}
    });
  }

  invokeMethod(id: string, method: string, args: Object): Promise<any> {
    if (args instanceof File) {
      return this.req.getData({
        url: this.getUrl('send-file'),
        params: {id},
        postData: args
      });
    }

    return this.req.getJSON({
      url: this.getUrl('invoke-method'),
      postData: {id, method, args}
    });
  }

  getAllObjIDS(): Promise<Set<string>> {
    return Promise.reject('This is not implemented');
  }

  removeObjs(ids: Set<string>): Promise<any> {
    return Promise.reject('This is not implemented');
  }

  private getUrl(url: string): string {
    return `${this.root}${url}`;
  }
}
