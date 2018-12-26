export interface StatItem {
  minSize?: number;
  maxSize?: number;
  minChar?: number;
  maxChar?: number;
  nulls: number;
  nums: number;
  ints: number;
  minValue?: number;
  maxValue?: number;
  bools: number;
  strs: number;
}

export type StatMap = {[key: string]: StatItem};

export function pushStat(objs: Array<Object>, statMap: StatMap) {
  for (let n = 0; n < objs.length; n++) {
    let obj = objs[n];
    Object.keys(obj).forEach(key => {
      let item = statMap[key] || ( statMap[key] = { nulls: 0, nums: 0, bools: 0, strs: 0, ints: 0 });
      const value = obj[key];
      if (value == null) {
        item.nulls++;
      } else if (typeof value == 'string') {
        item.strs++;
        if (item.minSize == null)
          item.minSize = value.length;
        else
          item.minSize = Math.min(value.length, item.minSize);

        if (item.maxSize == null)
          item.maxSize = value.length;
        else
          item.maxSize = Math.max(value.length, item.maxSize);

        for (let n = 0; n < value.length; n++) {
          const code = value.charCodeAt(n);
          if (item.minChar == null)
            item.minChar = code;
          else
            item.minChar = Math.min(code, item.minChar);

          if (item.maxChar == null)
            item.maxChar = code;
          else
            item.maxChar = Math.max(code, item.maxChar);
        }
      } else if (typeof value == 'boolean') {
        item.bools++;
      } else if (typeof value == 'number') {
        if (Math.round(value) == value)
          item.ints++;
        else
          item.nums++;

        if (item.minValue == null)
          item.minValue = value;
        else
          item.minValue = Math.min(item.minValue, value);

        if (item.maxValue == null)
          item.maxValue = value;
        else
          item.maxValue = Math.min(item.maxValue, value);
      }
    });
  }
}
