// @vitest-environment happy-dom
// Sección Personalización (contenido fuera de las reglas): las casillas se guardan en la ficha y el Excel recalcula.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, celdasEntrada, listas, motor, read, type NombreFicha } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
vi.mock('../src/engine', () => ({
  motor: signal('listo'), errorMotor: signal(''), valores, abierta, formulaLista: (c: string) => LISTAS[c],
  async abrir(id: string, e: Record<string, Entrada>) {
    if (abierta.value === id) return;
    abierta.value = id; motor().cargar(e); valores.value = motor().hojas(HOJAS_VISIBLES);
  },
  async poner(c: string, v: Entrada | null) { valores.value = { ...valores.value, ...motor().poner(c, v) }; },
  async opciones(c: string, f = LISTAS[c]) { return f ? motor().lista(f, c.slice(0, c.lastIndexOf('!'))) : []; },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

const P = (c: string) => `Personalización!${c}`;
function abrirFicha(n: NombreFicha) {
  const f = store.importar(JSON.stringify(read(`ref/fichas/${n}.json`)));
  render(<FichaView id={f.id} seccion="personalizacion" />);
  return f;
}
const esperarListo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
const celda = (clave: string) => document.querySelector(`[data-clave="${clave}"] input, [data-clave="${clave}"] select, [data-clave="${clave}"] textarea`) as HTMLInputElement & HTMLSelectElement;
const opcionesDe = (clave: string) => [...(celda(clave)?.options ?? [])].map((o) => o.value).filter(Boolean);
const val = (c: string) => valores.value[P(c)];

describe('Personalización', () => {
  it('va marcada como personalizada y sus casillas escriben en celdas de entrada reales', async () => {
    abrirFicha('lock');
    await esperarListo();
    expect(screen.getAllByText('Personalizado').length).toBeGreaterThan(10);
    expect(document.querySelector('.personalizado')).toBeTruthy();
    const entrada = celdasEntrada();
    const claves = [...document.querySelectorAll('[data-clave]')].map((e) => e.getAttribute('data-clave')!);
    expect(claves.length).toBeGreaterThan(100);
    expect(claves.filter((c) => !entrada.has(c))).toEqual([]);
  }, T);

  it('elegir una habilidad en "Ventajas en secundarias" resta un hueco libre', async () => {
    const f = abrirFicha('lock');
    await esperarListo();
    const antes = Number(val('K11'));
    await waitFor(() => expect(opcionesDe(P('L11')).length).toBeGreaterThan(0));
    const hab = opcionesDe(P('L11')).find((o) => !o.startsWith('>') && !o.startsWith('--'))!;
    fireEvent.change(celda(P('L11')), { target: { value: hab } });
    expect(store.buscar(f.id)!.entradas[P('L11')]).toBe(hab);
    await waitFor(() => expect(Number(val('K11'))).toBe(antes - 1));
  }, T);

  it('el bono de una raíz cultural personalizada cambia la suma total', async () => {
    const f = abrirFicha('lock');
    await esperarListo();
    const antes = Number(val('Q21'));
    fireEvent.change(celda(P('H18')), { target: { value: String(Number(val('H18')) + 10) } });
    expect(typeof store.buscar(f.id)!.entradas[P('H18')]).toBe('number');
    await waitFor(() => expect(Number(val('Q21'))).toBe(antes + 10));
    expect(document.body.textContent).toContain(`Suma total: ${antes + 10}`);
  }, T);

  it('una ventaja personalizada nueva se guarda y abre otra fila libre', async () => {
    const f = abrirFicha('ayane');
    await esperarListo();
    const filas = () => [30, 31, 32, 33].filter((r) => celda(P(`C${r}`))).length;
    const libre = [30, 31, 32, 33].find((r) => celda(P(`C${r}`)) && !celda(P(`C${r}`)).value)!;
    const n = filas();
    fireEvent.change(celda(P(`C${libre}`)), { target: { value: 'Sangre de dragón' } });
    fireEvent.change(celda(P(`G${libre}`)), { target: { value: '2' } });
    const e = store.buscar(f.id)!.entradas;
    expect([e[P(`C${libre}`)], e[P(`G${libre}`)]]).toEqual(['Sangre de dragón', 2]);
    if (libre < 33) await waitFor(() => expect(filas()).toBe(n + 1));
  }, T);

  it('cambiar la calidad de confección de una marioneta recalcula sus PV', async () => {
    const f = abrirFicha('lock');
    await esperarListo();
    await waitFor(() => expect(opcionesDe(P('V94')).length).toBeGreaterThan(1));
    const antes = val('Z93');
    const otra = opcionesDe(P('V94')).find((o) => o !== celda(P('V94')).value)!;
    fireEvent.change(celda(P('V94')), { target: { value: otra } });
    expect(store.buscar(f.id)!.entradas[P('V94')]).toBe(otra);
    await waitFor(() => expect(val('Z93')).not.toEqual(antes));
  }, T);
});
