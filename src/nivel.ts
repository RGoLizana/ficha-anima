// Subir de nivel y cambiar de categoría desde la tarjeta de nivel. Todo lo que escribe son casillas del Excel (PDs!O/S/Z/AA);
// el cambio «programado» es solo una reserva de PD guardada aparte (`Ficha.programado`) y no toca el Excel hasta que se aplica.
import { OFICIALES, oficialDe, type CategoriaGremio } from './gremio/categorias';

/** Cambio de categoría pendiente: a qué categoría y cuántos PD reserva cada una (Z = la antigua, AA = la nueva). */
export interface Programado { a: string; z: number; aa: number }
export type Reparto = 'antigua' | 'mitad' | 'nueva';

/** Filas de PDs donde se elige cada categoría (O) y sus niveles (S). */
export const FILAS = [7, 9, 11, 13, 15];

const min = (s: unknown) => String(s ?? '').toLowerCase().trim();

/** Arquetipos (CF, CG) de una categoría: los de la ficha si los cambió, si no los oficiales. undefined = no se conoce. */
function arquetipos(n: string, cats: CategoriaGremio[] | undefined): [string, string] | undefined {
  const propia = cats?.find((c) => min(c.n) === min(n));
  const ofi = oficialDe(n);
  const cf = propia?.v.CF ?? ofi?.v.CF, cg = propia?.v.CG ?? ofi?.v.CG;
  return cf === undefined ? undefined : [String(cf), String(cg ?? 'Sin')];
}

/** Coste en PD de pasar de una categoría a otra: la misma regla que PDs!Y7 (20 / 40 / 60, la mitad con la ventaja de Tablas!G371). */
export function costeCambio(de: string, a: string, cats?: CategoriaGremio[], mitad = false): number {
  if (!de || !a) return 0;
  const x = arquetipos(de, cats), y = arquetipos(a, cats);
  const base = min(de) === 'novel' || min(a) === 'novel' || (x && y && min(x[0] + x[1]) === min(y[0] + y[1])) ? 20
    : x && y && (min(x[0]) === min(y[0]) || min(x[0]) === min(y[1]) || min(x[1]) === min(y[0]) || (!(min(x[1]) === 'sin' && min(y[1]) === 'sin') && min(x[1]) === min(y[1]))) ? 40 : 60;
  return mitad ? base / 2 : base;
}

/** Reparte el coste entre la categoría antigua y la nueva. */
export function repartir(coste: number, modo: Reparto): [number, number] {
  return modo === 'antigua' ? [coste, 0] : modo === 'nueva' ? [0, coste] : [Math.ceil(coste / 2), Math.floor(coste / 2)];
}

/** Fila de PDs de la categoría actual (la última elegida) y la siguiente libre. Sin categoría elegida o con las 5 ocupadas no hay siguiente. */
export function filasActuales(entradas: Record<string, unknown>) {
  const llena = (r: number) => String(entradas[`PDs!O${r}`] ?? '').trim() !== '';
  let i = 0;
  while (i + 1 < FILAS.length && llena(FILAS[i]) && llena(FILAS[i + 1])) i++;
  return { actual: FILAS[i], siguiente: llena(FILAS[i]) ? FILAS[i + 1] : undefined };
}

/** Valida el cambio programado guardado en una ficha (lo que no encaja se descarta). */
export function parseProgramado(d: unknown): Programado | undefined {
  if (typeof d !== 'object' || d === null) return undefined;
  const o = d as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x) : undefined);
  const a = typeof o.a === 'string' ? o.a.trim() : '';
  return a && n(o.z) !== undefined && n(o.aa) !== undefined ? { a, z: n(o.z)!, aa: n(o.aa)! } : undefined;
}

/** Nombres de las categorías oficiales (para avisar de las que no existen). */
export const NOMBRES_OFICIALES = OFICIALES.map((o) => o.n);
