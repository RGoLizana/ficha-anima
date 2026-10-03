// @vitest-environment happy-dom
// Avisos de Desarrollo / Principal: cada uno sale dentro del panel que lo provoca y desaparece al deshacer
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

function abrir(n: NombreFicha, seccion: string, cambios: Record<string, Entrada>) {
  const j = read(`ref/fichas/${n}.json`) as { entradas: Record<string, Entrada> };
  Object.assign(j.entradas, cambios);
  const f = store.importar(JSON.stringify(j));
  render(<FichaView id={f.id} seccion={seccion} />);
  return f;
}
const listo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
const panel = (titulo: string) => [...document.querySelectorAll('.panel')].find((p) => p.querySelector('.panel-title')?.textContent === titulo)!;
const avisos = (titulo: string) => [...panel(titulo).querySelectorAll('.aviso')].map((a) => a.textContent!).join(' | ');

const CASOS: [NombreFicha, string, string, Record<string, Entrada>, string, string][] = [
  ['sesshomaru', 'desarrollo', 'Puntos de desarrollo', { 'PDs!M25': 400 }, 'PDs!M25', 'Exceso de PDs gastados'],
  ['sesshomaru', 'desarrollo', 'Habilidades de combate', { 'PDs!M25': 400 }, 'PDs!M25', 'Ataque + Defensa no debe superar:'],
  ['sesshomaru', 'desarrollo', 'Ki', { 'PDs!M42': 100 }, 'PDs!M42', 'Exceso de PDs en Conocimiento Marcial'],
  ['lock', 'desarrollo', 'Habilidades místicas', { 'PDs!M96': 400 }, 'PDs!M96', 'Exceso en Proyección Mágica'],
  ['ayane', 'desarrollo', 'Habilidades psíquicas', { 'PDs!M112': 300 }, 'PDs!M112', 'Exceso en Proyección Psíquica'],
  ['sesshomaru', 'principal', 'Características', { 'Principal!E11': 12 }, 'Principal!E11', 'Exceso de AGI inicial'],
];

describe('avisos de Desarrollo y Principal, bajo su categoría', () => {
  it.each(CASOS)('%s: «%s» sale en el panel «%s» y no arriba', async (n, sec, titulo, cambios, clave, texto) => {
    const original = (read(`ref/fichas/${n}.json`) as { entradas: Record<string, Entrada> }).entradas[clave];
    abrir(n, sec, cambios);
    await listo();
    await waitFor(() => expect(avisos(titulo)).toContain(texto));
    // el primer panel de la sección no arrastra avisos de otros paneles (salvo que sea el suyo)
    const fuera = [...document.querySelectorAll('.content > .aviso, .content > .stack-sm > .aviso')];
    expect(fuera).toHaveLength(0);
    // deshacer
    const { poner } = await import('../src/engine');
    await poner(clave, original ?? null);
    await waitFor(() => expect(avisos(titulo)).not.toContain(texto));
  }, T);
});
