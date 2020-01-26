export function isEquals(obj1: Object, obj2: Object) {
  return JSON.stringify(obj1) == JSON.stringify(obj2);
}

export function genId(digits: number) {
  let id = '';
  while (id.length < digits) {
    id += Math.random().toString(32).substr(2);
  }
  return id.substr(0, digits);
}

export function delay(ms: number): Promise<void> {
  return Promise.delay(ms) as any;
}

export function getExt(file: string) {
  let i = file.lastIndexOf('.');
  if (i == -1)
    return '';

  return file.substr(i);
}
