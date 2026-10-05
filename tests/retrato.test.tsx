// @vitest-environment happy-dom
// Imagen del personaje: se añade desde la cabecera de la ficha y sale en los iconos (lista, ficha, modo juego)
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor, read } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
vi.mock('../src/engine', () => ({
  motor: signal('listo'), errorMotor: signal(''), valores, abierta,
  formulaLista: (c: string) => LISTAS[c],
  async abrir(id: string, entradas: Record<string, Entrada>) { if (abierta.value === id) return; abierta.value = id; motor().cargar(entradas); valores.value = motor().hojas(HOJAS_VISIBLES); },
  async poner() { /* sin edición */ },
  async opciones() { return []; },
}));
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ';
vi.mock('../src/util/imagen', () => ({
  reducirImagen: async (f: File) => { if (!/^image\//.test(f.type)) throw new Error('El archivo no es una imagen.'); return FOTO; },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');
const { Lista } = await import('../src/ui/Lista');
const { Juego } = await import('../src/ui/Juego');
const { parse } = await import('../src/model/ficha');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

const subir = (archivo: File) => {
  const input = document.querySelector('input[aria-label="Imagen del personaje"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
  fireEvent.change(input);
};

describe('imagen del personaje', () => {
  it('en la pestaña Principal se ve grande y se puede cambiar desde ahí', async () => {
    const f = store.importar(JSON.stringify({ ...read('ref/fichas/lock.json'), retrato: FOTO }));
    render(<FichaView id={f.id} seccion="principal" />);
    await waitFor(() => expect(document.querySelector('.avatar.xl img')).toBeTruthy(), { timeout: 20_000 });
    expect(document.querySelector('.avatar.xl img')!.getAttribute('src')).toBe(FOTO);
    cleanup(); abierta.value = null;
    const g = store.importar(JSON.stringify(read('ref/fichas/ayane.json')));       // sin imagen: caja para añadirla
    render(<FichaView id={g.id} seccion="principal" />);
    await waitFor(() => expect(document.querySelector('.avatar.xl')).toBeTruthy(), { timeout: 20_000 });
    expect(document.querySelector('.avatar.xl')!.textContent).toContain('Añadir imagen');
  }, T);

  it('se añade desde la cabecera, se guarda en la ficha y sale en el icono; se puede quitar', async () => {
    const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
    render(<FichaView id={f.id} seccion="principal" />);
    expect(document.querySelector('.topbar .avatar img')).toBeNull();                  // sin imagen: la inicial
    subir(new File(['x'], 'foto.png', { type: 'image/png' }));
    await waitFor(() => expect(store.buscar(f.id)!.retrato).toBe(FOTO));
    await waitFor(() => expect(document.querySelector('.topbar .avatar img')!.getAttribute('src')).toBe(FOTO));
    expect(store.buscar(f.id)!.entradas['General!M5']).toBeUndefined();                // no toca las entradas del Excel
    fireEvent.click(document.querySelector('[aria-label="Quitar la imagen del personaje"]')!);
    await waitFor(() => expect(store.buscar(f.id)!.retrato).toBeUndefined());
    expect(document.querySelector('.topbar .avatar img')).toBeNull();
  }, T);

  it('lo que no es una imagen da un error claro y no cambia nada', async () => {
    const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
    render(<FichaView id={f.id} seccion="principal" />);
    subir(new File(['x'], 'datos.txt', { type: 'text/plain' }));
    await waitFor(() => expect(document.querySelector('.avatar-edit [role=alert]')!.textContent).toContain('no es una imagen'));
    expect(store.buscar(f.id)!.retrato).toBeUndefined();
  }, T);

  it('sale en la página principal (lista de fichas) y en el modo juego', async () => {
    const f = store.importar(JSON.stringify({ ...read('ref/fichas/lock.json'), retrato: FOTO }));
    store.importar(JSON.stringify(read('ref/fichas/ayane.json')));
    render(<Lista />);
    const iconos = [...document.querySelectorAll('.card .avatar')];
    expect(iconos).toHaveLength(2);
    expect(iconos.filter((a) => a.querySelector('img')).length).toBe(1);               // solo la ficha con imagen; la otra, su inicial
    cleanup();
    render(<Juego id={f.id} />);
    await waitFor(() => expect(document.querySelector('.avatar img')?.getAttribute('src')).toBe(FOTO));
  }, T);

  it('se conserva al exportar/importar el JSON y una imagen inválida o enorme se descarta', () => {
    expect(parse({ version: 2, entradas: {}, retrato: FOTO }).retrato).toBe(FOTO);
    expect(parse({ version: 2, entradas: {}, retrato: 'http://malo.example/x.png' }).retrato).toBeUndefined();
    expect(parse({ version: 2, entradas: {}, retrato: `data:image/jpeg;base64,${'A'.repeat(500_000)}` }).retrato).toBeUndefined();
  });
});
