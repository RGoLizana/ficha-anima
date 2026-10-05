// Categorías de gremio con el motor real: regresión (sin ellas todo igual), equivalencia (una copia exacta da lo mismo),
// modificar una oficial cambia lo que debe, y cambiar de ficha limpia la tabla.
import { describe, expect, it } from 'vitest';
import type { Entradas, Valor } from '../src/engine/libro';
import { categoriaDesde, categoriasUsadas, entradasCategorias } from '../src/gremio/categorias';
import { entradasMotor, nueva } from '../src/model/ficha';
import { FICHAS, HOJAS_VISIBLES, diferencias, golden, iguales, motor, read } from './helpers';

const T = 300_000;
const lock = (read('ref/fichas/lock.json') as { entradas: Entradas }).entradas;
const valores = () => motor().hojas(HOJAS_VISIBLES);
const con = (entradas: Entradas, cats = [] as ReturnType<typeof categoriaDesde>[]) => ({ ...entradas, ...entradasCategorias(cats, categoriasUsadas(entradas)) });
const cambios = (a: Record<string, Valor>, b: Record<string, Valor>) => Object.keys({ ...a, ...b }).filter((k) => !iguales(a[k], b[k]));

describe('categorías de gremio en el motor', () => {
  it('regresión: sin categorías de gremio cada ficha da exactamente los valores de Excel', () => {
    const l = motor();
    for (const n of FICHAS) {
      const f = nueva();
      f.entradas = golden(n).entradas;
      l.cargar(entradasMotor(f));
      expect(diferencias(l, golden(n)), n).toEqual([]);
    }
  }, T);

  it('equivalencia: Lock con una copia exacta de Hechicero (otro nombre) da los mismos valores salvo los textos con el nombre', () => {
    const l = motor();
    l.cargar(lock);
    const base = valores();
    const propia = categoriaDesde('Hechicero', 'Hechicero bis');
    l.cargar(con({ ...lock, 'PDs!O7': 'Hechicero bis' }, [propia]));
    const nuevo = valores();
    const distintos = cambios(base, nuevo).filter((k) => !(typeof base[k] === 'string' && String(base[k]).includes('Hechicero')) && !(typeof nuevo[k] === 'string' && String(nuevo[k]).includes('Hechicero bis'))
      && k !== 'PDs!N11');                     // PDs!N11 = LEN(E11): largo de un texto que lleva el nombre de la categoría
    expect(distintos).toEqual([]);
    expect(Object.keys(base).length).toBeGreaterThan(5000);
  }, T);

  it('modificar una oficial (Hechicero: coste de ki 3 → 1) cambia el coste y los PD gastados, y volver a los valores oficiales lo deshace', () => {
    const l = motor();
    l.cargar({ ...lock, 'PDs!M30': 10 });                   // 10 PD en la primera casilla de ki
    const base = valores();
    const mod = categoriaDesde('Hechicero', '', true);
    mod.v.V = 1;
    l.cargar(con({ ...lock, 'PDs!M30': 10 }, [mod]));
    const cambiado = valores();
    const dif = cambios(base, cambiado);
    expect(dif.length).toBeGreaterThan(0);
    expect(dif.every((k) => /^(PDs|Ki|Principal|Resumen|General)!/.test(k))).toBe(true);
    const sinCambio = categoriaDesde('Hechicero', '', true);
    l.cargar(con({ ...lock, 'PDs!M30': 10 }, [sinCambio]));
    expect(cambios(base, valores())).toEqual([]);
  }, T);

  it('un límite de la propia pasado de rosca avisa y deja seguir (nunca bloquea)', () => {
    const l = motor();
    l.cargar(lock);
    const sin = valores();
    const propia = categoriaDesde('Hechicero', 'Hechicero bis');
    propia.v.I = 0.01;                                      // límite de combate: 1 %
    l.cargar(con({ ...lock, 'PDs!O7': 'Hechicero bis', 'PDs!M25': 20 }, [propia]));
    const con1 = valores();
    expect(Object.entries(con1).filter(([k, v]) => /^PDs!(V86|T194)$/.test(k) && /exceso|excedido/i.test(String(v))).length).toBeGreaterThan(0);
    expect(cambios(sin, con1).length).toBeGreaterThan(0);
  }, T);

  it('cargar una ficha con propia y luego otra sin ella deja la tabla limpia (valores de Excel)', () => {
    const l = motor();
    const propia = categoriaDesde('Hechicero', 'Hechicero bis');
    propia.v.V = 1;
    l.cargar(con({ ...lock, 'PDs!O7': 'Hechicero bis' }, [propia]));
    l.cargar(golden('lock').entradas);
    expect(diferencias(l, golden('lock'))).toEqual([]);
    expect(l.valor('Tablas!D223')).toBe('Novel');
  }, T);

  it('dos categorías propias a la vez (cambio de categoría) ocupan filas distintas y calculan', () => {
    const l = motor();
    const a = categoriaDesde('Guerrero', 'Caballero'), b = categoriaDesde('Hechicero', 'Hechicero bis');
    l.cargar(con({ ...lock, 'PDs!O7': 'Caballero', 'PDs!O9': 'Hechicero bis', 'PDs!S9': 2 }, [a, b]));
    expect(l.valor('Tablas!D223')).toBe('Caballero');
    expect(l.valor('Tablas!D222')).toBe('Hechicero bis');
    expect(l.valor('Tablas!C223')).toBe(Number(lock['PDs!S7'] ?? 0));            // niveles de la categoría (SUMIF por nombre)
  }, T);
});
