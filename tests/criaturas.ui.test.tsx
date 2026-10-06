// @vitest-environment happy-dom
// Criaturas atadas y familiares en la interfaz (motor real sin worker, como en ui.test.tsx).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor, read } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
vi.mock('../src/engine', () => ({
  motor: signal('listo'), errorMotor: signal(''), valores, abierta,
  formulaLista: (c: string) => LISTAS[c],
  async abrir(id: string, entradas: Record<string, Entrada>) { if (abierta.value === id) return; abierta.value = id; motor().cargar(entradas); valores.value = motor().hojas(HOJAS_VISIBLES); },
  async poner(clave: string, v: Entrada | null) { valores.value = { ...valores.value, ...motor().poner(clave, v) }; },
  async opciones(clave: string, formula = LISTAS[clave]) { return formula ? motor().lista(formula, clave.slice(0, clave.lastIndexOf('!'))) : []; },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');
const { Lista } = await import('../src/ui/Lista');
const { nivelDe } = await import('../src/model/ficha');
const { Juego } = await import('../src/ui/Juego');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const esperarListo = () => waitFor(() => expect(document.querySelector('.banner[role=status]:not(.criatura-banda)')).toBeNull(), { timeout: 20_000 });
const enlaces = () => [...document.querySelectorAll('nav.sections a')].map((a) => a.textContent);
const lock = () => store.importar(JSON.stringify(read('ref/fichas/lock.json')));
const hijas = (p: string) => store.fichas.value.filter((f) => f.criatura?.padre === p);

describe('pestaña Criaturas', () => {
  it('no aparece sin convocatoria, aparece con una criatura y no existe en la ficha de la criatura', async () => {
    const p = lock();
    const { unmount } = render(<FichaView id={p.id} seccion="principal" />);
    await esperarListo();
    expect(enlaces()).not.toContain('Criaturas');
    unmount();
    abierta.value = null;
    const c = store.crearCriatura(p.id)!;
    const r = render(<FichaView id={p.id} seccion="principal" />);
    await esperarListo();
    expect(enlaces()).toContain('Criaturas');
    r.unmount();
    abierta.value = null;
    render(<FichaView id={c.id} seccion="criaturas" />);
    await esperarListo();
    expect(enlaces()).not.toContain('Criaturas');
    expect(document.querySelector('.criatura-banda')!.textContent).toContain('Criatura de');
    expect(document.querySelector('.criatura-banda a')!.getAttribute('href')).toBe(`#/ficha/${p.id}/criaturas`);
  }, T);

  it('«+ Nueva criatura» crea una ficha enlazada con los mismos PD y abre su ficha', async () => {
    const p = lock();
    store.crearCriatura(p.id);
    render(<FichaView id={p.id} seccion="criaturas" />);
    await esperarListo();
    fireEvent.click(screen.getByText('+ Nueva criatura'));
    const h = hijas(p.id);
    expect(h).toHaveLength(2);
    expect(nivelDe(h[1])).toBe(nivelDe(store.buscar(p.id)!));
    expect(location.hash).toBe(`#/ficha/${h[1].id}`);
  }, T);

  it('con «Familiar» la criatura sube cuando el convocador sube de nivel; sin marcar, no', async () => {
    const p = lock();
    const c = store.crearCriatura(p.id)!;
    const n0 = nivelDe(c);
    render(<FichaView id={p.id} seccion="criaturas" />);
    await esperarListo();
    const casilla = () => document.querySelector<HTMLInputElement>('.criatura input[type=checkbox]')!;
    store.editar(p.id, 'PDs!S7', (Number(store.buscar(p.id)!.entradas['PDs!S7']) || 0) + 1);
    expect(nivelDe(store.buscar(c.id)!)).toBe(n0);                      // atada: no cambia
    fireEvent.click(casilla());
    expect(store.buscar(c.id)!.criatura!.familiar).toBe(true);
    store.editar(p.id, 'PDs!S7', (Number(store.buscar(p.id)!.entradas['PDs!S7']) || 0) + 2);
    expect(nivelDe(store.buscar(c.id)!)).toBe(n0 + 2);
    await waitFor(() => expect(document.querySelector('.criatura .chip')!.textContent).toContain('Sube con'));
    fireEvent.click(screen.getByText('Atar / recalcular'));
    expect(nivelDe(store.buscar(c.id)!)).toBe(nivelDe(store.buscar(p.id)!));
  }, T);

  it('«Anotar en criaturas atadas» escribe nombre y zeón en la primera fila libre sin pisar nada', async () => {
    const p = lock();
    store.editar(p.id, 'Místicos!C33', 'Escrito por el jugador');
    const c = store.crearCriatura(p.id)!;
    store.editar(c.id, 'General!F22', 'Lobo');
    store.editar(c.id, 'PDs!S7', 3);
    render(<FichaView id={p.id} seccion="criaturas" />);
    await esperarListo();
    fireEvent.click(screen.getByText('Anotar en criaturas atadas'));
    const e = store.buscar(p.id)!.entradas;
    expect(e['Místicos!C33']).toBe('Escrito por el jugador');
    expect(e['Místicos!C34']).toBe('Lobo');
    expect(e['Místicos!H34']).toBe(30);
    await waitFor(() => expect(document.querySelector('.criatura')!.textContent).toContain('fila 34'));
  }, T);
});

describe('lista de fichas con criaturas', () => {
  it('las criaturas cuelgan de su convocador, la búsqueda las encuentra y las sueltas llevan chip', async () => {
    const p = store.crear();
    store.editar(p.id, 'General!F22', 'Tel');
    const c = store.crearCriatura(p.id)!;
    store.editar(c.id, 'General!F22', 'Ave');
    const suelta = store.crear();
    store.editar(suelta.id, 'General!F22', 'Perdida');
    store.enlazar(suelta.id, p.id);
    store.borrar(p.id);                                                  // la suelta y la criatura quedan solas
    expect(store.buscar(c.id)!.criatura).toBeUndefined();
    const p2 = store.crear();
    store.editar(p2.id, 'General!F22', 'Mago');
    const c2 = store.crearCriatura(p2.id)!;
    store.editar(c2.id, 'General!F22', 'Gato');
    store.marcarFamiliar(c2.id, true);
    render(<Lista />);
    expect(screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent)).not.toContain('Gato');
    expect(screen.getByLabelText('Criaturas').textContent).toContain('Gato (familiar)');
    fireEvent.input(screen.getByPlaceholderText('Nombre o categoría'), { target: { value: 'gato' } });
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Mago']);
    fireEvent.input(screen.getByPlaceholderText('Nombre o categoría'), { target: { value: '' } });
    store.fichas.value = store.fichas.value.map((f) => (f.id === c2.id ? { ...f, criatura: { ...f.criatura!, padre: 'no-existe' } } : f));
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toContain('Gato'));
    expect(screen.getByText('Criatura sin convocador')).toBeTruthy();
  }, T);

  it('borrar el convocador desde la lista deja a sus criaturas sueltas', () => {
    const p = store.crear();
    const c = store.crearCriatura(p.id)!;
    vi.stubGlobal('confirm', () => true);
    render(<Lista />);
    fireEvent.click(document.querySelector('button[aria-label="Borrar"]')!);
    expect(store.buscar(p.id)).toBeUndefined();
    expect(store.buscar(c.id)!.criatura).toBeUndefined();
  });
});

describe('enlaces desde Magia y modo juego', () => {
  it('Magia enseña «Abrir ficha» en la fila cuyo nombre coincide con una criatura', async () => {
    const p = lock();
    const c = store.crearCriatura(p.id)!;
    store.editar(c.id, 'General!F22', 'Lobo');
    store.editar(p.id, 'Místicos!C33', 'Lobo');
    render(<FichaView id={p.id} seccion="magia" />);
    await esperarListo();
    const enlace = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Abrir ficha')!;
    expect(enlace.getAttribute('href')).toBe(`#/ficha/${c.id}`);
    expect([...document.querySelectorAll('a')].some((a) => a.textContent === 'Ver criaturas →')).toBe(true);
  }, T);

  it('el modo juego enlaza criatura y convocador sin tocar ninguna ficha', async () => {
    const p = lock();
    const c = store.crearCriatura(p.id)!;
    const antes = JSON.stringify(store.fichas.value.map((f) => f.entradas));
    const r = render(<Juego id={p.id} />);
    await waitFor(() => expect(document.querySelector('.juego-hud')).toBeTruthy(), { timeout: 20_000 });
    expect([...document.querySelectorAll('a.btn')].find((a) => a.getAttribute('href') === `#/juego/${c.id}`)).toBeTruthy();
    r.unmount();
    abierta.value = null;
    render(<Juego id={c.id} />);
    await waitFor(() => expect(document.querySelector('.juego-hud')).toBeTruthy(), { timeout: 20_000 });
    expect([...document.querySelectorAll('a.btn')].find((a) => a.getAttribute('href') === `#/juego/${p.id}`)).toBeTruthy();
    expect(JSON.stringify(store.fichas.value.map((f) => f.entradas))).toBe(antes);
  }, T);
});
