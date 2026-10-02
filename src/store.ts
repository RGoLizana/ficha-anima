import { signal, effect } from '@preact/signals';
import { nueva, parse, nombreDe, NOMBRE, type Ficha, type Resumen } from './model/ficha';
import { abierta, poner, type Entrada } from './engine';

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

/** Cambia lo que el jugador ha escrito en una celda (null o '' = vaciar) y recalcula si la ficha está abierta. */
export function editar(id: string, clave: string, valor: Entrada | null) {
  cambiar(id, (f) => {
    const entradas = { ...f.entradas };
    if (valor === null || valor === '') delete entradas[clave]; else entradas[clave] = valor;
    return { ...f, entradas, actualizada: new Date().toISOString() };
  });
  if (abierta.value === id) void poner(clave, valor);
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
  fichas.value = fichas.value.filter((f) => f.id !== id);
}

/** Importa una ficha desde texto JSON. Si ya existe ese id, entra como copia. */
export function importar(texto: string): Ficha {
  const f = parse(JSON.parse(texto));
  if (buscar(f.id)) f.id = crypto.randomUUID();
  fichas.value = [...fichas.value, f];
  return f;
}

export function exportar(f: Ficha) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(f, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${nombreDe(f) || 'ficha'}.json` });
  a.click();
  URL.revokeObjectURL(url);
}
