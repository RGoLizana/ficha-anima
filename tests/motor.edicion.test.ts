// El motor al editar: cambiar de ficha, vaciar/restaurar entradas, errores de fórmula, tipos de valor.
import { describe, expect, it } from 'vitest';
import type { Entrada } from '../src/engine/libro';
import { FICHAS, HOJAS_VISIBLES, diferencias, golden, motor } from './helpers';

const T = 300_000;
const ERRORES_GRAVES = ['#CICLO!', '#ERROR!', '#NAME?'];

describe('cambiar de ficha', () => {
  it('cargar fichas en secuencia (A→B→C→A) da siempre los valores de Excel', () => {
    const l = motor();
    for (const n of [...FICHAS, FICHAS[0]]) {
      l.cargar(golden(n).entradas);
      expect(diferencias(l, golden(n)), n).toEqual([]);
    }
  }, T);

  it('una ficha vacía tras otra llena no conserva nada de la anterior', () => {
    const l = motor();
    l.cargar(golden('lock').entradas);
    l.cargar({});
    expect(l.valor('General!F22')).toBe(null); // la casilla de entrada vacía está vacía
    expect(l.valor('Principal!K4')).toBe('');  // y la fórmula que la lee da "" (como Excel)
    expect(l.valor('Principal!K5')).not.toBe('Hechicero');
  }, T);
});

describe('editar entradas', () => {
  it('vaciar y restaurar cada entrada de Sesshomaru deja la ficha exactamente igual', () => {
    const l = motor();
    const g = golden('sesshomaru');
    l.cargar(g.entradas);
    for (const [k, v] of Object.entries(g.entradas)) {
      l.poner(k, null);
      l.poner(k, v);
    }
    expect(diferencias(l, g)).toEqual([]);
  }, T);

  it.each(['lock', 'ayane'] as const)('vaciar y restaurar 1 de cada 5 entradas de %s deja la ficha igual', (n) => {
    const l = motor();
    const g = golden(n);
    l.cargar(g.entradas);
    Object.entries(g.entradas).filter((_, i) => i % 5 === 0).forEach(([k, v]) => { l.poner(k, null); l.poner(k, v); });
    expect(diferencias(l, g)).toEqual([]);
  }, T);

  it('poner devuelve las celdas dependientes que cambian', () => {
    const l = motor();
    l.cargar(golden('sesshomaru').entradas);
    const cambios = l.poner('Principal!E11', 12);
    expect(cambios['Principal!G11']).toBe(13);          // total AGI
    expect(cambios['Principal!H11']).toBe(25);          // bono AGI
    expect(Object.keys(cambios).length).toBeGreaterThan(5);
    l.poner('Principal!E11', 10);
  }, T);

  it('vaciar una entrada vuelve al valor por defecto de la plantilla (p.ej. tipo de criatura = Natural)', () => {
    const l = motor();
    l.cargar(golden('sesshomaru').entradas);
    l.poner('Principal!Y11', 'No muerto');
    expect(l.valor('Principal!Y11')).toBe('No muerto');
    l.poner('Principal!Y11', null);
    expect(l.valor('Principal!Y11')).toBe('Natural');
  }, T);

  it('los textos que parecen números se guardan como texto ("1.", "007", "1/2")', () => {
    const l = motor();
    l.cargar(golden('sesshomaru').entradas);
    for (const t of ['1.', '007', '1/2', 'TRUE', '=1+1']) {
      l.poner('General!F22', t);
      expect(l.valor('General!F22')).toBe(t);
    }
    l.poner('General!F22', 'Sesshomaru');
  }, T);

  it('los números se guardan como número y calculan', () => {
    const l = motor();
    l.cargar(golden('sesshomaru').entradas);
    l.poner('PDs!M25', 240);
    expect(l.valor('PDs!AA25')).toBe(155);
    l.poner('PDs!M25', 230);
    expect(l.valor('PDs!AA25')).toBe(150);
  }, T);

  it('una celda inexistente da error claro', () => {
    expect(() => motor().valor('NoExiste!A1')).toThrow('Celda desconocida');
    expect(() => motor().poner('Principal!ZZZZ', 1)).toThrow();
  }, T);
});

describe('sin errores de fórmula graves', () => {
  it.each([...FICHAS, 'vacía'] as const)('ficha %s: ninguna celda visible con #CICLO!, #ERROR! o #NAME?', (n) => {
    const l = motor();
    l.cargar(n === 'vacía' ? {} : golden(n).entradas);
    const malos = Object.entries(l.hojas(HOJAS_VISIBLES)).filter(([, v]) => ERRORES_GRAVES.includes(String(v)));
    expect(malos.slice(0, 20), `${malos.length} celdas con error`).toEqual([]);
  }, T);
});

describe('rendimiento', () => {
  it('una edición recalcula en menos de 500 ms', () => {
    const l = motor();
    l.cargar(golden('sesshomaru').entradas);
    const t0 = performance.now();
    l.poner('Principal!E11', 11);
    l.poner('Principal!E11', 10);
    expect((performance.now() - t0) / 2).toBeLessThan(500);
  }, T);

  it('cargar una ficha tarda menos de 5 s', () => {
    const l = motor();
    const t0 = performance.now();
    l.cargar(golden('ayane').entradas);
    expect(performance.now() - t0).toBeLessThan(5000);
  }, T);
});

describe('categorías múltiples', () => {
  it('con 5 categorías, el bono por nivel de las secundarias suma las 5 (la 5ª usaba una búsqueda aproximada rota)', () => {
    const l = motor();
    const base: Record<string, Entrada> = { ...golden('sesshomaru').entradas, 'PDs!O7': 'Guerrero Acróbata', 'PDs!S7': 1 };
    l.cargar(base);
    const una = l.valor('PDs!AE129') as number;               // bono de categoría a Acrobacias, 1 nivel
    expect(typeof una).toBe('number');
    const cinco = { ...base };
    for (const r of [9, 11, 13, 15]) { cinco[`PDs!O${r}`] = 'Guerrero Acróbata'; cinco[`PDs!S${r}`] = 1; }
    l.cargar(cinco);
    expect(l.valor('PDs!AE129')).toBe(5 * una);
    expect(l.valor('Principal!O6')).toBe('5 + 4');             // nivel total (+4 de ajuste por raza)
  }, T);
});
