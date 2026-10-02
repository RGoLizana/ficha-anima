// Utilidades comunes de las pruebas: datos de referencia y un motor compartido por archivo de pruebas.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Libro, type Entradas, type Plantilla } from '../src/engine/libro';

// rutas con node:path (en el entorno happy-dom, URL es la del DOM simulado y readFileSync no la entiende)
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const read = (p: string) => JSON.parse(readFileSync(join(RAIZ, p), 'utf8'));

export const FICHAS = ['sesshomaru', 'lock', 'ayane'] as const;
export type NombreFicha = (typeof FICHAS)[number];

export interface Golden { entradas: Entradas; valores: Record<string, unknown> }
export const golden = (n: NombreFicha): Golden => read(`golden/${n}.json`);
export const listas = (): Record<string, string> => read('src/data/listas.json');

type Inventario = Record<string, { celda: string; etiqueta: string | null; lista: string | null; defecto: unknown }[]>;
export const inventario = (): Inventario => read('ref/inputs.json');
/** Claves "Hoja!Celda" de todas las celdas de entrada del Excel (desbloqueadas). */
export const celdasEntrada = () => new Set(Object.entries(inventario()).flatMap(([h, xs]) => xs.map((x) => `${h}!${x.celda}`)));

let libro: Libro | undefined;
/** Construir el libro tarda unos segundos: uno por archivo de pruebas. */
export const motor = () => (libro ??= new Libro(read('public/plantilla.json') as Plantilla));

/** Igualdad como la ve el usuario: números con tolerancia y textos sin espacios en los extremos. */
export const iguales = (a: unknown, b: unknown) =>
  a === b
  || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6)
  || (typeof a === 'string' && typeof b === 'string' && a.trim() === b.trim());

/** Celdas cuyo valor difiere del Excel en una ficha ya cargada en el motor. */
export function diferencias(l: Libro, g: Golden) {
  return Object.entries(g.valores)
    .map(([k, esperado]) => [k, esperado, l.valor(k)] as const)
    .filter(([, esperado, obtenido]) => !iguales(obtenido, esperado));
}

export const HOJAS_VISIBLES = ['Principal', 'General', 'PDs', 'Combate', 'Ki', 'Creación de Técnicas', 'Místicos', 'Metamagia',
  'Sheele', 'Psíquicos', 'Elan', 'Personalización', 'Grimorio Magia', 'Grimorio de Vía', 'Grimorio Psíquica', 'Resumen'];
