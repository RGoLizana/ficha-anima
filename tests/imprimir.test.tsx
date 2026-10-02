// @vitest-environment happy-dom
// Vista de impresión: el nombre propuesto para el PDF es «Nombre nivel» (el navegador usa el título de la página)
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
  async abrir(id: string, entradas: Record<string, Entrada>) {
    if (abierta.value === id) return;
    abierta.value = id;
    motor().cargar(entradas);
    valores.value = motor().hojas(HOJAS_VISIBLES);
  },
  async poner() { /* sin edición */ },
  async opciones() { return []; },
}));

const store = await import('../src/store');
const { Imprimir } = await import('../src/ui/Imprimir');

beforeAll(() => { motor(); }, 120_000);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; vi.unstubAllGlobals(); });

describe('nombre del PDF', () => {
  it.each([['lock', 'Lock 6'], ['ayane', 'Ayane Akame 4']])('%s se propone como «%s»', async (ficha, esperado) => {
    const f = store.importar(JSON.stringify(read(`ref/fichas/${ficha}.json`)));
    let titulo = '';
    vi.stubGlobal('print', () => { titulo = document.title; });
    const antes = document.title;
    render(<Imprimir id={f.id} />);
    await waitFor(() => expect((document.querySelector('.btn.primary') as HTMLButtonElement).disabled).toBe(false), { timeout: 30_000 });
    fireEvent.click(document.querySelector('.btn.primary')!);
    expect(titulo).toBe(esperado);
    expect(document.title).toBe(antes);      // el título se restaura después
  }, 120_000);
});
