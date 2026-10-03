// @vitest-environment happy-dom
// Resumen de las artes marciales en Combate: qué hace el arte + lo que añade su nivel + sus números.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor, read } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';
import datos from '../src/data/artes-marciales.json';

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

function ficha(extra: Record<string, Entrada>) {
  const base = read('ref/fichas/lock.json') as { entradas: Record<string, Entrada> };
  return store.importar(JSON.stringify({ ...base, entradas: { ...base.entradas, ...extra } }));
}

describe('artes marciales resumidas', () => {
  it('cada nivel de la tabla del Excel tiene su arte descrita', () => {
    for (const [nombre, x] of Object.entries(datos.niveles as Record<string, { a: string }>)) expect(datos.artes, nombre).toHaveProperty(x.a);
  });

  it('Aikido (Avanzado): arte, efecto del nivel y números', async () => {
    const f = ficha({ 'PDs!E59': 'Aikido', 'PDs!J59': 'Avanzado' });
    render(<FichaView id={f.id} seccion="combate" />);
    await waitFor(() => expect(document.querySelector('.arte-marcial')).toBeTruthy(), { timeout: 20_000 });
    const t = document.querySelector('.arte-marcial')!.textContent!;
    expect(t).toContain('Aikido');
    expect(t).toContain('Avanzado');
    expect(t).toContain('Defensa que vuelve la fuerza del atacante');             // qué hace el arte
    expect(t).toMatch(/En nivel Avanzado:.*Presa y Derribo sin penalizador/);       // el efecto de su nivel, tal como lo dice el Excel
    expect(t).toContain('Daño base 10 + FUE');
    expect(t).toContain('Esquiva +10');
    expect(t).toContain('Parada +10');
  }, T);

  it('un nivel sin efecto especial lo dice y deja solo los bonos (Boxeo base)', async () => {
    const f = ficha({ 'PDs!E59': 'Boxeo', 'PDs!J59': 'Base' });
    render(<FichaView id={f.id} seccion="combate" />);
    await waitFor(() => expect(document.querySelector('.arte-marcial')).toBeTruthy(), { timeout: 20_000 });
    const t = document.querySelector('.arte-marcial')!.textContent!;
    expect(t).toContain('sin efecto especial');
    expect(t).toContain('Turno +5');
  }, T);
});
