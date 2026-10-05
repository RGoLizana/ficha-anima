// @vitest-environment happy-dom
// Lo que aún no está hecho se ve marcado como «Próximamente» en la propia página (y no hace nada)
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, render, waitFor } from '@testing-library/preact';
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

const store = await import('../src/store');
const { Imprimir } = await import('../src/ui/Imprimir');
const { Juego } = await import('../src/ui/Juego');
const { FichaView } = await import('../src/ui/FichaView');
const { Compendio } = await import('../src/ui/Compendio');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });
const ficha = () => store.importar(JSON.stringify(read('ref/fichas/lock.json')));

describe('Próximamente', () => {
  it('la vista de impresión marca lo que falta: páginas de Sheele y Equipo y grimorio', async () => {
    render(<Imprimir id={ficha().id} />);
    const marcas = [...document.querySelectorAll('.topbar label.pronto')];
    expect(marcas.map((l) => l.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Página de Sheele Próximamente', 'Página de Equipo Próximamente', 'PDF de grimorio (apaisado) Próximamente']);
    expect(marcas.every((l) => (l.querySelector('input') as HTMLInputElement).disabled)).toBe(true);
  }, T);

  it('los grimorios tienen su botón de PDF deshabilitado con la marca', async () => {
    const f = ficha();
    render(<FichaView id={f.id} seccion="grimorios" />);
    await waitFor(() => expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Descargar grimorio en PDF')).toBe(true), { timeout: 20_000 });
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Descargar grimorio en PDF') as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.parentElement!.querySelector('.proximamente')).toBeTruthy();
  }, T);

  it('el modo juego ya no tiene nada pendiente marcado', async () => {
    render(<Juego id={ficha().id} />);
    await waitFor(() => expect(document.querySelector('.juego')).toBeTruthy(), { timeout: 20_000 });
    expect(document.querySelector('.juego')!.textContent).not.toContain('Próximamente');
  }, T);

  it('el compendio ya tiene convocatoria como pestaña real (sin marca de Próximamente)', async () => {
    render(<Compendio />);
    await waitFor(() => expect(document.querySelector('.tabs')).toBeTruthy(), { timeout: 20_000 });
    expect(document.querySelector('.tab-pronto')).toBeNull();
    expect(document.querySelector('.tabs .proximamente')).toBeNull();
    expect(document.querySelectorAll('[role=tab]')).toHaveLength(4);
    expect(document.getElementById('tab-conv')!.textContent).toContain('Convocatoria');
  }, T);
});
