// @vitest-environment happy-dom
// Paso 8: Sheele, Elan y Equipo (interfaz con el motor real, sin worker)
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor, read, type NombreFicha } from './helpers';
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
  async poner(clave: string, v: Entrada | null) {
    valores.value = { ...valores.value, ...motor().poner(clave, v) };
  },
  async opciones(clave: string, formula = LISTAS[clave]) {
    return formula ? motor().lista(formula, clave.slice(0, clave.lastIndexOf('!'))) : [];
  },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');
const { modoTecnicas } = await import('../src/ui/Tecnicas');
modoTecnicas.value = 'experto';   // estas pruebas miran todas las casillas de la hoja

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

function abrirFicha(n: NombreFicha, seccion: string) {
  const f = store.importar(JSON.stringify(read(`ref/fichas/${n}.json`)));
  render(<FichaView id={f.id} seccion={seccion} />);
  return f;
}
const esperarListo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
const celda = (clave: string) => document.querySelector(`[data-clave="${clave}"] input, [data-clave="${clave}"] select, [data-clave="${clave}"] textarea`) as HTMLInputElement & HTMLSelectElement;
const opcionesDe = (clave: string) => [...(celda(clave)?.options ?? [])].map((o) => o.value).filter(Boolean);
const texto = () => document.querySelector('.content')!.textContent!;

describe('Sheele', () => {
  it('Lock: tipo, nivel y estadísticas salen del Excel', async () => {
    abrirFicha('lock', 'sheele');
    await esperarListo();
    expect(celda('Sheele!M5').value).toBe('Aire');
    expect(texto()).toContain('Nivel 6');
    expect(texto()).toContain('110');            // proyección mágica
  }, T);

  it('el temporal de una característica sube su total; mejorar una habilidad la recalcula', async () => {
    const f = abrirFicha('lock', 'sheele');
    await esperarListo();
    const fila = (r: number) => document.querySelector(`[data-clave="Sheele!F${r}"]`)!.closest('tr')!.textContent!;
    expect(fila(9)).toContain('8');
    fireEvent.change(celda('Sheele!F9'), { target: { value: '3' } });
    await waitFor(() => expect(fila(9)).toContain('11'));
    expect(store.buscar(f.id)!.entradas['Sheele!F9']).toBe(3);
    fireEvent.change(celda('Sheele!R10'), { target: { value: '2' } });
    expect(store.buscar(f.id)!.entradas['Sheele!R10']).toBe(2);
    await waitFor(() => expect(motor().valor('Sheele!X10')).toBe(80));   // 60 base + 10 por punto de mejora
  }, T);

  it('mejoras de Sheele: siempre hay una fila libre y las opciones salen de la tabla', async () => {
    abrirFicha('lock', 'sheele');
    await esperarListo();
    await waitFor(() => expect(opcionesDe('Sheele!C24').length).toBeGreaterThan(3));
    expect(celda('Sheele!C25')).toBeFalsy();
    fireEvent.change(celda('Sheele!C24'), { target: { value: opcionesDe('Sheele!C24')[0] } });
    await waitFor(() => expect(celda('Sheele!C25')).toBeTruthy());
  }, T);
});

describe('Elan', () => {
  it('elegir entidad abre la lista de dones y siempre hay una fila libre', async () => {
    const f = abrirFicha('lock', 'elan');
    await esperarListo();
    await waitFor(() => expect(opcionesDe('Elan!C11').length).toBeGreaterThan(3));
    const entidad = opcionesDe('Elan!C11')[0];
    fireEvent.change(celda('Elan!C11'), { target: { value: entidad } });
    expect(store.buscar(f.id)!.entradas['Elan!C11']).toBe(entidad);
    await waitFor(() => expect(opcionesDe('Elan!C13').length).toBeGreaterThan(2));
    expect(celda('Elan!C14')).toBeFalsy();
    fireEvent.change(celda('Elan!C13'), { target: { value: opcionesDe('Elan!C13')[0] } });
    await waitFor(() => expect(celda('Elan!C14')).toBeTruthy());
  }, T);
});

describe('Equipo', () => {
  it('el peso del equipo suma al peso total y las filas crecen de una en una', async () => {
    const f = abrirFicha('lock', 'equipo');
    await esperarListo();
    expect(celda('General!AF12')).toBeFalsy();
    fireEvent.change(celda('General!AF11'), { target: { value: 'Mochila' } });
    fireEvent.change(celda('General!AL11'), { target: { value: '5' } });
    expect(store.buscar(f.id)!.entradas).toMatchObject({ 'General!AF11': 'Mochila', 'General!AL11': 5 });
    await waitFor(() => expect(celda('General!AF12')).toBeTruthy());
    await waitFor(() => expect(texto()).toContain('Peso total'));
    expect(Number([...document.querySelectorAll('.stat')].find((s) => s.textContent!.includes('Peso total'))!.querySelector('.stat-v')!.textContent)).toBeGreaterThanOrEqual(5);
  }, T);

  it('dinero, fama y contactos se guardan', async () => {
    const f = abrirFicha('lock', 'equipo');
    await esperarListo();
    fireEvent.change(celda('General!Y59'), { target: { value: '12' } });
    fireEvent.change(celda('General!AF47'), { target: { value: 'Maestro herrero' } });
    fireEvent.change(celda('General!AI58'), { target: { value: '3' } });
    expect(store.buscar(f.id)!.entradas).toMatchObject({ 'General!Y59': 12, 'General!AF47': 'Maestro herrero', 'General!AI58': 3 });
  }, T);
});

describe('Grimorios informativos (todas las vías / disciplinas a la vez)', () => {
  const nombres = () => [...document.querySelectorAll('.arma.info .arma-titulo')].map((t) => t.textContent);

  const desplegarTodo = async () => {
    await waitFor(() => expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Desplegar todo')).toBe(true), { timeout: 20_000 });
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'Desplegar todo')!);
  };

  it('Lock: las vías salen como desplegables cerrados con su resumen, y se abren de una en una o todas a la vez', async () => {
    abrirFicha('lock', 'grimorios');
    await esperarListo();
    await waitFor(() => expect(document.querySelectorAll('.desplegable').length).toBeGreaterThanOrEqual(3), { timeout: 20_000 });
    const filas = [...document.querySelectorAll('.desplegable > .desp-cab')];
    expect(filas[0].textContent).toContain('Fuego');
    expect(filas[0].textContent).toMatch(/nivel aprendido \d+ · \d+ conjuros/);
    expect(filas[0].querySelector('.chevron')).toBeTruthy();                       // la flecha indica que se abre
    expect(filas[0].textContent).toContain('Mostrar');
    expect(nombres()).toHaveLength(0);                                              // cerrados: sin cientos de tarjetas
    fireEvent.click(filas[0]);
    await waitFor(() => expect(nombres().length).toBeGreaterThan(5));
    expect(document.querySelector('.desplegable > .desp-cab')!.textContent).toContain('Ocultar');
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent === 'Plegar todo')!);
    await waitFor(() => expect(nombres()).toHaveLength(0));
  }, T);

  it('Lock: muestra a la vez los conjuros de todas sus vías, con lo no alcanzado atenuado', async () => {
    abrirFicha('lock', 'grimorios');
    await esperarListo();
    await desplegarTodo();
    await waitFor(() => expect(nombres().length).toBeGreaterThan(30), { timeout: 20_000 });
    const vias = [...document.querySelectorAll('.desp-cab strong')].map((e) => e.textContent!);
    expect(vias.length).toBeGreaterThanOrEqual(3);
    expect(vias.join('|')).toContain('Fuego');
    expect(nombres()).toContain('Crear fuego');
    expect(document.querySelectorAll('.arma.info.sin-aprender').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.arma.info:not(.sin-aprender)').length).toBeGreaterThan(0);
  }, T);

  it('Ayane: muestra los poderes de todas sus disciplinas afines, marcando los aprendidos', async () => {
    abrirFicha('ayane', 'psiquica');
    await esperarListo();
    await desplegarTodo();
    await waitFor(() => expect(nombres().length).toBeGreaterThan(20), { timeout: 20_000 });
    expect(nombres()).toEqual(expect.arrayContaining(['Crear fuego', 'Impacto telequinético']));
    const imp = [...document.querySelectorAll('.arma.info')].find((a) => a.querySelector('.arma-titulo')!.textContent === 'Impacto telequinético')!;
    expect(imp.classList.contains('sin-aprender')).toBe(false);
    expect(imp.textContent).toContain('Aprendido');
  }, T);
});

describe('Teoremas de magia (referencia)', () => {
  it('Lock: muestra las tablas de efectos máximos, modificadores y tramos; cambian con el teorema', async () => {
    abrirFicha('lock', 'magia');
    await esperarListo();
    const panel = () => [...document.querySelectorAll('.panel')].find((p) => p.textContent!.startsWith('Teoremas de magia'))!.textContent!;
    for (const t of ['Efectos máximos', 'Modificadores', 'Instantáneo', '250m', 'Primer tramo']) expect(panel()).toContain(t);
    const antes = panel();
    await waitFor(() => expect(opcionesDe('Místicos!AT10').length).toBeGreaterThan(1));
    const otro = opcionesDe('Místicos!AT10').find((o) => o !== 'General')!;
    fireEvent.change(celda('Místicos!AT10'), { target: { value: otro } });
    await waitFor(() => expect(panel()).toContain(otro));
    expect(panel()).not.toBe(antes);
  }, T);
});

describe('Estilos y tablas en Combate', () => {
  it('se compran desde Combate (mismas celdas que Desarrollo) y aparece su descripción', async () => {
    const f = abrirFicha('lock', 'combate');
    await esperarListo();
    for (const c of ['PDs!E43', 'PDs!E49', 'PDs!E59', 'PDs!E81']) expect(celda(c), c).toBeTruthy();
    await waitFor(() => expect(opcionesDe('PDs!E49').length).toBeGreaterThan(2));
    const estilo = opcionesDe('PDs!E49').find((o) => !o.startsWith('>'))!;
    const antes = [...document.querySelectorAll('.panel')].find((p) => p.textContent!.startsWith('Capacidades de combate'))?.textContent ?? '';
    fireEvent.change(celda('PDs!E49'), { target: { value: estilo } });
    expect(store.buscar(f.id)!.entradas['PDs!E49']).toBe(estilo);
    await waitFor(() => expect(celda('PDs!E50')).toBeTruthy());
    await waitFor(() => {
      const t = [...document.querySelectorAll('.panel')].find((p) => p.textContent!.startsWith('Capacidades de combate'))!.textContent!;
      expect(t).toContain(estilo.split(' (')[0]);
      expect(t).not.toBe(antes);
    });
  }, T);
});

describe('Conjuros de libre acceso', () => {
  it('la vía asociada solo ofrece las vías que tiene el personaje y «-» si es libre; el nivel y el conjuro siguen', async () => {
    const f = abrirFicha('lock', 'magia');
    await esperarListo();
    await waitFor(() => expect(opcionesDe('Místicos!AE13').length).toBeGreaterThan(0));
    expect(opcionesDe('Místicos!AE13')).toEqual(['-', 'Fuego', 'Creación', 'Oscuridad']);       // las vías de Lock (+ libre)
    // libre: los niveles salen aunque no haya vía asociada
    fireEvent.change(celda('Místicos!AE13'), { target: { value: '-' } });
    await waitFor(() => expect(opcionesDe('Místicos!AK13').length).toBeGreaterThan(5));
    fireEvent.change(celda('Místicos!AK13'), { target: { value: opcionesDe('Místicos!AK13')[0] } });
    await waitFor(() => expect(opcionesDe('Místicos!AG13').length).toBeGreaterThan(3));
    fireEvent.change(celda('Místicos!AG13'), { target: { value: opcionesDe('Místicos!AG13').find((o) => !o.startsWith('>'))! } });
    expect(store.buscar(f.id)!.entradas['Místicos!AG13']).toBeTruthy();
    // con una vía que tiene, sin subvía (Fuego), también hay niveles
    fireEvent.change(celda('Místicos!AE14') ?? celda('Místicos!AE13'), { target: { value: 'Fuego' } });
  }, T);
});

describe('Técnicas: desventajas por nivel (Core, tabla 54)', () => {
  const avisos = () => [...document.querySelectorAll('details.tecnica')[0].querySelectorAll('.aviso')].map((a) => a.textContent!);

  it('una técnica de nivel 1 con más de una desventaja avisa sin bloquear, y quitarla lo deshace', async () => {
    const f = abrirFicha('lock', 'tecnicas');
    await esperarListo();
    expect(avisos().filter((a) => /admite como máximo/.test(a))).toEqual([]);      // Lock tiene una (Atadura Elemental)
    await waitFor(() => expect(celda('Creación de Técnicas!F22')).toBeTruthy());
    await waitFor(() => expect(opcionesDe('Creación de Técnicas!F22').length).toBeGreaterThan(3));
    fireEvent.change(celda('Creación de Técnicas!F22'), { target: { value: 'Sin Defensa' } });
    await waitFor(() => expect(avisos().join(' ')).toContain('Una técnica de nivel 1 admite como máximo 1 desventaja (Core, tabla 54) y esta tiene 2'));
    expect(store.buscar(f.id)!.entradas['Creación de Técnicas!F22']).toBe('Sin Defensa');          // se guarda igualmente
    fireEvent.change(celda('Creación de Técnicas!F22'), { target: { value: '' } });
    await waitFor(() => expect(avisos().filter((a) => /admite como máximo/.test(a))).toEqual([]));
  }, T);

  it('con nivel 2 admite dos; una desventaja de nivel mayor que el de la técnica avisa', async () => {
    abrirFicha('lock', 'tecnicas');
    await esperarListo();
    await waitFor(() => expect(opcionesDe('Creación de Técnicas!F22').length).toBeGreaterThan(3));
    fireEvent.change(celda('Creación de Técnicas!F22'), { target: { value: 'Compleja' } });      // desventaja de nivel 2 en una técnica de nivel 1
    await waitFor(() => expect(avisos().join(' ')).toContain('es una desventaja de nivel: 2 y la técnica es de nivel 1'));
    fireEvent.change(celda('Creación de Técnicas!P12'), { target: { value: '2' } });
    await waitFor(() => expect(avisos().filter((a) => /admite como máximo|desventaja de nivel/.test(a))).toEqual([]));
  }, T);
});
