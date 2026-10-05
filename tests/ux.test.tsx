// @vitest-environment happy-dom
// Usabilidad: menú ordenado por uso, paneles vacíos plegados, secundarias sin PD ocultas con interruptor y datos de la lista sin abrir la ficha
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
const { Lista } = await import('../src/ui/Lista');
const { modoTecnicas } = await import('../src/ui/Tecnicas');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });
const lock = (extra: Record<string, Entrada> = {}) => {
  const base = read('ref/fichas/lock.json') as { entradas: Record<string, Entrada> };
  return store.importar(JSON.stringify({ ...base, entradas: { ...base.entradas, ...extra } }));
};
const titulos = () => [...document.querySelectorAll('details.plegable')].map((d) => ({ t: d.querySelector('.panel-title')!.textContent!, abierto: (d as HTMLDetailsElement).open }));

describe('usabilidad', () => {
  it('el menú sigue el uso real de las fichas: personaje, PD, combate y ventajas primero; Sheele y Elan al final', async () => {
    const f = lock();
    render(<FichaView id={f.id} seccion="principal" />);
    const enlaces = [...document.querySelectorAll('nav.sections a')].map((a) => a.textContent);
    expect(enlaces.slice(0, 4)).toEqual(['Principal', 'Desarrollo (PD)', 'Combate', 'Ventajas y poderes']);
    expect(enlaces.indexOf('Sheele')).toBeGreaterThan(enlaces.indexOf('Psíquica'));
  }, T);

  it('en Principal: características antes que el estado actual, que va plegado si está vacío', async () => {
    const f = lock({ 'Principal!J77': '' });                                            // Lock trae puntos de destino: se quitan para dejar el panel vacío
    render(<FichaView id={f.id} seccion="principal" />);
    await waitFor(() => expect(document.querySelector('details.plegable')).toBeTruthy(), { timeout: 20_000 });
    const orden = [...document.querySelectorAll('main .panel-title')].map((h) => h.textContent);
    expect(orden.indexOf('Características')).toBeLessThan(orden.indexOf('Estado actual y valores especiales'));
    expect(titulos().find((x) => x.t === 'Estado actual y valores especiales')!.abierto).toBe(false);
    cleanup(); abierta.value = null;
    const g = lock({ 'Principal!P11': 100 });                                           // PV actuales escritos: se abre
    render(<FichaView id={g.id} seccion="principal" />);
    await waitFor(() => expect(titulos().length).toBeGreaterThan(0), { timeout: 20_000 });
    expect(titulos().find((x) => x.t === 'Estado actual y valores especiales')!.abierto).toBe(true);
  }, T);

  it('los paneles vacíos de Combate y Equipo arrancan plegados y siguen en la página', async () => {
    const f = lock();
    render(<FichaView id={f.id} seccion="equipo" />);
    await waitFor(() => expect(titulos().length).toBeGreaterThan(3), { timeout: 20_000 });
    expect(titulos().filter((x) => x.abierto).length).toBeLessThan(titulos().length);
    expect(document.querySelectorAll('details.plegable [data-clave]').length).toBeGreaterThan(5);      // sus casillas siguen en el DOM
  }, T);

  it('Desarrollo: orden por uso (secundarias tras combate) y secundarias sin PD ocultas con interruptor', async () => {
    const f = lock({ 'PDs!K143': 5, 'PDs!K144': 5 });
    render(<FichaView id={f.id} seccion="desarrollo" />);
    await waitFor(() => expect(document.querySelector('.tabla.pd')).toBeTruthy(), { timeout: 20_000 });
    const orden = [...document.querySelectorAll('main .panel-title')].map((h) => h.textContent);
    expect(orden.indexOf('Habilidades secundarias')).toBe(orden.indexOf('Habilidades de combate') + 1);
    const panel = [...document.querySelectorAll('details.plegable')].find((d) => d.querySelector('.panel-title')!.textContent === 'Habilidades secundarias')!;
    const filas = () => [...panel.querySelectorAll<HTMLTableRowElement>('tbody tr:not(.grupo-cab)')];
    expect(filas().filter((r) => !r.hidden).length).toBeLessThan(filas().length - 10);     // solo las desarrolladas
    expect(filas().length).toBeGreaterThan(40);                                           // las demás siguen en el DOM
    const interruptor = [...panel.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].find((c) => c.parentElement!.textContent!.includes('Mostrar también'))!;
    fireEvent.click(interruptor);
    await waitFor(() => expect(filas().every((r) => !r.hidden)).toBe(true));
  }, T);

  it('la lista enseña categoría, raza y nivel sin abrir la ficha', () => {
    lock();
    render(<Lista />);
    expect(document.body.textContent).toContain('Hechicero');
    expect(document.body.textContent).toMatch(/Nivel 6/);
    expect(document.body.textContent).not.toContain('Sin abrir');
    void modoTecnicas;
  });
});
