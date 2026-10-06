// @vitest-environment happy-dom
// Psíquica por pestañas: resumen corto, mis poderes por disciplina, grimorio con buscador y una sola dificultad, y las casillas de siempre
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
const { pestanaPsi } = await import('../src/ui/Psiquica');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; pestanaPsi.value = 'resumen'; });

const ayane = async () => {
  const f = store.importar(JSON.stringify(read('ref/fichas/ayane.json')));
  render(<FichaView id={f.id} seccion="psiquica" />);
  await waitFor(() => expect(document.querySelector('.psi-tabs')).toBeTruthy(), { timeout: 20_000 });
  return f;
};
const tab = (t: string) => [...document.querySelectorAll<HTMLButtonElement>('[role=tab]')].find((b) => b.textContent!.startsWith(t))!;
const panel = (titulo: string) => [...document.querySelectorAll<HTMLElement>('section.panel, details.panel')].find((s) => s.querySelector('.panel-title')?.textContent === titulo)!;
/** A la vista: ni dentro de un panel oculto por pestaña ni de un desplegable cerrado. */
const aLaVista = (el: Element) => !el.closest('[hidden]') && !(el.closest('details:not([open])') && !el.closest('summary'));
const carta = (n: string) => [...panel('Mis poderes').querySelectorAll('.psi-carta')].find((c) => c.querySelector('strong')!.textContent === n)!;

describe('Psíquica por pestañas', () => {
  it('cinco pestañas accesibles; cada una enseña lo suyo y la elegida se recuerda al volver', async () => {
    await ayane();
    expect([...document.querySelectorAll('[role=tab]')].map((b) => b.textContent!.replace(/\s*\d+$/, ''))).toEqual(['Resumen', 'Mis poderes', 'Disciplinas', 'Mantenidos', 'Construcción']);
    expect(tab('Resumen').getAttribute('aria-selected')).toBe('true');
    expect(panel('Potencial psíquico').hidden).toBe(false);
    expect(panel('Mis poderes').hidden).toBe(true);
    fireEvent.click(tab('Mis poderes'));
    await waitFor(() => expect(panel('Mis poderes').hidden).toBe(false));
    expect(panel('Potencial psíquico').hidden).toBe(true);
    fireEvent.click(tab('Construcción'));
    await waitFor(() => expect(panel('Poderes psíquicos').hidden).toBe(false));
    expect(panel('Grimorio de psíquica').hidden).toBe(false);
    expect(panel('Mis poderes').hidden).toBe(true);
    cleanup(); abierta.value = null;
    await ayane();
    expect(tab('Construcción').getAttribute('aria-selected')).toBe('true');
  }, T);

  it('la pestaña inicial cabe en poco: muy pocas filas y tarjetas a la vista (antes ~500 filas de tabla)', async () => {
    await ayane();
    await new Promise((x) => setTimeout(x, 300));
    const vistas = [...document.querySelectorAll('main tr, main article, main .psi-carta, main .compra')].filter(aLaVista);
    expect(vistas.length).toBeLessThanOrEqual(40);
    expect(document.querySelectorAll('main tr').length).toBeGreaterThan(40);             // el resto sigue en la página, oculto
  }, T);

  it('«Mis poderes» agrupa los de Ayane por disciplina, con innatos y CV, y el resto de la disciplina plegado', async () => {
    await ayane();
    fireEvent.click(tab('Mis poderes'));
    await waitFor(() => expect(panel('Mis poderes').querySelector('.psi-grupo')).toBeTruthy());
    const grupo = (d: string) => [...panel('Mis poderes').querySelectorAll('.psi-grupo')].find((g) => g.querySelector('h3')!.textContent!.startsWith(d))!;
    const nombres = (d: string) => [...grupo(d).querySelectorAll('.psi-carta strong')].map((s) => s.textContent);
    expect(nombres('Telequinesis')).toEqual(['Impacto telequinético', 'Presa telequinética', 'Balística', 'Escudo telequinético']);
    expect(nombres('Piroquinesis')).toEqual(['Inmolar']);
    expect(nombres('Crioquinesis')).toEqual(['Crear frío', 'Control sobre el frío', 'Esquirlas de hielo']);
    expect(nombres('Teletransporte')).toEqual(['Transporte defensivo']);
    expect(carta('Escudo telequinético').textContent).toContain('Innato');
    expect(carta('Inmolar').textContent).toContain('2 CV potenciados');
    const resto = grupo('Telequinesis').querySelector('details')!;
    expect(resto.open).toBe(false);
    expect(resto.querySelector('summary')!.textContent).toBe('Otros 10 poderes de Telequinesis');
  }, T);

  it('una sola dificultad: por defecto la del potencial (100 → Medio) y al cambiarla cambia el efecto', async () => {
    await ayane();
    fireEvent.click(tab('Mis poderes'));
    await waitFor(() => expect(carta('Escudo telequinético')).toBeTruthy());
    const efecto = () => carta('Escudo telequinético').querySelector('.psi-efecto')!.textContent;
    expect(efecto()).toMatch(/^Medio:/);
    const antes = efecto();
    const sel = panel('Mis poderes').querySelector<HTMLSelectElement>('.psi-dif select')!;
    fireEvent.change(sel, { target: { value: '5' } });
    await waitFor(() => expect(efecto()).toMatch(/^Absurdo:/));
    expect(efecto()).not.toBe(antes);
    expect(carta('Escudo telequinético').querySelectorAll('tr').length).toBe(0);           // la tabla de 10 solo al pedirla
    fireEvent.click(carta('Escudo telequinético').querySelector('.psi-mas')!);
    await waitFor(() => expect(carta('Escudo telequinético').querySelectorAll('tr').length).toBe(10));
  }, T);

  it('«Disciplinas»: una disciplina cada vez y buscador por nombre o efecto', async () => {
    await ayane();
    fireEvent.click(tab('Disciplinas'));
    const p = () => panel('Todas mis disciplinas');
    await waitFor(() => expect(p().querySelectorAll('.psi-carta').length).toBeGreaterThan(0));
    const disciplinas = () => new Set([...p().querySelectorAll('.psi-carta .muted')].map((s) => s.textContent!.split(' · ')[0]));
    expect([...disciplinas()]).toEqual(['Piroquinesis']);
    const todas = [...p().querySelectorAll<HTMLButtonElement>('.psi-chip')].find((b) => b.textContent!.startsWith('Todas'))!;
    fireEvent.click(todas);
    await waitFor(() => expect(disciplinas().size).toBe(4));
    const total = p().querySelectorAll('.psi-carta').length;
    fireEvent.input(p().querySelector('input[type=search]')!, { target: { value: 'escudo' } });
    await waitFor(() => expect(p().querySelectorAll('.psi-carta').length).toBeLessThan(total));
    const cartas = [...p().querySelectorAll('.psi-carta')];
    expect(cartas.length).toBeGreaterThan(0);
    expect(cartas.map((c) => c.querySelector('strong')!.textContent)).toContain('Escudo telequinético');
  }, T);

  it('«Construcción»: las casillas de siempre siguen y el −/+ escribe en la misma celda de CV', async () => {
    const f = await ayane();
    for (const k of ['Psíquicos!M10', 'Psíquicos!M13', 'Psíquicos!C25', 'Psíquicos!V11', 'Psíquicos!AA11', 'Psíquicos!AD11', 'Psíquicos!AO12', 'Psíquicos!AD17', 'Psíquicos!AI17', 'Psíquicos!AJ17', 'Psíquicos!J63', 'Psíquicos!C53', 'Grimorio Psíquica!S6'])
      expect(document.querySelector(`[data-clave="${k}"]`), k).toBeTruthy();
    fireEvent.click(tab('Construcción'));
    const tarjeta = document.querySelector('[data-clave="Psíquicos!V13"]')!.closest('.psi-carta')!;
    fireEvent.click(tarjeta.querySelector('[aria-label="Sumar 1 a CVs"]')!);
    expect(store.buscar(f.id)!.entradas['Psíquicos!AA13']).toBe(3);
    // solo filas ocupadas y una libre, agrupadas por disciplina
    const p = panel('Poderes psíquicos');
    expect(p.querySelectorAll('.psi-carta').length).toBe(10);
    expect([...p.querySelectorAll('.psi-grupo-t')].map((h) => h.textContent)).toEqual(['Crioquinesis', 'Piroquinesis', 'Telequinesis', 'Teletransporte']);
  }, T);

  it('un poder ya elegido no se ofrece otra vez en las demás casillas, y un duplicado importado avisa sin borrarse', async () => {
    const f = await ayane();
    const elegido = String(store.buscar(f.id)!.entradas['Psíquicos!V11']);
    tab('Construcción').click();
    await waitFor(() => expect(panel('Poderes psíquicos').hidden).toBe(false));
    const selLibre = () => panel('Poderes psíquicos').querySelector('.psi-carta.libre select') as HTMLSelectElement;
    await waitFor(() => expect(selLibre().options.length).toBeGreaterThan(5));
    expect([...selLibre().options].map((o) => o.value)).not.toContain(elegido);
    cleanup(); abierta.value = null; store.fichas.value = [];
    const base = read('ref/fichas/ayane.json') as { entradas: Record<string, Entrada> };
    const g = store.importar(JSON.stringify({ ...base, entradas: { ...base.entradas, 'Psíquicos!V13': elegido, 'Psíquicos!V15': elegido } }));
    render(<FichaView id={g.id} seccion="psiquica" />);
    await waitFor(() => expect(document.querySelector('.psi-tabs')).toBeTruthy(), { timeout: 20_000 });
    await waitFor(() => expect(document.body.textContent).toContain(`«${elegido}» está elegido dos veces`), { timeout: 30_000 });
    expect(store.buscar(g.id)!.entradas['Psíquicos!V13']).toBe(elegido);          // el duplicado no se borra
  }, T);
});
