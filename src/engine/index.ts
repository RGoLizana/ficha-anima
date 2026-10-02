// Acceso al motor desde la página: valores calculados de la ficha abierta como señal reactiva.
import { signal } from '@preact/signals';
import type { Entrada, Entradas, Valor } from './libro';
import type { Mensaje } from './worker';
import listas from '../data/listas.json';

export type { Entrada, Entradas, Valor };

export const motor = signal<'cargando' | 'listo' | 'error'>('cargando');
export const errorMotor = signal('');
/** Valores de la ficha abierta: {"Hoja!A1": valor}. Vacío mientras no hay ficha cargada. */
export const valores = signal<Record<string, Valor>>({});
export const abierta = signal<string | null>(null);

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
let n = 0;
const pendientes = new Map<number, { ok: (v: unknown) => void; ko: (e: Error) => void }>();
worker.onmessage = (e: MessageEvent<{ id: number; res?: unknown; error?: string }>) => {
  const p = pendientes.get(e.data.id);
  pendientes.delete(e.data.id);
  if (e.data.error !== undefined) p?.ko(new Error(e.data.error)); else p?.ok(e.data.res);
};

function llamar<T>(m: Mensaje): Promise<T> {
  const id = ++n;
  return new Promise<T>((ok, ko) => {
    pendientes.set(id, { ok: ok as (v: unknown) => void, ko });
    worker.postMessage({ ...m, id });
  });
}

// URL absoluta: dentro del worker una relativa se resolvería respecto a /assets/
const PLANTILLA = new URL(import.meta.env.BASE_URL + 'plantilla.json', location.href).href;
const listo = llamar<{ descarga: number; construir: number }>({ tipo: 'iniciar', url: PLANTILLA })
  .then((t) => { motor.value = 'listo'; console.debug(`[motor] plantilla ${t.descarga} ms, construir ${t.construir} ms`); })
  .catch((e: Error) => { motor.value = 'error'; errorMotor.value = e.message; throw e; });

/** Carga las entradas de una ficha en el motor (si no es ya la abierta). */
export async function abrir(id: string, entradas: Entradas) {
  if (abierta.value === id) return;
  abierta.value = id;
  valores.value = {};
  await listo;
  const v = await llamar<Record<string, Valor>>({ tipo: 'cargar', entradas });
  if (abierta.value === id) valores.value = v;
}

/** Cambia una entrada de la ficha abierta y actualiza los valores calculados. */
export async function poner(clave: string, valor: Entrada | null) {
  await listo;
  const cambios = await llamar<Record<string, Valor>>({ tipo: 'poner', clave, valor });
  valores.value = { ...valores.value, ...cambios };
}

const LISTAS = listas as Record<string, string>;

/** Fórmula del desplegable de una celda de entrada, tal como está en el Excel (o undefined si no tiene). */
export const formulaLista = (clave: string): string | undefined => LISTAS[clave];

/** Opciones de un desplegable para la celda `clave` (por defecto, el desplegable que tiene en el Excel). */
export function opciones(clave: string, formula = LISTAS[clave]): Promise<string[]> {
  if (!formula) return Promise.resolve([]);
  const hoja = clave.slice(0, clave.lastIndexOf('!'));
  return listo.then(() => llamar<string[]>({ tipo: 'lista', formula, hoja }));
}
