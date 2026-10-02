// @vitest-environment happy-dom
// Compendio de magia y mentalismo: consulta, filtros, favoritos, comparar y "Mi personaje" (motor real, sin worker)
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
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
  async poner() { /* no se edita nada */ },
  async opciones() { return []; },
}));

const store = await import('../src/store');
const { Compendio } = await import('../src/ui/Compendio');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; localStorage.clear(); });

const abrirCompendio = async (id?: string) => {
  const r = render(<Compendio id={id} />);
  await waitFor(() => expect(document.querySelector('.tabs')).toBeTruthy(), { timeout: 20_000 });
  return r;
};
const boton = (texto: string | RegExp, ambito: ParentNode = document) =>
  [...ambito.querySelectorAll('button')].find((b) => (typeof texto === 'string' ? b.textContent!.trim().startsWith(texto) : texto.test(b.textContent!)))!;
const filas = () => [...document.querySelectorAll('.lista .fila')];
const contador = () => document.querySelector('.contador strong')!.textContent;

describe('Compendio', () => {
  it('muestra los 640 conjuros y 125 poderes en sus pestañas', async () => {
    await abrirCompendio();
    const tabs = [...document.querySelectorAll('[role=tab]')].map((t) => t.textContent!.replace(/\s+/g, ' ').trim());
    expect(tabs).toEqual(['Magia 640', 'Mentalismo 125', '★ Favoritos 0']);
    expect(contador()).toBe('640');
  }, T);

  it('elegir una vía muestra su contexto (mayor, opuesta, subvías) y sus 40 conjuros', async () => {
    await abrirCompendio();
    fireEvent.click(boton(/^Luz/, document.querySelector('.explorador')!));
    const ctx = document.querySelector('.ctx')!.textContent!;
    for (const t of ['Luz', 'Vía mayor', 'Oscuridad', 'Subvías permitidas', 'Subvías prohibidas']) expect(ctx).toContain(t);
    expect(contador()).toBe('40');
    fireEvent.click(boton('Oscuridad', document.querySelector('.ctx')!));   // las vías opuestas son enlaces
    expect(document.querySelector('.ctx h2')!.textContent).toBe('Oscuridad');
  }, T);

  it('filtra por nivel, tipo y texto, y quita los filtros', async () => {
    await abrirCompendio();
    const inicial = Number(contador());
    fireEvent.input(document.querySelector('[aria-label="Nivel hasta"]')!, { target: { value: '10' } });
    const hasta10 = Number(contador());
    expect(hasta10).toBeLessThan(inicial);
    expect(filas().every((f) => Number(f.querySelector('.nv b')!.textContent) <= 10)).toBe(true);
    fireEvent.click(document.querySelector('input[name=tipo][value=Ataque]')!);
    expect(Number(contador())).toBeLessThan(hasta10);
    fireEvent.input(document.getElementById('q')!, { target: { value: 'zzzz no existe' } });
    expect(document.querySelector('.vacio')!.textContent).toContain('Ningún conjuro');
    fireEvent.click(boton('Quitar filtros y búsqueda'));
    expect(contador()).toBe(String(inicial));
  }, T);

  it('el detalle de un conjuro muestra sus 4 grados con INT, zeón y mantenimiento', async () => {
    await abrirCompendio();
    fireEvent.input(document.getElementById('q')!, { target: { value: 'Crear luz' } });
    fireEvent.click(document.querySelector('.fila-main')!);
    const d = document.getElementById('detalle')!;
    expect(d.querySelector('h2')!.textContent).toBe('Crear luz');
    for (const g of ['Base', 'Intermedio', 'Avanzado', 'Arcano']) expect(d.textContent).toContain(g);
    expect(d.querySelectorAll('.grados tbody')).toHaveLength(4);
  }, T);

  it('favoritos: se guardan, salen en su pestaña y se quitan', async () => {
    await abrirCompendio();
    fireEvent.click(document.querySelectorAll('.fila .ico.fav')[0]);
    fireEvent.click(document.querySelectorAll('.fila .ico.fav')[1]);
    expect(JSON.parse(localStorage.getItem('anima.compendio.fav')!)).toHaveLength(2);
    fireEvent.click(document.getElementById('tab-fav')!);
    expect(contador()).toBe('2');
    expect(filas()).toHaveLength(2);
    expect(document.querySelector('.explorador')).toBeTruthy();
    fireEvent.click(boton('Quitar todos'));
    expect(filas()).toHaveLength(0);
    expect(document.querySelector('.fav-sec .vacio')!.textContent).toContain('Aún no hay');
    expect(JSON.parse(localStorage.getItem('anima.compendio.fav')!)).toEqual([]);
  }, T);

  it('comparar: pide 2, deja 3 como máximo y abre la tabla de comparación', async () => {
    await abrirCompendio();
    const cmp = () => document.querySelectorAll('.fila .ico.cmp');
    fireEvent.click(cmp()[0]);
    expect((boton('Comparar', document.querySelector('.bandeja')!) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cmp()[1]); fireEvent.click(cmp()[2]);
    fireEvent.click(cmp()[3]);
    expect(document.querySelector('.bandeja .msg')!.textContent).toContain('Máximo 3');
    expect(document.querySelectorAll('.bandeja .sel .pill')).toHaveLength(3);
    fireEvent.click(boton('Comparar', document.querySelector('.bandeja')!));
    const dlg = document.querySelector('[role=dialog]')!;
    expect(dlg.querySelectorAll('thead th')).toHaveLength(3);
    expect(dlg.textContent).toContain('Arcano');
    expect(dlg.querySelector('.mejor')).toBeTruthy();       // el zeón más barato de cada grado
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('[role=dialog]')).toBeNull());
  }, T);

  it('mentalismo: 125 poderes con su tabla de 10 dificultades y valores', async () => {
    await abrirCompendio();
    fireEvent.click(document.getElementById('tab-psi')!);
    expect(contador()).toBe('125');
    fireEvent.click(boton(/^Telepatía/, document.querySelector('.explorador')!));
    expect(document.querySelector('.ctx h2')!.textContent).toBe('Telepatía');
    fireEvent.click(document.querySelector('.fila-main')!);
    const filasDif = document.querySelectorAll('#detalle .difs tr');
    expect(filasDif).toHaveLength(10);
    expect(filasDif[0].querySelector('small')!.textContent).toBe('20');
    expect(filasDif[9].querySelector('small')!.textContent).toBe('440');
  }, T);

  it('Mi personaje (Lock): resalta sus vías y conjuros sin tocar la ficha', async () => {
    const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
    const antes = JSON.stringify(store.buscar(f.id)!.entradas);
    await abrirCompendio(f.id);
    await waitFor(() => expect(boton('Mi personaje')).toBeTruthy(), { timeout: 20_000 });
    fireEvent.click(boton('Mi personaje'));
    expect(document.querySelector('.pj-banner')!.textContent).toContain('Fuego 76');
    fireEvent.click(boton(/^Fuego/, document.querySelector('.explorador')!));
    expect(document.querySelector('.ctx')!.textContent).toContain('Nivel 76 aprendido');
    expect(document.querySelectorAll('.marca').length).toBeGreaterThan(0);
    expect(JSON.stringify(store.buscar(f.id)!.entradas)).toBe(antes);
  }, T);

  it('la vista de tarjetas pinta 60 y deja ampliar de 60 en 60', async () => {
    await abrirCompendio();
    fireEvent.click(boton('Tarjetas'));
    expect(document.querySelectorAll('.carta')).toHaveLength(60);
    fireEvent.click(boton(/^Mostrar 60 más/));
    expect(document.querySelectorAll('.carta')).toHaveLength(120);
  }, T);

  it('la leyenda de iconos va encima de la lista y explica cada icono', async () => {
    await abrirCompendio();
    const ley = () => document.querySelector('.leyenda-iconos')!.textContent!;
    for (const t of ['Favorito', 'Comparar', 'Nivel', 'DIARIO', 'MANT.', 'CERRADO', 'INT']) expect(ley()).toContain(t);
    expect(document.querySelector('.leyenda-iconos')!.compareDocumentPosition(document.querySelector('.lista')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(document.getElementById('tab-psi')!);
    expect(ley()).toContain('MANTENIDO');
    expect(ley()).toContain('dificultad');
    fireEvent.click(document.getElementById('tab-fav')!);
    expect(ley()).toContain('Favorito');
    expect(ley()).not.toContain('Comparar');
  }, T);

  it('sin ficha no hay botón Mi personaje', async () => {
    await abrirCompendio();
    expect(boton('Mi personaje')).toBeUndefined();
  }, T);
});
