// Una ficha guarda SOLO lo que introduce el jugador, como en el Excel: {"Hoja!Celda": valor}.
// Todo lo demás lo calcula el motor de fórmulas (src/engine) con la plantilla 8.7.0.
import type { Entrada, Entradas } from '../engine/libro';

export const VERSION = 2;
export const NOMBRE = 'General!F22';

/** Copia de unos pocos valores calculados, solo para pintar la lista de fichas sin cargar el motor. */
export interface Resumen {
  categoria?: string;
  nivel?: string;
  raza?: string;
  stats?: { k: string; v: string | number }[];
}

export interface Ficha {
  version: number;
  id: string;
  entradas: Entradas;
  notas: string;
  actualizada: string; // ISO
  resumen?: Resumen;
}

export const nombreDe = (f: Ficha) => String(f.entradas[NOMBRE] ?? '');

export function nueva(nombre = 'Nuevo personaje'): Ficha {
  return { version: VERSION, id: crypto.randomUUID(), entradas: { [NOMBRE]: nombre }, notas: '',
    actualizada: new Date().toISOString() };
}

const CELDA = /^[^!]+![A-Z]{1,3}\d+$/;
const esEntrada = (v: unknown): v is Entrada => ['string', 'number', 'boolean'].includes(typeof v);

/** Valida y migra una ficha venida de fuera (archivo importado o localStorage). Lanza Error si no sirve. */
export function parse(data: unknown): Ficha {
  if (typeof data !== 'object' || data === null) throw new Error('No es una ficha');
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'number' || d.version > VERSION) throw new Error('Versión de ficha no soportada');
  let entradas: Entradas = {};
  if (d.version === 1) {
    if (typeof d.nombre !== 'string') throw new Error('Falta el nombre');
    entradas = { [NOMBRE]: d.nombre };
  } else {
    if (typeof d.entradas !== 'object' || d.entradas === null) throw new Error('Faltan las entradas');
    for (const [k, v] of Object.entries(d.entradas)) {
      if (!CELDA.test(k) || !esEntrada(v)) throw new Error(`Entrada no válida: ${k}`);
      entradas[k] = v;
    }
  }
  return {
    version: VERSION,
    id: typeof d.id === 'string' ? d.id : crypto.randomUUID(),
    entradas,
    notas: typeof d.notas === 'string' ? d.notas : '',
    actualizada: typeof d.actualizada === 'string' ? d.actualizada : new Date().toISOString(),
    resumen: typeof d.resumen === 'object' && d.resumen !== null ? (d.resumen as Resumen) : undefined,
  };
}
