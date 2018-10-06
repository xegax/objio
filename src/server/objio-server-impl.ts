import { Server, createServer, Params as ParamsBase, DataParams as DataParamsBase } from './server';
import {
  OBJIOFactory,
  WriteObjectsArgs,
  CreateObjectsArgs,
  OBJIOServerStore,
  OBJIOItem,
  Field
} from '../index';
import { OBJIOFSLocalStore } from './objio-fs-store';
import { existsSync, lstatSync, mkdirSync } from 'fs';
import { ServerInstance } from './server-instance';
import { OBJIOItemClass } from '../objio/item';
import { UserGroup } from './user-group';
import { User, AccessType } from './user';
import { Project } from './project';

const PRIVATE_PATH = 'private';
const PUBLIC_PATH = 'public';

interface Params<GET, POST, COOKIE> extends ParamsBase<GET, POST, COOKIE> {
  userId: string;
  user: User;
}

type Handler<GET, POST, COOKIE> = (
  params: Params<GET, POST, COOKIE>,
  addOnClose?: (handler: () => void) => void
) => void;

interface DataParams<GET, COOKIE> extends DataParamsBase<GET, COOKIE> {
  get: GET;
  userId: string;
  user: User;
}

type DataHandler<GET, COOKIE> = (
  params: DataParams<GET, COOKIE>,
  resolve: (result: any) => void,
  reject: (err: any) => void
) => void;

export interface ServerArgs {
  rootDir: string;
  factory: OBJIOFactory;
  port?: number;
  baseUrl?: string;
}

function msToMin(ms: number): number {
  return ms / 1000 / 60;
}

let serverObj: ServerInstance;

interface Cookies {
  sessId: string;
}

interface Session {
  startTime: Date;
  lastTime: Date;
  user: User;
}

class RestrictionPolicy {
  private srv: Server;
  private sess: {[id: string]: Session} = {};
  private maxTimeMinOfInactivity: number = 5;

  constructor(srv: Server) {
    this.srv = srv;

    srv.addJsonHandler('login', (params: Params<{}, {login: string, passwd: string}, Cookies>) => {
      const sess = this.checkAndGetSession(params.cookie.sessId);
      if (sess)
        return params.done({error: 'Already logged in'});

      const user = serverObj.findUser({
        login: params.post.login,
        password: params.post.passwd
      });

      if (!user)
        return params.done({error: `User "${params.post.login}" not found or password is incorrect`});

      const sessId = nextVersion('');
      params.cookie.sessId = sessId;
      this.sess[sessId] = {
        startTime: new Date(),
        lastTime: new Date(),
        user
      };

      params.done({error: '', sessId});
    });
  }

  checkAndGetSession(sessId: string): Session {
    let sess = this.sess[sessId];
    if (sess && msToMin(Date.now() - sess.lastTime.getTime()) > this.maxTimeMinOfInactivity) {
      delete this.sess[sessId];
      sess = null;
    }

    return sess;
  }

  addJsonHandler<GET, POST>( accessType: AccessType,
                                               url: string,
                                               handler: Handler<PrjData, POST, Cookies>,
                                               addOnClose?: (handler: () => void) => void) {
    this.srv.addJsonHandler(url, (params: Params<PrjData, POST, Cookies>, addOnClose) => {
      const sess = this.checkAndGetSession(params.cookie.sessId);
      if (!sess)
        return params.error('Authorization required', 401);

      sess.lastTime = new Date();
      if (!serverObj.hasRight(sess.user, accessType))
        return params.error(`Forbidden, you do not have right to ${accessType}`, 403);

      if (params.get.prj == 'main' && !serverObj.isAdmin(sess.user))
        return params.error('Access denied', 403);

      const nextParams = {
        ...params,
        userId: sess.user.getUserId(),
        user: sess.user
      };

      handler(nextParams, addOnClose);
    }, addOnClose);
  }

  addDataHandler<GET>( accessType: AccessType,
                       url: string,
                       handler: DataHandler<GET, Cookies>) {
    this.srv.addDataHandler(
      url,
      (
        params: DataParams<GET, Cookies>,
        resolve: (res: any) => void,
        reject: (err: any) => void) => {
          const sess = this.checkAndGetSession(params.cookie.sessId);
          if (!sess)
            return reject('Authorization required');

          sess.lastTime = new Date();
          if (!serverObj.hasRight(sess.user, accessType))
            return reject('Forbidden');

          const userId = sess.user.getUserId();
          handler({...params, userId}, resolve, reject);
        }
    );
  }
}

interface ObjWatcherItem {
  id: string;
  version: string;
}

interface DefferredItem {
  user: User;
  version: number;
  handler: () => void;
}

function nextVersion(ver: string) {
  let newVer = '';
  while ((newVer = Math.round(Math.random() * 1e17).toString(16)) != newVer) {
  }
  return newVer;
}

class ObjWatcher {
  private objs: Array<ObjWatcherItem> = [];
  private version: number = 0;

  getVersion(): number {
    return this.version;
  }

  addObject(id: string, version: string) {
    const idx = this.objs.findIndex(item => item.id == id);
    if (idx != -1)
      this.objs.splice(idx, 1);

    this.objs.splice(0, 0, {id, version});
    this.version++;
  }

  remove(ids: Array<string>) {
    const newObjs = this.objs.filter(obj => {
      return ids.indexOf(obj.id) == -1;
    });

    if (newObjs.length != this.objs.length) {
      this.objs = newObjs;
      this.version++;
    }
  }

  getObjects(): Array<ObjWatcherItem> {
    return this.objs;
  }
}

interface ProjectStore {
  store: OBJIOServerStore;
  watcher: ObjWatcher;
  prj: Project;
}

interface PrjData {
  prj?: string;
}

let deferredHandler: Array<DefferredItem> = [];
const flushDeffer = () => {
  console.log('flush', deferredHandler.length, 'handlers');
  deferredHandler.forEach(item => item.handler());
  deferredHandler = [];
};

export interface ServerCreateResult {
  store: OBJIOServerStore;
}

interface SendFileArgs extends PrjData {
  id: string;
  name: string;
  size: number;
  mime: string;
  user: User;
}

class ProjectManager {
  private rootDir: string;
  private projectsDir: string = 'projects';
  private projectMap: {[id: string]: ProjectStore | Promise<ProjectStore>} = {};
  private factory: OBJIOFactory;

  constructor(rootDir: string, factory: OBJIOFactory) {
    this.rootDir = rootDir;
    this.factory = factory;
  }

  getProjectPath(project: string): string {
    return [ this.rootDir, this.projectsDir, project].join('/');
  }

  getObjectsPath(project: string): string {
    return [ this.rootDir, this.projectsDir, project, PRIVATE_PATH ].join('/');
  }

  getFilePath(project: string): string {
    return [ this.rootDir, this.projectsDir, project, PUBLIC_PATH ].join('/');
  }

  createProject(args: { user?: User, projectId?: string }): Promise<ProjectStore> {
    const { projectId } = args;
    const prjPath = this.getProjectPath(projectId);
    if (existsSync(prjPath))
      throw 'project already exists';

    mkdirSync( prjPath );
    mkdirSync( this.getFilePath(projectId) );
    mkdirSync( this.getObjectsPath(projectId) );
    return this.getProject(args);
  }

  createNewProject(): Project {
    return new Project();
  }

  getProject(args: { user?: User, projectId?: string }): Promise<ProjectStore> {
    const projectId = args.projectId || 'main';
    const project = this.projectMap[projectId] as ProjectStore;
    if (project) {
      if (project instanceof Promise)
        return project;
      else
        return Promise.resolve(project);
    }

    const projectPath = this.getProjectPath(projectId);
    if (!existsSync(projectPath))
      return Promise.reject(`project ${projectId} does't exists`);

    return (
      this.projectMap[projectId] = OBJIOServerStore.create({
        factory: this.factory,
        store: new OBJIOFSLocalStore(this.factory, [ projectPath, PRIVATE_PATH ].join('/')),
          includeFilter: (field: Field): boolean => {
            return !field.tags || !field.tags.length || field.tags.indexOf('sr') == -1;
          },
          context: {
            objectsPath: this.getObjectsPath(projectId) + '/',
            filesPath: this.getFilePath(projectId) + '/'
          },
          saveTime: 10,
          getUserById: userId => Promise.resolve(serverObj.findUser({ userId }))
      })
      .then(store => {
        const objio = store.getOBJIO();
        return Promise.all([
          objio.loadObject<Project>()
          .catch(() => {
            let prj = this.createNewProject();
            return (
              objio.createObject(prj, args.user.getUserId())
              .then(() => prj)
            );
          }),
          store
        ]);
      })
      .then(res => {
        const [prj, store] = res;

        const watcher = new ObjWatcher();
        store.getOBJIO().addObserver({
          onSave: (objs: Array<OBJIOItem>) => {
            const v = watcher.getVersion();
            objs.forEach(obj => watcher.addObject(obj.holder.getID(), obj.holder.getVersion()));
            if (v != watcher.getVersion())
              flushDeffer();
          }
        });

        return this.projectMap[projectId] = {
          prj,
          store,
          watcher
        };
      })
    );
  }
}

export async function createOBJIOServer(args: ServerArgs): Promise<ServerCreateResult> {
  const classes: Array<OBJIOItemClass> = [
    ServerInstance,
    User,
    UserGroup,
    Project
  ];

  classes.forEach(objClass => {
    args.factory.registerItem(objClass);
  });

  const manager = new ProjectManager( args.rootDir, args.factory );

  const srv = new RestrictionPolicy(createServer({
    port: args.port || 8088,
    baseUrl: args.baseUrl || '/handler/objio/'
  }));

  let main: ProjectStore;
  try {
    main = await manager.getProject({ projectId: 'main' });
    serverObj = await main.store.getOBJIO().loadObject<ServerInstance>();
  } catch (e) {
    console.log(e);
    serverObj = new ServerInstance();
    await main.store.getOBJIO().createObject(serverObj);
  }

  srv.addDataHandler<SendFileArgs>('write', 'send-file', (params, done, error) => {
    return (
      manager.getProject({ projectId: params.get.prj, user: params.user })
      .then(prj => {
        const obj = prj.store.getOBJIO().getObject(params.get.id);
        if (!obj)
          return error('object not found');

        const methods = obj.holder.getMethodsToInvoke();
        if ('send-file' in methods)
          methods['send-file'].method({ ...params.get, data: params.stream }, params.userId).then(() => done({}));
        else
          error(`method send-file of this object type = "${OBJIOItem.getClass(obj).TYPE_ID}" not found!`);
      })
    );
  });

  srv.addJsonHandler<PrjData, CreateObjectsArgs>('create', 'create-object', async (params) => {
    const { store } = await manager.getProject({ projectId: params.get.prj, user: params.user });
    try {
      params.done(await store.createObjects({...params.post, userId: params.userId}));
    } catch (err) {
      params.error(err);
    }
  });

  srv.addJsonHandler<PrjData, WriteObjectsArgs>('write', 'write-objects', async (params) => {
    const { store } = await manager.getProject({ projectId: params.get.prj, user: params.user });
    const res = await store.writeObjects({...params.post, userId: params.userId});

    const removed = res.removed;
    if (removed.length) {
      console.log('removed', removed);
    }

    params.done(res);
  });

  srv.addJsonHandler<PrjData, {id: string}>('read', 'read-object', async (params) => {
    try {
      const { store } = await manager.getProject({ projectId: params.get.prj, user: params.user });
      params.done(await store.readObject({id: params.post.id, userId: params.userId}));
    } catch (e) {
      params.error(e.toString());
    }
  });

  srv.addJsonHandler<PrjData, {id: string}>('read', 'read-objects', async (params) => {
    try {
      const { store } = await manager.getProject({ projectId: params.get.prj, user: params.user });
      params.done(await store.readObjects({id: params.post.id, userId: params.userId}));
    } catch (e) {
      params.error(e.toString());
    }
  });

  srv.addJsonHandler<PrjData, {id: string, method: string, args: Object}>('read', 'invoke-method', async (params) => {
    try {
      const { store } = await manager.getProject({ projectId: params.get.prj, user: params.user });

      params.done(await store.invokeMethod({
        userId: params.userId,
        user: params.user,
        id: params.post.id,
        methodName: params.post.method,
        args: params.post.args
      }) || {});
    } catch (e) {
      params.error(e.toString());
    }
  });

  srv.addJsonHandler<PrjData, CreateObjectsArgs>('create', 'create-project', (params) => {
    manager.createProject({ projectId: params.get.prj, user: params.user })
    .then(() => {
      params.done({});
    })
    .catch(e => {
      params.error(e);
    });
  });

  srv.addJsonHandler<PrjData, {version: number}>('read', 'watcher/version', async (params, addOnClose) => {
    const { watcher, prj } = await manager.getProject({ projectId: params.get.prj, user: params.user });

    const version = watcher.getVersion();
    if (+params.post.version != version) {
      params.done({version});
    } else {
      const item = {
        user: params.user,
        version: +params.post.version,
        handler: () => params.done({version: watcher.getVersion()})
      };
      deferredHandler.push(item);

      addOnClose(() => {
        prj.removeWatchingUser(params.user);
        deferredHandler.splice(deferredHandler.indexOf(item), 1);
      });
    }
    prj.addWatchingUser(params.user);
  });

  srv.addJsonHandler<PrjData, {}>('read', 'watcher/items', async (params) => {
    const { watcher } = await manager.getProject({ projectId: params.get.prj, user: params.user });
    params.done(watcher.getObjects());
  });

  srv.addJsonHandler<PrjData, {}>('write', 'clean', (params) => {
    console.log('clean process started');
    manager.getProject({ projectId: params.get.prj, user: params.user })
    .then(res => {
      return res.store.clean();
    })
    .then(objs => {
      params.done(objs);
    });
  });

  return { store: main.store };
}
