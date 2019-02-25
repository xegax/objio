import { AccessType } from './security';

export interface RequestStat {
  time: number;
  startCount: number;
  requestNum: number;
  writeNum: number;
  readNum: number;
  createNum: number;
  invokeNum: number;
  getFilesNum: number;
  sentBytes: number;
  recvBytes: number;
  taskNum: number;
}

export function createEmptyRequestStat(): RequestStat {
  return {
    time: 0,
    startCount: 0,
    requestNum: 0,
    writeNum: 0,
    readNum: 0,
    createNum: 0,
    invokeNum: 0,
    getFilesNum: 0,
    sentBytes: 0,
    recvBytes: 0,
    taskNum: 0
  };
}

export function makeStatByType(type: AccessType | 'invoke' | 'other'): Partial<RequestStat> {
  return {
    createNum: type == 'create' ? 1 : 0,
    writeNum: type == 'write' ? 1 : 0,
    readNum: type == 'read' ? 1 : 0,
    invokeNum: type == 'invoke' ? 1 : 0,
    requestNum: 1
  };
}
