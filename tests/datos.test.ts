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

describe('compendio.json (magia y mentalismo)', () => {
  type Conj = { n: string; v: string; l: number; g: unknown[][]; e: string };
  type C = { magia: { vias: { n: string; tipo: string; opuestas: string[]; subvias: string[] }[]; subvias: { n: string; prohibidas: string[] }[]; conjuros: Conj[] };
    psiquica: { disciplinas: { n: string }[]; poderes: { n: string; d: string; l: number; f: string[] }[]; dificultades: string[]; valores: number[] } };
  const C = read('src/data/compendio.json') as C;

  it('11 vías (5 mayores y 6 menores), 14 subvías y 640 conjuros con sus 4 grados', () => {
    expect(C.magia.vias).toHaveLength(11);
    expect(C.magia.vias.filter((v) => v.tipo === 'Mayor').map((v) => v.n).sort()).toEqual(['Creación', 'Destrucción', 'Luz', 'Nigromancia', 'Oscuridad']);
    expect(C.magia.subvias).toHaveLength(14);
    expect(C.magia.conjuros).toHaveLength(640);
    for (const c of C.magia.conjuros) {
      expect(c.g, c.n).toHaveLength(4);
      expect(Number.isFinite(c.l), c.n).toBe(true);
    }
  });

  it('cada vía o subvía existe y las opuestas son simétricas', () => {
    const nombres = new Set([...C.magia.vias.map((v) => v.n), ...C.magia.subvias.map((s) => s.n), 'Libre acceso']);
    for (const c of C.magia.conjuros) expect(nombres.has(c.v), `${c.n}: ${c.v}`).toBe(true);
    for (const v of C.magia.vias.filter((x) => x.n !== 'Nigromancia'))
      for (const o of v.opuestas) expect(C.magia.vias.find((x) => x.n === o)!.opuestas, `${v.n}-${o}`).toContain(v.n);
  });

  it('niveles de libre acceso resueltos (2 a 92) y vías con 40/30/10 conjuros', () => {
    const por = (v: string) => C.magia.conjuros.filter((c) => c.v === v);
    expect(Math.max(...por('Libre acceso').map((c) => c.l))).toBe(92);
    expect(por('Luz')).toHaveLength(40);
    expect(por('Fuego')).toHaveLength(30);
    expect(por('Caos')).toHaveLength(10);
  });

  it('datos limpios: tipos canónicos, diario Sí/No, mantenimiento numérico o No, sin espacios sobrantes', () => {
    const TIPOS = new Set(['Efecto', 'Ataque', 'Defensa', 'Anímico', 'Detección', 'Automático']);
    for (const c of C.magia.conjuros as unknown as { n: string; t: string; a: string | null; d: string; g: [unknown, unknown, unknown, string][] }[]) {
      for (const t of c.t.split(', ').filter(Boolean)) expect(TIPOS.has(t), `${c.n}: ${c.t}`).toBe(true);
      expect(['Sí', 'No'], c.n).toContain(c.d);
      expect(c.n, c.n).toBe(c.n.trim());
      for (const g of c.g) expect(g[2] === null || g[2] === 'No' || typeof g[2] === 'number', `${c.n}: ${String(g[2])}`).toBe(true);
    }
    // Defensa no cuenta también como Efecto (la 'efe' de 'defensa')
    expect((C.magia.conjuros as unknown as { t: string }[]).filter((c) => c.t === 'Defensa')).toHaveLength(21);
  });

  it('las disciplinas de los poderes coinciden con la lista de disciplinas', () => {
    const nombres = new Set(C.psiquica.disciplinas.map((d) => d.n));
    for (const p of C.psiquica.poderes) expect(nombres.has(p.d), `${p.n}: ${p.d}`).toBe(true);
  });

  it('14 disciplinas y 125 poderes con las 10 dificultades', () => {
    expect(C.psiquica.disciplinas).toHaveLength(14);
    expect(C.psiquica.poderes).toHaveLength(125);
    const discs = new Set(C.psiquica.disciplinas.map((d) => d.n));
    for (const p of C.psiquica.poderes.filter((x) => x.d !== 'Poderes matriciales')) { expect(discs.has(p.d), p.n).toBe(true); expect(p.f, p.n).toHaveLength(10); }
    expect(C.psiquica.dificultades).toHaveLength(10);
    expect(C.psiquica.valores).toEqual([20, 40, 80, 120, 140, 180, 240, 280, 320, 440]);
  });
});
