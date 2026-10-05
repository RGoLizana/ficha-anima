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
const { modoTecnicas } = await import('../src/ui/Tecnicas');
modoTecnicas.value = 'experto';   // estas pruebas miran todas las casillas de la hoja

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

function abrirFicha(entradas: Record<string, Entrada>) {
  const base = read('ref/fichas/lock.json');
  const f = store.importar(JSON.stringify({ ...base, entradas: { ...base.entradas, ...entradas } }));
  render(<FichaView id={f.id} seccion="sheele" />);
  return f;
}
const esperarListo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
const celda = (clave: string) => document.querySelector(`[data-clave="${clave}"] select`) as HTMLSelectElement;
const opcionesDe = (clave: string) => [...(celda(clave)?.options ?? [])].map((o) => o.value).filter((o) => o && !o.startsWith('>'));
const texto = () => document.querySelector('.content')!.textContent!;

describe('Mejoras de Sheele por tipo', () => {
  it('con tipo Aire solo salen las de Aire y las genéricas', async () => {
    abrirFicha({ 'Sheele!M5': 'Aire' });
    await esperarListo();
    await waitFor(() => expect(opcionesDe('Sheele!C24')).toContain('Teletransporte'));
    const o = opcionesDe('Sheele!C24');
    expect(o).toContain('Elementalismo');
    expect(o).not.toContain('Meteoro');
  }, T);

  it('con tipo Tierra solo salen las de Tierra', async () => {
    abrirFicha({ 'Sheele!M5': 'Tierra' });
    await esperarListo();
    await waitFor(() => expect(opcionesDe('Sheele!F24')).toContain('Meteoro'));
    expect(opcionesDe('Sheele!F24')).not.toContain('Teletransporte');
  }, T);

  it('una mejora guardada de otro tipo se conserva y se marca', async () => {
    const f = abrirFicha({ 'Sheele!M5': 'Aire', 'Sheele!C24': 'Meteoro' });
    await esperarListo();
    await waitFor(() => expect(texto()).toContain('es una mejora de otro tipo'));
    expect(celda('Sheele!C24').value).toBe('Meteoro');
    expect(store.buscar(f.id)!.entradas['Sheele!C24']).toBe('Meteoro');
  }, T);

  it('sin tipo avisa y ofrece todas', async () => {
    abrirFicha({ 'Sheele!M5': 'Nada' });
    await esperarListo();
    await waitFor(() => expect(texto()).toContain('Elige primero el tipo de Sheele'));
    await waitFor(() => expect(opcionesDe('Sheele!C24')).toEqual(expect.arrayContaining(['Teletransporte', 'Meteoro'])));
  }, T);
});
