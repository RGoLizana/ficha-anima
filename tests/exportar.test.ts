// Exportar la ficha a Excel sobre la plantilla base (src/export/xlsm.ts) y volver a leerla con el importador.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { strToU8, zipSync, unzipSync, strFromU8 } from 'fflate';
import { escribirFicha, reescribirHoja } from '../src/export/xlsm';
import { leerFicha } from '../src/import/xlsm';
import mapa from '../src/data/migracion.json';
import { FICHAS, read } from './helpers';

const RAIZ = join(import.meta.dirname, '..');
const BASE = (n: string) => join(RAIZ, 'ref/pdf', `${n} 8.7.0.xlsm`);
const DEFECTOS = (mapa as unknown as { defectos: Record<string, unknown> }).defectos;

describe('reescribirHoja (XML de una hoja)', () => {
  const hoja = (filas: string) => `<worksheet><sheetData>${filas}</sheetData><pageMargins/></worksheet>`;

  it('cambia una celda conservando su estilo, y escapa el texto', () => {
    const xml = hoja('<row r="3" spans="1:4"><c r="A3" s="7" t="s"><v>5</v></c><c r="C3" s="9"><v>1</v></c></row>');
    const r = reescribirHoja(xml, new Map<string, string | number | boolean | undefined>([['A3', 'a < b & "c"'], ['C3', 42]]));
    expect(r).toContain('<c r="A3" s="7" t="inlineStr"><is><t xml:space="preserve">a &lt; b &amp; "c"</t></is></c>');
    expect(r).toContain('<c r="C3" s="9"><v>42</v></c>');
    expect(r).not.toContain('spans=');
    expect(r.endsWith('<pageMargins/></worksheet>')).toBe(true);
  });

  it('inserta celdas y filas que no existían, siempre en orden', () => {
    const xml = hoja('<row r="2"><c r="B2"><v>1</v></c><c r="D2"><v>1</v></c></row><row r="9"><c r="A9"><v>1</v></c></row>');
    const r = reescribirHoja(xml, new Map<string, string | number | boolean | undefined>([['C2', true], ['AA2', 'x'], ['A5', 7]]));
    expect(r.indexOf('r="2"')).toBeLessThan(r.indexOf('r="5"'));
    expect(r.indexOf('r="5"')).toBeLessThan(r.indexOf('r="9"'));
    const fila2 = /<row r="2"[^>]*>(.*?)<\/row>/.exec(r)![1];
    expect([...fila2.matchAll(/<c r="([A-Z]+)2"/g)].map((m) => m[1])).toEqual(['B', 'C', 'D', 'AA']);
    expect(fila2).toContain('<c r="C2" t="b"><v>1</v></c>');
  });

  it('no pisa las celdas con fórmula y deja vacía la que no tiene valor', () => {
    const xml = hoja('<row r="1"><c r="A1" s="2"><f>B1+1</f><v>3</v></c><c r="B1" s="4"><v>8</v></c></row>');
    const r = reescribirHoja(xml, new Map<string, string | number | boolean | undefined>([['A1', 'x'], ['B1', undefined]]));
    expect(r).toContain('<c r="A1" s="2"><f>B1+1</f><v>3</v></c>');
    expect(r).toContain('<c r="B1" s="4"/>');
  });

  it('acepta una hoja con <sheetData/> vacío', () => {
    expect(reescribirHoja('<worksheet><sheetData/></worksheet>', new Map([['A1', 5]]))).toContain('<c r="A1"><v>5</v></c>');
  });
});

describe('escribirFicha', () => {
  it('rechaza lo que no es un Excel o no es una ficha', () => {
    expect(() => escribirFicha(strToU8('hola'), {})).toThrow(/no es un archivo Excel/);
    const otro = zipSync({
      'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData/></worksheet>'),
    });
    expect(() => escribirFicha(otro, {})).toThrow(/no parece una ficha de Anima/);
  });
});

// los .xlsm originales no se suben al repositorio (.gitignore): sin ellos estas pruebas se omiten (en CI)
const HAY_BASE = FICHAS.every((n) => existsSync(BASE(n)));
describe.skipIf(!HAY_BASE)('escribirFicha sobre una plantilla real 8.7.0', () => {
  const base = readFileSync(BASE('sesshomaru'));

  it.each(['lock', 'ayane'])('la ficha %s se lee igual tras exportarla (sobre la base de otra ficha)', (n) => {
    const entradas = read(`ref/fichas/${n}.json`).entradas as Record<string, unknown>;
    const libro = escribirFicha(new Uint8Array(base), entradas as never);
    const r = leerFicha(libro);
    expect(r.version).toBe('8.7.0');
    for (const [k, v] of Object.entries(entradas)) expect(r.entradas[k], k).toEqual(v);
    // lo que la ficha no define queda con el valor por defecto de la plantilla (no con lo que tuviera la base)
    for (const [k, v] of Object.entries(r.entradas)) expect(v, k).toEqual(entradas[k] ?? DEFECTOS[k]);
  }, 60_000);

  it('conserva las macros y todo lo demás, recalcula al abrir y no deja calcChain', () => {
    const libro = unzipSync(escribirFicha(new Uint8Array(base), read('ref/fichas/lock.json').entradas));
    const original = unzipSync(new Uint8Array(base));
    expect(Object.keys(libro).filter((k) => k !== 'xl/calcChain.xml').sort()).toEqual(Object.keys(original).filter((k) => k !== 'xl/calcChain.xml').sort());
    expect(libro['xl/vbaProject.bin']).toEqual(original['xl/vbaProject.bin']);
    expect(strFromU8(libro['xl/workbook.xml'])).toMatch(/<calcPr\b[^>]*fullCalcOnLoad="1"/);
    expect(libro['xl/calcChain.xml']).toBeUndefined();
    expect(strFromU8(libro['[Content_Types].xml'])).not.toContain('calcChain');
    // las fórmulas de la plantilla no se tocan
    const formulas = (z: Record<string, Uint8Array>) => Object.keys(z).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
      .reduce((n, k) => n + (strFromU8(z[k]).match(/<f\b/g)?.length ?? 0), 0);
    expect(formulas(libro)).toBe(formulas(original));
  }, 60_000);
});
