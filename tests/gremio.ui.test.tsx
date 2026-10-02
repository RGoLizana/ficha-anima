// @vitest-environment happy-dom
// Sección «Gremio»: biblioteca propia (vías/subvías, disciplinas, Ars Magnus) y lo que consume cada personaje
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
  async abrir(id: string, entradas: Record<string, Entrada>) {
    if (abierta.value === id) return;
    abierta.value = id; motor().cargar(entradas); valores.value = motor().hojas(HOJAS_VISIBLES);
  },
  async poner(clave: string, v: Entrada | null) { valores.value = { ...valores.value, ...motor().poner(clave, v) }; },
  async opciones() { return []; },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');
const { guardarBiblioteca, biblioteca } = await import('../src/gremio/almacen');
const { BIBLIOTECA_VACIA } = await import('../src/gremio/modelo');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; guardarBiblioteca(BIBLIOTECA_VACIA); localStorage.clear(); });

const abrir = async () => {
  const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
  render(<FichaView id={f.id} seccion="gremio" />);
  await waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
  await waitFor(() => expect(document.querySelector('.personalizado')).toBeTruthy());
  return f;
};
const boton = (t: string | RegExp) => [...document.querySelectorAll('button, label.btn')].find((b) => (typeof t === 'string' ? b.textContent!.trim() === t : t.test(b.textContent!))) as HTMLElement;
const campo = (etiqueta: string, ambito: ParentNode = document) => [...ambito.querySelectorAll('label.field')].find((l) => l.querySelector('.lbl')?.textContent === etiqueta)!.querySelector('input, select, textarea') as HTMLInputElement;
const escribir = (el: HTMLInputElement | HTMLSelectElement, v: string) => fireEvent.change(el, { target: { value: v } });
const valor = (k: string) => Number(motor().valor(k));
const elegir = (v: string) => {
  escribir([...document.querySelectorAll('select')].find((s) => s.querySelector('optgroup'))!, v);
  fireEvent.click(boton('Añadir de la biblioteca') ?? [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Añadir').at(-1)!);
};

describe('Gremio', () => {
  it('crear una vía propia con un conjuro: se guarda en la biblioteca', async () => {
    await abrir();
    fireEvent.input(campo('Nuevo elemento'), { target: { value: 'Ars Gnosis' } });
    fireEvent.click([...document.querySelectorAll('button')].filter((b) => b.textContent === 'Añadir')[0]);
    await waitFor(() => expect(biblioteca.value.vias.map((v) => v.n)).toEqual(['Ars Gnosis']));
    fireEvent.click(boton('+ Añadir conjuro'));
    await waitFor(() => expect(biblioteca.value.vias[0].conjuros).toHaveLength(1));
    escribir(campo('Conjuro'), 'Chispa gnóstica');
    escribir(campo('Zeón', document.querySelector('article')!), '40');
    expect(biblioteca.value.vias[0].conjuros[0].n).toBe('Chispa gnóstica');
    expect(biblioteca.value.vias[0].conjuros[0].g[0][1]).toBe(40);
    expect(JSON.parse(localStorage.getItem('anima.biblioteca')!).vias[0].n).toBe('Ars Gnosis');
  }, T);

  it('importar un .json de gremio; un archivo malo da error claro y no pierde lo anterior', async () => {
    await abrir();
    const subir = (texto: string) => {
      const input = document.querySelector('input[aria-label="Importar biblioteca de gremio"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [new File([texto], 'g.json')], configurable: true });
      fireEvent.change(input);
    };
    subir(JSON.stringify({ nombre: 'Gremio X', vias: [{ n: 'Susurros', tipo: 'Subvía' }], disciplinas: [{ n: 'Resonancia' }], arsMagnus: [{ n: 'Sello', pd: 30, cm: 20 }] }));
    await waitFor(() => expect(biblioteca.value.arsMagnus.map((a) => a.n)).toEqual(['Sello']));
    expect(biblioteca.value.nombre).toBe('Gremio X');
    subir('no soy json');
    await waitFor(() => expect(document.querySelector('.aviso')).toBeTruthy());
    subir(JSON.stringify({ hola: 1 }));
    await waitFor(() => expect(document.querySelector('.aviso')!.textContent).toContain('no es una biblioteca de gremio'));
    expect(biblioteca.value.vias).toHaveLength(1);
  }, T);

  it('lo propio del personaje consume CM, PD, nivel de vía y CV en los totales del Excel, y quitarlo lo deshace', async () => {
    guardarBiblioteca({ ...BIBLIOTECA_VACIA, arsMagnus: [{ n: 'Sello', pd: 30, cm: 20, e: '' }], vias: [{ n: 'Ars Gnosis', tipo: 'Vía mayor', nota: '', conjuros: [] }], disciplinas: [{ n: 'Resonancia', mod: '', poderes: [] }] });
    const f = await abrir();
    const antes = { cm: valor('Ki!E29'), pd: valor('PDs!K194'), nivel: valor('Místicos!E12'), cv: valor('Psíquicos!E12') };
    elegir('ars:Sello');
    await waitFor(() => expect(store.buscar(f.id)!.propio).toHaveLength(1));
    await waitFor(() => expect(valor('Ki!E29')).toBe(antes.cm + 20));
    expect(valor('PDs!K194')).toBe(antes.pd + 30);
    elegir('via:Ars Gnosis');
    await waitFor(() => expect(store.buscar(f.id)!.propio).toHaveLength(2));
    escribir(campo('Nivel de vía'), '30');
    await waitFor(() => expect(valor('Místicos!E12')).toBe(antes.nivel + 30));
    elegir('disciplina:Resonancia');
    await waitFor(() => expect(valor('Psíquicos!E12')).toBe(antes.cv + 1));      // una disciplina consume 1 CV por defecto
    fireEvent.click(document.querySelector('[aria-label="Quitar Sello"]')!);
    await waitFor(() => expect(valor('Ki!E29')).toBe(antes.cm));
    expect(store.buscar(f.id)!.entradas['Ki!E29']).toBeUndefined();               // nada se escribe en las entradas del Excel
  }, T);

  it('pasarse de nivel de magia avisa sin bloquear', async () => {
    guardarBiblioteca({ ...BIBLIOTECA_VACIA, vias: [{ n: 'Gran Vía', tipo: 'Vía mayor', nota: '', conjuros: [] }] });
    const f = await abrir();
    elegir('via:Gran Vía');
    await waitFor(() => expect(store.buscar(f.id)!.propio).toHaveLength(1));
    escribir(campo('Nivel de vía'), '5000');
    await waitFor(() => expect(document.querySelector('.aviso')?.textContent).toContain('Exceso de Nivel de Magia'));
    expect(store.buscar(f.id)!.propio![0].nivel).toBe(5000);
  }, T);

  it('la ficha conserva lo propio al importar el JSON y descarta lo inválido', () => {
    const f = store.importar(JSON.stringify({ ...read('ref/fichas/lock.json'), propio: [{ tipo: 'ars', n: 'Sello', cm: 20, pd: 30, cat: 2 }, { n: '' }] }));
    expect(store.buscar(f.id)!.propio).toEqual([{ tipo: 'ars', n: 'Sello', nivel: 0, cv: 0, cm: 20, pd: 30, cat: 2 }]);
  });
});
