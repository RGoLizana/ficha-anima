// @vitest-environment happy-dom
// Asistente de nueva ficha (paso 2 pendiente de futuro.test.ts): escribe en las celdas de las secciones,
// se pueden saltar pasos y terminar a medias, y pasarse de un límite avisa sin bloquear.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, celdasEntrada, listas, motor } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

// Motor en el mismo hilo (igual que ui.test.tsx)
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
const { Asistente } = await import('../src/ui/Asistente');
const { Lista } = await import('../src/ui/Lista');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

function nueva() {
  const f = store.crear();
  render(<Asistente id={f.id} />);
  return f;
}
const esperarListo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
const celda = (clave: string) => document.querySelector(`[data-clave="${clave}"] input, [data-clave="${clave}"] select`) as HTMLInputElement & HTMLSelectElement;
const opcionesDe = (clave: string) => [...(celda(clave)?.options ?? [])].map((o) => o.value).filter((o) => o && !o.startsWith('>') && !o.startsWith('--'));
const paso = () => document.querySelector('[aria-current="step"]')!.textContent;
const entradas = (id: string) => store.buscar(id)!.entradas;

describe('asistente de nueva ficha', () => {
  it('Nueva ficha crea la ficha y abre el asistente', () => {
    render(<Lista />);
    fireEvent.click(screen.getByText('+ Nueva ficha'));
    expect(store.fichas.value).toHaveLength(1);
    expect(location.hash).toBe(`#/nueva/${store.fichas.value[0].id}`);
  });

  it('recorre origen → características → PD → poderes → equipo con progreso accesible', async () => {
    nueva();
    await esperarListo();
    const barra = screen.getByRole('progressbar');
    const titulos = ['Origen', 'Características', 'Desarrollo (PD)', 'Ventajas y poderes', 'Equipo y resumen'];
    for (const [i, t] of titulos.entries()) {
      expect(paso()).toBe(`${i + 1}. ${t}`);
      expect(barra.getAttribute('aria-valuenow')).toBe(String(i + 1));
      if (i < titulos.length - 1) fireEvent.click(screen.getByText('Siguiente'));
    }
    expect(screen.queryByText('Siguiente')).toBeNull();
    fireEvent.click(screen.getByText('Anterior'));
    expect(paso()).toBe('4. Ventajas y poderes');
  }, T);

  it('escribe en las mismas celdas que las secciones (General!F22/F23, PDs!O7/S7, Principal!E11:E18…)', async () => {
    const f = nueva();
    await esperarListo();
    fireEvent.change(celda('General!F22'), { target: { value: 'Kira' } });
    await waitFor(() => expect(opcionesDe('General!F23')).toContain('Humano'));
    fireEvent.change(celda('General!F23'), { target: { value: 'Humano' } });
    await waitFor(() => expect(opcionesDe('PDs!O7')).toContain('Guerrero'));
    fireEvent.change(celda('PDs!O7'), { target: { value: 'Guerrero' } });
    fireEvent.change(celda('PDs!S7'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.change(celda('Principal!E11'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.change(celda('PDs!M25'), { target: { value: '50' } });
    fireEvent.click(screen.getByText('Siguiente'));
    await waitFor(() => expect(opcionesDe('Principal!C35').length).toBeGreaterThan(0));
    const ventaja = opcionesDe('Principal!C35')[0];
    fireEvent.change(celda('Principal!C35'), { target: { value: ventaja } });
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.change(celda('General!Y59'), { target: { value: '10' } });

    expect(entradas(f.id)).toMatchObject({
      'General!F22': 'Kira', 'General!F23': 'Humano', 'PDs!O7': 'Guerrero', 'PDs!S7': 1,
      'Principal!E11': 8, 'PDs!M25': 50, 'Principal!C35': ventaja, 'General!Y59': 10,
    });
    // lo que calcula el Excel se ve en el resumen final
    await waitFor(() => expect(document.querySelector('.tiles')!.textContent).toMatch(/\d/));
    expect(document.body.textContent).toContain('Guerrero');
  }, T);

  it('todas las casillas de todos los pasos son celdas de entrada reales del Excel', async () => {
    const entrada = celdasEntrada();
    nueva();
    await esperarListo();
    for (let i = 0; i < 5; i++) {
      const claves = [...document.querySelectorAll('[data-clave]')].map((e) => e.getAttribute('data-clave')!);
      expect(claves.length, `paso ${i + 1}`).toBeGreaterThan(0);
      expect(claves.filter((c) => !entrada.has(c)), `paso ${i + 1}`).toEqual([]);
      if (i < 4) fireEvent.click(screen.getByText('Saltar'));
    }
  }, T);

  it('se pueden saltar pasos y terminar a medias: lo escrito se queda en la ficha', async () => {
    const f = nueva();
    await esperarListo();
    fireEvent.click(screen.getByText('Saltar'));
    fireEvent.click(screen.getByText('Saltar'));
    expect(paso()).toBe('3. Desarrollo (PD)');
    fireEvent.click(screen.getByText('5. Equipo y resumen')); // también se salta directamente a cualquier paso
    expect(paso()).toBe('5. Equipo y resumen');
    fireEvent.click(screen.getByText('2. Características'));
    fireEvent.change(celda('Principal!E12'), { target: { value: '7' } });
    // "Terminar" siempre disponible y lleva a la ficha
    for (const a of screen.getAllByText('Terminar')) expect(a.getAttribute('href')).toBe(`#/ficha/${f.id}`);
    expect(entradas(f.id)).toEqual({ 'General!F22': 'Nuevo personaje', 'Principal!E12': 7 });
  }, T);

  it('pasarse de un límite avisa con el texto del Excel pero no bloquea', async () => {
    const f = nueva();
    await esperarListo();
    fireEvent.click(screen.getByText('Siguiente'));
    fireEvent.change(celda('Principal!E11'), { target: { value: '12' } });
    await waitFor(() => expect(screen.getByText('Exceso de AGI inicial')).toBeTruthy());
    expect(entradas(f.id)['Principal!E11']).toBe(12);
    fireEvent.click(screen.getByText('Siguiente'));
    expect(paso()).toBe('3. Desarrollo (PD)');
    fireEvent.change(celda('PDs!M25'), { target: { value: '4000' } });
    await waitFor(() => expect(screen.getByText('Exceso de PDs gastados')).toBeTruthy());
    expect(entradas(f.id)['PDs!M25']).toBe(4000);
    fireEvent.click(screen.getByText('Siguiente'));
    expect(paso()).toBe('4. Ventajas y poderes');
  }, T);
});
