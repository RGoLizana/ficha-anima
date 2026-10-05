// Contenido propio de un gremio: vías/subvías, disciplinas psíquicas y Ars Magnus que no están en las tablas del Excel.
// Se guarda en una biblioteca compartible (JSON, global en este navegador). Cada ficha elige qué tiene (`Elegido`) y cada
// elemento elegido solo CONSUME: nivel de vía, CV, CM y PD. No se tocan las tablas de la plantilla.
import { parseCategorias, type CategoriaGremio } from './categorias';

export interface ConjuroPropio {
  n: string; l: number; t: string; a: string; d: 'Sí' | 'No';
  g: [number | null, number | null, number | string | null, string][];   // 4 grados: [INT, zeón, mantenimiento, efecto]
  e: string;
}
export interface ViaPropia { n: string; tipo: 'Vía mayor' | 'Vía menor' | 'Subvía'; nota: string; conjuros: ConjuroPropio[] }
export interface PoderPropio { n: string; l: number; m: 'Sí' | 'No'; a: string; f: string[] }   // f: efecto en las 10 dificultades
export interface DisciplinaPropia { n: string; mod: string; poderes: PoderPropio[] }
export interface ArsPropio { n: string; pd: number; cm: number; e: string }

export interface Biblioteca {
  version: 1;
  nombre: string;
  vias: ViaPropia[];
  disciplinas: DisciplinaPropia[];
  arsMagnus: ArsPropio[];
  categorias: CategoriaGremio[];   // categorías propias y oficiales modificadas
  ocultas: string[];               // oficiales que no se ofrecen en los desplegables (las fichas que ya las tienen no cambian)
}
export const BIBLIOTECA_VACIA: Biblioteca = { version: 1, nombre: '', vias: [], disciplinas: [], arsMagnus: [], categorias: [], ocultas: [] };

export type TipoElegido = 'via' | 'disciplina' | 'ars';
/** Un elemento propio que tiene un personaje y lo que consume. */
export interface Elegido {
  tipo: TipoElegido;
  n: string;
  nivel: number;   // nivel de vía que consume (vías y subvías)
  cv: number;      // CV que consume (disciplinas y sus poderes)
  cm: number;      // CM que consume (Ars Magnus)
  pd: number;      // PD que gasta
  cat: number;     // categoría (1-5) a la que se cargan los PD
}
export interface Consumo { nivel: number; cv: number; cm: number; pd: [number, number, number, number, number] }

const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
const lista = (x: unknown) => (Array.isArray(x) ? x : []);
const obj = (x: unknown): Record<string, unknown> => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

export function conjuroNuevo(): ConjuroPropio {
  return { n: '', l: 2, t: 'Efecto', a: 'Activa', d: 'No', g: [[null, null, 'No', ''], [null, null, 'No', ''], [null, null, 'No', ''], [null, null, 'No', '']], e: '' };
}
export const poderNuevo = (): PoderPropio => ({ n: '', l: 1, m: 'No', a: 'Activa', f: Array(10).fill('') });

/** Valida un JSON de biblioteca: lo que no encaja se descarta; un archivo que no es una biblioteca lanza Error. */
export function parseBiblioteca(datos: unknown): Biblioteca {
  const o = obj(datos);
  if (!('vias' in o || 'disciplinas' in o || 'arsMagnus' in o || 'categorias' in o)) throw new Error('no es una biblioteca de gremio (faltan vias, disciplinas, arsMagnus o categorias)');
  const conjuro = (c: unknown): ConjuroPropio => {
    const x = obj(c), g = lista(x.g).slice(0, 4).map((r) => { const q = lista(r); return [q[0] == null ? null : num(q[0]), q[1] == null ? null : num(q[1]), typeof q[2] === 'number' ? q[2] : str(q[2]) || 'No', str(q[3])] as ConjuroPropio['g'][number]; });
    while (g.length < 4) g.push([null, null, 'No', '']);
    return { n: str(x.n), l: num(x.l, 2), t: str(x.t), a: str(x.a) || 'Activa', d: /^s/i.test(str(x.d)) ? 'Sí' : 'No', g, e: str(x.e) };
  };
  const poder = (p: unknown): PoderPropio => {
    const x = obj(p), f = lista(x.f).slice(0, 10).map(str);
    while (f.length < 10) f.push('');
    return { n: str(x.n), l: num(x.l, 1), m: /^s/i.test(str(x.m)) ? 'Sí' : 'No', a: str(x.a) || 'Activa', f };
  };
  const nombres = new Set<string>();
  const unico = <T extends { n: string }>(l: T[]) => l.filter((e) => e.n && !nombres.has(e.n.toLowerCase()) && nombres.add(e.n.toLowerCase()));
  const vias = unico(lista(o.vias).map((v) => { const x = obj(v); const tipo = ['Vía mayor', 'Vía menor', 'Subvía'].includes(str(x.tipo)) ? (str(x.tipo) as ViaPropia['tipo']) : 'Subvía';
    return { n: str(x.n), tipo, nota: str(x.nota), conjuros: lista(x.conjuros).map(conjuro).filter((c) => c.n) }; }));
  const disciplinas = unico(lista(o.disciplinas).map((d) => { const x = obj(d); return { n: str(x.n), mod: str(x.mod) || 'Sin modificador', poderes: lista(x.poderes).map(poder).filter((p) => p.n) }; }));
  const arsMagnus = unico(lista(o.arsMagnus).map((a) => { const x = obj(a); return { n: str(x.n), pd: num(x.pd), cm: num(x.cm), e: str(x.e) }; }));
  const vistas = new Set<string>();
  const categorias = parseCategorias(o.categorias).filter((c) => !vistas.has(c.n.toLowerCase()) && vistas.add(c.n.toLowerCase()));
  const ocultas = [...new Set(lista(o.ocultas).map(str).filter(Boolean))];
  return { version: 1, nombre: str(o.nombre), vias, disciplinas, arsMagnus, categorias, ocultas };
}

/** Lo que un personaje gasta con sus elementos propios (se suma a los totales de la ficha). */
export function consumo(elegidos: Elegido[]): Consumo {
  const c: Consumo = { nivel: 0, cv: 0, cm: 0, pd: [0, 0, 0, 0, 0] };
  for (const e of elegidos) {
    c.nivel += num(e.nivel); c.cv += num(e.cv); c.cm += num(e.cm);
    const cat = Math.min(5, Math.max(1, Math.round(num(e.cat, 1))));
    c.pd[cat - 1] += num(e.pd);
  }
  return c;
}

/** Valida los elementos elegidos guardados en una ficha. */
export function parseElegidos(d: unknown): Elegido[] {
  return lista(d).map(obj).map((x) => ({
    tipo: (['via', 'disciplina', 'ars'].includes(str(x.tipo)) ? str(x.tipo) : 'via') as TipoElegido,
    n: str(x.n), nivel: num(x.nivel), cv: num(x.cv), cm: num(x.cm), pd: num(x.pd), cat: Math.min(5, Math.max(1, Math.round(num(x.cat, 1)))),
  })).filter((e) => e.n);
}

/** Celdas de la hoja interna «Gremio» del motor con lo que consume el personaje. */
export function entradasConsumo(elegidos: Elegido[]): Record<string, number> {
  const c = consumo(elegidos);
  return { 'Gremio!B1': c.nivel, 'Gremio!B2': c.cv, 'Gremio!B3': c.cm, 'Gremio!B4': c.pd[0], 'Gremio!B5': c.pd[1], 'Gremio!B6': c.pd[2], 'Gremio!B7': c.pd[3], 'Gremio!B8': c.pd[4] };
}
