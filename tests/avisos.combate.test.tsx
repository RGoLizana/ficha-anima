// @vitest-environment happy-dom
// Avisos de Combate: cada uno sale dentro del panel/tarjeta que lo provoca y desaparece al deshacer.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor, read } from './helpers';
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

async function abrir(cambios: Record<string, Entrada>) {
  const json = read('ref/fichas/sesshomaru.json');
  json.entradas = { ...json.entradas, ...cambios };
  const f = store.importar(JSON.stringify(json));
  render(<FichaView id={f.id} seccion="combate" />);
  await waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
}
const panel = (titulo: string) => [...document.querySelectorAll('section.panel, details.panel')].find((s) => s.querySelector('h2')?.textContent === titulo)!;
const avisos = (el: Element) => [...el.querySelectorAll('[role=status].aviso')].map((p) => p.textContent);

describe('avisos de Combate bajo su categoría', () => {
  it('Ataque + Defensa sale en las armas, no arriba; desaparece al deshacer', async () => {
    await abrir({ 'PDs!M25': 400 });
    expect(avisos(panel('Armas cuerpo a cuerpo')).join()).toContain('Ataque + Defensa no debe superar:');
    expect(document.querySelector('.content > [role=status], .content > div > [role=status]')?.textContent ?? '').not.toContain('Ataque + Defensa');
    cleanup(); abierta.value = null; store.fichas.value = [];
    await abrir({});
    expect(avisos(document.body)).toEqual([]);
  }, T);

  it('Conocimiento Marcial sale bajo Tablas de armas', async () => {
    await abrir({ 'PDs!M42': 100 });
    const sig = panel('Tablas de armas').nextElementSibling!;
    expect(sig.getAttribute('role')).toBe('status');
    expect(sig.textContent).toContain('Conocimiento Marcial');
    expect(avisos(document.body).join()).toContain('Exceso de PDs en Conocimiento Marcial');
    expect(avisos(panel('Armas cuerpo a cuerpo'))).toEqual([]);
  }, T);

  it('Tam. excesivo sale dentro de la tarjeta del arma 1', async () => {
    await abrir({ 'Combate!F29': 'Gigante' });
    const tarjeta = document.querySelector('article.arma')!;
    expect(tarjeta.querySelector('[role=status]')?.textContent).toContain('Tam. excesivo');
    cleanup(); abierta.value = null; store.fichas.value = [];
    await abrir({});
    expect(avisos(document.body)).toEqual([]);
  }, T);
});
