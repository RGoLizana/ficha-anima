import { signal, effect } from '@preact/signals';
import { nueva, parse, nombreDe, nivelDe, NOMBRE, entradasMotor, type Ficha, type Resumen, type Sesion, type VistaJuego } from './model/ficha';
import { filasActuales, type Programado } from './nivel';
import { criaturasDe, entradasIniciales, fijarNivel, sincronizar } from './criaturas';
import { CASILLAS_CATEGORIA, type CategoriaGremio } from './gremio/categorias';
import { entradasConsumo, type Elegido } from './gremio/modelo';
import { abierta, poner, recargar, type Entrada } from './engine';

const KEY = 'anima.fichas';

function load(): Ficha[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as unknown[]).flatMap((d) => {
      try { return [parse(d)]; } catch { return []; }
    });
  } catch {
    return [];
  }
}

export const fichas = signal<Ficha[]>(load());
export const guardado = signal(true);

effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(fichas.value));
    guardado.value = true;
  } catch {
    guardado.value = false; // sin espacio o almacenamiento bloqueado: se avisa en la cabecera
  }
});

export const buscar = (id: string) => fichas.value.find((f) => f.id === id);

function cambiar(id: string, fn: (f: Ficha) => Ficha) {
  fichas.value = fichas.value.map((f) => (f.id === id ? fn(f) : f));
}

export function crear(): Ficha {
  const f = nueva();
  fichas.value = [...fichas.value, f];
  return f;
}

export function actualizar(id: string, cambios: Partial<Pick<Ficha, 'notas'>>) {
  cambiar(id, (f) => ({ ...f, ...cambios, actualizada: new Date().toISOString() }));
}

const NIVEL = /^PDs!S(7|9|11|13|15)$/;

/** Cambia lo que el jugador ha escrito en una celda (null o '' = vaciar) y recalcula si la ficha está abierta. */
export function editar(id: string, clave: string, valor: Entrada | null) {
  cambiar(id, (f) => {
    const entradas = { ...f.entradas };
    if (valor === null || valor === '') delete entradas[clave]; else entradas[clave] = valor;
    return { ...f, entradas, actualizada: new Date().toISOString() };
  });
  // con categorías de gremio, cambiar de categoría puede cambiar qué fila de «Tablas» ocupa cada una: se carga la ficha entera
  if (NIVEL.test(clave)) sincronizarFamiliares(id);
  if (abierta.value === id) { if (CASILLAS_CATEGORIA.includes(clave) && buscar(id)?.categorias?.length) void recargar(id, entradasMotor(buscar(id)!)); else void poner(clave, valor); }
}

/** Guarda la copia de las categorías de gremio que usa el personaje y recalcula. */
export function guardarCategorias(id: string, categorias: CategoriaGremio[]) {
  cambiar(id, (f) => { const { categorias: _viejas, ...resto } = f; return { ...resto, ...(categorias.length ? { categorias } : {}), actualizada: new Date().toISOString() }; });
  const f = buscar(id);
  if (f && abierta.value === id) void recargar(id, entradasMotor(f));
}

/** Elige la categoría de una casilla de PDs; si es una de gremio que la ficha aún no tiene, se copia a la ficha en el mismo paso. */
export function elegirCategoria(id: string, clave: string, nombre: string, copia?: CategoriaGremio) {
  const f = buscar(id);
  if (copia && f && !(f.categorias ?? []).some((c) => !c.oficial && c.n === copia.n)) guardarCategorias(id, [...(f.categorias ?? []), copia]);
  editar(id, clave, nombre || null);
}

/** Varias celdas de una vez (una sola actualización de la ficha); null o '' vacía la celda. Solo escribe las que cambian. */
export function editarVarias(id: string, cambios: Record<string, Entrada | null>) {
  const f = buscar(id);
  if (!f) return;
  const distintos = Object.entries(cambios).filter(([k, v]) => String(f.entradas[k] ?? '') !== String(v ?? ''));
  if (!distintos.length) return;
  cambiar(id, (g) => {
    const entradas = { ...g.entradas };
    for (const [k, v] of distintos) if (v === null || v === '') delete entradas[k]; else entradas[k] = v;
    return { ...g, entradas, actualizada: new Date().toISOString() };
  });
  if (distintos.some(([k]) => NIVEL.test(k))) sincronizarFamiliares(id);
  if (abierta.value === id) for (const [k, v] of distintos) void poner(k, v);
}

/** Guarda los elementos propios del gremio de un personaje y actualiza lo que consumen en el motor si la ficha está abierta. */
export function guardarPropio(id: string, propio: Elegido[]) {
  cambiar(id, (f) => ({ ...f, propio, actualizada: new Date().toISOString() }));
  if (abierta.value === id) for (const [k, v] of Object.entries(entradasConsumo(propio))) void poner(k, v);
}

/** Guarda qué pestañas del menú están ocultas en un personaje. No toca `entradas` ni el motor. */
export function guardarOcultas(id: string, ocultas: string[]) {
  cambiar(id, (f) => { const { ocultas: _viejas, ...resto } = f; return ocultas.length ? { ...resto, ocultas } : resto; });
}

/** Pone o quita (null) la imagen del personaje. No toca `entradas` ni el motor. */
export function guardarRetrato(id: string, retrato: string | null) {
  cambiar(id, (f) => { const { retrato: _viejo, ...resto } = f; return retrato ? { ...resto, retrato } : resto; });
}

/** Guarda el estado de la partida (Modo juego). No toca `entradas` ni el motor: no cambia ningún cálculo. */
export function guardarSesion(id: string, sesion: Sesion) {
  cambiar(id, (f) => ({ ...f, sesion }));
}

/** Guarda qué bloques del modo juego se ven y su orden (vacío = vista por defecto). No toca `entradas` ni el motor. */
export function guardarVistaJuego(id: string, v: VistaJuego) {
  cambiar(id, (f) => { const { vistaJuego: _vieja, ...resto } = f; return v.ocultos.length || v.orden.length ? { ...resto, vistaJuego: v } : resto; });
}

/** Programa (o anula con null) un cambio de categoría: solo reserva PD en la ficha, no toca `entradas` ni el motor. */
export function programarCambio(id: string, programado: Programado | null) {
  cambiar(id, (f) => { const { programado: _viejo, ...resto } = f; return programado ? { ...resto, programado, actualizada: new Date().toISOString() } : resto; });
}

/** Cambia de categoría: la nueva ocupa la siguiente fila de PDs y se anotan los PD que paga cada una (PDs!Z/AA de la fila de la antigua). Quita el programado. */
export function aplicarCambio(id: string, p: Programado, copia?: CategoriaGremio): boolean {
  const f = buscar(id);
  const { actual, siguiente } = f ? filasActuales(f.entradas) : { actual: 0, siguiente: undefined };
  if (!f || !siguiente) return false;
  elegirCategoria(id, `PDs!O${siguiente}`, p.a, copia);
  editarVarias(id, { [`PDs!Z${actual}`]: p.z || null, [`PDs!AA${actual}`]: p.aa || null });
  programarCambio(id, null);
  return true;
}

/** Guarda la copia de valores calculados que usa la lista (no cuenta como edición). */
export function guardarResumen(id: string, resumen: Resumen) {
  const f = buscar(id);
  if (f && JSON.stringify(f.resumen) !== JSON.stringify(resumen)) cambiar(id, (x) => ({ ...x, resumen }));
}

export function duplicar(id: string) {
  const f = buscar(id);
  if (f) {
    const copia = { ...f, id: crypto.randomUUID(), entradas: { ...f.entradas, [NOMBRE]: nombreDe(f) + ' (copia)' } };
    fichas.value = [...fichas.value, copia];
  }
}

export function borrar(id: string) {
  // sus criaturas quedan como personajes sueltos: no se pierde nada
  fichas.value = fichas.value.filter((f) => f.id !== id).map((f) => { if (f.criatura?.padre !== id) return f; const { criatura: _c, ...resto } = f; return resto; });
}

/** Escribe cambios en la ficha de una criatura (y en el motor si está abierta) y actualiza su enlace. */
function aplicarCriatura(id: string, entradas: Record<string, number>, vinculo: Partial<NonNullable<Ficha['criatura']>>) {
  cambiar(id, (g) => ({ ...g, entradas: { ...g.entradas, ...entradas }, criatura: { ...g.criatura!, ...vinculo }, actualizada: new Date().toISOString() }));
  if (abierta.value === id) for (const [k, v] of Object.entries(entradas)) void poner(k, v);
}

/** Los familiares de este convocador ganan (o pierden) los niveles que él ha ganado desde la última sincronización. Se puede repetir sin efecto. */
export function sincronizarFamiliares(padre: string) {
  const p = buscar(padre);
  if (!p || p.criatura) return;
  const nivel = nivelDe(p);
  for (const c of criaturasDe(fichas.value, padre)) {
    const r = sincronizar(c, nivel);
    if (r) aplicarCriatura(c.id, r.entradas, { nivelAmo: r.nivelAmo });
  }
}

/** Crea una criatura enlazada que empieza con los mismos PD que su convocador (mismo nivel y categoría). */
export function crearCriatura(padre: string): Ficha | undefined {
  const p = buscar(padre);
  if (!p || p.criatura) return undefined;
  const f = nueva();
  f.entradas = entradasIniciales('Nueva criatura', p);
  f.criatura = { padre, familiar: false, nivelAmo: nivelDe(p) };
  fichas.value = [...fichas.value, f];
  return f;
}

/** Enlaza una ficha a un convocador (null = la deja suelta). Un solo nivel: el convocador no puede ser criatura ni una ficha con criaturas. */
export function enlazar(id: string, padre: string | null): boolean {
  const f = buscar(id);
  if (!f) return false;
  if (padre === null) { cambiar(id, (g) => { const { criatura: _c, ...resto } = g; return resto; }); return true; }
  const p = buscar(padre);
  if (!p || p.criatura || padre === id || criaturasDe(fichas.value, id).length) return false;
  cambiar(id, (g) => ({ ...g, criatura: { padre, familiar: g.criatura?.familiar ?? false, nivelAmo: nivelDe(p) } }));
  return true;
}

/** Marca o desmarca «Familiar». Al marcar no recupera niveles perdidos: solo se resincroniza con el nivel actual del convocador. */
export function marcarFamiliar(id: string, familiar: boolean) {
  const c = buscar(id);
  const p = c?.criatura && buscar(c.criatura.padre);
  if (c?.criatura) aplicarCriatura(id, {}, { familiar, nivelAmo: p ? nivelDe(p) : c.criatura.nivelAmo });
}

/** «Atar / recalcular»: el nivel de la criatura pasa a ser el del convocador y se anota el nivel del amo. */
export function atar(id: string) {
  const c = buscar(id);
  const p = c?.criatura && buscar(c.criatura.padre);
  if (c && p) aplicarCriatura(id, fijarNivel(c, nivelDe(p)), { nivelAmo: nivelDe(p) });
}

/** Importa una ficha desde texto JSON. Si ya existe ese id, entra como copia. */
export function importar(texto: string): Ficha {
  const datos = JSON.parse(texto);
  const f = parse(datos);
  if (buscar(f.id)) f.id = crypto.randomUUID();
  // las criaturas que trae el convocador entran con id nuevo si chocan y apuntando a su id final
  const hijas: Ficha[] = f.criatura || !Array.isArray(datos?.criaturasAtadas) ? [] : datos.criaturasAtadas.flatMap((d: unknown) => { try { return [parse(d)]; } catch { return []; } });
  const usados = new Set([...fichas.value.map((x) => x.id), f.id]);
  for (const c of hijas) {
    if (usados.has(c.id)) c.id = crypto.randomUUID();
    usados.add(c.id);
    c.criatura = { familiar: false, ...c.criatura, nivelAmo: c.criatura?.nivelAmo ?? nivelDe(f), padre: f.id };
  }
  fichas.value = [...fichas.value, f, ...hijas];
  return f;
}

/** Importa una ficha Excel (.xlsm/.xlsx). El lector se carga aparte, solo cuando hace falta. Lanza Error si no es una ficha. */
export async function importarExcel(datos: Uint8Array, nombreArchivo = ''): Promise<{ ficha: Ficha; avisos: string[] }> {
  const { leerFicha } = await import('./import/xlsm');
  const { entradas, avisos } = leerFicha(datos);
  const f = nueva(nombreArchivo.replace(/\.xls[xm]$/i, '') || undefined);
  f.entradas = { ...f.entradas, ...entradas };
  fichas.value = [...fichas.value, f];
  return { ficha: f, avisos };
}

export function exportar(f: Ficha) {
  const hijas = criaturasDe(fichas.value, f.id);
  const url = URL.createObjectURL(new Blob([JSON.stringify(hijas.length ? { ...f, criaturasAtadas: hijas } : f, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${nombreDe(f) || 'ficha'}.json` });
  a.click();
  URL.revokeObjectURL(url);
}
