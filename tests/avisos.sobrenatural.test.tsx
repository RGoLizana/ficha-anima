// @vitest-environment happy-dom
// Avisos de Magia y Psíquica: cada uno sale dentro de su panel, no al principio de la sección
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, render, waitFor } from '@testing-library/preact';
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

async function abrirFicha(n: NombreFicha, seccion: string) {
  const f = store.importar(JSON.stringify(read(`ref/fichas/${n}.json`)));
  render(<FichaView id={f.id} seccion={seccion} />);
  await waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
}
const poner = (k: string, v: Entrada | null) => { valores.value = { ...valores.value, ...motor().poner(k, v) }; };
const panel = (titulo: string) => [...document.querySelectorAll('section.panel, details.panel')].find((s) => s.querySelector('.panel-title')?.textContent === titulo)!;
const avisoEn = (titulo: string, texto: string) => [...panel(titulo).querySelectorAll('[role=status]')].some((p) => p.textContent!.includes(texto));
const avisoEnTodo = (texto: string) => [...document.querySelectorAll('[role=status]')].some((p) => p.textContent!.includes(texto));

describe('avisos de magia', () => {
  it('exceso de nivel de magia y de PDs salen en el panel Nivel de magia y se van al deshacer', async () => {
    await abrirFicha('lock', 'magia');
    const antes = f0('Místicos!G15');
    poner('Místicos!G15', 500);
    poner('PDs!M96', 400);
    await waitFor(() => expect(avisoEn('Nivel de magia', 'Exceso de Nivel de Magia')).toBe(true));
    expect(avisoEn('Nivel de magia', 'Exceso en Proyección Mágica')).toBe(true);
    expect(avisoEn('Vías de magia', 'Exceso de Nivel de Magia')).toBe(false);
    poner('Místicos!G15', antes);
    poner('PDs!M96', f0('PDs!M96'));
    await waitFor(() => expect(avisoEnTodo('Exceso')).toBe(false));
  }, T);
});

describe('avisos de psíquica', () => {
  it('exceso de CVs bajo el potencial, innatos bajo poderes innatos, PDs bajo poderes psíquicos', async () => {
    await abrirFicha('ayane', 'psiquica');
    poner('Psíquicos!M10', 50);
    await waitFor(() => expect(avisoEn('Potencial psíquico', 'Exceso de CVs')).toBe(true));
    expect(avisoEn('Poderes innatos', 'Exceso de CVs')).toBe(false);
    poner('Psíquicos!M10', f0('Psíquicos!M10'));
    poner('Psíquicos!M13', -1);
    await waitFor(() => expect(avisoEn('Poderes innatos', 'Exceso de innatos activos')).toBe(true));
    expect(avisoEn('Potencial psíquico', 'innatos')).toBe(false);
    poner('Psíquicos!M13', f0('Psíquicos!M13'));
    poner('PDs!M112', 300);
    await waitFor(() => expect(avisoEn('Poderes psíquicos', 'Exceso en Proyección Psíquica')).toBe(true));
    poner('PDs!M112', f0('PDs!M112'));
    await waitFor(() => expect(avisoEnTodo('Exceso')).toBe(false));
  }, T);
});

/** Valor original de la ficha abierta (null si no tenía entrada). */
function f0(k: string): Entrada | null { return store.fichas.value[0]?.entradas[k] ?? null; }
