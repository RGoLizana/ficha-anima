// Funciones que HyperFormula no tiene, o que no calcula igual que Excel en este libro.
// Junto con las reescrituras de tools/export_formulas.py dejan las 3 fichas de referencia idénticas a Excel.
import { HyperFormula, FunctionPlugin, FunctionArgumentType, CellError, ErrorType } from 'hyperformula';

type Val = number | string | boolean | null | undefined;

/** Criterios de COUNTIF/SUMIF como Excel: operador solo si es el primer carácter, comodines * ? ~, sin mayúsculas. */
export function matcher(criteria: Val): (v: Val) => boolean {
  if (typeof criteria === 'number') {
    return (v) => v === criteria || (typeof v === 'string' && v.trim() !== '' && Number(v) === criteria);
  }
  if (typeof criteria === 'boolean') return (v) => v === criteria;
  const m = String(criteria ?? '').match(/^(<=|>=|<>|<|>|=)?([\s\S]*)$/)!;
  const op = m[1] || '=';
  const rest = m[2];
  const num = rest.trim() !== '' && !isNaN(Number(rest)) ? Number(rest) : null;
  const isEmpty = (v: Val) => v === null || v === undefined || v === '';
  if (num !== null) {
    const cmp = { '=': (a: number) => a === num, '<>': (a: number) => a !== num, '<': (a: number) => a < num,
      '>': (a: number) => a > num, '<=': (a: number) => a <= num, '>=': (a: number) => a >= num }[op]!;
    const textoIgual = (v: Val) => typeof v === 'string' && v.trim() !== '' && Number(v) === num; // "5" cuenta como 5
    return (v) => (typeof v === 'number' ? cmp(v) : op === '<>' ? !textoIgual(v) : op === '=' && textoIgual(v));
  }
  const low = rest.toLowerCase();
  if (op === '=' || op === '<>') {
    let re: RegExp | null = null;
    if (/[*?~]/.test(low)) {
      const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let src = '';
      for (let i = 0; i < low.length; i++) {
        const ch = low[i];
        if (ch === '~' && i + 1 < low.length) src += esc(low[++i]);
        else if (ch === '*') src += '[\\s\\S]*';
        else if (ch === '?') src += '[\\s\\S]';
        else src += esc(ch);
      }
      re = new RegExp('^' + src + '$');
    }
    const eq = (v: Val) => {
      if (rest === '') return isEmpty(v);
      if (typeof v === 'boolean') return String(v).toLowerCase() === low;
      if (typeof v !== 'string') return false;
      return re ? re.test(v.toLowerCase()) : v.toLowerCase() === low;
    };
    return op === '=' ? eq : (v) => !eq(v);
  }
  const cmp = { '<': (a: string) => a < low, '>': (a: string) => a > low, '<=': (a: string) => a <= low,
    '>=': (a: string) => a >= low }[op]!;
  return (v) => typeof v === 'string' && cmp(v.toLowerCase());
}

/** Posición (1..n) de la búsqueda aproximada de Excel: binaria; con datos desordenados da lo mismo que Excel. */
export function matchApprox(x: Val, arr: Val[], type: number): number | null {
  const kind = (v: Val) => (typeof v === 'number' ? 0 : typeof v === 'string' ? (v === '' ? -1 : 1) : typeof v === 'boolean' ? 2 : -1);
  const k = kind(x);
  const cmp = (v: Val) => {
    const a = k === 1 ? String(v).toLowerCase() : (v as number);
    const b = k === 1 ? String(x).toLowerCase() : (x as number);
    return a < b ? -1 : a > b ? 1 : 0;
  };
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let m = mid;
    while (m >= lo && kind(arr[m]) !== k) m--; // otro tipo: se usa la anterior del mismo tipo
    if (m < lo) { lo = mid + 1; continue; }
    const c = cmp(arr[m]);
    if (type >= 1 ? c <= 0 : c >= 0) lo = mid + 1; else hi = m - 1;
  }
  while (hi >= 0 && kind(arr[hi]) !== k) hi--;
  return hi >= 0 ? hi + 1 : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Valores de un rango; las celdas fuera del área usada de la hoja (que el motor no devuelve) cuentan como vacías. */
const flat = (r: any): Val[] => {
  if (!(r && r.valuesFromTopLeftCorner)) return [r];
  const vals: Val[] = r.valuesFromTopLeftCorner();
  const total = typeof r.width === 'function' ? r.width() * r.height() : vals.length;
  return vals.length < total ? [...vals, ...Array(total - vals.length).fill(null)] : vals;
};
// errores y la celda vacía del motor (un Symbol) cuentan como vacío
const plain = (v: any): Val => (typeof v === 'symbol' || (v && typeof v === 'object' && 'type' in v) ? null : v);

class ExcelPlugin extends FunctionPlugin {
  search(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('SEARCH'), (pattern: string = '', text: string = '', start: number = 1) => {
      if (start < 1 || start > text.length) return new CellError(ErrorType.VALUE);
      const p = pattern.toLowerCase();
      const t = text.substring(start - 1).toLowerCase();
      const helper = this.arithmeticHelper as any;
      const i = helper.requiresRegex(p) ? helper.searchString(p, t) : t.indexOf(p);
      return i > -1 ? i + start : new CellError(ErrorType.VALUE);
    });
  }
  find(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('FIND'), (pattern: string = '', text: string = '', start: number = 1) => {
      if (start < 1 || start > text.length) return new CellError(ErrorType.VALUE);
      const i = text.substring(start - 1).indexOf(pattern);
      return i > -1 ? i + start : new CellError(ErrorType.VALUE);
    });
  }
  countif(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('COUNTIF'), (range: any, criteria: Val) => {
      const f = matcher(criteria);
      return flat(range).filter((v) => f(plain(v))).length;
    });
  }
  sumif(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('SUMIF'), (range: any, criteria: Val, sumRange: any) => {
      const f = matcher(criteria);
      const vals = flat(range);
      const sums = sumRange ? flat(sumRange) : vals;
      let t = 0;
      vals.forEach((v, i) => { if (f(plain(v)) && typeof sums[i] === 'number') t += sums[i] as number; });
      return t;
    });
  }
  matchapprox(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('MATCHAPPROX'), (x: Val, range: any, type: number) => {
      const buscado = plain(x);
      if (buscado === null || buscado === '') return new CellError(ErrorType.NA); // buscar un vacío: #N/A, como Excel
      const i = matchApprox(buscado, flat(range).map(plain), type);
      return i ?? new CellError(ErrorType.NA);
    });
  }
  rank(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('RANK'), (x: number, range: any, order: number) => {
      const nums = flat(range).filter((v): v is number => typeof v === 'number');
      return 1 + nums.filter((v) => (order ? v < x : v > x)).length;
    });
  }
}
const STR = { argumentType: FunctionArgumentType.STRING };
const NUM1 = { argumentType: FunctionArgumentType.NUMBER, defaultValue: 1 };
const RANGE = { argumentType: FunctionArgumentType.RANGE };
const SCALAR = { argumentType: FunctionArgumentType.SCALAR };
(ExcelPlugin as any).implementedFunctions = {
  SEARCH: { method: 'search', parameters: [STR, STR, NUM1] },
  FIND: { method: 'find', parameters: [STR, STR, NUM1] },
  COUNTIF: { method: 'countif', parameters: [RANGE, SCALAR] },
  SUMIF: { method: 'sumif', parameters: [RANGE, SCALAR, { ...RANGE, optionalArg: true }] },
  MATCHAPPROX: { method: 'matchapprox', parameters: [{ argumentType: FunctionArgumentType.NOERROR }, RANGE, NUM1] },
  RANK: { method: 'rank', parameters: [{ argumentType: FunctionArgumentType.NUMBER }, RANGE, { argumentType: FunctionArgumentType.NUMBER, defaultValue: 0 }] },
};

let registered = false;
/** Registra las funciones y corrige ""+1 (Excel: #VALUE!, HyperFormula: 1). Llamar antes de crear el libro. */
export function registerExcelCompat() {
  if (registered) return;
  registered = true;
  const names = Object.keys((ExcelPlugin as any).implementedFunctions);
  for (const f of names) {
    try { HyperFormula.unregisterFunction(f); } catch { /* no existía */ }
  }
  HyperFormula.registerFunctionPlugin(ExcelPlugin as any, { enGB: Object.fromEntries(names.map((f) => [f, f])) });
  const probe = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' }) as any;
  const proto = Object.getPrototypeOf(probe._evaluator.interpreter.arithmeticHelper);
  const orig = proto.coerceNonDateScalarToMaybeNumber;
  proto.coerceNonDateScalarToMaybeNumber = function (arg: unknown) {
    return arg === '' ? undefined : orig.call(this, arg);
  };
  probe.destroy();
}
