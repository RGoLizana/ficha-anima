// @vitest-environment happy-dom
// Almacén de fichas: crear, editar, duplicar, borrar, importar/exportar y guardado en el navegador.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

const poner = vi.fn(async () => {});
vi.mock('../src/engine', () => ({ abierta: signal<string | null>(null), poner }));

const { abierta } = await import('../src/engine');
const store = await import('../src/store');
const { nombreDe, NOMBRE } = await import('../src/model/ficha');
const { read } = await import('./helpers');

const guardadas = () => JSON.parse(localStorage.getItem('anima.fichas') ?? '[]');

beforeEach(() => {
  store.fichas.value = [];
  poner.mockClear();
  abierta.value = null;
});

describe('crear, editar, borrar', () => {
  it('crear una ficha la guarda en el navegador con nombre por defecto', () => {
    const f = store.crear();
    expect(nombreDe(f)).toBe('Nuevo personaje');
    expect(guardadas()).toHaveLength(1);
    expect(store.guardado.value).toBe(true);
  });

  it('editar escribe la celda, actualiza la fecha y vaciar la quita', async () => {
    const f = store.crear();
    const antes = f.actualizada;
    await new Promise((r) => setTimeout(r, 5));
    store.editar(f.id, 'Principal!E11', 10);
    expect(store.buscar(f.id)!.entradas['Principal!E11']).toBe(10);
    expect(store.buscar(f.id)!.actualizada > antes).toBe(true);
    store.editar(f.id, 'Principal!E11', null);
    expect('Principal!E11' in store.buscar(f.id)!.entradas).toBe(false);
    store.editar(f.id, 'General!F23', '');
    expect('General!F23' in store.buscar(f.id)!.entradas).toBe(false);
  });

  it('editar recalcula en el motor solo si la ficha está abierta', () => {
    const f = store.crear();
    store.editar(f.id, 'Principal!E11', 9);
    expect(poner).not.toHaveBeenCalled();
    abierta.value = f.id;
    store.editar(f.id, 'Principal!E11', 10);
    expect(poner).toHaveBeenCalledWith('Principal!E11', 10);
  });

  it('las notas se guardan', () => {
    const f = store.crear();
    store.actualizar(f.id, { notas: 'Lenguas: Latín' });
    expect(guardadas()[0].notas).toBe('Lenguas: Latín');
  });

  it('duplicar crea otra ficha con id nuevo, mismas entradas y "(copia)" en el nombre', () => {
    const f = store.crear();
    store.editar(f.id, 'Principal!E11', 10);
    store.duplicar(f.id);
    const [a, b] = store.fichas.value;
    expect(b.id).not.toBe(a.id);
    expect(nombreDe(b)).toBe('Nuevo personaje (copia)');
    expect(b.entradas['Principal!E11']).toBe(10);
    store.editar(b.id, 'Principal!E11', 5); // las copias no comparten datos
    expect(store.buscar(a.id)!.entradas['Principal!E11']).toBe(10);
  });

  it('borrar la quita del navegador', () => {
    const f = store.crear();
    store.borrar(f.id);
    expect(store.fichas.value).toEqual([]);
    expect(guardadas()).toEqual([]);
  });

  it('el resumen para la lista se guarda sin contar como edición', () => {
    const f = store.crear();
    store.guardarResumen(f.id, { categoria: 'Hechicero', stats: [{ k: 'PV', v: 150 }] });
    expect(store.buscar(f.id)!.resumen?.categoria).toBe('Hechicero');
    expect(store.buscar(f.id)!.actualizada).toBe(f.actualizada);
  });
});

describe('importar y exportar', () => {
  it('importa las fichas de ejemplo (ref/fichas)', () => {
    for (const n of ['sesshomaru', 'lock', 'ayane']) store.importar(JSON.stringify(read(`ref/fichas/${n}.json`)));
    expect(store.fichas.value.map(nombreDe)).toEqual(['Sesshomaru', 'Lock', 'Ayane Akame']);
  });

  it('importar dos veces la misma ficha la añade como copia con otro id (no sobrescribe)', () => {
    const texto = JSON.stringify(read('ref/fichas/lock.json'));
    const a = store.importar(texto);
    const b = store.importar(texto);
    expect(a.id).not.toBe(b.id);
    expect(store.fichas.value).toHaveLength(2);
  });

  it('importar algo que no es una ficha falla con un mensaje y no añade nada', () => {
    expect(() => store.importar('{"hola": 1}')).toThrow();
    expect(() => store.importar('no es json')).toThrow();
    expect(store.fichas.value).toEqual([]);
  });

  it('importa fichas v1 antiguas (solo nombre y notas)', () => {
    const f = store.importar(JSON.stringify({ version: 1, id: 'x', nombre: 'Viejo', notas: 'n', actualizada: '2026-01-01' }));
    expect(nombreDe(f)).toBe('Viejo');
    expect(f.entradas).toEqual({ [NOMBRE]: 'Viejo' });
  });

  it('exportar descarga un .json con el nombre del personaje que se vuelve a importar igual', async () => {
    const f = store.importar(JSON.stringify(read('ref/fichas/ayane.json')));
    let blob: Blob | undefined;
    let descarga = '';
    URL.createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:x'; }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { descarga = this.download; });
    store.exportar(f);
    expect(click).toHaveBeenCalled();
    expect(descarga).toBe('Ayane Akame.json');
    const vuelta = store.importar(await blob!.text());
    expect(vuelta.entradas).toEqual(f.entradas);
  });
});

describe('guardado en el navegador', () => {
  it('al arrancar ignora fichas corruptas y conserva las buenas', async () => {
    localStorage.setItem('anima.fichas', JSON.stringify([read('ref/fichas/lock.json'), { basura: true }]));
    vi.resetModules();
    vi.doMock('../src/engine', () => ({ abierta: signal(null), poner }));
    const nuevo = await import('../src/store');
    expect(nuevo.fichas.value.map(nombreDe)).toEqual(['Lock']);
  });

  it('si localStorage tiene JSON roto arranca vacío', async () => {
    localStorage.setItem('anima.fichas', '{roto');
    vi.resetModules();
    vi.doMock('../src/engine', () => ({ abierta: signal(null), poner }));
    const nuevo = await import('../src/store');
    expect(nuevo.fichas.value).toEqual([]);
  });

  it('si no se puede guardar (sin espacio) lo indica', () => {
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
    store.crear();
    expect(store.guardado.value).toBe(false);
    set.mockRestore();
    store.crear();
    expect(store.guardado.value).toBe(true);
  });
});
