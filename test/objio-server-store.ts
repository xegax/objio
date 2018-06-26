import {
  OBJIOServerStore,
  OBJIOFactory,
  OBJIOLocalStore,
  OBJIOItem,
  SERIALIZER,
  OBJIOArray,
  ReadResult,
  OBJIO,
  Field,
  EXTEND
} from '../index';
import { expect } from 'chai';

class TestObj extends OBJIOItem {
  img: string = '';
  tmp: string = '??';

  constructor(img?: string) {
    super();
    this.img = img || this.img;
  }

  static TYPE_ID: string = 'TestObj';
  static SERIALIZE: SERIALIZER<TestObj> = () => ({
    'img': { type: 'string' }
  });
}

class SrTestObj extends TestObj {
  internal: string = 'testObj internals';

  static TYPE_ID: string = 'SrTestObj';
  static SERIALIZE: SERIALIZER<SrTestObj> = () => ({
    ...TestObj.SERIALIZE(),
    ...EXTEND<SrTestObj>({
      'internal': { type: 'string' }
    }, { tags: ['sr'] })
  });
}

class DummyCont extends OBJIOItem {
  name: string = 'unnamed';
  arr: OBJIOArray<TestObj> = new OBJIOArray<TestObj>();
  internal: string = 'something internal';

  constructor(name?: string, items?: Array<TestObj>) {
    super();
    this.name = name || this.name;

    items = items || [];
    items.forEach(obj => this.arr.push(obj));
  }

  static TYPE_ID: string = 'DummyCont';
  static SERIALIZE: SERIALIZER<DummyCont> = () => ({
    'name': { type: 'string' },
    'arr': { type: 'object' },
    'internal': { type: 'string', tags: ['sr'] }
  });
}

describe('OBJIOServerStore', () => {
  let factory: OBJIOFactory = new OBJIOFactory();
  factory.registerItem(DummyCont);
  factory.registerItem(TestObj);
  factory.registerItem(SrTestObj);
  factory.registerItem(OBJIOArray);

  let store: OBJIOLocalStore = new OBJIOLocalStore(factory);
  let serverStore: OBJIOServerStore;
  let objio: OBJIO;

  it('OBJIOServerStore.create', async () => {
    serverStore = await OBJIOServerStore.create({factory, store});
    expect(serverStore).not.eq(null);
    expect(serverStore).instanceof(OBJIOServerStore);

    objio = await OBJIO.create(factory, serverStore);
  });

  it('OBJIOServerStore.readObject', async () => {
    const arr = {
      'id1': {data: {img: 'root.png'}, classId: 'TestObj', version: '1'},
      'id2': {data: {arr: '["id1"]'}, classId: 'OBJIOArray', version: '1'}
    };
    store.setObjectData('id1', arr['id1']);
    store.setObjectData('id2', arr['id2']);

    const res: ReadResult = await serverStore.readObject('id2');
    expect(Object.keys(res)).eqls(['id2']);
    expect(res['id2']).eqls({
      json: arr['id2'].data,
      classId: arr['id2'].classId,
      version: arr['id2'].version
    }, 'check id2 object');

    const obj: OBJIOArray<TestObj> = serverStore.getOBJIO().getObject('id2');
    expect(obj).not.eq(null);
    expect(obj).instanceof(OBJIOArray);

    const testObj: TestObj = obj.get(0);
    expect(testObj).instanceof(TestObj);
    expect(testObj.img).eq(arr['id1'].data.img);
  });

  it('OBJIOServerStore.readObjects', async () => {
    const arr = {
      'id1': {data: {img: 'root2.png'}, classId: 'TestObj', version: '1'},
      'id2': {data: {arr: '["id1"]'}, classId: 'OBJIOArray', version: '1'}
    };
    store.setObjectData('id1', arr['id1']);
    store.setObjectData('id2', arr['id2']);

    const res: ReadResult = await serverStore.readObjects('id2');
    expect(Object.keys(res)).eqls(['id2', 'id1']);
    expect(res['id2']).eqls({json: arr['id2'].data, classId: arr['id2'].classId, version: arr['id2'].version});
    expect(res['id1']).eqls({json: arr['id1'].data, classId: arr['id1'].classId, version: arr['id1'].version});

    const obj: OBJIOArray<TestObj> = serverStore.getOBJIO().getObject('id2');
    expect(obj).not.eq(null);
    expect(obj).instanceof(OBJIOArray);

    const testObj: TestObj = obj.get(0);
    expect(testObj).instanceof(TestObj);
    expect(testObj.img).eq(arr['id1'].data.img);
  });

  it('OBJIOServerStore.readObject without "sr" tag', async () => {
    serverStore['fieldFilter'] = (f: Field) => {
      return !f.tags || !f.tags.length || f.tags.indexOf('sr') == -1;
    };

    const id1 = {
      data: {img: 'root2.png', 'internal': '???'},
      classId: 'SrTestObj',
      version: '1'
    };
    store.setObjectData('id3', id1);

    const res: ReadResult = await serverStore.readObject('id3');
    expect(Object.keys(res)).eqls(['id3']);
    expect(res['id3']).eqls({
      json: { img: id1.data.img },
      classId: id1.classId,
      version: id1.version
    });

    const obj: SrTestObj = serverStore.getOBJIO().getObject('id3');
    expect(obj).not.eq(null);
    expect(obj).instanceof(SrTestObj);
    expect(obj.img).eq(id1.data.img);

    serverStore['fieldFilter'] = null;
  });

  it('OBJIOServerStore.writeObjects', async () => {
    const arr = {
      'id3': {data: {img: 'root3.png'}, classId: 'TestObj', version: '1'},
      'id4': {data: {arr: '["id3"]'}, classId: 'OBJIOArray', version: '1'}
    };
    store.setObjectData('id3', arr['id3']);
    store.setObjectData('id4', arr['id4']);

    await serverStore.writeObjects([{id: 'id3', json: {img: 'root?.png'}}]);
    const obj: TestObj = serverStore.getOBJIO().getObject('id3');
    expect(obj).instanceof(TestObj);
    expect(obj.img).eq('root?.png');
  });

  it('OBJIOServerStore.createObjects all new objects', async () => {
    let obj = new DummyCont('???', [ new TestObj('!!.png') ]);
    const prevIds = [obj.holder.getID(), obj.arr.get(0).holder.getID()];
    await objio.createObject<DummyCont>(obj);
    const newIds = [obj.holder.getID(), obj.arr.get(0).holder.getID()];
    expect(newIds).not.eqls(prevIds);

    expect(store.getObjectData(newIds[0])).eqls({
      data: {
        name: '???',
        arr: obj.arr.holder.getID(),
        internal: 'something internal'
      },
      version: obj.holder.getVersion(),
      classId: 'DummyCont'
    });
  });

  it('OBJIOServerStore.createObjects with one exist object', async () => {
    const obj1: TestObj = serverStore.getOBJIO().getObject('id1');
    let obj = new DummyCont('+++', [ new TestObj('??.png'), obj1 ]);
    const prevIds = [obj.holder.getID(), obj.arr.get(1).holder.getID()];
    await objio.createObject<DummyCont>(obj);
    const newIds = [obj.holder.getID(), obj.arr.get(1).holder.getID()];
    expect(newIds).not.eqls(prevIds);

    expect(store.getObjectData(newIds[0])).eqls({
      data: {
        name: '+++',
        arr: obj.arr.holder.getID(),
        internal: 'something internal'
      },
      version: obj.holder.getVersion(),
      classId: 'DummyCont'
    });
    expect(obj1.holder.getID()).eq('id1');
  });
});
