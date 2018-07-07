export function isNode(): boolean {
  try {
    return eval('process') != null;
  } catch (e) {
    return false;
  }
}
