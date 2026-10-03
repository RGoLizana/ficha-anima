// @vitest-environment happy-dom
// Modo juego: HUD con los valores reales de la ficha y estado de sesión aparte (no toca entradas ni cálculos)
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
  poner,
  async opciones() { return []; },
}));

const store = await import('../src/store');
const { Juego, regeneracionDiaria, REGLAS_DESCANSO } = await import('../src/ui/Juego');
const { parse } = await import('../src/model/ficha');

const T = 120_000;
const vacia = () => ({ r: {}, asalto: 1, efectos: [], conts: [], mant: [], favH: [], favC: [], notas: '' });
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; poner.mockClear(); });

function abrirLock() {
  const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
  render(<Juego id={f.id} />);
  return f;
}
const esperar = () => waitFor(() => expect(document.querySelector('.juego-hud')).toBeTruthy(), { timeout: 20_000 });
const hud = (r: string) => document.querySelector(`.juego-hud [data-r="${r}"]`)!;
const hudInput = (r: string) => hud(r).querySelector('input') as HTMLInputElement;
const boton = (texto: string | RegExp) => [...document.querySelectorAll('button')].find((b) =>
  typeof texto === 'string' ? b.textContent!.trim() === texto || b.getAttribute('aria-label') === texto : texto.test(b.getAttribute('aria-label') ?? b.textContent!))!;
const sesion = (id: string) => store.buscar(id)!.sesion;
const avisos = () => [...document.querySelectorAll('.aviso')].map((a) => a.textContent).join(' | ');

describe('Modo juego', () => {
  it('HUD con los valores reales de la ficha de Lock', async () => {
    abrirLock();
    await esperar();
    expect(hudInput('pv').value).toBe('150');                // Principal!N11 (sin P11 en la ficha: al máximo)
    expect(hud('pv').textContent).toContain('de 150');
    expect(hudInput('zeon').value).toBe('970');               // Místicos!M18
    expect(hud('zeon').textContent).toContain('de 1110');     // Místicos!K18
    const stats = document.querySelector('.juego-hud-stats')!.textContent!;
    for (const t of ['90', 'Turno', 'H. Ataque', 'H. Esquiva', '175', '3/3']) expect(stats).toContain(t);
    const texto = document.body.textContent!;
    expect(texto).toContain('Lock');
    expect(texto).toContain('Hechicero');
    for (const t of ['Medicina', 'Ocultismo', 'Desarmado', 'Baile espectral', '12 ki', 'Aseamiento', 'Próximamente']) expect(texto).toContain(t);
    expect(texto).toContain('30 PV / día');
  }, T);

  it('cambiar PV y zeón se guarda en la sesión y no toca entradas ni cálculos', async () => {
    const f = abrirLock();
    await esperar();
    const entradas = JSON.stringify(store.buscar(f.id)!.entradas);
    const antes = { ...valores.value };
    fireEvent.change(hudInput('pv'), { target: { value: '120' } });
    fireEvent.click(hud('zeon').querySelector('[aria-label^="Restar"]')!);
    expect(sesion(f.id)!.r).toMatchObject({ pv: 120, zeon: 960 });
    await waitFor(() => expect(hudInput('pv').value).toBe('120'));
    expect(JSON.stringify(store.buscar(f.id)!.entradas)).toBe(entradas);
    expect(valores.value).toEqual(antes);
    expect(poner).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('anima.fichas')!)[0].sesion.r.pv).toBe(120);
  }, T);

  it('reglas de descanso del Core: ki 6 por hora, CV 1 por hora y los negativos continuos bajan con la regeneración (tabla 24)', async () => {
    expect(REGLAS_DESCANSO.kiPorHora * REGLAS_DESCANSO.horas).toBe(144);
    expect(REGLAS_DESCANSO.cvPorHora * REGLAS_DESCANSO.horas).toBe(24);
    const r = REGLAS_DESCANSO.reduccionNegativosPorDia;
    expect([1, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(r)).toEqual([5, 5, 10, 10, 15, 20, 25, 30, 40, 50]);
    expect([12, 13, 14, 15].map(r)).toEqual([120, 240, 360, 480]);     // «por hora» ×24
    expect(r(16)).toBe(Infinity);
    expect(r(0)).toBe(0);
  });

  it('descansar baja un negativo continuo según la regeneración de la ficha y lo quita al llegar a 0; los temporales se van', async () => {
    const f = abrirLock();                                   // regeneración 3: -5 al día
    await esperar();
    store.guardarSesion(f.id, { ...vacia(), efectos: [{ n: 'Herida', a: null, m: -10, nota: '' }, { n: 'Aturdido', a: 3, m: -20, nota: '' }, { n: 'Bendición', a: null, m: 10, nota: '' }] });
    await waitFor(() => expect(document.querySelector('.juego-hud-stats')!.textContent).toContain('-20'));
    fireEvent.click(boton('Descansar un día'));
    expect(sesion(f.id)!.efectos.map((e) => [e.n, e.m])).toEqual([['Herida', -5], ['Bendición', 10]]);   // lo positivo no se toca
    fireEvent.click(boton('Descansar un día'));
    expect(sesion(f.id)!.efectos.map((e) => e.n)).toEqual(['Bendición']);
  }, T);

  it('lanzar un conjuro descuenta zeón y añade el mantenido; deshacer lo devuelve', async () => {
    const f = abrirLock();
    await esperar();
    await waitFor(() => expect(boton(/^Lanzar Crear fuego, grado Base/)).toBeTruthy(), { timeout: 20_000 });
    fireEvent.click(boton(/^Lanzar Crear fuego, grado Base/));       // 30 zeón, mantenimiento 5
    expect(sesion(f.id)!.r.zeon).toBe(940);
    expect(sesion(f.id)!.mant).toEqual([{ n: 'Crear fuego (Base)', m: 5 }]);
    await waitFor(() => expect(document.querySelector('.juego-toast')!.textContent).toContain('−30 zeón'));
    fireEvent.click(boton('Deshacer'));
    expect(sesion(f.id)!.r.zeon ?? 970).toBe(970);
    expect(sesion(f.id)!.mant).toEqual([]);
  }, T);

  it('los conjuros de libre acceso elegidos salen con su coste de zeón y se lanzan como los demás', async () => {
    const f = abrirLock();
    await esperar();
    // Aseamiento (libre acceso, nivel 4) está en las entradas de Lock (Místicos!AG12): su grado Base cuesta zeón
    await waitFor(() => expect(boton(/^Lanzar Aseamiento, grado Base/)).toBeTruthy(), { timeout: 20_000 });
    fireEvent.click(boton(/^Lanzar Aseamiento, grado Base/));
    const gastado = 970 - (sesion(f.id)!.r.zeon ?? 970);
    expect(gastado).toBeGreaterThan(0);
    expect(document.querySelector('.juego')!.textContent).not.toContain('Coste en zeón de los conjuros de libre acceso');
  }, T);

  it('requisito de INT y zeón negativo avisan, no bloquean', async () => {
    const f = abrirLock();
    await esperar();
    await waitFor(() => expect(boton(/^Lanzar Bola de fuego, grado Arcano/)).toBeTruthy(), { timeout: 20_000 });
    const arcano = boton(/^Lanzar Bola de fuego, grado Arcano/);
    expect(arcano.classList.contains('req')).toBe(true);             // INT 15 > 11
    expect(arcano.hasAttribute('disabled')).toBe(false);
    fireEvent.change(hudInput('zeon'), { target: { value: '100' } });
    fireEvent.click(boton(/^Lanzar Bola de fuego, grado Arcano/));
    expect(sesion(f.id)!.r.zeon).toBe(-150);
    await waitFor(() => expect(document.querySelector('.juego-toast')!.textContent).toMatch(/requiere INT 15.*zeón insuficiente/));
    expect(avisos()).toContain('Zeón por debajo de 0');
    fireEvent.change(hudInput('pv'), { target: { value: '-5' } });
    await waitFor(() => expect(avisos()).toContain('PV a 0 o menos'));
    expect(hudInput('pv').value).toBe('-5');
    fireEvent.change(hudInput('pv'), { target: { value: '200' } });
    await waitFor(() => expect(avisos()).toContain('PV por encima del máximo'));
    expect(sesion(f.id)!.r.pv).toBe(200);
  }, T);

  it('descansar un día recupera según la ficha, quita efectos y mantenidos; se puede deshacer', async () => {
    const f = abrirLock();
    await esperar();
    fireEvent.change(hudInput('pv'), { target: { value: '100' } });
    fireEvent.change(hudInput('zeon'), { target: { value: '500' } });
    fireEvent.input(document.querySelector('[aria-label="Efecto"]')!, { target: { value: 'Aturdido' } });
    fireEvent.input(document.querySelector('[aria-label="Asaltos (vacío: sin fin)"]')!, { target: { value: '3' } });
    fireEvent.input(document.querySelector('[aria-label="Modificador a toda acción"]')!, { target: { value: '-20' } });
    fireEvent.submit(document.querySelector('.juego-nuevo-ef')!);
    fireEvent.input(document.querySelector('[aria-label="Efecto"]')!, { target: { value: 'Maldito' } });
    fireEvent.submit(document.querySelector('.juego-nuevo-ef')!);
    expect(sesion(f.id)!.efectos.map((e) => [e.n, e.a, e.m])).toEqual([['Aturdido', 3, -20], ['Maldito', null, 0]]);
    await waitFor(() => expect(document.querySelector('.juego-hud-stats')!.textContent).toContain('-20'));
    fireEvent.click(boton('Nuevo asalto'));
    expect(sesion(f.id)!.asalto).toBe(2);
    expect(sesion(f.id)!.efectos[0].a).toBe(2);
    const antes = sesion(f.id)!;
    fireEvent.click(boton('Descansar un día'));
    const s = sesion(f.id)!;
    expect(s.r.pv).toBe(130);                       // +30 PV / día (Principal!K11)
    expect(s.r.zeon).toBe(560);                     // +60 de regeneración zeónica (Místicos!J12)
    expect(s.r).toMatchObject({ ki: 51, cv: 2, cans: 9, acc: 3 });
    expect(s.efectos.map((e) => e.n)).toEqual(['Maldito']);
    expect(s.asalto).toBe(1);
    await waitFor(() => expect(boton('Deshacer')).toBeTruthy());
    fireEvent.click(boton('Deshacer'));
    expect(sesion(f.id)).toEqual(antes);
  }, T);

  it('reiniciar sesión pide un segundo toque y vuelve a los valores de la ficha', async () => {
    const f = abrirLock();
    await esperar();
    fireEvent.change(hudInput('pv'), { target: { value: '40' } });
    fireEvent.click(boton('Reiniciar sesión'));
    expect(sesion(f.id)!.r.pv).toBe(40);
    await waitFor(() => expect(boton('Confirmar: reiniciar sesión')).toBeTruthy());
    fireEvent.click(boton('Confirmar: reiniciar sesión'));
    expect(sesion(f.id)!.r).toEqual({});
    await waitFor(() => expect(hudInput('pv').value).toBe('150'));
    expect(hudInput('zeon').value).toBe('970');
  }, T);

  it('la sesión persiste al salir y volver a entrar; no hay dados', async () => {
    const f = abrirLock();
    await esperar();
    fireEvent.change(hudInput('pv'), { target: { value: '77' } });
    fireEvent.input(document.querySelector('#juego-notas')!, { target: { value: 'El cultista' } });
    fireEvent.click(boton('Favorita Medicina'));
    cleanup();
    render(<Juego id={f.id} />);
    await esperar();
    expect(hudInput('pv').value).toBe('77');
    expect((document.querySelector('#juego-notas') as HTMLTextAreaElement).value).toBe('El cultista');
    expect(boton('Favorita Medicina').getAttribute('aria-pressed')).toBe('true');
    // sin dados: ningún control ni título habla de tiradas (los textos de los conjuros sí pueden decir "cuidado")
    const controles = [...document.querySelectorAll('button, label, input, summary, h1, h2, h3')]
      .map((e) => `${e.textContent} ${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('placeholder') ?? ''}`).join(' | ');
    expect(controles).not.toMatch(/\bdados?\b|tirada|tirar|\b1?d(10|100)\b/i);
    expect(document.querySelector('a[href$="/principal"]')!.getAttribute('href')).toBe(`#/ficha/${f.id}/principal`);
  }, T);

  it('exportar/importar el JSON conserva la sesión', async () => {
    const f = abrirLock();
    await esperar();
    fireEvent.change(hudInput('pv'), { target: { value: '33' } });
    const json = JSON.stringify(store.buscar(f.id));
    const copia = store.importar(json);
    expect(copia.sesion).toEqual(sesion(f.id));
    expect(parse(JSON.parse(json)).sesion!.r.pv).toBe(33);
  }, T);
});

describe('entrada desde la ficha', () => {
  it('la cabecera de la ficha tiene el botón "Modo juego"', async () => {
    const { FichaView } = await import('../src/ui/FichaView');
    const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
    render(<FichaView id={f.id} seccion="principal" />);
    const a = [...document.querySelectorAll('a')].find((x) => x.textContent === 'Modo juego')!;
    expect(a.getAttribute('href')).toBe(`#/juego/${f.id}`);
  }, T);
});

describe('regeneración diaria', () => {
  it('pasa la regeneración de la ficha a PV por día; sin cifra, null', () => {
    expect(regeneracionDiaria('30 PV / día')).toBe(30);
    expect(regeneracionDiaria('10 PV / min *')).toBe(14400);
    expect(regeneracionDiaria('')).toBeNull();
  });

  it('calculadora de daño: Daño por % como en el Excel y sin tocar la ficha', async () => {
    const f = abrirLock();
    await esperar();
    const antes = JSON.stringify(store.buscar(f.id)!.entradas);
    const calc = document.querySelector('.calc')!;
    const [dano, pct] = [...calc.querySelectorAll('input')];
    fireEvent.input(dano, { target: { value: '105' } });     // se sube a la decena: 110
    fireEvent.input(pct, { target: { value: '50' } });
    await waitFor(() => expect(calc.querySelector('.calc-final strong')!.textContent).toBe('55'));
    expect(JSON.stringify(store.buscar(f.id)!.entradas)).toBe(antes);
  }, T);
});
