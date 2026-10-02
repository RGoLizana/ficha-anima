// Contenido propio del gremio: biblioteca (validar/importar/exportar) y lo que consume cada personaje.
import { beforeEach, describe, expect, it } from 'vitest';
import { consumo, conjuroNuevo, entradasConsumo, parseBiblioteca, parseElegidos, type Elegido } from '../src/gremio/modelo';

const ejemplo = {
  nombre: 'Gremio de prueba',
  vias: [
    { n: 'Ars Gnosis', tipo: 'Vía mayor', nota: 'del gremio', conjuros: [{ n: 'Chispa gnóstica', l: 4, t: 'Efecto', a: 'Activa', d: 'Sí', g: [[6, 40, 'No', 'efecto base'], [8, 80, 10, 'int'], [10, 120, 10, 'avz'], [12, 200, 15, 'arc']], e: 'texto' }, { n: '' }] },
    { n: 'Ars Gnosis', tipo: 'Subvía', conjuros: [] },     // repetida: se descarta
    { n: 'Susurros', tipo: 'inventado', conjuros: [] },     // tipo desconocido: subvía
  ],
  disciplinas: [{ n: 'Resonancia', mod: '', poderes: [{ n: 'Eco', l: 1, m: 'Sí', a: 'Pasiva', f: ['a', 'b'] }] }],
  arsMagnus: [{ n: 'Sello del gremio', pd: 30, cm: 20, e: 'x' }],
};

describe('parseBiblioteca', () => {
  it('valida y normaliza: 4 grados, 10 dificultades, sin repetidos ni vacíos', () => {
    const b = parseBiblioteca(ejemplo);
    expect(b.vias.map((v) => v.n)).toEqual(['Ars Gnosis', 'Susurros']);
    expect(b.vias[1].tipo).toBe('Subvía');
    expect(b.vias[0].conjuros).toHaveLength(1);
    expect(b.vias[0].conjuros[0].g).toHaveLength(4);
    expect(b.vias[0].conjuros[0].d).toBe('Sí');
    expect(b.disciplinas[0].mod).toBe('Sin modificador');
    expect(b.disciplinas[0].poderes[0].f).toHaveLength(10);
    expect(b.arsMagnus[0]).toMatchObject({ n: 'Sello del gremio', pd: 30, cm: 20 });
  });
  it('un archivo que no es una biblioteca da error claro y la basura dentro se descarta', () => {
    expect(() => parseBiblioteca({ hola: 1 })).toThrow(/no es una biblioteca/);
    expect(() => parseBiblioteca('texto')).toThrow();
    const b = parseBiblioteca({ vias: [5, null, { n: 'X', conjuros: 'mal' }], disciplinas: 'mal' });
    expect(b.vias).toHaveLength(1);
    expect(b.disciplinas).toEqual([]);
  });
  it('ida y vuelta por JSON', () => {
    const b = parseBiblioteca(ejemplo);
    expect(parseBiblioteca(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });
  it('un conjuro nuevo tiene 4 grados vacíos', () => { expect(conjuroNuevo().g).toHaveLength(4); });
});

describe('consumo del personaje', () => {
  const el = (p: Partial<Elegido>): Elegido => ({ tipo: 'via', n: 'x', nivel: 0, cv: 0, cm: 0, pd: 0, cat: 1, ...p });
  it('suma nivel de vía, CV, CM y PD por categoría', () => {
    const c = consumo([el({ nivel: 20 }), el({ n: 'y', nivel: 10, pd: 5, cat: 3 }), el({ tipo: 'disciplina', n: 'd', cv: 2 }), el({ tipo: 'ars', n: 'a', cm: 20, pd: 30, cat: 2 })]);
    expect(c).toEqual({ nivel: 30, cv: 2, cm: 20, pd: [0, 30, 5, 0, 0] });
  });
  it('categorías fuera de 1-5 se ajustan y los números raros cuentan 0', () => {
    expect(consumo([el({ pd: 10, cat: 9 }), el({ pd: Number.NaN, cat: 0 })]).pd).toEqual([0, 0, 0, 0, 10]);
  });
  it('sin elementos consume 0 y se vuelca a las celdas de la hoja interna Gremio', () => {
    expect(entradasConsumo([])).toEqual({ 'Gremio!B1': 0, 'Gremio!B2': 0, 'Gremio!B3': 0, 'Gremio!B4': 0, 'Gremio!B5': 0, 'Gremio!B6': 0, 'Gremio!B7': 0, 'Gremio!B8': 0 });
    expect(entradasConsumo([el({ nivel: 12, cv: 1, cm: 3, pd: 4, cat: 2 })])).toMatchObject({ 'Gremio!B1': 12, 'Gremio!B2': 1, 'Gremio!B3': 3, 'Gremio!B5': 4 });
  });
  it('parseElegidos descarta lo que no encaja', () => {
    expect(parseElegidos([{ tipo: 'via', n: 'A', nivel: 5 }, { n: '' }, 7, { tipo: 'raro', n: 'B', cat: 8 }]))
      .toEqual([{ tipo: 'via', n: 'A', nivel: 5, cv: 0, cm: 0, pd: 0, cat: 1 }, { tipo: 'via', n: 'B', nivel: 0, cv: 0, cm: 0, pd: 0, cat: 5 }]);
    expect(parseElegidos('mal')).toEqual([]);
  });
});

beforeEach(() => { /* sin estado compartido */ });
