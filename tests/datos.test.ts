// Integridad de los datos generados desde el Excel (se regeneran con tools/*.py; si algo se rompe, salta aquí).
import { describe, expect, it } from 'vitest';
import { parse } from '../src/model/ficha';
import { FICHAS, celdasEntrada, golden, listas, read } from './helpers';

const plantilla = read('public/plantilla.json') as { sheets: Record<string, Record<string, unknown>>; names: Record<string, string> };
const formulas = Object.entries(plantilla.sheets).flatMap(([h, cs]) =>
  Object.entries(cs).filter(([, v]) => typeof v === 'string' && v.startsWith('=')).map(([c, v]) => [`${h}!${c}`, v as string]));

/** Argumentos de nivel superior de cada llamada que encaje con `re` (respeta paréntesis y textos). */
function argumentosDe(f: string, re: RegExp): string[][] {
  const out: string[][] = [];
  for (let m = re.exec(f); m; m = re.exec(f)) {
    const args: string[] = [];
    let depth = 1, cur = '', i = m.index + m[0].length;
    for (; i < f.length && depth > 0; i++) {
      const ch = f[i];
      if (ch === '"') { const j = f.indexOf('"', i + 1); cur += f.slice(i, j + 1); i = j; continue; }
      if (ch === '(' || ch === '{') depth++;
      if (ch === ')' || ch === '}') depth--;
      if (depth === 0) break;
      if (ch === ',' && depth === 1) { args.push(cur); cur = ''; } else cur += ch;
    }
    args.push(cur);
    out.push(args);
  }
  return out;
}

describe('plantilla.json (fórmulas para el motor)', () => {
  it('tiene las 22 hojas de la ficha 8.7.0 (sin NamedRangesList) y unas 35.000 fórmulas', () => {
    expect(Object.keys(plantilla.sheets)).toHaveLength(22);
    expect(Object.keys(plantilla.sheets)).not.toContain('NamedRangesList');
    expect(formulas.length).toBeGreaterThan(34000);
    expect(Object.keys(plantilla.names).length).toBeGreaterThan(600);
  });
  it('no quedan funciones que el motor no tiene o escribe distinto', () => {
    const malas = formulas.filter(([, f]) => /INDIRECT\(|_xlfn\.|_xlws\./.test(f.replace(/"[^"]*"/g, '')));
    expect(malas.slice(0, 5)).toEqual([]);
  });
  it('TRUE/FALSE siempre como función (TRUE()/FALSE())', () => {
    const sueltos = formulas.filter(([, f]) => /(?<![A-Za-z0-9_.!$'])(TRUE|FALSE)(?![A-Za-z0-9_(])/.test(f.replace(/"[^"]*"/g, '')));
    expect(sueltos.slice(0, 5)).toEqual([]);
  });
  it('los textos constantes llevan apóstrofo (si no, "1." se convertiría en número)', () => {
    const sin = Object.entries(plantilla.sheets).flatMap(([h, cs]) => Object.entries(cs)
      .filter(([, v]) => typeof v === 'string' && !v.startsWith('=') && !v.startsWith("'")).map(([c]) => `${h}!${c}`));
    expect(sin.slice(0, 5)).toEqual([]);
  });
  it('las búsquedas aproximadas usan MATCHAPPROX (el MATCH aproximado del motor falla con textos)', () => {
    expect(formulas.some(([, f]) => f.includes('MATCHAPPROX('))).toBe(true);
    // VLOOKUP/HLOOKUP aproximados (sin 4º argumento, o TRUE()/1) que hayan quedado sin reescribir
    const aproximados = formulas.filter(([, f]) => argumentosDe(f, /[VH]LOOKUP\(/g)
      .some((a) => a.length === 3 || (a.length === 4 && /^(TRUE\(\)|1)$/.test(a[3].trim()))));
    expect(aproximados.slice(0, 5)).toEqual([]);
  });
});

describe('listas.json (desplegables)', () => {
  it('hay unos 2.144 desplegables y todos son de celdas de entrada', () => {
    const entrada = celdasEntrada();
    const ls = listas();
    expect(Object.keys(ls).length).toBeGreaterThan(2000);
    expect(Object.keys(ls).filter((k) => !entrada.has(k))).toEqual([]);
  });
  it('incluye las validaciones x14 que openpyxl descarta (p.ej. artes marciales)', () => {
    expect(listas()['PDs!E59']).toBeTruthy();
  });
  it('las fórmulas relativas están trasladadas a cada celda', () => {
    const ls = listas();
    expect(ls['Principal!AG14']).toBe('INDIRECT($AK14)');
    expect(ls['Principal!AF50']).toBe('INDIRECT($AK50)');
    expect(ls['PDs!M44']).toBe('L44');
  });
});

describe('fichas de referencia', () => {
  it.each(FICHAS)('golden/%s.json: entradas solo en celdas de entrada y valores sin fórmulas', (n) => {
    const g = golden(n);
    const entrada = celdasEntrada();
    expect(Object.keys(g.entradas).filter((k) => !entrada.has(k))).toEqual([]);
    expect(Object.values(g.valores).filter((v) => typeof v === 'string' && v.startsWith('='))).toEqual([]);
    expect(Object.keys(g.valores).length).toBeGreaterThan(4000);
  });
  it.each(FICHAS)('ref/fichas/%s.json se importa y tiene las mismas entradas que la referencia', (n) => {
    const f = parse(read(`ref/fichas/${n}.json`));
    expect(f.entradas).toEqual(golden(n).entradas);
  });
});

describe('pdf-layout.json (PDF idéntico al del Excel)', () => {
  const L = read('src/data/pdf-layout.json') as Record<string, { fondo: number[][]; logo: number[][]; textos: Record<string, unknown>[] }>;
  it('dos páginas con el fondo exacto del PDF del Excel', () => {
    expect(Object.keys(L)).toEqual(['resumen', 'notas']);
    expect(L.resumen.fondo).toHaveLength(537);
    expect(L.notas.fondo).toHaveLength(311);
    expect(L.resumen.logo).toHaveLength(1);
  });
  it('todo cabe en un A4 (595,32 × 841,92 pt)', () => {
    for (const p of Object.values(L)) {
      for (const [x, y, w, h] of p.fondo) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(595.32 + 0.5);
        expect(y + h).toBeLessThanOrEqual(841.92 + 0.5);
      }
    }
  });
  it('cada texto es fijo o sale de una celda de Resumen, con fuente del PDF (múltiplo de 0,12 pt)', () => {
    for (const p of Object.values(L)) {
      for (const t of p.textos) {
        expect('text' in t || String(t.ref).startsWith('Resumen!')).toBe(true);
        expect(Math.abs((t.size as number) / 0.12 - Math.round((t.size as number) / 0.12))).toBeLessThan(1e-6);
      }
    }
  });
});

describe('tablas.json (reglamento, referencia)', () => {
  it('contiene las tablas principales', () => {
    const t = read('src/data/tablas.json');
    expect(Object.keys(t).length).toBeGreaterThan(250);
    for (const n of ['Tabla_Categorías', 'Tabla_Razas', 'Tabla_ArmasyEscudos', 'Tabla_Conjuros']) expect(t[n]).toBeTruthy();
  });
});
