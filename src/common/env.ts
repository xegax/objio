let isNodeValue: boolean = null;

export function isNode(): boolean {
  if (isNodeValue != null)
    return isNodeValue;

  try {
    isNodeValue = eval('process') != null;
  } catch (e) {
    isNodeValue = false;
  }

  return isNodeValue;
}
