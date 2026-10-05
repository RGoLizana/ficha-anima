// Categorías (clases) propias o modificadas de un gremio. Una categoría del Excel es una fila de «Tablas» (D202:CG223) con sus costes en PD,
// límites, bonos por nivel y arquetipos; todo el Excel la busca por NOMBRE. Como no hay filas libres, una categoría propia usa EN ESA FICHA una
// fila de una oficial que el personaje no tiene: sus valores se escriben como entradas del motor, igual que el consumo de gremio. No se toca
// ninguna fórmula; sin categorías propias no se escribe nada y todo da exactamente lo mismo que antes.
import datos from '../data/categorias.json';

export type Valores = Record<string, number | string>;
export interface CategoriaGremio {
  n: string;
  oficial: boolean;     // true = modifica una oficial (n es su nombre); false = categoría nueva
  base: string;         // de qué oficial se copió (solo informativo)
  v: Valores;           // valor por COLUMNA de Tablas (E..CG)
  nota: string;
}
export interface Columna { c: string; l: string }
export interface Oficial { n: string; fila: number; v: Valores }

export const COLUMNAS = datos.cols as Columna[];
export const OFICIALES = datos.oficiales as unknown as Oficial[];
export const ARQUETIPOS = ['Luchador', 'Místico', 'Psíquico', 'Acechador', 'Domine', 'Sin'];
export const COLS_TEXTO = ['CF', 'CG'];
/** Casillas de PDs donde se elige la categoría de cada nivel (hasta 5). */
export const CASILLAS_CATEGORIA = ['PDs!O7', 'PDs!O9', 'PDs!O11', 'PDs!O13', 'PDs!O15'];
const FILA_PRIMERA = 202, FILA_ULTIMA = 223;
const minus = (s: string) => s.toLowerCase().trim();

export const oficialDe = (n: string) => OFICIALES.find((o) => minus(o.n) === minus(n));

/** Texto del problema, o '' si el nombre vale. Es integridad de datos (el Excel busca por nombre con comodines), no una regla del juego. */
export function validarNombre(n: string, otras: string[]): string {
  const t = n.trim();
  if (!t) return 'Ponle un nombre.';
  if (/[*?~]/.test(t) || /^[<>=]/.test(t)) return 'El nombre no puede llevar * ? ~ ni empezar por < > = (el Excel los usa como comodines).';
  if (oficialDe(t)) return `«${t}» ya es una categoría oficial.`;
  if (otras.some((x) => minus(x) === minus(t))) return `Ya hay una categoría «${t}».`;
  return '';
}

/** Copia de una oficial como punto de partida de una categoría nueva (o como su modificación). */
export function categoriaDesde(base: string, n: string, oficial = false): CategoriaGremio {
  const o = oficialDe(base) ?? OFICIALES[0];
  return { n: oficial ? o.n : n.trim(), oficial, base: o.n, v: { ...o.v }, nota: '' };
}

const objeto = (x: unknown): Record<string, unknown> => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

/** Valida una categoría guardada: lo que no encaja se descarta; null si no es una categoría. */
export function parseCategoria(d: unknown): CategoriaGremio | null {
  const o = objeto(d);
  const n = typeof o.n === 'string' ? o.n.trim() : '';
  if (!n) return null;
  const oficial = o.oficial === true;
  if (oficial ? !oficialDe(n) : validarNombre(n, [])) return null;
  const v: Valores = {};
  const crudo = objeto(o.v);
  for (const { c } of COLUMNAS) {
    const x = crudo[c];
    if (COLS_TEXTO.includes(c)) { if (typeof x === 'string' && ARQUETIPOS.includes(x)) v[c] = x; }
    else if (typeof x === 'number' && Number.isFinite(x)) v[c] = x;
  }
  return { n: oficial ? oficialDe(n)!.n : n, oficial, base: typeof o.base === 'string' ? o.base : '', v, nota: typeof o.nota === 'string' ? o.nota : '' };
}
export const parseCategorias = (d: unknown): CategoriaGremio[] => (Array.isArray(d) ? d.map(parseCategoria).filter((c): c is CategoriaGremio => c !== null) : []);

/** Nombres de las categorías que tiene elegidas el personaje (PDs!O7…O15). */
export const categoriasUsadas = (entradas: Record<string, unknown>) => CASILLAS_CATEGORIA.map((c) => String(entradas[c] ?? '').trim()).filter(Boolean);

/** Celdas de «Tablas» que hay que escribir en el motor para que el personaje calcule con sus categorías de gremio. {} si no hay ninguna en uso.
 *  - Oficial modificada en uso: sobrescribe las columnas que cambia en su propia fila.
 *  - Propia en uso: ocupa una fila de oficial que el personaje no usa (de la última hacia arriba) con TODOS sus valores (vacío → 0). */
export function entradasCategorias(cats: CategoriaGremio[] | undefined, usadas: string[]): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  if (!cats?.length) return out;
  const enUso = new Set(usadas.map(minus));
  const reservadas = new Set<number>();
  for (const o of OFICIALES) if (enUso.has(minus(o.n))) reservadas.add(o.fila);
  for (const c of cats.filter((x) => x.oficial && enUso.has(minus(x.n)))) {
    const o = oficialDe(c.n)!;
    for (const [col, val] of Object.entries(c.v)) if (val !== o.v[col]) out[`Tablas!${col}${o.fila}`] = val;
  }
  for (const c of cats.filter((x) => !x.oficial && enUso.has(minus(x.n)))) {
    let fila = FILA_ULTIMA;
    while (fila >= FILA_PRIMERA && reservadas.has(fila)) fila--;
    if (fila < FILA_PRIMERA) continue;      // imposible: como mucho 5 en uso
    reservadas.add(fila);
    out[`Tablas!D${fila}`] = c.n;
    for (const { c: col } of COLUMNAS) out[`Tablas!${col}${fila}`] = c.v[col] ?? (COLS_TEXTO.includes(col) ? 'Sin' : 0);
  }
  return out;
}

/** Fila que ocupa cada categoría propia en uso (para avisar de qué oficial se sustituye en el Excel exportado). */
export function sustituciones(cats: CategoriaGremio[] | undefined, usadas: string[]): { propia: string; oficial: string }[] {
  const e = entradasCategorias(cats, usadas);
  return Object.entries(e).filter(([k]) => /^Tablas!D\d+$/.test(k)).map(([k, n]) => ({ propia: String(n), oficial: OFICIALES.find((o) => o.fila === Number(k.slice(8)))?.n ?? '' }));
}
