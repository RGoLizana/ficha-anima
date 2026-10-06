// @vitest-environment happy-dom
// Tarjeta de nivel: +1/−1, cambio de categoría al momento y cambio programado (reserva PD sin tocar nivel ni categoría)
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
  async recargar(id: string, entradas: Record<string, Entrada>) { abierta.value = id; motor().cargar(entradas); valores.value = motor().hojas(HOJAS_VISIBLES); },
  async poner(clave: string, v: Entrada | null) { valores.value = { ...valores.value, ...motor().poner(clave, v) }; },
  async opciones(clave: string, formula = LISTAS[clave]) { return formula ? motor().lista(formula, clave.slice(0, clave.lastIndexOf('!'))) : []; },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });
const lock = () => store.importar(JSON.stringify(read('ref/fichas/lock.json')));
const ver = async (seccion = 'principal') => {
  const f = lock();
  render(<FichaView id={f.id} seccion={seccion} />);
  await waitFor(() => expect(document.querySelector('.tarjeta-nivel')).toBeTruthy(), { timeout: 20_000 });
  return f;
};
const boton = (t: RegExp) => [...document.querySelectorAll<HTMLButtonElement>('.tarjeta-nivel button')].find((b) => t.test(b.textContent ?? '') || t.test(b.getAttribute('aria-label') ?? ''))!;
const libres = () => Number(document.querySelector('.tarjeta-nivel .chip')!.textContent!.replace(/[^\d-]/g, ''));
const actual = (id: string) => store.buscar(id)!;

describe('tarjeta de nivel', () => {
  it('sale arriba de Principal y de Desarrollo con la categoría y el nivel', async () => {
    await ver();
    expect(document.querySelector('.tarjeta-nivel')!.textContent).toContain('Hechicero');
    expect(boton(/\+1 nivel de Hechicero/)).toBeTruthy();
    cleanup(); abierta.value = null; valores.value = {};
    await ver('desarrollo');
    expect(document.querySelector('.tarjeta-nivel')).toBeTruthy();
  }, T);

  it('+1 y −1 cambian los niveles de la categoría actual', async () => {
    const f = await ver();
    fireEvent.click(boton(/\+1 nivel/));
    expect(actual(f.id).entradas['PDs!S7']).toBe(7);
    fireEvent.click(boton(/Bajar un nivel/));
    fireEvent.click(boton(/Bajar un nivel/));
    expect(actual(f.id).entradas['PDs!S7']).toBe(5);
  }, T);

  it('programar reserva PD sin cambiar categoría ni nivel, y la × lo anula', async () => {
    const f = await ver();
    const antes = libres();
    fireEvent.click(boton(/Cambiar de categoría/));
    fireEvent.change(document.querySelector('#tn-destino')!, { target: { value: 'Mentalista' } });
    fireEvent.click(boton(/Todo la nueva/));
    fireEvent.click(boton(/Programar para después/));
    await waitFor(() => expect(actual(f.id).programado).toEqual({ a: 'Mentalista', z: 0, aa: 60 }));
    expect(actual(f.id).entradas['PDs!O9']).toBeUndefined();
    expect(actual(f.id).entradas['PDs!S7']).toBe(6);
    expect(document.querySelector('.tn-prog')!.textContent).toContain('→ Mentalista');
    expect(libres()).toBe(antes - 60);
    fireEvent.click(document.querySelector('.tn-equis')!);
    expect(actual(f.id).programado).toBeUndefined();
    expect(document.querySelector('.tn-prog')).toBeNull();
    expect(libres()).toBe(antes);
  }, T);

  it('aplicar pone la categoría nueva y los PD de cada una en la fila de la antigua, y quita el programado', async () => {
    const f = await ver();
    fireEvent.click(boton(/Cambiar de categoría/));
    fireEvent.change(document.querySelector('#tn-destino')!, { target: { value: 'Hechicero Mentalista' } });   // cuesta 40: mitad y mitad
    fireEvent.click(boton(/Aplicar ahora/));
    const e = actual(f.id).entradas;
    expect(e['PDs!O9']).toBe('Hechicero Mentalista');
    expect(e['PDs!Z7']).toBe(20);
    expect(e['PDs!AA7']).toBe(20);
    expect(actual(f.id).programado).toBeUndefined();
    await waitFor(() => expect(document.querySelector('.tarjeta-nivel')!.textContent).toContain('Hechicero Mentalista'));
  }, T);

  it('avisa (sin bloquear) si lo que se paga no suma el coste', async () => {
    await ver();
    fireEvent.click(boton(/Cambiar de categoría/));
    const antigua = document.querySelectorAll<HTMLInputElement>('.tn-cambio input')[0];
    fireEvent.input(antigua, { target: { value: '5' } });
    await waitFor(() => expect(document.querySelector('.tn-cambio .aviso')!.textContent).toMatch(/no suma el coste/));
    expect(boton(/Aplicar ahora/).disabled).toBe(false);
  }, T);
});
