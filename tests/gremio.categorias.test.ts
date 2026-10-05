// Categorías de gremio (unitarias): nombres, filas que ocupan las propias y que sin ellas no cambia nada.
import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  COLUMNAS, OFICIALES, categoriaDesde, categoriasUsadas, entradasCategorias, parseCategoria, parseCategorias, sustituciones, validarNombre,
} from '../src/gremio/categorias';
import { parseBiblioteca, BIBLIOTECA_VACIA } from '../src/gremio/modelo';
import { entradasMotor, parse, nueva } from '../src/model/ficha';
import { escribirFicha } from '../src/export/xlsm';
import { read } from './helpers';

describe('datos oficiales', () => {
  it('22 categorías en las filas 202-223 y 81 columnas editables (E..CG)', () => {
    expect(OFICIALES).toHaveLength(22);
    expect(OFICIALES.map((o) => o.fila)).toEqual(Array.from({ length: 22 }, (_, i) => 202 + i));
    expect(COLUMNAS).toHaveLength(81);
    expect(COLUMNAS[0]).toEqual({ c: 'E', l: 'Turno' });
    expect(COLUMNAS.at(-1)).toEqual({ c: 'CG', l: 'Arquetipo 2' });
    expect(OFICIALES.at(-1)!.n).toBe('Novel');
  });
});

describe('datos al día con la plantilla', () => {
  it('src/data/categorias.json coincide con Tablas!D202:CG223 de plantilla.json (regenerar con tools/export_categorias.py)', () => {
    const t = read('public/plantilla.json').sheets.Tablas as Record<string, unknown>;
    const texto = (x: unknown) => (typeof x === 'string' && x.startsWith("'") ? x.slice(1) : x);
    for (const o of OFICIALES) {
      expect(texto(t[`D${o.fila}`])).toBe(o.n);
      for (const { c } of COLUMNAS) {
        const x = t[`${c}${o.fila}`];
        if (x === undefined || x === null || x === '') expect(o.v[c], `${o.n} ${c}`).toBeUndefined();
        else expect(o.v[c], `${o.n} ${c}`).toBe(texto(x));
      }
    }
  });
});

describe('nombres', () => {
  it('rechaza vacíos, oficiales, repetidos y comodines del Excel', () => {
    expect(validarNombre('', [])).toMatch(/nombre/);
    expect(validarNombre('hechicero', [])).toMatch(/oficial/);
    expect(validarNombre('Caballero rúnico', ['CABALLERO RÚNICO'])).toMatch(/Ya hay/);
    for (const mal of ['Mago*', 'Mago?', 'Ma~go', '=Mago', '<Mago', '>Mago']) expect(validarNombre(mal, []), mal).toMatch(/comodines/);
    expect(validarNombre(' Caballero rúnico ', [])).toBe('');
  });
});

describe('qué se escribe en el motor', () => {
  const propia = (n = 'Hechicero bis') => categoriaDesde('Hechicero', n);

  it('sin categorías de gremio no se escribe nada (las fichas normales no cambian)', () => {
    expect(entradasCategorias(undefined, ['Hechicero'])).toEqual({});
    expect(entradasCategorias([], ['Hechicero'])).toEqual({});
    const f = nueva(); f.entradas['PDs!O7'] = 'Hechicero';
    expect(Object.keys(entradasMotor(f)).filter((k) => k.startsWith('Tablas!'))).toEqual([]);          // lo único extra es el consumo de gremio (Gremio!B1…)
  });

  it('una propia que no se usa no escribe nada', () => {
    expect(entradasCategorias([propia()], ['Hechicero'])).toEqual({});
  });

  it('una propia en uso ocupa la última fila libre (Novel) con TODAS las columnas y sin cadenas vacías', () => {
    const e = entradasCategorias([propia()], ['Hechicero bis']);
    expect(e['Tablas!D223']).toBe('Hechicero bis');
    expect(Object.keys(e)).toHaveLength(1 + 81);
    expect(Object.keys(e).every((k) => /^Tablas!([A-Z]+)223$/.test(k))).toBe(true);
    expect(Object.values(e).some((v) => v === '')).toBe(false);
    expect(e['Tablas!E223']).toBe(OFICIALES.find((o) => o.n === 'Hechicero')!.v.E);
    expect(e['Tablas!CF223']).toBe('Místico');
  });

  it('salta la fila de una oficial que el personaje usa (Novel) y reparte varias propias sin pisarse', () => {
    const e = entradasCategorias([propia('A'), propia('B')], ['Novel', 'A', 'B']);
    expect(e['Tablas!D222']).toBe('A');
    expect(e['Tablas!D221']).toBe('B');
    expect(e['Tablas!D223']).toBeUndefined();
    expect(sustituciones([propia('A'), propia('B')], ['Novel', 'A', 'B'])).toEqual([{ propia: 'A', oficial: OFICIALES[20].n }, { propia: 'B', oficial: OFICIALES[19].n }]);
  });

  it('una oficial modificada solo escribe lo que cambia, en su propia fila', () => {
    const mod = categoriaDesde('Hechicero', '', true);
    mod.v.V = 1;                                         // coste de ki 3 → 1
    expect(OFICIALES.find((o) => o.n === 'Hechicero')!.fila).toBe(215);
    expect(entradasCategorias([mod], ['Hechicero'])).toEqual({ 'Tablas!V215': 1 });
    expect(entradasCategorias([mod], ['Mentalista'])).toEqual({});
  });

  it('las categorías usadas salen de PDs!O7…O15', () => {
    expect(categoriasUsadas({ 'PDs!O7': 'Hechicero', 'PDs!O11': ' Novel ', 'PDs!O9': '' })).toEqual(['Hechicero', 'Novel']);
  });
});

describe('guardar y validar', () => {
  it('parseCategoria descarta lo que no encaja y no admite nombres prohibidos', () => {
    expect(parseCategoria({ n: 'Mago*' })).toBeNull();
    expect(parseCategoria({ n: 'Hechicero' })).toBeNull();                       // oficial sin marcar como modificación
    expect(parseCategoria({ n: 'Hechicero', oficial: true, v: { E: 9, ZZ: 4, F: 'x', CF: 'Marciano', CG: 'Sin' } })).toMatchObject({ n: 'Hechicero', oficial: true, v: { E: 9, CG: 'Sin' } });
    expect(parseCategorias('no es una lista')).toEqual([]);
  });

  it('la biblioteca y la ficha conservan las categorías al guardarse y abrirse', () => {
    const c = categoriaDesde('Guerrero', 'Caballero');
    const b = parseBiblioteca({ categorias: [c, c], ocultas: ['Novel', 'Novel', ''] });
    expect(b.categorias).toHaveLength(1);                                         // nombres únicos
    expect(b.ocultas).toEqual(['Novel']);
    expect(parseBiblioteca({ vias: [] })).toEqual({ ...BIBLIOTECA_VACIA, version: 1 });
    const f = parse(JSON.parse(JSON.stringify({ ...nueva(), categorias: [c] })));
    expect(f.categorias).toEqual([c]);
    expect(parse(JSON.parse(JSON.stringify(nueva()))).categorias).toBeUndefined();
  });
});

describe('exportar a Excel', () => {
  const libro = () => zipSync({
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Principal" sheetId="1" r:id="rId1"/><sheet name="General" sheetId="2" r:id="rId2"/><sheet name="Tablas" sheetId="3" r:id="rId3"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData/></worksheet>'),
    'xl/worksheets/sheet2.xml': strToU8('<worksheet><sheetData/></worksheet>'),
    'xl/worksheets/sheet3.xml': strToU8('<worksheet><sheetData><row r="223"><c r="C223"><f>SUMIF(A1,B1,C1)</f><v>0</v></c><c r="D223" t="inlineStr"><is><t>Novel</t></is></c></row></sheetData></worksheet>'),
  });

  it('escribe las celdas de Tablas de la categoría propia y no toca sus fórmulas', () => {
    const extras = entradasCategorias([categoriaDesde('Hechicero', 'Hechicero bis')], ['Hechicero bis']);
    const t = strFromU8(unzipSync(escribirFicha(libro(), {}, extras))['xl/worksheets/sheet3.xml']);
    expect(t).toContain('<f>SUMIF(A1,B1,C1)</f>');
    expect(t).toContain('Hechicero bis');
    expect(t).not.toContain('>Novel<');
    expect(t).toContain('<c r="E223"><v>');
    expect(t).toContain('<c r="CF223" t="inlineStr">');
  });

  it('sin extras la hoja Tablas queda igual', () => {
    const antes = strFromU8(unzipSync(libro())['xl/worksheets/sheet3.xml']);
    expect(strFromU8(unzipSync(escribirFicha(libro(), {}))['xl/worksheets/sheet3.xml'])).toBe(antes);
  });
});
