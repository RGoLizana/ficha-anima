// @vitest-environment happy-dom
// Modo juego: personalizar vista (ocultar y reordenar bloques por personaje) sin tocar las entradas de la ficha
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
const { parse } = await import('../src/model/ficha');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; poner.mockClear(); });

const cargar = (ref: string) => store.importar(JSON.stringify(read(`ref/fichas/${ref}.json`)));
const esperar = () => waitFor(() => expect(document.querySelector('.juego-hud')).toBeTruthy(), { timeout: 20_000 });
const boton = (nombre: string) => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === nombre || b.textContent!.trim() === nombre)!;
const orden = (grupo: string) => [...document.querySelectorAll(`#juego-${grupo} > .juego-bloque`)].map((b) => b.getAttribute('data-bloque'));
const tieneArma = (t: string) => [...document.querySelectorAll('.arma-titulo')].some((h) => h.textContent === t);

describe('Modo juego: personalizar vista', () => {
  it('sin proyección psíquica no sale; con ella se puede ocultar, persiste y no toca entradas', async () => {
    const vacio = store.crear();
    render(<Juego id={vacio.id} />);
    await esperar();
    expect(tieneArma('Proyección psíquica')).toBe(false);
    cleanup(); abierta.value = null;

    const f = cargar('lock');
    const entradas = JSON.stringify(store.buscar(f.id)!.entradas);
    const r = render(<Juego id={f.id} />);
    await esperar();
    expect(tieneArma('Proyección psíquica')).toBe(true);
    expect(boton('Ocultar Proyección psíquica')).toBeUndefined();     // fuera del modo edición no hay controles
    fireEvent.click(boton('Personalizar vista'));
    fireEvent.click(boton('Ocultar Proyección psíquica'));
    expect(tieneArma('Proyección psíquica')).toBe(false);
    expect(document.querySelector('.juego-ocultos')!.textContent).toContain('Proyección psíquica');
    expect(store.buscar(f.id)!.vistaJuego).toEqual({ ocultos: ['proy-psi'], orden: [] });
    fireEvent.click(boton('Listo'));
    expect(document.querySelector('.juego-ocultos')).toBeNull();
    expect(tieneArma('Proyección psíquica')).toBe(false);

    // recargar: la vista sale del almacenamiento
    r.unmount(); abierta.value = null;
    store.fichas.value = JSON.parse(localStorage.getItem('anima.fichas')!).map(parse);
    render(<Juego id={f.id} />);
    await esperar();
    expect(tieneArma('Proyección psíquica')).toBe(false);
    expect(JSON.stringify(store.buscar(f.id)!.entradas)).toBe(entradas);
    expect(poner).not.toHaveBeenCalled();

    // «Reiniciar sesión» no borra la vista; «Mostrar» la devuelve
    fireEvent.click(boton('Reiniciar sesión')); fireEvent.click(boton('Confirmar: reiniciar sesión'));
    expect(store.buscar(f.id)!.vistaJuego!.ocultos).toEqual(['proy-psi']);
    fireEvent.click(boton('Personalizar vista'));
    fireEvent.click(boton('Mostrar Proyección psíquica'));
    expect(tieneArma('Proyección psíquica')).toBe(true);
    expect(store.buscar(f.id)!.vistaJuego).toBeUndefined();
  }, T);

  it('reordenar paneles, ocultar una estadística de la barra y restablecer', async () => {
    const f = cargar('lock');
    render(<Juego id={f.id} />);
    await esperar();
    const base = orden('estado');
    expect(base.slice(0, 2)).toEqual(['estado', 'asalto']);
    fireEvent.click(boton('Personalizar vista'));
    expect((boton('Subir Estado actual') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(boton('Bajar Estado actual'));
    expect(orden('estado').slice(0, 2)).toEqual(['asalto', 'estado']);
    fireEvent.click(boton('Subir Descanso'));
    expect(orden('estado').slice(0, 3)).toEqual(['asalto', 'descanso', 'estado']);
    expect(store.buscar(f.id)!.vistaJuego!.orden.slice(0, 3)).toEqual(['asalto', 'descanso', 'estado']);

    expect(document.querySelector('.juego-hud-stats')!.textContent).toContain('H. Ataque');
    fireEvent.click(boton('Ocultar H. Ataque'));
    expect(document.querySelector('.juego-hud-stats .juego-bloque[data-bloque="stat-ataque"]')).toBeNull();
    fireEvent.click(boton('Listo'));
    expect(document.querySelector('.juego-hud-stats')!.textContent).not.toContain('H. Ataque');
    expect(orden('estado').slice(0, 3)).toEqual(['asalto', 'descanso', 'estado']);     // el orden se respeta fuera de la edición

    fireEvent.click(boton('Personalizar vista'));
    fireEvent.click(boton('Restablecer vista'));
    expect(orden('estado')).toEqual(base);
    expect(document.querySelector('.juego-hud-stats')!.textContent).toContain('H. Ataque');
    expect(store.buscar(f.id)!.vistaJuego).toBeUndefined();
  }, T);

  it('la vista se valida al importar y se exporta con la ficha', () => {
    const f = store.crear();
    store.guardarVistaJuego(f.id, { ocultos: ['proy-psi'], orden: ['b', 'a'] });
    const copia = parse(JSON.parse(JSON.stringify(store.buscar(f.id))));
    expect(copia.vistaJuego).toEqual({ ocultos: ['proy-psi'], orden: ['b', 'a'] });
    expect(parse({ version: 2, entradas: {}, vistaJuego: { ocultos: [3, 'x y', 'ok', 'ok'], orden: 'no' } }).vistaJuego).toEqual({ ocultos: ['ok'], orden: [] });
    expect(parse({ version: 2, entradas: {}, vistaJuego: 5 }).vistaJuego).toBeUndefined();
  });
});
