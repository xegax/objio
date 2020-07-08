import { createServer, JSONHandler, CORPS } from '../server/server2';
import { WRRequestor } from './wr-client';
import { WRModel, Report, ReportType } from './wr-model';
import { EditReportArgs, DeleteReportArgs, ProjectNode, Layout, StatComp } from './wr-model-decl';
import { compContainer, textAppr } from './wr-appr';

const req = new WRRequestor('https://10.0.0.9:5043/polyanalyst');

const srv = createServer({ host: 'localhost', port: 8000 });
CORPS(srv, { ACAllowOrigin: '*', ACAllowHeaders: '*' });

JSONHandler(srv, '/dbmanager/report-params')
.callback<{ uuid: string }>(args => {
  const report = wr.getReport({ uuid: args.get.uuid, silent: false });

  return {
    prjUUID: report.prj,
    reportUUID: args.get.uuid
  };
});

const wr = new WRModel();
JSONHandler(srv, '/dbmanager/list')
.callback<{ filter: number }>(args => {
  if (args.get.filter == 7)
    return wr.getDBItems();

  return req.dbItemList(args.get.filter);
});

JSONHandler(srv, '/dbmanager/edit')
.callback<{ filter: number; }, EditReportArgs>(args => {
  if (args.get.filter != 7) {
    return req.dbItemEdit({
      filter: args.get.filter,
      name: args.post.name,
      item: args.post.item
    });
  }

  wr.editReport(args.post);

  return wr.getDBItems();
});


JSONHandler(srv, '/dbmanager/delete')
.callback<{ filter: number; }, DeleteReportArgs>(args => {
  const filter = args.get.filter;
  if (filter != 7) {
    return req.dbItemDelete({
      filter,
      ...args.post
    });
  }

  wr.deleteReport(args.post);
  return { ...wr.getDBItems(), needUnload: [] };
});

JSONHandler(srv, '/user/info')
.callback(args => {
  return {
    admin: 1,
    hasAppLicense: {0: true, 1: true, 2: true},
    login: 'administrator',
    name: 'administrator',
    type: 1
  };
});

JSONHandler(srv, '/locales')
.callback(args => {
  return [
    {
      'type':'monetary',
      'pointSymbol':'.',
      'afterPoint':2,
      'groupSymbol':',',
      'groupFormat':'123,456,789',
      'currencySymbol':'$',
      'positiveFormat':'$1.1',
      'negativeFormat':'($1.1)',
      'useSuffix':false,
      'suffixes':'k;M;G;T;P;E;Z;Y'
    }, {
      'type':'numeric',
      'pointSymbol':'.',
      'afterPoint':2,'groupSymbol':',',
      'groupFormat':'123,456,789',
      'multiplier':1,'minusSymbol':'-',
      'positiveFormat':'1.1',
      'negativeFormat':'-1.1',
      'leadingZeros':true,'useSuffix':false,'suffixes':'k;M;G;T;P;E;Z;Y',
      'allowScientificFormat':false
    }, {
      'type':'datetime',
      'language':'english-us',
      'dateFirst':true,'mode':'DATE_TIME',
      'intervalFormat':"dd day(s) hh,mm'ss''",
      'dateFormat':'M/d/yyyy',
      'dateSeparator':'/',
      'timeFormat':'h:mm:ss tt',
      'timeSeparator':':',
      'amSymbol':'AM',
      'pmSymbol':'PM',
      'hide1200am':true
    }, {
      'type':'boolean',
      'yes':'yes',
      'no':'no'
    }, {
      'type':'category',
      'catSymbol':'~'
    }
  ];
})

JSONHandler(srv, '/project/load')
.callback<{ prjUUID: string; reportUUID?: string }>(args => {
  const report = wr.getReport({ silent: false, uuid: args.get.reportUUID });
  if (report.type == 'grid')
    return { name: 'project name' };

  return req.loadProject(args.get.prjUUID);
});

JSONHandler(srv, '/wr/report/create')
.callback<{ name?: string; prjUUID: string; type?: ReportType }, Array<ProjectNode>>(args => {
  const dbitem = wr.createReport({
    name: 'New report',
    ...args.get
  });

  if (Array.isArray(args.post)) {
    const report = wr.getReport({ silent: false, uuid: dbitem.uuid });
    report.nodes.push(...args.post);
  }
  return dbitem;
});

JSONHandler(srv, '/wr/report/available/nodes/list')
.callback<{ prjUUID: string }>(args => {
  const items = wr.listReports(args.get.prjUUID);
  return {
    list: items.map(item => {
      return {
        name: item.report.name,
        uuid: item.uuid,
        nodes: item.report.nodes
      }
    }),
    project: args.get.prjUUID
  };
});

JSONHandler(srv, '/wr/report/available/nodes/add2')
.callback<{ reportUUID?: string; prjUUID: string }, Array<ProjectNode>>(args => {
  let report: Report;
  if (args.get.reportUUID) {
    report = wr.reports.get(args.get.reportUUID);
  } else {
    report = (wr.listReports(args.get.prjUUID)[0] || { report: undefined }).report;
  }

  if (!report)
    throw new Error(`report not found`);

  report.nodes.push(...args.post);

  return 'ok';
});

JSONHandler(srv, '/wr/report/available/nodes/add')
.callback<{ reportUUID?: string; prjUUID: string }, Array<number>>(args => {
  return (
    req.nodeList(args.get.prjUUID)
    .then(res => {
      let nodes = Array<ProjectNode>();
      let report: Report;
      if (args.get.reportUUID) {
        report = wr.reports.get(args.get.reportUUID);
      } else {
        report = (wr.listReports(args.get.prjUUID)[0] || { report: undefined }).report;
      }
      
      if (!report)
        throw new Error(`report not found`);

      const currNodesIds = new Set(report.nodes.map(node => node.id));
 
      const ids = new Set(args.post);
      res.nodes.forEach(node => {
        if (!ids.has(+node.id) || currNodesIds.has(node.id))
          return;

        const type = node.type.split('/');
        nodes.push({
          name: node.name,
          id: node.id,
          type: type[0],
          subType: type[1]
        });
      });

      report.nodes.push(...nodes);
    })
    .catch(err => {
      console.log(err);
      return '';
    })
  );
});


const reportAppr = {
  'component-container/container/background/alpha':'50', 'component-container/container/background/bgColor1':'"#ffffff"', 'component-container/container/background/bgColor2':'"#ffffff"', 'component-container/container/background/fillType':'',
  'component-container/container/caption/alignment':'"left"',
  'component-container/container/caption/font':'"Arial,13"',
  'component-container/container/caption/fontColor':'"#404040"',
  'component-container/container/caption/show':'true',
  'component-container/container/caption/text':'""',
  'component-container/container/header/font':'"Arial,18,bold"',
  'component-container/container/header/fontColor':'"#333333"',
  'component-container/wrp_cc/fixedHeight':'0',
  'component-container/wrp_cc/showEDDExpr':'false',
  'component-container/wrp_cc/showHeader':'-1',
  'configurationTemplate':'""',
  'disableComponentView':'true',
  'disableCtxMenu':'false',
  'hideAppName':'false',
  'hideSheetTabs':'false',
  'maxPublications':'10',
  'palette':'""',
  'sheet/component/background/alpha':'50',
  'sheet/component/background/bgColor1':'"#ffffff"',
  'sheet/component/background/bgColor2':'"#ffffff"',
  'sheet/component/background/fillType':'"none"',
  'sheet/component/border':'true',
  'sheet/component/headerFont':'"Arial,18,Bold"',
  'sheet/component/headerTextColor':'"#333333"',
  'sheet/component/padding':'0',
  '__##changed_info##__':[]
};

JSONHandler(srv, '/wrp/appearance-report')
.callback(args => {
  return reportAppr;
});

const apprSheet = {
  'component/background/alpha':'50',
  'component/background/bgColor1':'"#ffffff"',
  'component/background/bgColor2':'"#ffffff"',
  'component/background/fillType':'"none"',
  'component/border':'true',
  'component/headerFont':'"Arial,18,Bold"',
  'component/headerTextColor':'"#333333"',
  'component/padding':'0',
  '__##changed_info##__':[]
};

JSONHandler(srv, '/wrp/appearance-sheet')
.callback(args => {
  return apprSheet;
});

const snapshotAppr = {
  'snapshots':'[]',
  'snapshots/#/Name':'""',
  'snapshots/#/createdTime':'""',
  'snapshots/#/pubId':'""',
  'snapshots/#/title':'""',
  'snapshots/#/userId':'"autouser_rutor_a6959c31-ced4-4c8b-ab67-b82f95094a8d"',
  'snapshots/#/value':'""',
  'snapshots/#/version':'1',
  '__##changed_info##__':[]
};

JSONHandler(srv, '/wrp/snapshot/appearance')
.callback(args => {
  return snapshotAppr;
});


JSONHandler(srv, '/wr/publication/list')
.callback<{ reportUUID: string }>(args => {
  const report = wr.getReport({ uuid: args.get.reportUUID, silent: false });
  return {
    items: [],
    name: report.name
  };
});

JSONHandler(srv, '/wr/sheet/list')
.callback<{ reportUUID: string }>(args => {
  const report = wr.getReport({ uuid: args.get.reportUUID, silent: false });

  return (
    report.sheets.map(sheet => ({
      color: "",
      hiddenOnPublication: 0,
      id: sheet.id,
      name: sheet.name,
    }))
  );
});

JSONHandler(srv, '/wr/component/list')
.callback<{ reportUUID: string; sheetId: number; }>(args => {
  const report = wr.getReport({ silent: false, uuid: args.get.reportUUID });
  const sheet = report.getSheet({ silent: false, id: args.get.sheetId });

  let components: {[id: number]: StatComp} = {};
  Array.from(sheet.ids).forEach(id => {
    components[id] = report.statComp.get(id) || report.comp.get(id);
  });

  return {
    components,
    id: +args.get.sheetId,
    layout: sheet.layout
  }
});

JSONHandler(srv, '/wr/node/add')
.callback<{
  sheetId: number;
  objId: string;
  reportUUID: string;
}, {
  scheme: Layout;
  ddType: number;
  viewType: string;
  appr: Array<string>;
}>(args => {
  const report = wr.getReport({ silent: false, uuid: args.get.reportUUID });
  const sheet = report.getSheet({ silent: false, id: +args.get.sheetId });
  const node = report.addNode({
    sheetId: +args.get.sheetId,
    viewType: args.post.viewType,
    layout: args.post.scheme,
    objId: args.get.objId,
    ddType: 0
  });

  let components: {[id: number]: StatComp} = {};
  Array.from(sheet.ids).forEach(id => {
    components[id] = report.statComp.get(id) || report.comp.get(id);
  });

  (args.post.appr || []).forEach(keyVal => {
    const i = keyVal[0].indexOf('/', 1);
    if (i == -1)
      return;

    const prefix = keyVal[0].substr(0, i + 1);
    const key = keyVal[0].substr(i + 1);
    report.appr.get(node.id)[prefix][key] = keyVal[1];
  });

  return {
    addedCompId: node.id,
    id: +args.get.sheetId,
    components,
    layout: sheet.layout
  };
});

JSONHandler(srv, '/wr/node/add-static')
.callback<{
  sheetId: number;
  subtype: string;
  reportUUID: string
}, {
  scheme: Layout;
  appr: Array<string>;
}>
(args => {
  const report = wr.getReport({ silent: false, uuid: args.get.reportUUID });
  const sheet = report.getSheet({ silent: false, id: +args.get.sheetId });
  const node = report.addStatic({
    sheetId: args.get.sheetId,
    subType: args.get.subtype,
    layout: args.post.scheme
  });

  let components: {[id: number]: StatComp} = {};
  Array.from(sheet.ids).forEach(id => {
    components[id] = report.statComp.get(id) || report.comp.get(id);
  });

  args.post.appr.forEach(keyVal => {
    const i = keyVal[0].indexOf('/', 1);
    if (i == -1)
      return;

    const prefix = keyVal[0].substr(0, i + 1);
    const key = keyVal[0].substr(i + 1);
    report.appr.get(node.id)[prefix][key] = keyVal[1];
  });

  return {
    addedCompId: node.id,
    id: +args.get.sheetId,
    components,
    layout: sheet.layout
  };
});

JSONHandler(srv, '/wrp/appearance')
.callback<{
  prjUUID: string;
  reportUUID: string;
  CID: number;
  sliceId: number;
  prefix: string;
  action: string
}>(args => {
  const report = wr.getReport({ silent: false, uuid: args.get.reportUUID });

  if (args.get.action == 'save') {
    const appr = report.appr.get(+args.get.CID)[args.get.prefix];
    Object.keys(args.post).forEach(key => {
      appr[key] = args.post[key];
    });
  }

  return report.appr.get(+args.get.CID)[args.get.prefix] || {};
});

JSONHandler(srv, '/wr/sheet/setlayout')
.callback<{ reportUUID: string; }, { sheetId: number; scheme: Layout }>(args => {
  const report = wr.getReport({ silent: false, uuid: args.get.reportUUID });
  const sheet = report.getSheet({ silent: false, id: +args.post.sheetId });

  sheet.setLayout(args.post.scheme);
  let components: {[id: number]: StatComp} = {};
  Array.from(sheet.ids).forEach(id => {
    components[id] = report.statComp.get(id) || report.comp.get(id);
  });

  return {
    components,
    id: +args.post.sheetId,
    layout: sheet.layout
  }
});
