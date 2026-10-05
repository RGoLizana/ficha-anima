// @vitest-environment happy-dom
// Avisos del Excel bajo su panel: Ki y Elan (motor real, sin worker)
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


const panelDe = (titulo: string) => [...document.querySelectorAll('section.panel, details.panel')].find((p) => p.querySelector('.panel-title')?.textContent === titulo)!;
const avisosEn = (p: Element) => [...p.querySelectorAll('[role=status]')].map((a) => a.textContent);

describe('avisos bajo su panel', () => {
  it('Ki: "Exceso de CM" sale en el panel de CM y se va al deshacer', async () => {
    const f = abrirFicha('sesshomaru', 'ki');
    await esperarListo();
    expect(avisosEn(panelDe('Puntos de CM'))).not.toContain('Exceso de CM');
    for (const c of ['Y11', 'Y13', 'Y15']) store.editar(f.id, `Ki!${c}`, 1);
    await waitFor(() => expect(avisosEn(panelDe('Puntos de CM'))).toContain('Exceso de CM'), { timeout: 20_000 });
    expect(document.querySelector('.content')!.firstElementChild!.matches('[role=status]')).toBe(false);
    for (const c of ['Y11', 'Y13', 'Y15']) store.editar(f.id, `Ki!${c}`, null);
    await waitFor(() => expect(avisosEn(panelDe('Puntos de CM'))).not.toContain('Exceso de CM'), { timeout: 20_000 });
  }, T);

  it('Elan: "Exceso de Elán utilizado" sale en el panel de la entidad 1', async () => {
    const f = abrirFicha('sesshomaru', 'elan');
    await esperarListo();
    store.editar(f.id, 'Elan!G11', -1);
    await waitFor(() => expect(avisosEn(panelDe('Elan 1')).join()).toContain('Exceso de Elán utilizado'), { timeout: 20_000 });
    store.editar(f.id, 'Elan!G11', null);
    await waitFor(() => expect(avisosEn(panelDe('Elan 1')).join()).not.toContain('Exceso'), { timeout: 20_000 });
  }, T);
});
