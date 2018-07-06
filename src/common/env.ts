export function isNode(): boolean {
  try {
    return process != null;
  } catch (e) {
    return false;
  }
}
