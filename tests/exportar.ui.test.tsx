// @vitest-environment happy-dom
// Botón "Exportar Excel" de la cabecera de la ficha: pide la plantilla base una vez y descarga «Nombre nivel.xlsm»
import { existsSync, readFileSync } from 'node:fs';
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
  async poner() { /* sin edición */ },
  async opciones() { return []; },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');
const { borrarBase } = await import('../src/export/base');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(async () => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; await borrarBase(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const subir = (archivo: File) => {
  const input = document.querySelector('.exportar-excel input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
  fireEvent.change(input);
};
const abrirFicha = async () => {
  const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
  render(<FichaView id={f.id} seccion="principal" />);
  await waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });
  await waitFor(() => expect(document.querySelector('.exportar-excel')).toBeTruthy());
};

describe('Exportar Excel', () => {
  it('sin plantilla base pide una y rechaza lo que no es un Excel de la ficha', async () => {
    await abrirFicha();
    expect(document.querySelector('.exportar-excel')!.textContent).toContain('Exportar Excel');
    expect(document.querySelector('.exportar-excel input[aria-label="Plantilla base de Excel"]')).toBeTruthy();
    subir(new File(['no soy un excel'], 'mala.xlsm'));
    await waitFor(() => expect(document.querySelector('.exportar-excel [role=alert]')!.textContent).toContain('no es un archivo Excel'));
  }, T);

  it.skipIf(!existsSync('ref/pdf/sesshomaru 8.7.0.xlsm'))('con una plantilla real descarga «Lock 6.xlsm» y recuerda la base', async () => {
    const descargas: string[] = [];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { descargas.push(this.download); });
    await abrirFicha();
    subir(new File([readFileSync('ref/pdf/sesshomaru 8.7.0.xlsm')], 'sesshomaru 8.7.0.xlsm'));
    await waitFor(() => expect(descargas).toEqual(['Lock 6.xlsm']), { timeout: 30_000 });
    // ahora la base queda guardada: el botón exporta directamente
    await waitFor(() => expect(document.querySelector('.exportar-excel button.btn')!.getAttribute('title')).toContain('sesshomaru 8.7.0.xlsm'));
    fireEvent.click(document.querySelector('.exportar-excel button.btn')!);
    await waitFor(() => expect(descargas).toHaveLength(2), { timeout: 30_000 });
  }, T);

  it('avisa de lo que el Excel no puede llevar de gremio: categoría propia sustituida y consumos', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const { categoriaDesde } = await import('../src/gremio/categorias');
    const descargas: string[] = [];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { descargas.push(this.download); });
    const base = read('ref/fichas/lock.json');
    const f = store.importar(JSON.stringify({ ...base, entradas: { ...base.entradas, 'PDs!O7': 'Caballero rúnico' }, categorias: [categoriaDesde('Guerrero', 'Caballero rúnico')],
      propio: [{ tipo: 'via', n: 'Ars Gnosis', nivel: 22, cv: 0, cm: 0, pd: 0, cat: 1 }] }));
    render(<FichaView id={f.id} seccion="principal" />);
    await waitFor(() => expect(document.querySelector('.exportar-excel')).toBeTruthy(), { timeout: 20_000 });
    const hojas = ['Principal', 'General', 'Tablas'];
    const libro = zipSync({
      'xl/workbook.xml': strToU8(`<workbook><sheets>${hojas.map((h, i) => `<sheet name="${h}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
      'xl/_rels/workbook.xml.rels': strToU8(`<Relationships>${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`),
      ...Object.fromEntries(hojas.map((_, i) => [`xl/worksheets/sheet${i + 1}.xml`, strToU8('<worksheet><sheetData/></worksheet>')])),
    });
    subir(new File([libro], 'base.xlsm'));
    await waitFor(() => expect(descargas).toHaveLength(1), { timeout: 30_000 });
    const aviso = document.querySelector('.exportar-excel [role=alert]')!.textContent!;
    expect(aviso).toMatch(/«Novel» se sustituye por «Caballero rúnico»/);
    expect(aviso).toMatch(/no cuenta lo que consumen \(nivel de vía 22\)/);
  }, T);
});
