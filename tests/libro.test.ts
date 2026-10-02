// Regresión: la plantilla 8.7.0 con las entradas de cada ficha de referencia debe dar los mismos valores que Excel.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { Libro, type Plantilla } from '../src/engine/libro';

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
let libro: Libro;

beforeAll(() => {
  libro = new Libro(read('../public/plantilla.json') as Plantilla);
}, 60_000);

const iguales = (a: unknown, b: unknown) =>
  a === b
  || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6)
  || (typeof a === 'string' && typeof b === 'string' && a.trim() === b.trim()); // golden recortó espacios

describe.each(['sesshomaru', 'lock', 'ayane'])('ficha %s', (nombre) => {
  it('calcula igual que Excel', () => {
    const golden = read(`../golden/${nombre}.json`);
    libro.cargar(golden.entradas);
    const distintos = Object.entries(golden.valores as Record<string, unknown>)
      .map(([k, esperado]) => [k, esperado, libro.valor(k)])
      .filter(([, esperado, obtenido]) => !iguales(obtenido, esperado));
    expect(distintos).toEqual([]);
  }, 60_000);
});

it('al cambiar de ficha no quedan entradas de la anterior', () => {
  const lock = read('../golden/lock.json');
  const sess = read('../golden/sesshomaru.json');
  libro.cargar(lock.entradas);
  libro.cargar(sess.entradas);
  expect(libro.valor('Principal!K5')).toBe('Guerrero Acróbata');
  expect(libro.valor('Principal!N11')).toBe(190);
}, 60_000);

it('una edición devuelve las celdas que cambian', () => {
  libro.cargar(read('../golden/sesshomaru.json').entradas);
  const cambios = libro.poner('Principal!E11', 12); // AGI base 10 -> 12
  expect(cambios['Principal!G11']).toBe(13);
  expect(libro.valor('Principal!H11')).toBe(libro.rango('Tablas!D26')[0]);
}, 60_000);

it('resuelve los desplegables del Excel (INDIRECT, rangos, literales)', () => {
  const listas = read('../src/data/listas.json') as Record<string, string>;
  libro.cargar(read('../golden/lock.json').entradas);
  const op = (clave: string) => libro.lista(listas[clave], clave.split('!')[0]);
  expect(op('General!F23')).toContain('Humano');                      // Lista_Razas
  expect(op('PDs!O7')).toContain('Hechicero');                         // Categorías
  expect(op('Principal!C35')).toContain('Don');                        // INDIRECT($AN$32) -> rango
  expect(op('Principal!C43').length).toBeGreaterThan(0);               // INDIRECT($AN$33) -> "Lista_VentajasDon"
  expect(op('PDs!E59').length).toBeGreaterThan(10);                    // artes marciales (validación x14)
  expect(op('PDs!M43')).toEqual([]);                                   // Lock no tiene tabla de armas
  libro.cargar(read('../golden/sesshomaru.json').entradas);
  expect(op('PDs!M43')).toEqual(['20']);                               // coste de su tabla como única opción
}, 60_000);

it('listas de compras: PD de estilos (INDIRECT dentro de IF) y grado + PD de artes marciales', () => {
  const listas = read('../src/data/listas.json') as Record<string, string>;
  libro.cargar({ ...read('../golden/sesshomaru.json').entradas, 'PDs!E49': 'Tabla de Ataque inusual', 'PDs!E59': 'Tae Kwon Do' });
  const op = (c: string) => libro.lista(listas[`PDs!${c}`], 'PDs');
  expect(op('M49')).toEqual(['20']);
  expect(op('J59')).toEqual(['Base', 'Avanzado', 'Supremo']);
  libro.poner('PDs!J59', 'Base');
  expect(op('M59')).toEqual(['20']); // COLUMN(INDEX(...)) reescrito en el exportador
}, 60_000);
