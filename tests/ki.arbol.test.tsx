// @vitest-environment happy-dom
// Ki: árboles de habilidades reconstruidos de la hoja (tools/export_ki.py), su orden de compra (solo avisa) y el dibujo.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor, read } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';
import { leerFicha } from '../src/import/xlsm';

const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
vi.mock('../src/engine', () => ({
  motor: signal('listo'), errorMotor: signal(''), valores, abierta, formulaLista: (c: string) => LISTAS[c],
  async abrir(id: string, e: Record<string, Entrada>) { if (abierta.value === id) return; abierta.value = id; motor().cargar(e); valores.value = motor().hojas(HOJAS_VISIBLES); },
  async poner(c: string, v: Entrada | null) { valores.value = { ...valores.value, ...motor().poner(c, v) }; },
  async opciones(c: string, f = LISTAS[c]) { return f ? motor().lista(f, c.slice(0, c.lastIndexOf('!'))) : []; },
}));
const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');
const { ARBOL_KI, ARBOL_NEMESIS, estadoKi } = await import('../src/ui/Ki');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

const K = (c: string) => `Ki!${c}`;
const ARBOLES = [ARBOL_KI, ARBOL_NEMESIS];
const compradasDe = (e: Record<string, unknown>) =>
  ARBOLES.map((a) => new Set(a.nodos.map((n) => n.c).filter((c) => e[c] !== undefined && e[c] !== '' && e[c] !== null)));
const padre = (a: typeof ARBOL_KI, c: string) => a.nodos.find((n) => n.c === K(c))!.padre;

describe('árbol reconstruido', () => {
  it('raíces y aristas: el Ki cuelga de Uso del Ki y el Némesis de Uso del Némesis, como en la hoja y el Core', () => {
    expect(ARBOL_KI.nodos).toHaveLength(54);
    expect(ARBOL_NEMESIS.nodos).toHaveLength(21);
    const claves = [...ARBOL_KI.nodos, ...ARBOL_NEMESIS.nodos].map((n) => n.c).sort();
    expect(claves).toEqual(Object.keys(LISTAS).filter((c) => /^Ki!(Q(1\d|[2-5]\d|6[0-4])|I(4[3-9]|5\d|6[0-4]))$/.test(c)).sort());
    expect(ARBOL_KI.raiz).toBe(K('Q10'));
    expect(ARBOL_NEMESIS.raiz).toBe(K('I43'));
    for (const a of ARBOLES) expect(a.nodos.filter((n) => !n.padre).map((n) => n.c)).toEqual([a.raiz]);
    const esperadas: [string, string][] = [
      ['Q12', 'Q10'], ['Q13', 'Q12'], ['Q14', 'Q13'], ['Q26', 'Q12'], ['Q27', 'Q10'], ['Q28', 'Q27'], ['Q29', 'Q28'], ['Q31', 'Q28'],
      ['Q21', 'Q20'], ['Q23', 'Q22'], ['Q35', 'Q34'], ['Q41', 'Q32'], ['Q45', 'Q44'], ['Q52', 'Q50'], ['Q58', 'Q57'], ['Q59', 'Q58'],
      ['Q60', 'Q49'], ['Q62', 'Q10'], ['Q63', 'Q10'], ['Q64', 'Q63'],
    ];
    for (const [h, p] of esperadas) expect(padre(ARBOL_KI, h), h).toBe(K(p));
    for (const [h, p] of [['I45', 'I43'], ['I46', 'I45'], ['I55', 'I54'], ['I60', 'I59'], ['I64', 'I63']]) expect(padre(ARBOL_NEMESIS, h), h).toBe(K(p));
  });

  it('las compras de las fichas reales respetan el árbol (sin avisos)', () => {
    const casos: [string, Set<string>[]][] = (['lock', 'ayane', 'sesshomaru'] as const).map((n) => [n, compradasDe(read(`ref/fichas/${n}.json`).entradas)]);
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'golden');   // las .xlsm no están en CI
    if (existsSync(dir)) {
      for (const a of readdirSync(dir).filter((a) => a.endsWith('.xlsm'))) casos.push([a, compradasDe(leerFicha(new Uint8Array(readFileSync(join(dir, a)))).entradas)]);
    }
    expect([...casos.find(([n]) => n === 'lock')![1][0]].sort()).toEqual(['Q10', 'Q12', 'Q49', 'Q57'].map(K));
    for (const [n, cs] of casos) cs.forEach((c, i) => expect(estadoKi(ARBOLES[i], c).avisos, n).toEqual([]));
  }, T);

  it('estado: sin compras solo la raíz está disponible; saltarse el árbol avisa; lo innato cuenta como requisito', () => {
    const vacio = estadoKi(ARBOL_KI, new Set());
    expect(vacio.estado.get(K('Q10'))).toBe('disponible');
    expect(vacio.estado.get(K('Q12'))).toBe('bloqueada');
    expect(vacio.motivo.get(K('Q12'))).toBe('Requiere Uso del Ki');
    const salto = estadoKi(ARBOL_KI, new Set([K('Q10'), K('Q28')]));
    expect(salto.avisos).toEqual(['Te estás saltando el orden del árbol: para tomar Levitación antes necesitas Eliminación de peso.']);
    expect(salto.fuera).toEqual(new Set([K('Q28')]));
    expect(salto.estado.get(K('Q27'))).toBe('disponible');
    // Ocultación del Ki innata (D'Anjayni): Falsa muerte no avisa
    const innata = estadoKi(ARBOL_KI, new Set([K('Q10'), K('Q49'), K('Q52')]), new Set([K('Q50')]));
    expect(innata.avisos).toEqual([]);
    expect(innata.estado.get(K('Q50'))).toBe('innata');
  });
});

function abrirLock() {
  const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
  render(<FichaView id={f.id} seccion="ki" />);
  return f;
}
const esperarListo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
const casilla = (c: string) => document.querySelector(`[data-clave="${K(c)}"] input`) as HTMLInputElement;
const avisos = () => [...document.querySelectorAll('.aviso')].map((a) => a.textContent).join('\n');
const nodo = (c: string) => casilla(c).closest('.ki-nodo')!;

describe('árbol del Ki en la web', () => {
  it('dibuja los dos árboles con estados y cada casilla en su nodo', async () => {
    abrirLock();
    await esperarListo();
    expect(document.querySelectorAll('.ki-arbol')).toHaveLength(2);
    expect(document.querySelectorAll('.ki-nodo')).toHaveLength(75);
    await waitFor(() => expect(casilla('Q13')).toBeTruthy());
    expect(nodo('Q12').classList).toContain('ki-comprada');
    expect(nodo('Q13').classList).toContain('ki-disponible');
    expect(nodo('Q28').classList).toContain('ki-bloqueada');
    expect(nodo('Q28').textContent).toContain('Requiere Eliminación de peso');
    expect(nodo('Q10').classList).toContain('ki-raiz');
    expect(casilla('Q12').closest('li')!.classList).toContain('ki-on');
    expect(avisos()).not.toContain('saltando');
  }, T);

  it('marcar una habilidad sin su requisito se guarda y avisa; deshacer quita el aviso', async () => {
    const f = abrirLock();
    await esperarListo();
    await waitFor(() => expect(casilla('Q28').disabled).toBe(false));
    fireEvent.click(casilla('Q28'));                          // Levitación sin Eliminación de peso
    await waitFor(() => expect(store.buscar(f.id)!.entradas[K('Q28')]).toBe(20));
    await waitFor(() => expect(avisos()).toContain('para tomar Levitación antes necesitas Eliminación de peso'));
    expect(nodo('Q28').classList).toContain('ki-fuera');
    fireEvent.click(casilla('Q28'));
    await waitFor(() => expect(avisos()).not.toContain('Levitación'));
    expect(store.buscar(f.id)!.entradas[K('Q28')]).toBeUndefined();
  }, T);
});
