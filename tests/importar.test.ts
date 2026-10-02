// @vitest-environment happy-dom
// Importar fichas Excel (.xlsm) en el navegador: mismas entradas que sacan tools/extract.py y tools/migrate.py.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { strToU8, zipSync } from 'fflate';
import { FICHAS, read } from './helpers';
import { leerFicha } from '../src/import/xlsm';

vi.mock('../src/engine', () => ({ abierta: signal<string | null>(null), poner: vi.fn() }));
const store = await import('../src/store');
const { nombreDe } = await import('../src/model/ficha');

const RAIZ = join(import.meta.dirname, '..');
const xlsm = (p: string) => new Uint8Array(readFileSync(p));
const referencia = (n: string) => read(`ref/fichas/${n}.json`).entradas;

beforeEach(() => { store.fichas.value = []; });

describe('importar .xlsm 8.7.0', () => {
  it.each(FICHAS)('%s: mismas entradas que ref/fichas', (n) => {
    const r = leerFicha(xlsm(join(RAIZ, 'ref/pdf', `${n} 8.7.0.xlsm`)));
    expect(r.version).toBe('8.7.0');
    expect(r.avisos).toEqual([]);
    expect(r.entradas).toEqual(referencia(n));
  });

  it('crea la ficha en el almacén con el nombre de General', async () => {
    const { ficha, avisos } = await store.importarExcel(xlsm(join(RAIZ, 'ref/pdf/lock 8.7.0.xlsm')), 'lock 8.7.0.xlsm');
    expect(avisos).toEqual([]);
    expect(nombreDe(ficha)).toBe('Lock');
    expect(store.fichas.value).toEqual([ficha]);
  });
});

describe('archivos que no son una ficha', () => {
  it('basura: no es un Excel', async () => {
    expect(() => leerFicha(strToU8('hola, no soy un zip'))).toThrow(/no es un archivo Excel/);
    await expect(store.importarExcel(new Uint8Array(0))).rejects.toThrow(/no es un archivo Excel/);
    expect(store.fichas.value).toEqual([]);
  });

  it('zip sin libro de Excel', () => {
    expect(() => leerFicha(zipSync({ 'word/document.xml': strToU8('<w/>') }))).toThrow(/no es un archivo Excel/);
  });

  it('Excel que no es una ficha de Anima', () => {
    const libro = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData/></worksheet>'),
    });
    expect(() => leerFicha(libro)).toThrow(/no parece una ficha de Anima/);
  });
});

// Originales en versiones anteriores (solo en el equipo del autor; ver tools/migrate.py FICHAS)
const ORIGINALES = {
  sesshomaru: String.raw`D:\Escritorio\dissidia\aa-Sesshomaru\Sesshomaru 4.xlsm`, // 8.5.0
  lock: String.raw`D:\Escritorio\dissidia\a-Lock\Ficha_lock lvl 6.xlsm`, // 8.4.3
  ayane: String.raw`D:\Escritorio\dissidia\Pilars of reborn\Ayane akame lvl4.xlsm`, // 8.6.1
};
describe('importar .xlsm de versiones anteriores (como tools/migrate.py)', () => {
  it.each(FICHAS)('%s', (n) => {
    const p = ORIGINALES[n];
    if (!existsSync(p)) return;
    const r = leerFicha(xlsm(p));
    const ref = referencia(n);
    const diff = Object.fromEntries([...new Set([...Object.keys(ref), ...Object.keys(r.entradas)])]
      .filter((k) => ref[k] !== r.entradas[k]).map((k) => [k, [r.entradas[k], ref[k]]]));
    expect(r.avisos.join()).not.toMatch(/Versión/);
    expect(diff).toEqual({});
  });
});
