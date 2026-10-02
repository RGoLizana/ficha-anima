import { signal } from '@preact/signals';
import { BIBLIOTECA_VACIA, parseBiblioteca, type Biblioteca } from './modelo';

// Biblioteca de gremio: global en este navegador (la usan todas las fichas) y compartible como archivo .json.
const CLAVE = 'anima.biblioteca';

function cargar(): Biblioteca {
  try {
    const t = localStorage.getItem(CLAVE);
    return t ? parseBiblioteca(JSON.parse(t)) : BIBLIOTECA_VACIA;
  } catch { return BIBLIOTECA_VACIA; }
}

export const biblioteca = signal<Biblioteca>(cargar());
export const errorBiblioteca = signal('');

export function guardarBiblioteca(b: Biblioteca) {
  biblioteca.value = b;
  try { localStorage.setItem(CLAVE, JSON.stringify(b)); errorBiblioteca.value = ''; }
  catch { errorBiblioteca.value = 'No se pudo guardar la biblioteca en este navegador (almacenamiento lleno o bloqueado).'; }
}

/** Importa un .json de gremio. Si `unir` se añade a lo que ya hay (los nombres repetidos se sustituyen por los nuevos). */
export function importarBiblioteca(texto: string, unir = false): Biblioteca {
  const nueva = parseBiblioteca(JSON.parse(texto));
  const actual = biblioteca.value;
  const r: Biblioteca = !unir ? nueva : {
    ...nueva, nombre: nueva.nombre || actual.nombre,
    vias: [...actual.vias.filter((v) => !nueva.vias.some((x) => x.n.toLowerCase() === v.n.toLowerCase())), ...nueva.vias],
    disciplinas: [...actual.disciplinas.filter((v) => !nueva.disciplinas.some((x) => x.n.toLowerCase() === v.n.toLowerCase())), ...nueva.disciplinas],
    arsMagnus: [...actual.arsMagnus.filter((v) => !nueva.arsMagnus.some((x) => x.n.toLowerCase() === v.n.toLowerCase())), ...nueva.arsMagnus],
  };
  guardarBiblioteca(r);
  return r;
}

export const exportarBiblioteca = (b: Biblioteca = biblioteca.value) => JSON.stringify(b, null, 2);
