// @vitest-environment happy-dom
// Ayudante de poderes mantenidos: panel en Psíquica (lee el Excel, solo escribe la casilla de CV de incrementar) y modo juego (solo sesión)
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
const { FichaView } = await import('../src/ui/FichaView');
const { Juego } = await import('../src/ui/Juego');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; poner.mockClear(); });

const ayane = () => store.importar(JSON.stringify(read('ref/fichas/ayane.json')));
const panel = (titulo: string) => [...document.querySelectorAll('section.panel, details.panel')].find((s) => s.querySelector('.panel-title')?.textContent === titulo)!;
const boton = (re: RegExp) => [...document.querySelectorAll('button')].find((b) => re.test(b.getAttribute('aria-label') ?? b.textContent!))!;

describe('Psíquica: panel «Poderes mantenidos»', () => {
  it('nivel del Excel, mínimo para el siguiente, ventaja y aviso de innatos sin bloquear', async () => {
    const f = ayane();
    render(<FichaView id={f.id} seccion="psiquica" />);
    await waitFor(() => expect(panel('Poderes mantenidos')).toBeTruthy(), { timeout: 20_000 });
    const texto = () => panel('Poderes mantenidos').textContent!;
    // Escudo telequinético: potencial 100 + Fortalecer 10 = 110 → Medio; con 1 CV (130) Difícil
    expect(texto()).toContain('Escudo telequinético');
    expect(texto()).toMatch(/MED/);
    expect(texto()).toMatch(/Siguiente: DIF.*con 1 CV más/);
    fireEvent.click(boton(/^Poner 1 CV$/));
    expect(store.buscar(f.id)!.entradas['Psíquicos!AI17']).toBe(1);
    await waitFor(() => expect(texto()).toMatch(/Siguiente: MDF/));

    store.editar(f.id, 'Principal!C37', 'Mantenimiento añadido');
    await waitFor(() => expect(texto()).toContain('Mantenimiento añadido: +1 nivel'));

    store.editar(f.id, 'Psíquicos!M13', 0);
    await waitFor(() => expect(texto()).toContain('Mantienes 1 poder y tienes 0 innatos'));
    expect(boton(/^Poner \d CV$/).hasAttribute('disabled')).toBe(false);
  }, T);
});

describe('Modo juego: mantenidos psíquicos', () => {
  it('mantener, subir con CV de la reserva (avisa si faltan) y soltar sin tocar la ficha', async () => {
    const f = ayane();
    const entradas = JSON.stringify(f.entradas);
    render(<Juego id={f.id} />);
    await waitFor(() => expect(document.querySelector('.juego-hud')).toBeTruthy(), { timeout: 20_000 });
    const ses = () => store.buscar(f.id)!.sesion!;
    const libres = Number(valores.value['Psíquicos!F20']);

    fireEvent.click(boton(/^Mantener Escudo telequinético$/));
    expect(ses().mantPsi).toEqual([{ n: 'Escudo telequinético', cv: 0 }]);
    await waitFor(() => expect(panel('Mantenidos psíquicos').textContent).toContain('MED'));

    fireEvent.click(boton(/^Subir Escudo telequinético a DIF por 1 CV$/));
    expect(ses().mantPsi).toEqual([{ n: 'Escudo telequinético', cv: 1 }]);
    expect(ses().r.cv).toBe(libres - 1);

    store.guardarSesion(f.id, { ...ses(), r: { ...ses().r, cv: 0 } });
    await waitFor(() => expect(boton(/^Subir Escudo telequinético a MDF por 1 CV$/)).toBeTruthy());
    fireEvent.click(boton(/^Subir Escudo telequinético a MDF por 1 CV$/));
    expect(ses().r.cv).toBe(-1);
    await waitFor(() => expect(document.querySelector('.juego-toast')!.textContent).toContain('CVs libres por debajo de 0'));

    const mantenerOtro = () => [...document.querySelectorAll('button')].find((b) => /^Mantener /.test(b.textContent!));
    for (let i = 0; i < 2 && mantenerOtro(); i++) {
      fireEvent.click(mantenerOtro()!);
      await waitFor(() => expect(ses().mantPsi!.length).toBe(i + 2));
    }
    expect(ses().mantPsi!.length).toBe(3);
    await waitFor(() => expect(panel('Mantenidos psíquicos').textContent).toContain('Mantienes 3 poderes y tienes 2 innatos'));

    fireEvent.click(boton(/^Dejar de mantener Escudo telequinético$/));
    expect(ses().mantPsi!.some((m) => m.n === 'Escudo telequinético')).toBe(false);
    expect(JSON.stringify(store.buscar(f.id)!.entradas)).toBe(entradas);
    expect(poner).not.toHaveBeenCalled();
  }, T);
});
