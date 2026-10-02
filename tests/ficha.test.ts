import { describe, expect, it } from 'vitest';
import { nueva, nombreDe, parse, VERSION, NOMBRE } from '../src/model/ficha';

describe('parse (importar ficha)', () => {
  it('acepta una ficha exportada tal cual', () => {
    const f = nueva('Lock');
    expect(parse(JSON.parse(JSON.stringify(f)))).toEqual(f);
    expect(nombreDe(f)).toBe('Lock');
  });
  it('migra fichas v1 (solo nombre) a entradas', () => {
    const f = parse({ version: 1, nombre: 'Ayane', notas: 'x' });
    expect(f.version).toBe(VERSION);
    expect(f.entradas).toEqual({ [NOMBRE]: 'Ayane' });
    expect(f.notas).toBe('x');
  });
  it('rechaza lo que no es una ficha', () => {
    expect(() => parse(null)).toThrow();
    expect(() => parse({ nombre: 'x' })).toThrow('Versión');
    expect(() => parse({ version: VERSION + 1, entradas: {} })).toThrow('Versión');
    expect(() => parse({ version: 2 })).toThrow('entradas');
    expect(() => parse({ version: 2, entradas: { 'no-es-celda': 1 } })).toThrow('Entrada no válida');
    expect(() => parse({ version: 2, entradas: { 'Principal!E11': { x: 1 } } })).toThrow('Entrada no válida');
  });
});
