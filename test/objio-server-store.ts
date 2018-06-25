import {
  OBJIOServerStore,
  OBJIOFactory,
  OBJIOLocalStore,
  OBJIOItem,
  SERIALIZER,
  OBJIOArray,
  ReadResult,
  OBJIO
} from '../index';
import { expect } from 'chai';

class TestObj extends OBJIOItem {
  img: string = '';
  constructor(img?: string) {
    super();
    this.img = img || this.img;
  }

  static TYPE_ID: string = 'TestObj';
  static SERIALIZE: SERIALIZER = () => ({
    'img': { type: 'string' }
  });
}

class DummyCont extends OBJIOItem {
  name: string = 'unnamed';
  arr: OBJIOArray<TestObj> = new OBJIOArray<TestObj>();

  constructor(name?: string, items?: Array<TestObj>) {
    super();
    this.name = name || this.name;

    items = items || [];
    items.forEach(obj => this.arr.push(obj));
  }

  static TYPE_ID: string = 'DummyCont';
  static SERIALIZE: SERIALIZER = () => ({
    'name': { type: 'string' },
    'arr': { type: 'object' }
  });
}

describe('OBJIOServerStore', () => {
  let factory: OBJIOFactory = new OBJIOFactory();
  factory.registerItem(DummyCont);
  factory.registerItem(TestObj);
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
        arr: obj.arr.holder.getID()
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
        arr: obj.arr.holder.getID()
      },
      version: obj.holder.getVersion(),
      classId: 'DummyCont'
    });
    expect(obj1.holder.getID()).eq('id1');
  });
});
