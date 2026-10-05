// Datos de convocatoria del compendio (tools/export_convocatoria.py): cifras iguales a las del Excel, fuente en cada
// bloque y nada inventado (lo no verificado es null).
import { describe, expect, it } from 'vitest';
import { read } from './helpers';

const C = read('src/data/convocatoria.json');
const T = (read('public/plantilla.json') as { sheets: Record<string, Record<string, unknown>> }).sheets.Tablas;
const v = (c: string) => { const x = T[c]; return typeof x === 'string' && x.startsWith("'") ? x.slice(1) : x; };
type Inv = { n: string; g: string; dif: number; zeon: number; a: string | null; e: string | null; dur: string | null; pacto: string | null; libro: string | null };

describe('convocatoria.json', () => {
  it('22 Arcanos mayores y 22 invertidos con nombre, dificultad y zeón iguales al Excel (Tablas!AB1066:AD1109)', () => {
    const l: Inv[] = C.arcanos.lista;
    expect(l.filter((x) => x.g === 'Arcanos mayores')).toHaveLength(22);
    expect(l.filter((x) => x.g === 'Arcanos invertidos')).toHaveLength(22);
    l.forEach((x, i) => {
      expect(x.n).toBe(v(`AB${1066 + i}`));
      expect(x.dif).toBe(v(`AC${1066 + i}`));
      expect(x.zeon).toBe(v(`AD${1066 + i}`));
    });
  });

  it('comprobación puntual de cifras del Excel: El Mundo 460/1.000 y La Torre invertida 340/750', () => {
    const por = (n: string) => (C.arcanos.lista as Inv[]).find((x) => x.n === n)!;
    expect([por('El Mundo').dif, por('El Mundo').zeon]).toEqual([460, 1000]);
    expect([por('La Torre invertida').dif, por('La Torre invertida').zeon]).toEqual([340, 750]);
  });

  it('cada Arcano tiene acción, efecto, duración y pacto resumidos (cortos, no párrafos del libro)', () => {
    for (const x of C.arcanos.lista as Inv[]) {
      expect(x.a, x.n).toMatch(/^(Activa|Pasiva)/);
      for (const t of [x.e, x.dur, x.pacto]) { expect(t, x.n).toBeTruthy(); expect(t!.length, x.n).toBeLessThan(260); }
      expect(x.libro).toMatch(/Core Exxet/);
    }
  });

  it('las otras invocaciones salen del Excel; las que están en Arcana traen efecto resumido y las demás lo tienen a null', () => {
    const l: Inv[] = C.otras.lista;
    expect(l.length).toBeGreaterThan(100);
    for (const x of l) {
      const r = Object.keys(T).find((k) => /^AB\d+$/.test(k) && v(k) === x.n)!;
      expect(r, x.n).toBeTruthy();
      expect(x.dif).toBe(v(r.replace('AB', 'AC')));
      expect(x.zeon).toBe(v(r.replace('AB', 'AD')));
      if (x.libro === null) expect([x.a, x.e, x.dur, x.pacto]).toEqual([null, null, null, null]);
      else { expect(typeof x.e, x.n).toBe('string'); expect(x.e!.length, x.n).toBeGreaterThan(20); }
    }
    expect(l.filter((x) => x.libro === null).map((x) => x.n.split(/[:,]/)[0]).sort()).toEqual(['Rudraskha', 'Rudraskha', 'Vilfain', 'Vilfain', 'Vilfain', 'Zvilpogghua', 'Zvilpogghua']);
  });

  it('costes de PD por categoría iguales al Excel (Tablas!D202:AD223)', () => {
    expect(C.pd.filas).toHaveLength(22);
    C.pd.filas.forEach((p: { cat: string; c: number[] }, i: number) => {
      expect(p.cat).toBe(v(`D${202 + i}`));
      expect(p.c).toEqual(['AA', 'AB', 'AC', 'AD'].map((c) => v(`${c}${202 + i}`)));
    });
  });

  it('habilidades espirituales (Encarnación, Manifestación, Interacción) con coste y Gnosis del Excel', () => {
    expect(C.espirituales.filas.map((h: { n: string; coste: number; gnosis: number }) => [h.n, h.coste, h.gnosis])).toEqual([
      ['Interacción con el mundo', v('Q1535'), v('P1535')], ['Manifestación', v('Q1536'), v('P1536')], ['Encarnación', v('Q1537'), v('P1537')]]);
  });

  it('las 4 habilidades y la Tabla 64 (16 niveles; dominar cuesta el doble de zeón que convocar)', () => {
    expect(C.habilidades.lista.map((h: { n: string }) => h.n)).toEqual(['Convocar', 'Dominar', 'Atar', 'Desconvocar']);
    const f = C.dificultades.filas as { nivel: number; v: [number, number][] }[];
    expect(f.map((x) => x.nivel)).toEqual([...Array(16).keys()]);
    for (const x of f) {
      expect(x.v[0][0]).toBe(140 + 20 * x.nivel);
      expect(x.v[1]).toEqual([x.v[0][0] + 40, 2 * x.v[0][1]]);
    }
    expect(f[3].v).toEqual([[200, 60], [240, 120], [220, 30], [160, 15]]);   // ejemplo del libro: elemental de nivel 3
  });

  it('cada bloque declara su fuente', () => {
    for (const [k, b] of Object.entries(C)) expect((b as { fuente?: string }).fuente, k).toMatch(/\S/);
  });
});
