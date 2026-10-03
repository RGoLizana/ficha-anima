// @vitest-environment happy-dom
// Ocultar pestañas del menú de una ficha (p. ej. «Psíquica» en un mago): solo afecta al menú y se guarda con la ficha.
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
  async poner(clave: string, v: Entrada | null) { valores.value = { ...valores.value, ...motor().poner(clave, v) }; },
  async opciones(clave: string, formula = LISTAS[clave]) { return formula ? motor().lista(formula, clave.slice(0, clave.lastIndexOf('!'))) : []; },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');
const { parse } = await import('../src/model/ficha');

beforeAll(() => { motor(); }, 120_000);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });
const enlaces = () => [...document.querySelectorAll('nav.sections a')].map((a) => a.textContent);

describe('personalizar el menú', () => {
  it('ocultar una pestaña la quita del menú y se guarda en la ficha; la activa no se puede ocultar', async () => {
    const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
    render(<FichaView id={f.id} seccion="principal" />);
    expect(enlaces()).toContain('Psíquica');
    fireEvent.click(document.querySelector('.menu-personalizar-boton')!);
    const casilla = (t: string) => [...document.querySelectorAll<HTMLInputElement>('.menu-personalizar input')].find((i) => i.closest('label')!.textContent === t)!;
    fireEvent.click(casilla('Psíquica'));
    await waitFor(() => expect(enlaces()).not.toContain('Psíquica'));
    expect(store.buscar(f.id)!.ocultas).toEqual(['psiquica']);
    expect(parse(JSON.parse(JSON.stringify(store.buscar(f.id)))).ocultas).toEqual(['psiquica']);
    expect(document.querySelector('.menu-personalizar-boton')!.textContent).toContain('1 ocultas');
    expect(casilla('Principal')).toBeUndefined();                    // Principal no se oculta
    fireEvent.click(casilla('Psíquica'));
    await waitFor(() => expect(enlaces()).toContain('Psíquica'));
    expect(store.buscar(f.id)!.ocultas).toBeUndefined();
  }, 60_000);

  it('si estás en una pestaña oculta sigue viéndose hasta que cambias de sección', async () => {
    const f = store.importar(JSON.stringify({ ...read('ref/fichas/lock.json'), ocultas: ['psiquica'] }));
    render(<FichaView id={f.id} seccion="psiquica" />);
    expect(enlaces()).toContain('Psíquica');
    fireEvent.click(document.querySelector('.menu-personalizar-boton')!);
    expect(document.querySelector<HTMLInputElement>('.menu-personalizar input[disabled]')).toBeTruthy();
  }, 60_000);
});
