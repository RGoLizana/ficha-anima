// La plantilla base de Excel (.xlsm 8.7.0) la aporta el usuario una vez y se recuerda en este navegador (IndexedDB):
// no se distribuye con la web (el libro es del juego). Si IndexedDB no está disponible, vale para la sesión.
let enMemoria: { nombre: string; datos: Uint8Array } | null = null;
const BD = 'anima-base', ALMACEN = 'base', CLAVE = 'xlsm';

function abrirBD(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === 'undefined') return ko(new Error('sin IndexedDB'));
    const r = indexedDB.open(BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error ?? new Error('IndexedDB'));
  });
}
const pedir = <T,>(modo: IDBTransactionMode, f: (a: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  abrirBD().then((db) => new Promise<T>((ok, ko) => {
    const r = f(db.transaction(ALMACEN, modo).objectStore(ALMACEN));
    r.onsuccess = () => { db.close(); ok(r.result); };
    r.onerror = () => { db.close(); ko(r.error ?? new Error('IndexedDB')); };
  }));

export async function leerBase() {
  try {
    const r = await pedir<{ nombre: string; datos: Uint8Array } | undefined>('readonly', (a) => a.get(CLAVE));
    if (r) return r;
  } catch { /* sin almacenamiento persistente */ }
  return enMemoria;
}

export async function guardarBase(nombre: string, datos: Uint8Array) {
  enMemoria = { nombre, datos };
  try { await pedir('readwrite', (a) => a.put({ nombre, datos }, CLAVE)); } catch { /* queda en memoria */ }
}

export async function borrarBase() {
  enMemoria = null;
  try { await pedir('readwrite', (a) => a.delete(CLAVE)); } catch { /* nada que borrar */ }
}

/** Descarga un archivo desde el navegador. */
export function descargar(nombre: string, datos: Uint8Array, tipo = 'application/vnd.ms-excel.sheet.macroEnabled.12') {
  const url = URL.createObjectURL(new Blob([datos as BlobPart], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
