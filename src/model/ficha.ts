// Una ficha guarda SOLO lo que introduce el jugador, como en el Excel: {"Hoja!Celda": valor}.
// Todo lo demás lo calcula el motor de fórmulas (src/engine) con la plantilla 8.7.0.
import type { Entrada, Entradas } from '../engine/libro';
import { entradasConsumo, parseElegidos, type Elegido } from '../gremio/modelo';
import { categoriasUsadas, entradasCategorias, parseCategorias, type CategoriaGremio } from '../gremio/categorias';

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
  /** Estado de la partida (Modo juego). Aparte de `entradas`: no entra en el motor ni cambia ningún cálculo. */
  sesion?: Sesion;
  /** Elementos propios del gremio que tiene el personaje (vías, disciplinas, Ars Magnus) y lo que consumen. Se suma a los totales. */
  propio?: Elegido[];
  /** Imagen del personaje (data URL JPEG ya reducida): sale en los iconos de las fichas y en la página principal. */
  retrato?: string;
  /** Copia de las categorías de gremio (propias o modificadas) que usa el personaje: así calcula igual en cualquier navegador. */
  categorias?: CategoriaGremio[];
  /** Pestañas del menú que el jugador ha ocultado en este personaje (p. ej. «psiquica» en un mago). Solo afecta al menú. */
  ocultas?: string[];
}

export const RECURSOS = ['pv', 'zeon', 'ki', 'cv', 'cans', 'acc'] as const;
export type Recurso = (typeof RECURSOS)[number];

export interface Sesion {
  /** Valor actual de cada recurso; si falta, vale lo de la ficha. */
  r: Partial<Record<Recurso, number>>;
  asalto: number;
  efectos: { n: string; a: number | null; m: number; nota: string }[]; // a = asaltos restantes (null = sin fin)
  conts: { n: string; v: number }[];
  mant: { n: string; m: number }[];
  favH: string[];
  favC: string[];
  notas: string;
}

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
const str = (x: unknown) => (typeof x === 'string' ? x : '');
const objetos = (x: unknown) => (Array.isArray(x) ? x.filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null) : []);
const textos = (x: unknown) => (Array.isArray(x) ? x.filter((t): t is string => typeof t === 'string') : []);

/** Valida la sesión guardada: lo que no encaja se descarta sin romper la ficha (undefined = sin sesión). */
export function parseSesion(d: unknown): Sesion | undefined {
  if (typeof d !== 'object' || d === null || Array.isArray(d)) return undefined;
  const o = d as Record<string, unknown>;
  const r = typeof o.r === 'object' && o.r !== null ? (o.r as Record<string, unknown>) : {};
  return {
    r: Object.fromEntries(RECURSOS.filter((k) => num(r[k]) !== undefined).map((k) => [k, r[k]])),
    asalto: num(o.asalto) ?? 1,
    efectos: objetos(o.efectos).map((e) => ({ n: str(e.n), a: num(e.a) ?? null, m: num(e.m) ?? 0, nota: str(e.nota) })),
    conts: objetos(o.conts).map((c) => ({ n: str(c.n), v: num(c.v) ?? 0 })),
    mant: objetos(o.mant).map((m) => ({ n: str(m.n), m: num(m.m) ?? 0 })),
    favH: textos(o.favH),
    favC: textos(o.favC),
    notas: str(o.notas),
  };
}

/** Lo que se carga en el motor: las entradas del Excel más lo que consumen los elementos propios del gremio. */
export const entradasMotor = (f: Ficha): Entradas => ({ ...f.entradas, ...entradasConsumo(f.propio ?? []), ...entradasCategorias(f.categorias, categoriasUsadas(f.entradas)) });

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
  const sesion = parseSesion(d.sesion);
  const propio = parseElegidos(d.propio);
  const retrato = typeof d.retrato === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(d.retrato) && d.retrato.length < 400_000 ? d.retrato : undefined;
  const categorias = parseCategorias(d.categorias);
  const ocultas = Array.isArray(d.ocultas) ? [...new Set(d.ocultas.filter((x): x is string => typeof x === 'string' && /^[a-z]{2,20}$/.test(x)))] : [];
  return {
    version: VERSION,
    id: typeof d.id === 'string' ? d.id : crypto.randomUUID(),
    entradas,
    notas: typeof d.notas === 'string' ? d.notas : '',
    actualizada: typeof d.actualizada === 'string' ? d.actualizada : new Date().toISOString(),
    resumen: typeof d.resumen === 'object' && d.resumen !== null ? (d.resumen as Resumen) : undefined,
    ...(sesion ? { sesion } : {}),
    ...(propio.length ? { propio } : {}),
    ...(retrato ? { retrato } : {}),
    ...(categorias.length ? { categorias } : {}),
    ...(ocultas.length ? { ocultas } : {}),
  };
}
