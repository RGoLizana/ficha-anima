// @vitest-environment happy-dom
// Metamagia: el árbol reconstruido de la hoja (tools/export_metamagia.py), su orden de compra (solo avisa) y los totales.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor, read } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';
import { leerFicha } from '../src/import/xlsm';
import arbol from '../src/data/metamagia-arbol.json';

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
const { estadoArbol } = await import('../src/ui/Metamagia');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

const M = (c: string) => `Metamagia!${c}`;
const NODOS = new Set(arbol.nodos.map((n) => n.c));
const compradasDe = (e: Record<string, unknown>) => new Set(Object.keys(e).filter((k) => NODOS.has(k) && e[k] !== '' && e[k] !== null));

describe('árbol reconstruido', () => {
  it('68 cajas conectadas, 21 raíces sin requisito de nivel y las conexiones del dibujo', () => {
    expect(arbol.nodos).toHaveLength(68);
    expect(Object.keys(LISTAS).filter((k) => k.startsWith('Metamagia!') && k !== 'Metamagia!R6').sort()).toEqual([...NODOS].sort());
    expect(arbol.raices).toHaveLength(21);
    expect(arbol.raices).toEqual(expect.arrayContaining(['J13', 'D23', 'V23', 'D53', 'P53', 'AE62'].map(M)));
    expect(arbol.raices).not.toContain(M('AB53'));
    const hay = (a: string, b: string) => arbol.aristas.some(([x, y]) => (x === M(a) && y === M(b)) || (x === M(b) && y === M(a)));
    for (const [a, b] of [['J13', 'G14'], ['J13', 'J18'], ['G14', 'G23'], ['D23', 'D31'], ['D45', 'D53'], ['AE53', 'AE62'], ['AB48', 'AB53'], ['AB53', 'AE53'], ['AE53', 'AH53']]) {
      expect(hay(a, b), `${a}-${b}`).toBe(true);
    }
    expect(hay('P23', 'S23')).toBe(false);   // la fila central tiene un hueco a cada lado de S
    expect(hay('J33', 'J43')).toBe(false);
    // todo el árbol es una sola pieza
    const vistos = new Set<string>(); const pila = [arbol.nodos[0].c];
    while (pila.length) { const c = pila.pop()!; if (vistos.has(c)) continue; vistos.add(c); pila.push(...arbol.aristas.filter((a) => a.includes(c)).flat()); }
    expect(vistos.size).toBe(68);
  });

  it('las compras de las fichas reales son un subárbol válido (sin avisos)', () => {
    const casos: [string, Set<string>][] = (['lock', 'ayane', 'sesshomaru'] as const).map((n) => [n, compradasDe(read(`ref/fichas/${n}.json`).entradas)]);
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'golden');   // las .xlsm no están en CI
    if (existsSync(dir)) {
      for (const a of readdirSync(dir).filter((a) => a.endsWith('.xlsm'))) casos.push([a, compradasDe(leerFicha(new Uint8Array(readFileSync(join(dir, a)))).entradas)]);
    }
    expect(casos.find(([n]) => n === 'lock')![1].size).toBe(5);
    for (const [n, compradas] of casos) expect(estadoArbol(compradas).avisos, n).toEqual([]);
  }, T);

  it('estado: sin compras solo las raíces están disponibles; con compras, lo conectado', () => {
    const vacio = estadoArbol(new Set());
    expect(vacio.estado.get(M('J13'))).toBe('disponible');
    expect(vacio.estado.get(M('AB53'))).toBe('bloqueada');
    const lock = estadoArbol(new Set(['AB48', 'AB53', 'AE53', 'AE62', 'AH53'].map(M)));
    expect(lock.estado.get(M('AB53'))).toBe('comprada');
    expect(lock.estado.get(M('Y53'))).toBe('disponible');
    expect(lock.estado.get(M('J13'))).toBe('bloqueada');
    expect(lock.motivo.get(M('J13'))).toContain('otra rama');
    expect(estadoArbol(new Set([M('AB53')])).avisos[0]).toMatch(/^Para tomar Proyección mágica determinada antes necesitas /);
    expect(estadoArbol(new Set([M('J13'), M('AE62')])).avisos[0]).toContain('no se puede empezar el árbol por dos sitios');
  });
});

function abrirLock() {
  const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
  render(<FichaView id={f.id} seccion="metamagia" />);
  return f;
}
const esperarListo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
const casilla = (c: string) => document.querySelector(`[data-clave="${M(c)}"] input`) as HTMLInputElement;
const avisos = () => [...document.querySelectorAll('.aviso')].map((a) => a.textContent).join('\n');
const nodo = (c: string) => casilla(c).closest('.mm-nodo')!;

describe('Metamagia en la web', () => {
  it('dibuja el árbol: estados visibles, líneas y casillas con nombre', async () => {
    abrirLock();
    await esperarListo();
    expect(document.querySelectorAll('.mm-nodo')).toHaveLength(68);
    expect(document.querySelectorAll('.mm-lineas path').length).toBe(arbol.lineas.length);
    expect(document.querySelectorAll('.mm-lineas path.on').length).toBeGreaterThan(0);
    expect(nodo('AB53').classList).toContain('mm-comprada');
    expect(nodo('Y53').classList).toContain('mm-disponible');
    expect(nodo('J13').classList).toContain('mm-bloqueada');
    expect(nodo('J13').textContent).toContain('Incremento destructivo');
    expect(avisos()).not.toMatch(/rama|necesitas/);
  }, T);

  it('marcar una bloqueada se guarda y avisa; empezar por otra raíz avisa; deshacer lo quita; T37 cuadra', async () => {
    const f = abrirLock();
    await esperarListo();
    const T37 = () => motor().valor('Metamagia!T37');
    expect(T37()).toBe(25);                                  // el valor que guarda el Excel de Lock
    await waitFor(() => expect(casilla('J28').disabled).toBe(false));
    fireEvent.click(casilla('J28'));                         // Precisión mística: su vecino J23 no está comprado
    await waitFor(() => expect(store.buscar(f.id)!.entradas[M('J28')]).toBe(10));
    await waitFor(() => expect(avisos()).toContain('Para tomar Precisión mística antes necesitas'));
    expect(nodo('J28').classList).toContain('mm-fuera');
    await waitFor(() => expect(T37()).toBe(35));
    fireEvent.click(casilla('J28'));
    await waitFor(() => expect(avisos()).not.toContain('Precisión mística'));
    await waitFor(() => expect(T37()).toBe(25));

    await waitFor(() => expect(casilla('J13').disabled).toBe(false));
    fireEvent.click(casilla('J13'));                         // segunda raíz, lejos de la rama de Lock
    await waitFor(() => expect(store.buscar(f.id)!.entradas[M('J13')]).toBe(10));
    await waitFor(() => expect(avisos()).toContain('no se puede empezar el árbol por dos sitios'));
    fireEvent.click(casilla('J13'));
    await waitFor(() => expect(avisos()).not.toContain('dos sitios'));
    expect(store.buscar(f.id)!.entradas[M('J13')]).toBeUndefined();
  }, T);
});
