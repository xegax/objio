import { Requestor } from '../common/requestor';
import { ReadObjectArgs, InvokeMethodArgs } from './store';
import {
  CreateObjectsArgs,
  CreateResult,
  OBJIOStore,
  WriteResult,
  WriteObjectsArgs,
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

  writeObjects(args: WriteObjectsArgs): Promise<WriteResult> {
    return this.req.getJSON({
      url: this.getUrl('write-objects'),
      postData: args
    });
  }

  readObject(args: ReadObjectArgs): Promise<ReadResult> {
    return this.req.getJSON({
      url: this.getUrl('read-object'),
      postData: args
    });
  }

  readObjects(args: ReadObjectArgs): Promise<ReadResult> {
    return this.req.getJSON({
      url: this.getUrl('read-objects'),
      postData: args
    });
  }

  invokeMethod(args: InvokeMethodArgs): Promise<any> {
    if (args.args instanceof File) {
      return this.req.getData({
        url: this.getUrl('send-file'),
        params: {
          id: args.id,
          name: args.args['name'],
          size: args.args['size'],
          mime: args.args['type']
        },
        postData: args.args
      });
    }

    return this.req.getJSON({
      url: this.getUrl('invoke-method'),
      postData: { id: args.id, method: args.methodName, args: args.args }
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
