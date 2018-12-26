export interface TokenArgs {
  pos: number;
  str: string;
  continue: boolean;
  v?: string;
  open?: number;
}

export interface TokenRes {
  from?: number;
  to?: number;
  error?: string;
  continue?: boolean;
}

export function braces(args: TokenArgs): TokenRes {
  let p = args.pos;
  if (!args.continue) {
    if (args.str[p] != '{')
      return { error: 'expected {' };
    args.open = 0;
    args.v = '';
  } else {
    p = args.pos - 1;
  }

  while (++p < args.str.length) {
    const chr = args.str[p];
    if (chr == '\\' && args.open) {
      p++;
      continue;
    }

    if (chr == '"') {
      args.open = (args.open + 1) % 2;
    }

    if (args.open)
      continue;

    if (chr == '}')
      return { from: args.pos, to: p };
  }

  args.v += args.str.substr(args.pos);
  return { continue: true };
}

export function comma(args: TokenArgs): TokenRes {
  if (args.str[args.pos] == ',')
    return { from: args.pos, to: args.pos };

  return { error: 'expected ,' };
}

let spChar = new Set([' ', '\r', '\n', '\t', '[', ']']);
export function spaces(args: TokenArgs): TokenRes {
  let p = args.pos;
  while (p < args.str.length) {
    if (!spChar.has(args.str[p]))
      return p == args.pos ? {} : { from: args.pos, to: p - 1 };
    p++;
  }
  return { continue: true };
}

export function onValue(token: Token, callback?: (value: string) => void ) {
  return (targs: TokenArgs) => {
    const r = token(targs);

    if (callback && r.from != null && r.to != null) {
      const data = (targs.v || '') + targs.str.substr(r.from, (r.to - r.from) + 1);
      callback(data);
    }

    return r;
  };
}

export type Token = (args: TokenArgs) => TokenRes;
export type TokenArr = Array<Token | Array<Token>>;

export function createParser(tokens: TokenArr) {
  let tidx = 0;

  let parent = tokens;
  let ctx: TokenArgs = { str: '', pos: 0, continue: false };
  let min = null;
  let max = null;
  let p2 = 0;

  const parse = (str: string, offset: number) =>  {
    ctx.pos = 0;
    ctx.str = str;
    while (ctx.pos < str.length) {
      let token = parent[tidx] as Token;
      if (Array.isArray(token)) {
        parent = token;
        tidx = 0;
        token = parent[tidx] as Token;
      }
      const res = token(ctx);
      if (!res.continue) {
        // conts = [];
        ctx.continue = false;
        tidx++;
      } else {
        ctx.continue = true;
        return;
      }

      if (res.error)
        throw new Error(`error at ${offset + ctx.pos}: ${res.error}`);

      if (res.to == null)
        continue;

      /*if (token == braces) {
        objects++;
        let data = (ctx.v || '') + str.substr(res.from, (res.to - res.from) + 1);
        if (min == null)
          min = data.length;
        else
          min = Math.min(min, data.length);

        if (max == null)
          max = data.length;
        else
          max = Math.max(max, data.length);

        let obj = JSON.parse(data);
        let newP2 = Math.round(progress * 10)/10;
        if (newP2 != p2) {
          p2 = newP2;
          console.log(newP2);
        }
      }*/
      ctx.pos = res.to + 1;
    }
  }

  return {
    parse
  };
}
