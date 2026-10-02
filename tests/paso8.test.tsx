// @vitest-environment happy-dom
// Paso 8: Sheele, Elan y Equipo (interfaz con el motor real, sin worker)
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor, read, type NombreFicha } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
vi.mock('../src/engine', () => ({
  motor: signal('listo'),
  errorMotor: signal(''),
  valores,
  abierta,
  formulaLista: (c: string) => LISTAS[c],
  async abrir(id: string, entradas: Record<string, Entrada>) {
    if (abierta.value === id) return;
    abierta.value = id;
    motor().cargar(entradas);
    valores.value = motor().hojas(HOJAS_VISIBLES);
  },
  async poner(clave: string, v: Entrada | null) {
    valores.value = { ...valores.value, ...motor().poner(clave, v) };
  },
  async opciones(clave: string, formula = LISTAS[clave]) {
    return formula ? motor().lista(formula, clave.slice(0, clave.lastIndexOf('!'))) : [];
  },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

function abrirFicha(n: NombreFicha, seccion: string) {
  const f = store.importar(JSON.stringify(read(`ref/fichas/${n}.json`)));
  render(<FichaView id={f.id} seccion={seccion} />);
  return f;
}
const esperarListo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
const celda = (clave: string) => document.querySelector(`[data-clave="${clave}"] input, [data-clave="${clave}"] select, [data-clave="${clave}"] textarea`) as HTMLInputElement & HTMLSelectElement;
const opcionesDe = (clave: string) => [...(celda(clave)?.options ?? [])].map((o) => o.value).filter(Boolean);
const texto = () => document.querySelector('.content')!.textContent!;

describe('Sheele', () => {
  it('Lock: tipo, nivel y estadísticas salen del Excel', async () => {
    abrirFicha('lock', 'sheele');
    await esperarListo();
    expect(celda('Sheele!M5').value).toBe('Aire');
    expect(texto()).toContain('Nivel 6');
    expect(texto()).toContain('110');            // proyección mágica
  }, T);

  it('el temporal de una característica sube su total; mejorar una habilidad la recalcula', async () => {
    const f = abrirFicha('lock', 'sheele');
    await esperarListo();
    const fila = (r: number) => document.querySelector(`[data-clave="Sheele!F${r}"]`)!.closest('tr')!.textContent!;
    expect(fila(9)).toContain('8');
    fireEvent.change(celda('Sheele!F9'), { target: { value: '3' } });
    await waitFor(() => expect(fila(9)).toContain('11'));
    expect(store.buscar(f.id)!.entradas['Sheele!F9']).toBe(3);
    fireEvent.change(celda('Sheele!R10'), { target: { value: '2' } });
    expect(store.buscar(f.id)!.entradas['Sheele!R10']).toBe(2);
    await waitFor(() => expect(motor().valor('Sheele!X10')).toBe(80));   // 60 base + 10 por punto de mejora
  }, T);

  it('mejoras de Sheele: siempre hay una fila libre y las opciones salen de la tabla', async () => {
    abrirFicha('lock', 'sheele');
    await esperarListo();
    await waitFor(() => expect(opcionesDe('Sheele!C24').length).toBeGreaterThan(3));
    expect(celda('Sheele!C25')).toBeFalsy();
    fireEvent.change(celda('Sheele!C24'), { target: { value: opcionesDe('Sheele!C24')[0] } });
    await waitFor(() => expect(celda('Sheele!C25')).toBeTruthy());
  }, T);
});

describe('Elan', () => {
  it('elegir entidad abre la lista de dones y siempre hay una fila libre', async () => {
    const f = abrirFicha('lock', 'elan');
    await esperarListo();
    await waitFor(() => expect(opcionesDe('Elan!C11').length).toBeGreaterThan(3));
    const entidad = opcionesDe('Elan!C11')[0];
    fireEvent.change(celda('Elan!C11'), { target: { value: entidad } });
    expect(store.buscar(f.id)!.entradas['Elan!C11']).toBe(entidad);
    await waitFor(() => expect(opcionesDe('Elan!C13').length).toBeGreaterThan(2));
    expect(celda('Elan!C14')).toBeFalsy();
    fireEvent.change(celda('Elan!C13'), { target: { value: opcionesDe('Elan!C13')[0] } });
    await waitFor(() => expect(celda('Elan!C14')).toBeTruthy());
  }, T);
});

describe('Equipo', () => {
  it('el peso del equipo suma al peso total y las filas crecen de una en una', async () => {
    const f = abrirFicha('lock', 'equipo');
    await esperarListo();
    expect(celda('General!AF12')).toBeFalsy();
    fireEvent.change(celda('General!AF11'), { target: { value: 'Mochila' } });
    fireEvent.change(celda('General!AL11'), { target: { value: '5' } });
    expect(store.buscar(f.id)!.entradas).toMatchObject({ 'General!AF11': 'Mochila', 'General!AL11': 5 });
    await waitFor(() => expect(celda('General!AF12')).toBeTruthy());
    await waitFor(() => expect(texto()).toContain('Peso total'));
    expect(Number([...document.querySelectorAll('.stat')].find((s) => s.textContent!.includes('Peso total'))!.querySelector('.stat-v')!.textContent)).toBeGreaterThanOrEqual(5);
  }, T);

  it('dinero, fama y contactos se guardan', async () => {
    const f = abrirFicha('lock', 'equipo');
    await esperarListo();
    fireEvent.change(celda('General!Y59'), { target: { value: '12' } });
    fireEvent.change(celda('General!AF47'), { target: { value: 'Maestro herrero' } });
    fireEvent.change(celda('General!AI58'), { target: { value: '3' } });
    expect(store.buscar(f.id)!.entradas).toMatchObject({ 'General!Y59': 12, 'General!AF47': 'Maestro herrero', 'General!AI58': 3 });
  }, T);
});
