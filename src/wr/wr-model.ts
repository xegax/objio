import {
  DBFolder,
  DBItem,
  CreateReportArgs,
  EditReportArgs,
  DeleteReportArgs,
  ProjectNode,
  Layout,
  StatComp
} from './wr-model-decl';
import { compContainerPrefix, compContainer, getPrefix, apprByPrefix } from './wr-appr';

const ROOT_ITEM: DBFolder = {
  created: '42249.532083',
  description: 'The root of server database',
  isOwnerOrAdmin: 1,
  modified: '42249.532083',
  name: 'Root',
  owner: '-',
  path: '',
  spaceId: '95306631-c680-43df-8850-9501b6752f23',
  type: 'folder',
  uuid: '873b8e5c-0adc-4762-b0ed-5df9a148a114'
};

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getIDS(layout: Layout, ids: Map<number, Layout>) {
  if (!layout)
    return;

  if (layout.type == 'element') {
    ids.set(layout.id, layout);
    return;
  }

  for (let n = 0; n < layout.children.length; n++)
    getIDS(layout.children[n], ids);
}

class Sheet {
  name: string;
  id: number;
  ids = new Set<number>();
  layout: Layout = {
    id: -1,
    type: "horizontal-split",
    children: [],
    grow: []
  };

  constructor(id: number, name?: string) {
    this.id = id;
    this.name = name || (id == 1 ? 'Main' : `Sheet ${id}`);
  }

  setLayout(l: Layout) {
    this.layout = l;
    let ids = new Map<number, Layout>();
    getIDS(l, ids);
    this.ids = new Set(ids.keys());
  }
}

export type ReportType = 'pa' | 'grid';
export class Report {
  type: 'pa' | 'grid';
  name: string = 'New report';
  prj: string;
  uuid: string;
  nodes = Array<ProjectNode>();
  statComp = new Map<number, StatComp>();
  comp = new Map<number, StatComp>();
  appr = new Map<number, Object>();
  sheets = [ new Sheet(1) ];
  sheetIdCounter: number = 1;
  compIdCounter: number = 1;

  constructor(prj: string, type?: ReportType, name?: string) {
    this.prj = prj;
    this.name = name || this.name;
    this.type = type || 'pa';
  }

  addNode(args: {
    sheetId: number;
    objId: string;
    viewType: string;
    ddType: number;
    layout: Layout
  }) {
    const obj = this.nodes.find(node => node.id == args.objId);
    const sheet = this.getSheet({ silent: false, id: args.sheetId });
    const newNode: StatComp = {
      name: args.viewType,
      nameMode: 0,
      id: this.compIdCounter++,
      type: obj.type,
      subType: obj.subType + '|' + args.viewType,
      objId: obj.id,
      preFilter: 0,
    };

    let ids = new Map<number,Layout>();
    getIDS(args.layout, ids);
    let newElement = ids.get(-2);
    if (!newElement)
      throw new Error('new element not found');

    const prefix = getPrefix(newNode.type, newNode.subType);
    this.appr.set(newNode.id, {
      [compContainerPrefix]: {...compContainer},
      [prefix]: {...apprByPrefix[prefix]}
    });
    this.comp.set(newNode.id, newNode);
    newElement.id = newNode.id;
    sheet.setLayout(args.layout);

    return newNode;
  }

  addStatic(args: { sheetId: number, subType: string, layout: Layout }) {
    const sheet = this.getSheet({ silent: false, id: args.sheetId });
    const newNode: StatComp = {
      name: args.subType,
      nameMode: 0,
      id: this.compIdCounter++,
      type: 'static',
      subType: args.subType,
      objId: "-1",
      preFilter: 0,
    };

    let ids = new Map<number,Layout>();
    getIDS(args.layout, ids);
    let newElement = ids.get(-2);
    if (!newElement)
      throw new Error('new element not found');

    const prefix = getPrefix(newNode.type, newNode.subType);
    this.appr.set(newNode.id, {
      [compContainerPrefix]: {...compContainer},
      [prefix]: {...apprByPrefix[prefix]}
    });
    this.statComp.set(newNode.id, newNode);
    newElement.id = newNode.id;
    sheet.setLayout(args.layout);

    return newNode;
  }

  getSheet(args: { silent: boolean } & ({ id: number } | { idx: number })) {
    let sheet: Sheet | undefined = undefined;
    if ('id' in args)
      sheet = this.sheets.find(item => item.id == args.id);
    else if ('idx' in args)
      sheet = this.sheets[args.idx];

    if (!args.silent && !sheet)
      throw new Error('sheet not found');
    
    return sheet;
  }
}

export class WRModel {
  reports = new Map<string, Report>();

  getReport(args: { uuid: string, silent: boolean }) {
    const report = this.reports.get(args.uuid);
    if (!args.silent && !report)
      throw new Error(`Report ${uuid} not found`);

    return report;
  }

  listReports(prj: string) {
    const ids = Array.from(this.reports.keys());
    let arr = Array<{ uuid: string; report: Report }>();
    for (let n = 0; n < ids.length; n++) {
      const report = this.reports.get(ids[n]);
      if (report.prj == prj)
        arr.push({ uuid: ids[n], report });
    }

    return arr;
  }

  createReport(args: CreateReportArgs): DBItem {
    const reportId = uuid();
    const report = new Report(args.prjUUID, args.type, args.name);
    this.reports.set(reportId, report);

    return this.getDBItem(reportId, report);
  }

  editReport(args: EditReportArgs) {
    const report = this.reports.get(args.item);
    if (!report)
      throw new Error(`report "${args.item}" not found`);

    report.name = args.name;
  }

  deleteReport(args: DeleteReportArgs) {
    args.items.forEach(id => {
      this.reports.delete(id);
    });
  }

  getDBItem(uuid: string, report: Report): DBItem {
    return {
      created: "43418.456638",
      damaged: 0,
      description: "",
      isOwnerOrAdmin: 1,
      isShared: 0,
      modified: "43418.456638",
      name: report.name,
      owner: "administrator",
      path: "",
      project: report.prj,
      projectName: "edd",
      spaceId: "95306631-c680-43df-8850-9501b6752f23",
      type: "webreport",
      uuid
    };
  }

  getDBItems() {
    const items = Array.from(this.reports.keys()).map(uuid => {
      const report = this.reports.get(uuid);
      return this.getDBItem(uuid, report);
    });

    return {
      folders: [ ROOT_ITEM ],
      items
    };
  }
}
