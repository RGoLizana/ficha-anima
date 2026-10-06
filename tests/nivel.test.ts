// Coste y reparto del cambio de categoría (la misma regla que PDs!Y7 del Excel) y validación del cambio programado
import { describe, expect, it } from 'vitest';
import { costeCambio, filasActuales, parseProgramado, repartir } from '../src/nivel';
import { parse } from '../src/model/ficha';

describe('costeCambio', () => {
  it('mismo arquetipo completo = 20; un arquetipo en común = 40; nada en común = 60', () => {
    expect(costeCambio('Guerrero', 'Paladín')).toBe(20);
    expect(costeCambio('Guerrero', 'Tao')).toBe(40);       // Tao tiene Luchador como segundo arquetipo
    expect(costeCambio('Hechicero', 'Hechicero Mentalista')).toBe(40);
    expect(costeCambio('Hechicero', 'Mentalista')).toBe(60);
    expect(costeCambio('Guerrero', 'Hechicero')).toBe(60);
  });
  it('Novel siempre cuesta 20 y la ventaja de Tablas!G371 lo reduce a la mitad', () => {
    expect(costeCambio('Novel', 'Mentalista')).toBe(20);
    expect(costeCambio('Hechicero', 'Mentalista', undefined, true)).toBe(30);
  });
  it('sin categoría de origen o de destino no hay coste', () => {
    expect(costeCambio('', 'Tao')).toBe(0);
  });
});

describe('repartir y filas', () => {
  it('reparte entre antigua y nueva; la mitad redondea hacia la antigua', () => {
    expect(repartir(40, 'antigua')).toEqual([40, 0]);
    expect(repartir(40, 'nueva')).toEqual([0, 40]);
    expect(repartir(25, 'mitad')).toEqual([13, 12]);
  });
  it('la categoría actual es la última elegida y la siguiente fila está libre', () => {
    expect(filasActuales({ 'PDs!O7': 'Guerrero' })).toEqual({ actual: 7, siguiente: 9 });
    expect(filasActuales({ 'PDs!O7': 'Guerrero', 'PDs!O9': 'Tao' })).toEqual({ actual: 9, siguiente: 11 });
    expect(filasActuales({})).toEqual({ actual: 7, siguiente: undefined });
    expect(filasActuales(Object.fromEntries([7, 9, 11, 13, 15].map((r) => [`PDs!O${r}`, 'Tao']))).siguiente).toBeUndefined();
  });
});

describe('programado en la ficha', () => {
  it('se guarda y se recupera; los datos raros se descartan', () => {
    const base = { version: 2, id: 'x', entradas: {} };
    expect(parse({ ...base, programado: { a: 'Tao', z: 20, aa: 20 } }).programado).toEqual({ a: 'Tao', z: 20, aa: 20 });
    expect(parse({ ...base, programado: { a: '', z: 1, aa: 1 } }).programado).toBeUndefined();
    expect(parseProgramado({ a: 'Tao', z: -5, aa: 3 })).toBeUndefined();
    expect(parse(base).programado).toBeUndefined();
  });
});
