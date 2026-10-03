// @vitest-environment happy-dom
// Los máximos de las habilidades primarias se ven encima de sus casillas (no hay que jugar para descubrirlos)
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
  async poner(clave: string, v: Entrada | null) { valores.value = { ...valores.value, ...motor().poner(clave, v) }; },
  async opciones(clave: string, formula = LISTAS[clave]) { return formula ? motor().lista(formula, clave.slice(0, clave.lastIndexOf('!'))) : []; },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

const panel = (titulo: string) => [...document.querySelectorAll('.panel')].find((p) => p.querySelector('h2, .panel-title')?.textContent?.startsWith(titulo))!;

describe('máximos de las primarias en Desarrollo', () => {
  it('Lock: cada bloque dice su máximo encima de la tabla y la fila lleva el suyo junto a su casilla', async () => {
    const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
    render(<FichaView id={f.id} seccion="desarrollo" />);
    await waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
    await waitFor(() => expect(document.querySelector('.limites')).toBeTruthy());
    const total = Number(motor().valor('PDs!Z194'));
    expect(total).toBeGreaterThan(0);
    const dato = (p: Element, t: string) => [...p.querySelectorAll('.limites > div')].find((d) => d.querySelector('dt')!.textContent === t)?.querySelector('dd')?.textContent;
    const combate = panel('Habilidades de combate');
    expect(dato(combate, 'Ataque + defensa juntos')).toContain(`${Math.round(total / 2)} PD (50 %`);
    expect(dato(combate, 'Cada una (ataque, parada, esquiva)')).toContain(`${Math.round(total / 4)} PD (25 %`);
    expect(dato(combate, 'Ataque frente a defensa')).toContain('50 puntos');
    expect(combate.querySelector('.limites')!.textContent).toMatch(/Máx\. de PD en primarias/);
    // junto a la casilla de H. Ataque
    const ataque = [...combate.querySelectorAll('tbody tr')].find((tr) => tr.querySelector('th')!.textContent!.startsWith('H. Ataque'))!;
    expect(ataque.querySelector('.limite-fila')!.textContent).toContain('25 %');
    expect(panel('Ki').querySelector('.limites')!.textContent).toContain('Conocimiento Marcial');
    expect(dato(panel('Ki'), 'Conocimiento Marcial')).toContain(`${Math.round(total / 10)} PD (10 %`);
    expect(dato(panel('Habilidades místicas'), 'Nivel de magia')).toContain('10 %');
    expect(dato(panel('Habilidades místicas'), 'Proyección mágica')).toMatch(/la mitad del límite/);
    expect(dato(panel('Habilidades psíquicas'), 'Proyección psíquica')).toMatch(/la mitad del límite/);
  }, T);

  it('el máximo se actualiza al cambiar el nivel (sale del Excel, no está escrito a mano)', async () => {
    const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
    render(<FichaView id={f.id} seccion="desarrollo" />);
    await waitFor(() => expect(document.querySelector('.limites')).toBeTruthy(), { timeout: 20_000 });
    const antes = panel('Habilidades de combate').querySelector('.limites')!.textContent;
    store.editar(f.id, 'PDs!S7', 12);                                                   // nivel del personaje: cambia los PD y sus límites
    await waitFor(() => expect(panel('Habilidades de combate').querySelector('.limites')!.textContent).not.toBe(antes));
    expect(store.buscar(f.id)!.entradas['PDs!S7']).toBe(12);
  }, T);
});
