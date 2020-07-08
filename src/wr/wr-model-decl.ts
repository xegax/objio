import { ReportType } from "./wr-model";

export interface CreateReportArgs {
  name: string;
  folder?: string;
  prjUUID: string;
  type?: ReportType;
}

export interface EditReportArgs {
  name: string;
  item: string;
}

export interface DeleteReportArgs {
  items: Array<string>;
  recursive: boolean;
  unload: boolean;
}

export interface ProjectNode {
  id: string;
  name: string;
  subType: string;
  type: string;
}

export interface DBItemBase {
  created: string;        // "43418.456638"
  description: string;    // ""
  isOwnerOrAdmin: number; // 1
  modified: string;       // '42249.532083'
  name: string;           // new report 1
  owner: string;          // '-'
  path: string;           // 'folder1/folder2'
  spaceId: string;        // '95306631-c680-43df-8850-9501b6752f23'
  type: 'folder' | 'webreport';           // 'folder'
  uuid: string;           // '873b8e5c-0adc-4762-b0ed-5df9a148a114'
}

export interface DBItem extends DBItemBase {
  damaged: number;        // 0
  isShared: number;       // 0
  project: string;        // "42e6a676-b977-424d-a691-17ac524afad2"
  projectName: string;    // "edd"
}

export interface DBFolder extends DBItemBase {
}

export interface Layout {
  id: number;
  type: string;
  children: Array<Layout>;
  grow: Array<number>;
}

export interface StatComp {
  id: number;
  name: string;
  nameMode: number;
  objId: string;
  preFilter: 0
  subType: string;
  type: string;
}

export type CompType = StatComp;