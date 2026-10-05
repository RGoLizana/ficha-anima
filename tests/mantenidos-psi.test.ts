// Ayudante de poderes psíquicos mantenidos: reglas del Core Exxet p. 212-213 y réplica de Psíquicos!AK17 del Excel
import { describe, expect, it } from 'vitest';
import { motor, read } from './helpers';
import { NIVELES, avisos, bonoDe, indiceDe, innatosDe, mantenible, nivelDe, nivelMantenido, siguiente, ventajasDe } from '../src/psiquica/mantenidos';
import { parseSesion } from '../src/model/ficha';

const nv = (i: number) => NIVELES[i];
const MED = indiceDe('MED');

describe('nivel de un innato (Core p. 212)', () => {
  it('el potencial da la dificultad natural: +60 Fácil, +80 Medio, +120 Difícil', () => {
    expect([60, 80, 120].map((x) => nv(nivelDe(x)))).toEqual(['FAC', 'MED', 'DIF']);
  });

  it('dificultad mínima de la tabla del Excel: Vuelo telequinético Difícil, Incremento total Absurdo', () => {
    expect(nv(mantenible('Vuelo telequinético')!.min)).toBe('DIF');
    expect(nv(mantenible('Incremento total')!.min)).toBe('ABS');
    expect(nivelMantenido({ nat: 80, cv: 0, bono: 0, min: mantenible('Vuelo telequinético')!.min })).toBe(indiceDe('DIF'));
  });

  it('cada CV suma +20 al mantenimiento: Escudo con +80 y 2 CV en Difícil, con 3 en Muy difícil', () => {
    const escudo = { nat: 80, bono: 0, min: MED };
    expect(nv(nivelMantenido({ ...escudo, cv: 2 }))).toBe('DIF');
    expect(nv(nivelMantenido({ ...escudo, cv: 3 }))).toBe('MDF');
    expect(nv(nivelMantenido({ nat: 60, cv: 1, bono: 0, min: 0 }))).toBe('MED');
  });
});

describe('mínimo para el siguiente nivel', () => {
  it('Escudo con +80: 1 CV no basta (100 sigue en Medio), con 2 pasa a Difícil', () => {
    expect(siguiente({ nat: 80, cv: 0, bono: 0, min: MED })).toEqual({ cv: 2, extra: 2, nivel: indiceDe('DIF') });
    expect(siguiente({ nat: 80, cv: 2, bono: 0, min: MED })).toEqual({ cv: 3, extra: 1, nivel: indiceDe('MDF') });
  });

  it('Incremento total con +80 no sube ni con 5 CV (180 sigue en Absurdo)', () => {
    expect(siguiente({ nat: 80, cv: 0, bono: 0, min: mantenible('Incremento total')!.min })).toBeNull();
  });

  it('Mantenimiento añadido sube un nivel el natural, pero no se suma a los CV (como Psíquicos!AK17)', () => {
    const conVentaja = { nat: 80, cv: 0, bono: 1, min: MED };
    expect(nv(nivelMantenido(conVentaja))).toBe('DIF');
    expect(siguiente(conVentaja)).toEqual({ cv: 3, extra: 3, nivel: indiceDe('MDF') });
  });
});

describe('ventajas y avisos', () => {
  it('detecta Mantenimiento añadido en ventajas y en las personalizadas, e Introversión salvo cancelada', () => {
    const leer = (m: Record<string, string>) => (k: string) => m[k] ?? '';
    expect(ventajasDe(leer({ 'Principal!E40': 'Mantenimiento añadido' })).map((v) => v.n)).toEqual(['Mantenimiento añadido']);
    expect(ventajasDe(leer({ 'Principal!AM15': 'Mantenimiento añadido' })).map((v) => v.n)).toEqual(['Mantenimiento añadido']);
    expect(bonoDe(ventajasDe(leer({ 'Principal!C35': 'Mantenimiento añadido', 'Psíquicos!C39': 'Introversión' })))).toBe(2);
    expect(ventajasDe(leer({ 'Psíquicos!C39': 'Introversión', 'Psíquicos!C41': 'Cancelación: Introversión' }))).toEqual([]);
  });

  it('avisa (sin bloquear) de innatos de más, CV insuficientes y más de 5 CV en un poder', () => {
    expect(avisos({ activos: 1, innatos: 1, cvIncr: 2, cvLibres: 3, porPoder: [2] })).toEqual([]);
    const a = avisos({ activos: 2, innatos: 1, cvIncr: 6, cvLibres: 3, porPoder: [6] }).join(' ');
    expect(a).toMatch(/2 poderes y tienes 1 innato/);
    expect(a).toMatch(/superan tus CV libres/);
    expect(a).toMatch(/más de 5 CV/);
  });

  it('la sesión guarda los mantenidos psíquicos validados y las sesiones antiguas siguen valiendo', () => {
    expect(parseSesion({ mantPsi: [{ n: 'Vuelo telequinético', cv: 2.4 }, { n: '', cv: 1 }, { n: 'X', cv: -3 }, 7] })!.mantPsi)
      .toEqual([{ n: 'Vuelo telequinético', cv: 2 }, { n: 'X', cv: 0 }]);
    expect(parseSesion({ mant: [] })!.mantPsi).toBeUndefined();
  });
});

describe('coincide con el Excel (Psíquicos!AK) en la ficha de Ayane', () => {
  const casos: [string, Record<string, string | number>][] = [
    ['sin cambios', {}],
    ['2 CV de incrementar', { 'Psíquicos!AI17': 2 }],
    ['Mantenimiento añadido', { 'Principal!C37': 'Mantenimiento añadido' }],
    ['ventaja y 3 CV', { 'Principal!C37': 'Mantenimiento añadido', 'Psíquicos!AI17': 3 }],
    ['otro innato', { 'Psíquicos!AD17': 'Vuelo telequinético', 'Psíquicos!AJ17': 30 }],
  ];
  for (const [nombre, extra] of casos) {
    it(nombre, () => {
      const l = motor();
      l.cargar({ ...read('ref/fichas/ayane.json').entradas, ...extra });
      const leer = (k: string) => String(l.valor(k) ?? '').trim();
      const [i] = innatosDe(leer);
      expect(i.excel).toBeGreaterThan(0);
      expect(nivelMantenido({ nat: i.nat, cv: i.cv, bono: bonoDe(ventajasDe(leer)), min: i.poder!.min })).toBe(i.excel);
    }, 120_000);
  }
});
