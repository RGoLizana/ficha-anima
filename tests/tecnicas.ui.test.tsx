// @vitest-environment happy-dom
// Asistente de técnicas de ki: lista, plantillas, cambios que se escriben en las celdas del Excel y avisos que no bloquean.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
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
const { modoTecnicas } = await import('../src/ui/Tecnicas');
const { modoReparto } = await import('../src/ui/TecnicasAsistente');

const T = 120_000;
const H = 'Creación de Técnicas!';
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; modoReparto.value = 'barato'; });

function abrir() {
  modoTecnicas.value = 'guiado';
  const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
  render(<FichaView id={f.id} seccion="tecnicas" />);
  return f;
}
const entrada = (id: string, c: string) => store.buscar(id)!.entradas[H + c];
const v = (c: string) => valores.value[H + c];
const boton = (t: string | RegExp) => screen.getByRole('button', { name: t });
/** Botón de la tira de pasos. */
const paso = (t: string) => within(screen.getByRole('navigation', { name: 'Pasos del asistente' })).getByRole('button', { name: new RegExp(t) });
const quedan = () => v('AL63') === v('AL64');           // «Ki sin repartir» del bloque 2 a cero

describe('asistente de técnicas', () => {
  it('la lista resume cada técnica con lo que calcula el Excel', async () => {
    abrir();
    await waitFor(() => expect(screen.getByText('Baile espectral')).toBeTruthy());
    expect(screen.getByText(/Nivel 1 · CM 20 · Ki 12 · 3 asaltos acumulando/)).toBeTruthy();
    expect(screen.getAllByText('Crear aquí')).toHaveLength(9);
  }, T);

  it('una plantilla rellena las celdas, reparte el ki y el Excel no pide nada más', async () => {
    const f = abrir();
    await waitFor(() => expect(screen.getAllByText('Crear aquí').length).toBe(9));
    fireEvent.click(screen.getAllByText('Crear aquí')[0]);
    fireEvent.click(boton(/Defensiva · Las escamas/));
    await waitFor(() => expect(entrada(f.id, 'F50')).toBe('Defensas Adicionales'));
    expect(entrada(f.id, 'D46')).toBe('Las escamas');
    expect(entrada(f.id, 'D63')).toBe('+4');                                   // opción (grado) del efecto
    await waitFor(() => expect(Number(entrada(f.id, 'V50'))).toBeGreaterThan(0));   // ki repartido por la web (AGI es su principal: columna V)
    await waitFor(() => expect(quedan()).toBe(true));
    expect(v('AM76')).toBe(false);                                           // sin «ki puesto ≠ necesario»
  }, T);

  it('cambiar el grado recalcula el ki; lo escrito a mano se conserva y avisa', async () => {
    const f = abrir();
    await waitFor(() => expect(screen.getAllByText('Crear aquí').length).toBe(9));
    fireEvent.click(screen.getAllByText('Crear aquí')[0]);
    fireEvent.click(boton(/Defensiva · Las escamas/));
    await waitFor(() => expect(quedan()).toBe(true));
    fireEvent.click(paso('Efecto principal'));
    const antes = Number(entrada(f.id, 'V50'));
    fireEvent.click(await screen.findByRole('button', { name: /^\+6/ }));
    await waitFor(() => expect(entrada(f.id, 'D63')).toBe('+6'));
    await waitFor(() => expect(Number(entrada(f.id, 'V50'))).toBeGreaterThan(antes));
    await waitFor(() => expect(quedan()).toBe(true));
    // a mano: un punto de más en AGI → aviso, nada se bloquea
    fireEvent.click(paso('Reparto de Ki'));
    fireEvent.click(screen.getByRole('button', { name: 'Añadir 1 a Agilidad' }));
    await waitFor(() => expect(quedan()).toBe(false));
    expect(screen.getAllByText(/Has puesto 1 puntos de ki de más/).length).toBeGreaterThan(0);
    // cambiar de grado no pisa lo escrito a mano
    const manual = Number(entrada(f.id, 'V50'));
    fireEvent.click(paso('Efecto principal'));
    fireEvent.click(await screen.findByRole('button', { name: /^\+3/ }));
    await waitFor(() => expect(entrada(f.id, 'D63')).toBe('+3'));
    expect(Number(entrada(f.id, 'V50'))).toBe(manual);
    // «Repartir por mí» lo cuadra
    fireEvent.click(screen.getAllByRole('button', { name: 'Repartir por mí' })[0]);
    await waitFor(() => expect(quedan()).toBe(true));
  }, T);

  it('«lo más rápido» reparte entre más características y no tarda más asaltos', async () => {
    const f = abrir();
    await waitFor(() => expect(screen.getAllByText('Crear aquí').length).toBe(9));
    fireEvent.click(screen.getAllByText('Crear aquí')[0]);
    fireEvent.click(boton(/Ofensiva a distancia · Bola de fuego/));
    await waitFor(() => expect(quedan()).toBe(true));
    const barato = Number(v('AL63'));
    fireEvent.click(paso('Reparto de Ki'));
    fireEvent.click(screen.getAllByRole('button', { name: /Lo más rápido · / })[0]);
    await waitFor(() => expect(quedan()).toBe(true));
    expect(Number(v('AL63'))).toBeGreaterThanOrEqual(barato);
    expect(modoReparto.value).toBe('barato');                                   // el botón de cada efecto no cambia el valor por defecto
    fireEvent.click(within(screen.getByText('Reparto por defecto').closest('fieldset')!).getByRole('button', { name: 'Lo más rápido' }));
    expect(modoReparto.value).toBe('rapido');
    expect(entrada(f.id, 'F50')).toBe('Habilidad de Ataque');
  }, T);

  it('pasarse de CM avisa pero deja elegir; una técnica con efectos personalizados se manda al modo experto', async () => {
    const f = abrir();
    await waitFor(() => expect(screen.getAllByText('Crear aquí').length).toBe(9));
    fireEvent.click(screen.getAllByText('Crear aquí')[0]);
    fireEvent.click(boton(/Ofensiva a distancia · Bola de fuego/));
    fireEvent.click(paso('Efecto principal'));
    fireEvent.click(await screen.findByRole('button', { name: /^\+200/ }));
    await waitFor(() => expect(entrada(f.id, 'D63')).toBe('+200'));            // se pudo elegir
    await waitFor(() => expect(screen.getAllByText(/Te pasas \d+ CM del máximo de nivel 1/).length).toBeGreaterThan(0));
  }, T);
});
