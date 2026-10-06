// @vitest-environment happy-dom
// Modo juego: criaturas atadas y familiares (PV en su propia sesión, mantenimiento y vuelta al convocador)
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor, read } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
const poner = vi.fn(async (clave: string, v: Entrada | null) => {
  valores.value = { ...valores.value, ...motor().poner(clave, v) };
});
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
  async recargar() {},
  poner,
  async opciones() { return []; },
}));

const store = await import('../src/store');
const { Juego } = await import('../src/ui/Juego');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; poner.mockClear(); });

const esperar = () => waitFor(() => expect(document.querySelector('.juego-hud')).toBeTruthy(), { timeout: 20_000 });
const boton = (nombre: string) => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === nombre || b.textContent!.trim() === nombre)!;
const lock = () => store.importar(JSON.stringify(read('ref/fichas/lock.json')));
const stats = (pv: string) => ({ categoria: 'Bestia', nivel: '3', stats: [{ k: 'PV', v: pv }, { k: 'Turno', v: '80' }, { k: 'H. Ataque', v: '90' }, { k: 'H. Defensa', v: '70' }] });
const panelCriaturas = () => document.querySelector('#juego-criaturas');

describe('Modo juego: criaturas', () => {
  it('sin criaturas no hay pestaña ni panel', async () => {
    const p = lock();
    render(<Juego id={p.id} />);
    await esperar();
    expect(panelCriaturas()).toBeNull();
    expect([...document.querySelectorAll('.juego-tabs button')].map((b) => b.textContent)).not.toContain('Criaturas');
  }, T);

  it('PV de la criatura en SU sesión, aviso de familiar dañado y enlaces', async () => {
    const p = lock();
    const c = store.crearCriatura(p.id)!;
    store.editar(c.id, 'General!F22', 'Lobo');
    store.guardarResumen(c.id, stats('100'));
    const entradas = JSON.stringify(store.fichas.value.map((f) => f.entradas));
    render(<Juego id={p.id} />);
    await esperar();
    expect([...document.querySelectorAll('.juego-tabs button')].map((b) => b.textContent)).toContain('Criaturas');
    const t = panelCriaturas()!.textContent!;
    for (const x of ['Lobo', 'Atada', '100', '80', '90', '70']) expect(t).toContain(x);
    expect(t).not.toContain('Familiar dañado');
    fireEvent.click(boton('Restar 10 PV a Lobo'));
    fireEvent.click(boton('Restar 1 PV a Lobo'));
    expect(store.buscar(c.id)!.sesion!.r.pv).toBe(89);
    expect(store.buscar(p.id)!.sesion?.r.pv).toBeUndefined();          // la del convocador no cambia
    fireEvent.input(document.querySelector('input[aria-label="Daño o curación de Lobo"]')!, { target: { value: '20' } });
    fireEvent.click([...panelCriaturas()!.querySelectorAll('button')].find((b) => b.textContent === 'Quitar')!);
    expect(store.buscar(c.id)!.sesion!.r.pv).toBe(69);
    await waitFor(() => expect(panelCriaturas()!.querySelector('[aria-label="PV de Lobo"]')!.textContent).toBe('69'));
    fireEvent.click(boton('Sumar 10 PV a Lobo'));
    expect(store.buscar(c.id)!.sesion!.r.pv).toBe(79);
    expect(panelCriaturas()!.textContent).not.toContain('Familiar dañado');
    store.marcarFamiliar(c.id, true);
    await waitFor(() => expect(panelCriaturas()!.textContent).toContain('Familiar dañado (Core p. 199)'));
    expect([...panelCriaturas()!.querySelectorAll('a.btn')].map((a) => a.getAttribute('href'))).toContain(`#/juego/${c.id}`);
    expect(JSON.stringify(store.fichas.value.map((f) => f.entradas))).toBe(entradas);
  }, T);

  it('criatura sin resumen: avisa y enlaza a su ficha, sin controles de PV', async () => {
    const p = lock();
    const c = store.crearCriatura(p.id)!;
    render(<Juego id={p.id} />);
    await esperar();
    expect(panelCriaturas()!.textContent).toContain('Ábrela una vez para ver sus cifras');
    expect(panelCriaturas()!.querySelector('a[href="#/ficha/' + c.id + '"]')).toBeTruthy();
    expect(panelCriaturas()!.querySelector('[data-r="pv"]')).toBeNull();
  }, T);

  it('pagar el mantenimiento descuenta zeón de la sesión del convocador y avisa si no llega; descansar lo recuerda', async () => {
    const p = lock();
    const c = store.crearCriatura(p.id)!;
    store.editar(c.id, 'General!F22', 'Lobo');
    store.editar(p.id, 'Místicos!C33', 'Lobo');
    store.editar(p.id, 'Místicos!H33', 30);
    render(<Juego id={p.id} />);
    await esperar();
    expect(panelCriaturas()!.textContent).toContain('Mantenimiento diario: 30 zeón');
    fireEvent.click(boton('Pagar mantenimiento del día'));
    expect(store.buscar(p.id)!.sesion!.r.zeon).toBe(970 - 30);
    expect(document.querySelector('.juego-toast')!.textContent).toContain('Mantenimiento del día');
    store.guardarSesion(p.id, { ...store.buscar(p.id)!.sesion!, r: { zeon: 10 } });
    await waitFor(() => expect((document.querySelector('.juego-hud [data-r="zeon"] input') as HTMLInputElement).value).toBe('10'));
    fireEvent.click(boton('Pagar mantenimiento del día'));
    expect(store.buscar(p.id)!.sesion!.r.zeon).toBe(-20);              // no bloquea
    expect(document.querySelector('.juego-toast')!.textContent).toContain('⚠');
    fireEvent.click(boton('Descansar un día'));
    const toast = document.querySelector('.juego-toast')!.textContent!;
    expect(toast).toContain('mantenimiento de tus criaturas: 30 zeón');
    expect(toast).toContain('no se ha descontado');
  }, T);

  it('el modo juego de una criatura enseña la banda de vuelta al convocador', async () => {
    const p = lock();
    const c = store.crearCriatura(p.id)!;
    store.editar(c.id, 'General!F22', 'Lobo');
    render(<Juego id={c.id} />);
    await esperar();
    const banda = document.querySelector('.juego-banda')!;
    expect(banda.textContent).toContain('Criatura de');
    expect(banda.querySelector('a')!.getAttribute('href')).toBe(`#/juego/${p.id}`);
    expect(banda.querySelector('a')!.textContent).toBe('Volver al convocador');
  }, T);
});
