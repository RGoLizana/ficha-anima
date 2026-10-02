// La ficha de Excel 8.7.0 como libro de cálculo: plantilla (fórmulas) + entradas de una ficha -> valores.
// Las claves de celda son "Hoja!A1", igual que en el Excel.
import { HyperFormula, type SimpleCellAddress } from 'hyperformula';
import { registerExcelCompat } from './plugins';

export type Entrada = string | number | boolean;
export type Entradas = Record<string, Entrada>;
export type Valor = string | number | boolean | null;

export interface Plantilla {
  sheets: Record<string, Record<string, Entrada>>; // celdas: constantes y fórmulas ("=...")
  names: Record<string, string>;                  // rangos con nombre ("Hoja!nombre" si son de hoja)
}

const ERRORES: Record<string, string> = {
  NA: '#N/A', VALUE: '#VALUE!', REF: '#REF!', DIV_BY_ZERO: '#DIV/0!', NUM: '#NUM!', NAME: '#NAME?', NULL: '#NULL!',
  CYCLE: '#CICLO!', ERROR: '#ERROR!', SPILL: '#SPILL!', LIC: '#LIC!',
};

const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const colName = (n: number) => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** Sustituye cada INDIRECT(...) (con paréntesis anidados) por lo que devuelva `resolver(argumento)`. */
export function sustituirIndirect(f: string, resolver: (arg: string) => string): string {
  let out = '';
  let i = 0;
  const re = /INDIRECT\(/gi;
  for (let m = re.exec(f); m; m = re.exec(f)) {
    let depth = 1;
    let j = m.index + m[0].length;
    for (; j < f.length && depth > 0; j++) {
      if (f[j] === '"') j = f.indexOf('"', j + 1); // saltar textos
      else if (f[j] === '(') depth++;
      else if (f[j] === ')') depth--;
    }
    out += f.slice(i, m.index) + resolver(f.slice(m.index + m[0].length, j - 1));
    i = j;
    re.lastIndex = j;
  }
  return out + f.slice(i);
}

/** Contenido de celda para HyperFormula: los textos llevan ' para que "1." no se convierta en número. */
const contenido = (v: Entrada) => (typeof v === 'string' && !v.startsWith("'") ? "'" + v : v);

export class Libro {
  private hf: HyperFormula;
  private cargadas = new Set<string>();
  private plantilla: Plantilla;

  constructor(plantilla: Plantilla) {
    registerExcelCompat();
    this.plantilla = plantilla;
    const sheets: Record<string, Entrada[][]> = {};
    for (const [name, cells] of Object.entries(plantilla.sheets)) {
      const grid: Entrada[][] = [];
      for (const [addr, v] of Object.entries(cells)) {
        const m = addr.match(/^([A-Z]+)(\d+)$/)!;
        (grid[+m[2] - 1] ??= [])[colNum(m[1])] = v;
      }
      for (let i = 0; i < grid.length; i++) grid[i] ??= [];
      sheets[name] = grid;
    }
    const order = Object.keys(sheets);
    const relative = /(^|[^$A-Za-z])[A-Z]{1,3}\d+/; // HyperFormula no admite nombres con referencias relativas
    const names = Object.entries(plantilla.names)
      .filter(([n, e]) => !n.startsWith('_xl') && !/#REF|#NAME/.test(e) && !relative.test(e.replace(/'[^']*'!/g, 'X!')))
      .map(([n, e]) => (n.includes('!')
        ? { name: n.split('!')[1], expression: e, scope: order.indexOf(n.split('!')[0]) }
        : { name: n, expression: e }));
    this.hf = HyperFormula.buildFromSheets(sheets, {
      licenseKey: 'gpl-v3',
      useArrayArithmetic: true,
      evaluateNullToZero: true,  // como Excel: =CeldaVacía da 0
      accentSensitive: true,     // como Excel: "Ánima" <> "Anima"
      parseDateTime: () => undefined, // la ficha no usa fechas; probar cada texto como fecha era ~25 % del arranque
    }, names);
  }

  private addr(clave: string): SimpleCellAddress {
    const i = clave.lastIndexOf('!');
    const m = clave.slice(i + 1).match(/^([A-Z]+)(\d+)$/);
    const sheet = this.hf.getSheetId(clave.slice(0, i));
    if (!m || sheet === undefined) throw new Error(`Celda desconocida: ${clave}`);
    return { sheet, row: +m[2] - 1, col: colNum(m[1]) };
  }

  private clave(a: SimpleCellAddress) {
    return `${this.hf.getSheetName(a.sheet)}!${colName(a.col)}${a.row + 1}`;
  }

  private valorDe(v: unknown): Valor {
    if (v && typeof v === 'object' && 'type' in v) return ERRORES[(v as { type: string }).type] ?? '#ERROR!';
    return v as Valor;
  }

  /** Pone las entradas de una ficha (quitando las de la anterior) y devuelve las celdas que han cambiado. */
  cargar(entradas: Entradas): Record<string, Valor> {
    const cambios = this.hf.batch(() => {
      for (const k of this.cargadas) {
        if (!(k in entradas)) this.hf.setCellContents(this.addr(k), [[this.original(k)]]);
      }
      for (const [k, v] of Object.entries(entradas)) this.hf.setCellContents(this.addr(k), [[contenido(v)]]);
    });
    this.cargadas = new Set(Object.keys(entradas));
    return this.exportar(cambios);
  }

  /** Cambia una entrada (null = vaciar, vuelve al valor de la plantilla) y devuelve las celdas que han cambiado. */
  poner(clave: string, v: Entrada | null): Record<string, Valor> {
    const nuevo = v === null || v === '' ? this.original(clave) : contenido(v);
    // primero escribir (puede fallar con una celda inválida) y solo después anotarla como entrada de la ficha
    const cambios = this.exportar(this.hf.setCellContents(this.addr(clave), [[nuevo]]));
    if (v === null || v === '') this.cargadas.delete(clave); else this.cargadas.add(clave);
    return cambios;
  }

  private original(clave: string): Entrada | null {
    const i = clave.lastIndexOf('!');
    const v = this.plantilla.sheets[clave.slice(0, i)]?.[clave.slice(i + 1)];
    return v === undefined ? null : contenido(v);
  }

  private exportar(cambios: unknown[]): Record<string, Valor> {
    const out: Record<string, Valor> = {};
    for (const c of cambios as { address?: SimpleCellAddress; newValue: unknown }[]) {
      if (c.address) out[this.clave(c.address)] = this.valorDe(c.newValue);
    }
    return out;
  }

  valor(clave: string): Valor {
    return this.valorDe(this.hf.getCellValue(this.addr(clave)));
  }

  /** Todos los valores no vacíos de unas hojas, como {"Hoja!A1": valor}. */
  hojas(nombres: string[]): Record<string, Valor> {
    const out: Record<string, Valor> = {};
    for (const name of nombres) {
      const sheet = this.hf.getSheetId(name);
      if (sheet === undefined) continue;
      this.hf.getSheetValues(sheet).forEach((row, r) => row.forEach((v, c) => {
        if (v !== null && v !== '') out[`${name}!${colName(c)}${r + 1}`] = this.valorDe(v);
      }));
    }
    return out;
  }

  /** Valores de una fórmula o rango evaluado en el contexto de una hoja, fila a fila. */
  rango(ref: string, hoja?: string): Valor[] {
    const sid = hoja === undefined ? 0 : this.hf.getSheetId(hoja) ?? 0;
    const v = this.hf.calculateFormula(`=${ref}`, sid) as unknown;
    if (Array.isArray(v)) return v.flat().map((x) => this.valorDe(x));
    return [this.valorDe(v)];
  }

  /** Opciones del desplegable de Excel definido por `formula` (validación de datos) en una celda de `hoja`. */
  lista(formula: string, hoja: string): string[] {
    let f = formula.trim().replace(/^=/, '');
    // nombre definido con INDIRECT o rango dinámico (el motor no los evalúa): se usa su definición
    const def = this.plantilla.names[f];
    if (def && /INDIRECT\(|:INDEX\(/i.test(def)) f = def.replace(/^=/, '');
    // rango dinámico "A1:INDEX(R, n)" (R recortado a n filas): para una lista basta R, se quitan los vacíos
    const dinamico = f.match(/^[^:]+:INDEX\(([^,()]+),/i);
    if (dinamico) f = dinamico[1];
    // INDIRECT(x), suelto o dentro de otra fórmula: x da el nombre o la dirección de la lista
    f = sustituirIndirect(f, (arg) => {
      const [nombre] = this.rango(arg, hoja);
      return typeof nombre === 'string' && nombre !== '' && !nombre.startsWith('#') ? nombre : 'NA()';
    });
    const vals = /^".*"$/.test(f) ? f.slice(1, -1).split(',') : this.rango(f, hoja);
    const out: string[] = [];
    for (const x of vals) {
      if (x === null || typeof x === 'boolean') continue;
      const s = String(x).trim();
      if (s !== '' && !s.startsWith('#') && !out.includes(s)) out.push(s);
    }
    return out;
  }
}
