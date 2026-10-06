// Una ficha guarda SOLO lo que introduce el jugador, como en el Excel: {"Hoja!Celda": valor}.
// Todo lo demás lo calcula el motor de fórmulas (src/engine) con la plantilla 8.7.0.
import type { Entrada, Entradas } from '../engine/libro';
import { entradasConsumo, parseElegidos, type Elegido } from '../gremio/modelo';
import { categoriasUsadas, entradasCategorias, parseCategorias, type CategoriaGremio } from '../gremio/categorias';
import { parseProgramado, type Programado } from '../nivel';

export const VERSION = 2;
export const NOMBRE = 'General!F22';

/** Copia de unos pocos valores calculados, solo para pintar la lista de fichas sin cargar el motor. */
export interface Resumen {
  categoria?: string;
  nivel?: string;
  raza?: string;
  stats?: { k: string; v: string | number }[];
}

/** Enlace de una criatura atada con su convocador. Sin este campo, la ficha es un personaje normal. */
export interface Vinculo {
  padre: string;      // id del convocador
  familiar: boolean;  // true: sube con el convocador; false: atada o estancada, nivel fijo
  nivelAmo: number;   // nivel del convocador la última vez que se sincronizó
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
  /** Si es una criatura atada o familiar de otro personaje (el convocador). */
  criatura?: Vinculo;
  /** Qué bloques del modo juego se ven y en qué orden (por personaje). Solo afecta a la vista: no toca `entradas`. */
  vistaJuego?: VistaJuego;
  /** Cambio de categoría programado: reserva PD sin cambiar de categoría ni de nivel hasta que se aplica. No entra en el motor. */
  programado?: Programado;
}

export interface VistaJuego { ocultos: string[]; orden: string[] }

/** Casillas de nivel de cada categoría de PDs (la suma es el nivel del personaje). */
export const CASILLAS_NIVEL = ['PDs!S7', 'PDs!S9', 'PDs!S11', 'PDs!S13', 'PDs!S15'];
/** Nivel total escrito en la ficha (sin motor). */
export const nivelDe = (f: Ficha) => CASILLAS_NIVEL.reduce((t, c) => t + (Number(f.entradas[c]) || 0), 0);

export const RECURSOS = ['pv', 'zeon', 'ki', 'cv', 'cans', 'acc'] as const;
export type Recurso = (typeof RECURSOS)[number];

export interface Sesion {
  /** Valor actual de cada recurso; si falta, vale lo de la ficha. */
  r: Partial<Record<Recurso, number>>;
  /** Ki actual de cada característica (solo con el ki sin unificar); si falta una, vale su máximo. */
  kc?: Partial<Record<string, number>>;
  asalto: number;
  efectos: { n: string; a: number | null; m: number; nota: string }[]; // a = asaltos restantes (null = sin fin)
  conts: { n: string; v: number }[];
  mant: { n: string; m: number }[];
  /** Poderes psíquicos mantenidos como innatos y CV libres puestos en incrementarlos (Core p. 212-213). */
  mantPsi?: { n: string; cv: number }[];
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
    ...(typeof o.kc === 'object' && o.kc !== null ? { kc: Object.fromEntries(['AGI', 'CON', 'DES', 'FUE', 'POD', 'VOL'].filter((k) => num((o.kc as Record<string, unknown>)[k]) !== undefined).map((k) => [k, (o.kc as Record<string, unknown>)[k]])) as Sesion['kc'] } : {}),
    asalto: num(o.asalto) ?? 1,
    efectos: objetos(o.efectos).map((e) => ({ n: str(e.n), a: num(e.a) ?? null, m: num(e.m) ?? 0, nota: str(e.nota) })),
    conts: objetos(o.conts).map((c) => ({ n: str(c.n), v: num(c.v) ?? 0 })),
    mant: objetos(o.mant).map((m) => ({ n: str(m.n), m: num(m.m) ?? 0 })),
    ...(Array.isArray(o.mantPsi) ? { mantPsi: objetos(o.mantPsi).filter((m) => str(m.n)).map((m) => ({ n: str(m.n), cv: Math.max(0, Math.round(num(m.cv) ?? 0)) })) } : {}),
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
  const ids = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((t): t is string => typeof t === 'string' && /^[a-z0-9:.-]{1,40}$/i.test(t)))] : []);
  const vj = typeof d.vistaJuego === 'object' && d.vistaJuego !== null ? (d.vistaJuego as Record<string, unknown>) : undefined;
  const vistaJuego: VistaJuego | undefined = vj && (ids(vj.ocultos).length || ids(vj.orden).length) ? { ocultos: ids(vj.ocultos), orden: ids(vj.orden) } : undefined;
  const id = typeof d.id === 'string' ? d.id : crypto.randomUUID();
  const v = typeof d.criatura === 'object' && d.criatura !== null ? (d.criatura as Record<string, unknown>) : undefined;
  const criatura: Vinculo | undefined = v && typeof v.padre === 'string' && v.padre && v.padre !== id && num(v.nivelAmo) !== undefined
    ? { padre: v.padre, familiar: v.familiar === true, nivelAmo: v.nivelAmo as number } : undefined;
  const programado = parseProgramado(d.programado);
  return {
    version: VERSION,
    id,
    entradas,
    notas: typeof d.notas === 'string' ? d.notas : '',
    actualizada: typeof d.actualizada === 'string' ? d.actualizada : new Date().toISOString(),
    resumen: typeof d.resumen === 'object' && d.resumen !== null ? (d.resumen as Resumen) : undefined,
    ...(sesion ? { sesion } : {}),
    ...(propio.length ? { propio } : {}),
    ...(retrato ? { retrato } : {}),
    ...(categorias.length ? { categorias } : {}),
    ...(ocultas.length ? { ocultas } : {}),
    ...(criatura ? { criatura } : {}),
    ...(vistaJuego ? { vistaJuego } : {}),
    ...(programado ? { programado } : {}),
  };
}
