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
import { SendFileClientArgs } from '../base/file-system';

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
    const { file, fileId, other } = args.args as any;
    if (args.methodName == 'sendFile') {
      const fargs = args.args as SendFileClientArgs;
      if (!(file instanceof File))
        return Promise.reject('sendFile args must be instance of File');

      return this.req.getData({
        url: this.getUrl(args.methodName),
        params: {
          id: encodeURIComponent(args.id),
          fileId: encodeURIComponent(fileId || ''),
          other: encodeURIComponent(other || ''),
          name: encodeURIComponent(file.name),
          size: encodeURIComponent('' + fargs.fileSize),
          mime: encodeURIComponent(file.type)
        },
        postData: file,
        onProgress: args.onProgress
      });
    }

    return this.req.getJSON({
      url: this.getUrl(`invoke-method/${args.methodName}`),
      params: { obj: args.id },
      postData: { args: args.args }
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
