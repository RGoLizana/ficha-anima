// Poderes psíquicos mantenidos (innatos): nivel al que se mantienen y CV libres para subir al siguiente.
// Réplica de Psíquicos!AK17 (manda el Excel) con las reglas del Core Exxet p. 212-213; datos de tools/export_mantenidos_psi.py.
import datos from '../data/mantenidos-psi.json';

export type PoderMantenible = { n: string; d: string; l: number; min: number; f: (string | null)[] };
export const { umbrales: UMBRALES, niveles: NIVELES, porCV: POR_CV, maxCV: MAX_CV } = datos;
export const VENTAJAS = datos.ventajas;
export const MANTENIBLES = datos.poderes as PoderMantenible[];

/** Índice en NIVELES del potencial (0 = «-», 1 = RUT…), como SUMPRODUCT(--(Tablas!T26:T38<=x)) del Excel. */
export const nivelDe = (potencial: number) => Math.max(1, UMBRALES.filter((u) => u <= potencial).length) - 1;
/** Índice en NIVELES de un texto «MED», «DIF»… (−1 si no lo es). */
export const indiceDe = (nivel: string) => NIVELES.indexOf(nivel);

export type Innato = {
  /** Potencial del poder sin los CV de incrementar (Psíquicos!AL − 20·AI: potencial + Fortalecer + Otros). */
  nat: number;
  /** CV libres puestos en «Incrementar un innato» (Psíquicos!AI). */
  cv: number;
  /** Niveles extra por ventajas (Mantenimiento añadido, Introversión): solo suben el nivel natural, no el de los CV. */
  bono: number;
  /** Dificultad mínima del poder (índice en NIVELES). */
  min: number;
};

/** Nivel al que se mantiene: el mayor entre la mínima del poder, el natural + ventajas y el incrementado con CV. */
export const nivelMantenido = ({ nat, cv, bono, min }: Innato) =>
  Math.min(NIVELES.length - 1, Math.max(min, nivelDe(nat) + bono, nivelDe(nat + POR_CV * cv)));

/** Mínimo de CV (en total y extra) para el siguiente nivel; null si ni con el máximo de CV sube. */
export function siguiente(i: Innato): { cv: number; extra: number; nivel: number } | null {
  const ahora = nivelMantenido(i);
  for (let cv = Math.max(0, i.cv) + 1; cv <= MAX_CV; cv++) {
    const nivel = nivelMantenido({ ...i, cv });
    if (nivel > ahora) return { cv, extra: cv - Math.max(0, i.cv), nivel };
  }
  return null;
}

/** Efecto del poder en un nivel (NIVELES[1] = RUT = f[0]). */
export const efecto = (p: PoderMantenible | undefined, nivel: number) => (p && nivel >= 1 ? p.f[nivel - 1] ?? '' : '');
export const mantenible = (nombre: string) => MANTENIBLES.find((p) => p.n === nombre);

type Leer = (clave: string) => string;
const celdas = (hoja: string, cols: string[], filas: number[]) => cols.flatMap((c) => filas.map((r) => `${hoja}!${c}${r}`));
const rango = (a: number, b: number, paso = 1) => Array.from({ length: Math.floor((b - a) / paso) + 1 }, (_, i) => a + i * paso);
const COLS = (a: string, b: string) => rango(a.charCodeAt(0), b.charCodeAt(0)).map((c) => String.fromCharCode(c));

/** Ventajas de la ficha que suben el nivel natural de los innatos, igual que Psíquicos!AK17:
 *  Mantenimiento añadido (Tablas!G453: Principal C35:J47 y C48:F49; Tablas!H1393: Principal AM12:AM23) e Introversión (Psíquicos C39:E50). */
export function ventajasDe(leer: Leer): (typeof VENTAJAS)[number][] {
  const es = (t: string) => (k: string) => leer(k).toLowerCase() === t.toLowerCase();
  const principal = [...celdas('Principal', COLS('C', 'J'), rango(35, 47)), ...celdas('Principal', COLS('C', 'F'), [48, 49]), ...celdas('Principal', ['AM'], rango(12, 23))];
  const patrones = celdas('Psíquicos', COLS('C', 'E'), rango(39, 50));
  const tiene = [
    principal.some(es('Mantenimiento añadido')),
    patrones.filter(es('Introversión')).length > patrones.filter(es('Cancelación: Introversión')).length,
  ];
  return VENTAJAS.filter((_, i) => tiene[i]);
}
export const bonoDe = (vs: { efecto: number }[]) => vs.reduce((t, v) => t + v.efecto, 0);

const num = (x: string) => Number(x) || 0;
const p = (col: string, fila: number) => `Psíquicos!${col}${fila}`;

/** Innatos activos de la ficha (Psíquicos AD17…AD61): potencial sin los CV de incrementar y nivel que da el Excel (AK). */
export function innatosDe(leer: Leer) {
  return rango(17, 61, 2).filter((r) => leer(p('AD', r))).map((r) => {
    const n = leer(p('AD', r));
    const cv = num(leer(p('AI', r)));
    return { fila: r, n, cv, nat: num(leer(p('AL', r))) - POR_CV * cv, excel: indiceDe(leer(p('AK', r))), poder: mantenible(n) };
  });
}

/** Poderes dominados (Psíquicos V11…V63) que se pueden mantener, con su potencial (H11 + Fortalecer, como Psíquicos!AL). */
export function dominadosMantenibles(leer: Leer) {
  return rango(11, 63, 2).map((r) => ({ n: leer(p('V', r)), nat: num(leer(p('H', 11))) + num(leer(p('AB', r))) }))
    .flatMap((x) => { const poder = mantenible(x.n); return poder ? [{ ...x, poder }] : []; });
}

/** Avisos (no bloquean): más innatos activos que comprados, CV de incrementar por encima de los libres o del máximo. */
export function avisos({ activos, innatos, cvIncr, cvLibres, porPoder }: { activos: number; innatos: number; cvIncr: number; cvLibres: number; porPoder: number[] }) {
  const a: string[] = [];
  if (activos > innatos) a.push(`Mantienes ${activos} ${activos === 1 ? 'poder' : 'poderes'} y tienes ${innatos} ${innatos === 1 ? 'innato' : 'innatos'}.`);
  if (cvIncr > cvLibres) a.push(`Los CV para incrementar innatos (${cvIncr}) superan tus CV libres (${cvLibres}).`);
  if (porPoder.some((x) => x > MAX_CV)) a.push(`No se pueden poner más de ${MAX_CV} CV en incrementar un mismo innato (Core p. 213).`);
  return a;
}
