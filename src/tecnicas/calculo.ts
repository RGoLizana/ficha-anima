// Técnicas de ki: modelo de una técnica (un bloque de la hoja «Creación de Técnicas») y réplica de sus cuentas.
// El asistente lee y escribe las mismas celdas que el Excel; la réplica solo sirve para la vista previa («¿cuánto costaría si…?»)
// y para repartir el ki. Lo que se muestra de la técnica ya hecha sale del Excel. tests/tecnicas.test.ts comprueba que coinciden.
import datos from '../data/tecnicas.json';

export const CAR = ['AGI', 'CON', 'DES', 'FUE', 'POD', 'VOL'] as const;
export type Car = (typeof CAR)[number];
export type Reparto = Partial<Record<Car, number>>;
export const NOM_CAR: Record<Car, string> = { AGI: 'Agilidad', CON: 'Constitución', DES: 'Destreza', FUE: 'Fuerza', POD: 'Poder', VOL: 'Voluntad' };

export type Opcion = [string, number, number, number, number, number, number, number]; // etiqueta, ki prim., ki sec., CM, mant., sost. menor, sost. mayor, nivel
export interface DatosEfecto { n: string; c: string; t: string; k: string; p: Car; o: Reparto; e: string[]; b: Opcion | null; g: Opcion[]; x: Opcion[] }
export interface DatosDesv { n: string; k: string; o: [string, number, number][] }
export const EFECTOS = datos.efectos as DatosEfecto[];
export const DESVENTAJAS = datos.desventajas as DatosDesv[];
const minus = (s: string) => s.toLowerCase();
export const efecto = (n: string) => EFECTOS.find((e) => minus(e.n) === minus(n));
export const desventaja = (n: string) => DESVENTAJAS.find((d) => minus(d.n) === minus(n));

export const BASES = [12, 46, 80, 114, 148, 183, 217, 251, 285, 319];
export const COLS_ACTIVAR = ['V', 'X', 'Z', 'AB', 'AD', 'AF'];
export const COLS_MANTENER = ['W', 'Y', 'AA', 'AC', 'AE', 'AG'];
export const COLS_OPCION = ['D', 'J', 'P', 'V', 'AB'];
export const CM_MIN: Record<number, number> = { 1: 20, 2: 40, 3: 60 };
export const CM_MAX: Record<number, number> = { 1: 50, 2: 100, 3: 200 };
export const MAX_EFECTOS = 5;
export const MAX_DESV = 3;
export const DURACIONES = ['-', 'Mantenido', 'Sostenimiento Menor', 'Sostenimiento Mayor'] as const;
export type Duracion = (typeof DURACIONES)[number];
export const HOJA = 'Creación de Técnicas';
const celda = (c: string, fila: number) => `${HOJA}!${c}${fila}`;
export const NOMBRE_POR_DEFECTO = 'Nombre de la técnica';

export interface Efecto { n: string; rol: 'Primario' | 'Secundario'; g: number; x: number[]; dur: Duracion; ki: Reparto; kiM: Reparto }
export interface Desv { n: string; o: number; el: [string, string] }
export interface Tecnica {
  nombre: string; nivel: number; comb: boolean; efectos: Efecto[]; desv: Desv[];
  redKi: number;            // 0..5 (la celda guarda −redKi)
  redCM: number;            // 0..20 (la celda guarda −redCM)
  mods: Reparto;            // fila «Mod.» de las desventajas: reparte el ajuste de ki por característica
  desc: string;
  sinSoporte: string[];     // efectos o desventajas que no están en las tablas oficiales (personalizados): solo se editan en modo experto
}
export interface Contexto { acum: Record<Car, number>; legado: string[] }

export const vacia = (): Tecnica => ({ nombre: '', nivel: 1, comb: false, efectos: [], desv: [], redKi: 0, redCM: 0, mods: {}, desc: '', sinSoporte: [] });
export const copia = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const nuevoEfecto = (n: string, rol: Efecto['rol'] = 'Secundario'): Efecto => ({ n, rol, g: efecto(n)?.g.length ? 0 : -1, x: [], dur: '-', ki: {}, kiM: {} });

// ---------- leer y escribir las celdas del bloque ----------
type Get = (clave: string) => unknown;
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const texto = (v: unknown) => (v === undefined || v === null ? '' : String(v));

/** Lee el bloque que empieza en la fila b a partir de lo que ha escrito el jugador. */
export function leer(get: Get, b: number): Tecnica {
  const t = vacia();
  t.nombre = texto(get(celda('D', b))) === NOMBRE_POR_DEFECTO ? '' : texto(get(celda('D', b)));
  t.nivel = [1, 2, 3].includes(num(get(celda('P', b)))) ? num(get(celda('P', b))) : 1;
  t.comb = texto(get(celda('S', b))) === 'Sí';
  t.desc = texto(get(celda('D', b + 25)));
  for (let i = 0; i < MAX_EFECTOS; i++) {
    const n = texto(get(celda('F', b + 4 + i)));
    if (!n) continue;
    const d = efecto(n);
    if (!d) { t.sinSoporte.push(n); continue; }
    const e = nuevoEfecto(d.n, texto(get(celda('D', b + 4 + i))) === 'Secundario' ? 'Secundario' : i === 0 ? 'Primario' : 'Secundario');
    if (texto(get(celda('D', b + 4 + i))) === 'Primario') e.rol = 'Primario';
    e.g = -1;
    for (let r = b + 17; r <= b + 23; r++) {
      const et = texto(get(celda(COLS_OPCION[i], r)));
      const gi = et ? d.g.findIndex((g) => g[0] === et) : -1;
      if (gi >= 0 && e.g < 0) e.g = gi;
      else { const xi = et ? d.x.findIndex((x) => x[0] === et) : -1; if (xi >= 0 && !e.x.includes(xi)) e.x.push(xi); }
    }
    const dur = texto(get(celda('K', b + 4 + i)));
    e.dur = (DURACIONES as readonly string[]).includes(dur) ? (dur as Duracion) : '-';
    CAR.forEach((c, k) => {
      const a = num(get(celda(COLS_ACTIVAR[k], b + 4 + i))), m = num(get(celda(COLS_MANTENER[k], b + 4 + i)));
      if (a) e.ki[c] = a;
      if (m) e.kiM[c] = m;
    });
    t.efectos.push(e);
  }
  for (let k = 0; k < MAX_DESV; k++) {
    const n = texto(get(celda('F', b + 9 + k)));
    if (!n) continue;
    const d = desventaja(n);
    if (!d) { t.sinSoporte.push(n); continue; }
    const et = texto(get(celda('K', b + 9 + k)));
    t.desv.push({ n: d.n, o: Math.max(0, d.o.findIndex((o) => o[0] === et)), el: [texto(get(celda('O', b + 9 + k))), texto(get(celda('Q', b + 9 + k)))] });
  }
  t.redKi = Math.abs(num(get(celda('Y', b + 9))));
  t.redCM = Math.abs(num(get(celda('AC', b + 9))));
  CAR.forEach((c, k) => { const m = num(get(celda(COLS_ACTIVAR[k], b + 11))); if (m) t.mods[c] = m; });
  return t;
}

/** Todas las celdas que gestiona el asistente para este bloque (null = vacía, vuelve al valor de la plantilla). */
export function celdas(t: Tecnica, b: number): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  const poner = (c: string, fila: number, v: string | number | null) => { out[celda(c, fila)] = v === '' || v === 0 ? null : v; };
  poner('D', b, t.nombre); out[celda('P', b)] = t.nivel; poner('S', b, t.comb ? 'Sí' : null); poner('D', b + 25, t.desc);
  for (let i = 0; i < MAX_EFECTOS; i++) {
    const e = t.efectos[i], fila = b + 4 + i, d = e && efecto(e.n);
    poner('D', fila, e ? e.rol : null); poner('F', fila, e ? e.n : null); poner('K', fila, e && e.dur !== '-' ? e.dur : null);
    CAR.forEach((c, k) => { poner(COLS_ACTIVAR[k], fila, e?.ki[c] ?? 0); poner(COLS_MANTENER[k], fila, e?.kiM[c] ?? 0); });
    const ops = e && d ? [...(e.g >= 0 ? [d.g[e.g][0]] : []), ...e.x.map((j) => d.x[j][0])] : [];
    for (let r = 0; r < 7; r++) poner(COLS_OPCION[i], b + 17 + r, ops[r] ?? null);
  }
  for (let k = 0; k < MAX_DESV; k++) {
    const x = t.desv[k], fila = b + 9 + k, d = x && desventaja(x.n);
    poner('F', fila, x ? x.n : null); poner('K', fila, x && d ? d.o[x.o][0] : null);
    poner('O', fila, x?.el[0] || null); poner('Q', fila, x?.el[1] || null);
  }
  poner('Y', b + 9, -t.redKi); poner('AC', b + 9, -t.redCM);
  CAR.forEach((c, k) => poner(COLS_ACTIVAR[k], b + 11, t.mods[c] ?? 0));
  return out;
}

// ---------- cuentas ----------
const suma = (f: Opcion[], k: number) => f.reduce((a, r) => a + (Number(r[k]) || 0), 0);
/** Filas de la tabla que suma el Excel: la fila sin nombre del efecto (si la tiene), el grado elegido y los extras. */
export const filasDe = (e: Efecto): Opcion[] => { const d = efecto(e.n)!; return [...(d.b ? [d.b] : []), ...(e.g >= 0 ? [d.g[e.g]] : []), ...e.x.map((j) => d.x[j])]; };
const nOpcionesEstado = (e: Efecto) => filasDe(e).filter((r) => r[0].startsWith('Estado añadido:')).length;

/** Ki base de un efecto (sin recargo por características opcionales): primario o secundario + sostenimiento + mantenimiento. */
function kiBase(e: Efecto, rol: Efecto['rol']) {
  const f = filasDe(e);
  return suma(f, rol === 'Primario' ? 1 : 2) + (e.dur === 'Sostenimiento Menor' ? suma(f, 5) : e.dur === 'Sostenimiento Mayor' ? suma(f, 6) : 0) + (e.dur === 'Mantenido' ? suma(f, 4) : 0);
}
const recargo = (e: Efecto) => { const o = efecto(e.n)!.o; return CAR.reduce((a, c) => a + ((e.ki[c] ?? 0) !== 0 ? o[c] ?? 0 : 0), 0); };
const mantNecesario = (e: Efecto) => (e.dur === 'Mantenido' ? suma(filasDe(e), 4) : 0);
const esLegado = (e: Efecto, ctx: Contexto) => efecto(e.n)!.e.some((x) => ctx.legado.includes(x));

/** Ajuste de ki que reparten las desventajas (fila «Mod.»): reducción de ki, de CM y combinable. */
export const ajusteKi = (t: Tecnica) => -t.redKi + Math.round((t.redCM * 2) / 5) + (t.comb ? 3 * t.nivel : 0);

export interface Calculo {
  efectos: { e: Efecto; i: number; cm: number; ki: number; puesto: number; mant: number; mantPuesto: number; nivel: number }[];
  desv: { x: Desv; cm: number; nivel: number }[];
  cmEfectos: number; cmDesv: number; cmDuracion: number; cmSuma: number; cm: number;
  kiNec: number; kiPuesto: number; mantNec: number; mantPuesto: number;
  porCar: Record<Car, number>; asaltosCar: Record<Car, number>; asaltos: number; mantAsalto: number;
}

export function calcular(t: Tecnica, ctx: Contexto): Calculo {
  const L = t.nivel;
  const efectos = t.efectos.map((e, i) => {
    const f = filasDe(e), bruto = suma(f, 3);
    const ki = kiBase(e, e.rol) + recargo(e) + (nOpcionesEstado(e) - 1) * nOpcionesEstado(e);
    return { e, i, cm: bruto > 0 && esLegado(e, ctx) ? Math.max(5, bruto - 5) : bruto, ki,
      puesto: CAR.reduce((a, c) => a + (e.ki[c] ?? 0), 0), mant: mantNecesario(e), mantPuesto: CAR.reduce((a, c) => a + (e.kiM[c] ?? 0), 0),
      nivel: Math.max(1, ...f.map((r) => r[7] || 0)) };
  });
  const desv = t.desv.map((x) => { const o = desventaja(x.n)!.o[x.o]; return { x, cm: o[1], nivel: o[2] }; });
  const durs = t.efectos.map((e) => e.dur);
  const cmDuracion = (durs.includes('Mantenido') ? 10 * L : 0) + (durs.includes('Sostenimiento Menor') ? 20 * L : 0) + (durs.includes('Sostenimiento Mayor') ? 30 * L : 0);
  const cmEfectos = efectos.reduce((a, x) => a + x.cm, 0), cmDesv = desv.reduce((a, x) => a + x.cm, 0);
  const cmSuma = cmEfectos + cmDesv + 10 * t.redKi - t.redCM + (t.comb ? 10 * L : 0) + cmDuracion;
  const porCar = Object.fromEntries(CAR.map((c) => [c, 0])) as Record<Car, number>;
  t.efectos.forEach((e) => CAR.forEach((c) => { porCar[c] += e.ki[c] ?? 0; }));
  const kiEfectos = efectos.reduce((a, x) => a + x.puesto, 0);
  CAR.forEach((c) => { porCar[c] += t.mods[c] ?? 0; });
  const usadas = CAR.filter((c) => t.efectos.reduce((a, e) => a + (e.ki[c] ?? 0), 0) > 0).length;
  const hayMods = CAR.some((c) => (t.mods[c] ?? 0) < 0) || t.redKi > 0;
  const kiNec = Math.max(0, efectos.reduce((a, x) => a + x.ki, 0) + Math.abs((-t.redCM * 2) / 5)) + (usadas < 3 && hayMods ? 0 : -t.redKi) + (t.comb ? 3 * L : 0);
  const mantNec = durs.includes('Mantenido') ? Math.max(0, efectos.reduce((a, x) => a + x.mant, 0)) : 0;
  return { efectos, desv, cmEfectos, cmDesv, cmDuracion, cmSuma, cm: Math.max(CM_MIN[L], cmSuma), kiNec,
    kiPuesto: kiEfectos + CAR.reduce((a, c) => a + (t.mods[c] ?? 0), 0), mantNec, mantPuesto: efectos.reduce((a, x) => a + x.mantPuesto, 0),
    porCar, asaltosCar: Object.fromEntries(CAR.map((c) => [c, porCar[c] > 0 ? Math.ceil(porCar[c] / Math.max(1, ctx.acum[c])) : 0])) as Record<Car, number>,
    asaltos: Math.max(0, ...CAR.map((c) => (porCar[c] > 0 ? Math.ceil(porCar[c] / Math.max(1, ctx.acum[c])) : 0))),
    mantAsalto: efectos.reduce((a, x) => a + x.mant, 0) };
}

// ---------- reparto automático del ki ----------
export type ModoReparto = 'barato' | 'rapido';

/** Reparte el ki de un efecto. «barato»: todo en su característica principal. «rapido»: la combinación de características
 *  opcionales (con su recargo) que se acumula en menos asaltos con la acumulación del personaje y lo ya puesto en otros efectos. */
export function repartir(e: Efecto, rol: Efecto['rol'], carga: Reparto, modo: ModoReparto, ctx: Contexto): Reparto {
  const d = efecto(e.n)!, base = kiBase(e, rol) + (nOpcionesEstado(e) - 1) * nOpcionesEstado(e);
  if (modo === 'barato') return base > 0 ? { [d.p]: base } : {};
  const opts = (Object.keys(d.o) as Car[]);
  let mejor: { t: number; coste: number; x: Reparto } | null = null;
  for (let m = 0; m < 1 << opts.length; m++) {
    const S = opts.filter((_, i) => (m >> i) & 1), cars = [d.p, ...S];
    const coste = base + S.reduce((a, c) => a + (d.o[c] ?? 0), 0);
    for (let n = 1; n <= 80; n++) {
      let resto = coste; const x: Reparto = {};
      for (const c of cars) { const v = Math.min(resto, Math.max(0, n * ctx.acum[c] - (carga[c] ?? 0))); x[c] = v; resto -= v; }
      if (resto > 0) continue;
      if (S.some((c) => !x[c])) break;
      if (!mejor || n < mejor.t || (n === mejor.t && coste < mejor.coste)) mejor = { t: n, coste, x };
      break;
    }
  }
  const x = mejor ? mejor.x : { [d.p]: base };
  return Object.fromEntries(Object.entries(x).filter(([, v]) => v)) as Reparto;
}

const mismo = (a: Reparto, b: Reparto) => CAR.every((c) => (a[c] ?? 0) === (b[c] ?? 0));
const sumaReparto = (r: Reparto) => CAR.reduce((a, c) => a + (r[c] ?? 0), 0);

/** Cómo está repartido el ki de cada efecto: el modo automático que reproduce o null si lo ha escrito a mano. Vacío cuenta como automático. */
export function modos(t: Tecnica, ctx: Contexto, defecto: ModoReparto): (ModoReparto | null)[] {
  const carga: Reparto = {};
  return t.efectos.map((e) => {
    const barato = repartir(e, e.rol, carga, 'barato', ctx), rapido = repartir(e, e.rol, carga, 'rapido', ctx);
    const m = sumaReparto(e.ki) === 0 ? defecto : mismo(e.ki, rapido) && !mismo(e.ki, barato) ? 'rapido' : mismo(e.ki, barato) ? 'barato' : null;
    CAR.forEach((c) => { carga[c] = (carga[c] ?? 0) + (e.ki[c] ?? 0); });
    return m;
  });
}

/** Deja la técnica coherente tras un cambio: el primer efecto es el primario, el ki automático se recalcula (el que alguien ha
 *  escrito a mano se conserva), el mantenimiento y el ajuste de las desventajas se reparten. `antes` es la técnica antes del cambio. */
export function normalizar(antes: Tecnica | null, t: Tecnica, ctx: Contexto, defecto: ModoReparto): Tecnica {
  const previos = antes ? modos(antes, ctx, defecto) : [];
  t.efectos.forEach((e, i) => { e.rol = i === 0 ? 'Primario' : 'Secundario'; });
  const carga: Reparto = {};
  t.efectos.forEach((e, i) => {
    const a = antes?.efectos[i];
    // automático si es nuevo, está vacío o no se ha tocado y ya era automático; lo que se ha cambiado a mano (o con un botón de reparto) se conserva
    const previo = !a || a.n !== e.n || !sumaReparto(e.ki) ? defecto : mismo(a.ki, e.ki) ? previos[i] : null;
    if (previo) e.ki = repartir(e, e.rol, carga, previo, ctx);
    const d = efecto(e.n)!, mant = mantNecesario(e);
    if (sumaReparto(e.kiM) !== mant) e.kiM = mant ? { [d.p]: mant } : {};
    CAR.forEach((c) => { carga[c] = (carga[c] ?? 0) + (e.ki[c] ?? 0); });
  });
  const dondeEstaba = CAR.filter((c) => t.mods[c]);
  if (dondeEstaba.length <= 1) {
    const ajuste = ajusteKi(t), donde = dondeEstaba[0] ?? (t.efectos[0] ? efecto(t.efectos[0].n)!.p : undefined);
    t.mods = ajuste && donde ? { [donde]: ajuste } : {};
  }
  return t;
}

/** Característica sobre la que cae el ajuste de ki (por defecto la principal del primer efecto). */
export const carAjuste = (t: Tecnica): Car | undefined => CAR.find((c) => t.mods[c]) ?? (t.efectos[0] ? efecto(t.efectos[0].n)!.p : undefined);

/** Lee «Ki!D12…» de la ficha: lo que acumula cada característica por asalto. */
export function acumulacion(texto: string): Record<Car, number> {
  const acum = Object.fromEntries(CAR.map((c) => [c, 1])) as Record<Car, number>;
  for (const m of texto.matchAll(/(AGI|CON|DES|FUE|POD|VOL)\s+(\d+)/g)) acum[m[1] as Car] = Number(m[2]) || 1;
  return acum;
}

/** Elementos con «Empatía Elemental» en las ventajas del personaje (rebaja 5 CM los efectos de ese elemento). */
export const elementosLegado = (texto: string) => [...texto.matchAll(/Empatía Elemental \(([^)]+)\)/g)].map((m) => m[1]);
