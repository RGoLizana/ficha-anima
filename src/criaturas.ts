// Criaturas atadas y familiares: lógica pura (sin motor ni pantalla). Core Exxet p. 196-199 y Tabla 64.
import { CASILLAS_NIVEL, NOMBRE, nivelDe, type Ficha } from './model/ficha';
import convocatoria from './data/convocatoria.json';

const FILAS = (convocatoria as unknown as { dificultades: { filas: { nivel: number; v: number[][] }[] } }).dificultades.filas;
const CATEGORIAS = ['PDs!O7', 'PDs!O9', 'PDs!O11', 'PDs!O13', 'PDs!O15'];
const NUM_ATADAS = Array.from({ length: 28 }, (_, i) => 33 + i);
const m = (col: string, fila: number) => `Místicos!${col}${fila}`;
const texto = (f: Ficha, k: string) => String(f.entradas[k] ?? '').trim();

export const criaturasDe = (fichas: Ficha[], padre: string) => fichas.filter((f) => f.criatura?.padre === padre);

/** Criatura con un convocador que existe y que no es otra criatura (un solo nivel). */
export const convocadorDe = (fichas: Ficha[], f: Ficha) => {
  const p = f.criatura && fichas.find((x) => x.id === f.criatura!.padre);
  return p && !p.criatura ? p : undefined;
};

/** Casilla de nivel de la categoría actual: la última con categoría escrita; si no hay ninguna, la primera. */
export function casillaActual(f: Ficha) {
  const i = CATEGORIAS.reduce((x, c, j) => (texto(f, c) ? j : x), 0);
  return CASILLAS_NIVEL[i];
}

/** Cambios para que un familiar siga a su amo: suma la diferencia de nivel a su categoría actual (mínimo 0). null = nada que hacer. */
export function sincronizar(c: Ficha, nivelAmo: number): { entradas: Record<string, number>; nivelAmo: number } | null {
  const v = c.criatura;
  if (!v?.familiar || v.nivelAmo === nivelAmo) return null;
  const k = casillaActual(c);
  const actual = Number(c.entradas[k]) || 0;
  return { entradas: { [k]: Math.max(0, actual + nivelAmo - v.nivelAmo) }, nivelAmo };
}

/** Atar / recalcular: pone el nivel total de la criatura igual al del convocador, en su categoría actual. */
export function fijarNivel(c: Ficha, nivelAmo: number): Record<string, number> {
  const k = casillaActual(c);
  const resto = nivelDe(c) - (Number(c.entradas[k]) || 0);
  return { [k]: Math.max(0, nivelAmo - resto) };
}

/** Datos iniciales de una criatura nueva: mismos PD que su convocador (mismo nivel y, si la tiene, misma categoría). */
export function entradasIniciales(nombre: string, padre: Ficha): Record<string, string | number> {
  const cat = texto(padre, 'PDs!O7');
  const nivel = nivelDe(padre);
  return { [NOMBRE]: nombre, ...(cat ? { 'PDs!O7': cat } : {}), ...(nivel ? { 'PDs!S7': nivel } : {}) };
}

/** Nivel total de una criatura: lo calculado al abrirla («a + b») si lo hay y, si no, lo escrito. */
export function nivelTotal(c: Ficha) {
  const calc = c.resumen?.nivel?.match(/-?\d+/g)?.reduce((t, x) => t + Number(x), 0);
  return calc ?? nivelDe(c);
}

/** Zeón diario sugerido: atada = lo que costó atarla; familiar = la mitad de atar un ser de nivel + 2 (Core p. 198-199). null = fuera de la Tabla 64. */
export function zeonSugerido(nivel: number, familiar: boolean): number | null {
  const z = FILAS.find((x) => x.nivel === (familiar ? nivel + 2 : nivel))?.v[2][1];
  return z === undefined ? null : familiar ? z / 2 : z;
}

/** Fila (33-60) de Místicos donde el convocador ya anotó esta criatura por su nombre, o la primera libre (null = ninguna). */
export function filaAtada(padre: Ficha, nombre: string) {
  return NUM_ATADAS.find((r) => nombre && texto(padre, m('C', r)) === nombre) ?? null;
}
export function filaLibre(padre: Ficha) {
  return NUM_ATADAS.find((r) => ['C', 'H', 'J'].every((c) => !texto(padre, m(c, r)))) ?? null;
}
export const celdasAtada = (fila: number) => ({ nombre: m('C', fila), zeon: m('H', fila) });

/** Ventaja escrita en la ficha (Principal C35:J47 y C48:F49), por texto o expresión. */
export function tieneVentaja(f: Ficha, re: RegExp) {
  const celdas = (cols: string, filas: number[]) => filas.flatMap((r) => [...cols].map((c) => texto(f, `Principal!${c}${r}`)));
  return [...celdas('CDEFGHIJ', [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47]), ...celdas('CDEF', [48, 49])].some((t) => re.test(t));
}

/** Avisos de una criatura (ninguno bloquea; manda lo que escriba el jugador). */
export function avisosCriatura(c: Ficha, padre: Ficha | undefined, fichas: Ficha[]): string[] {
  const v = c.criatura;
  if (!v) return [];
  const a: string[] = [];
  if (!padre) { a.push('No tiene convocador: enlázala a un personaje para que su nivel siga al suyo.'); return a; }
  if (v.familiar) {
    const nc = nivelDe(c), np = nivelDe(padre);
    if (Math.abs(nc - np) > 1) a.push(`Core p. 198: al crear el lazo del familiar no puede haber más de un nivel de diferencia con su amo (nivel ${nc} frente a ${np}), salvo que se haya estancado.`);
    if (nc === 0 && np > 0) a.push('El nivel del familiar es 0: se queda en 0 si el convocador baja de nivel.');
    const tipo = texto(c, 'Principal!Y11');
    if (!/^(entre mundos|ánima)/i.test(tipo)) a.push(`Core p. 198: solo los seres entre mundos o espirituales pueden ser familiares${tipo ? ` («${tipo}» no lo es)` : '; indica su tipo de ser en Principal'}.`);
    if (criaturasDe(fichas, padre.id).filter((x) => x.criatura!.familiar).length > 1 && !tieneVentaja(padre, /^Sin límite de familiares/i))
      a.push('El convocador tiene varios familiares sin la ventaja «Sin límite de familiares».');
  }
  const n = nivelTotal(c);
  if (zeonSugerido(n, v.familiar) === null) a.push(`Nivel ${n}: fuera de la Tabla 64 (0 a 15), no hay zeón diario sugerido.`);
  return a;
}

/** ¿Se enseña la pestaña «Criaturas»? Con criaturas siempre; si no, solo si el personaje usa la convocatoria. `n` lee un valor calculado. */
export function mostrarPestaña(f: Ficha, fichas: Ficha[], n: (clave: string) => number): boolean {
  if (f.criatura) return false;
  if (criaturasDe(fichas, f.id).length) return true;
  const filas = [98, 99, 100, 101];
  const pd = filas.reduce((t, r) => t + ['V', 'X', 'Z'].reduce((u, c) => u + n(`PDs!${c}${r}`), 0), 0);
  return pd > 0 || [26, 27, 28, 29].some((r) => Number(f.entradas[m('L', r)])) || tieneVentaja(f, /^Familiar \(/i);
}
