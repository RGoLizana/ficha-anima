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
  it('conserva la sesión del Modo juego y la valida sin romper la ficha', () => {
    const f = { ...nueva('Lock'), sesion: { r: { pv: 10, zeon: -5 }, asalto: 3, efectos: [{ n: 'Dolor', a: null, m: -10, nota: '' }], conts: [{ n: 'Flechas', v: 12 }], mant: [], favH: ['Sigilo'], favC: [], notas: 'x' } };
    expect(parse(JSON.parse(JSON.stringify(f)))).toEqual(f);
    expect(parse(JSON.parse(JSON.stringify(nueva('Lock')))).sesion).toBeUndefined(); // fichas viejas: sin sesión
    expect(parse({ version: 2, entradas: {}, sesion: 'basura' }).sesion).toBeUndefined();
    const s = parse({ version: 2, entradas: {}, sesion: { r: { pv: 'x', ki: 3 }, efectos: [null, { n: 'A', a: '2' }], favH: [1, 'Advertir'] } }).sesion!;
    expect(s).toEqual({ r: { ki: 3 }, asalto: 1, efectos: [{ n: 'A', a: null, m: 0, nota: '' }], conts: [], mant: [], favH: ['Advertir'], favC: [], notas: '' });
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
