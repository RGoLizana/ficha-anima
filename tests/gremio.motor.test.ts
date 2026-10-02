// El contenido propio del gremio solo consume: nivel de vía, CV, CM y PD, sumándose a 4 totales de la plantilla.
import { describe, expect, it } from 'vitest';
import { entradasConsumo } from '../src/gremio/modelo';
import { motor, read } from './helpers';

describe('consumo del gremio en el motor', () => {
  const entradas = read('ref/fichas/lock.json').entradas;
  const l = motor();
  const v = (k: string) => Number(l.valor(k));
  const medir = () => ({ nivel: v('Místicos!E12'), cv: v('Psíquicos!E12'), cm: v('Ki!E29'), pd: ['K', 'M', 'O', 'Q', 'S'].map((c) => v(`PDs!${c}194`)), aviso: l.valor('Místicos!C29') });

  it('sin elementos propios no cambia nada (los ceros no alteran los totales)', () => {
    l.cargar(entradas);
    const a = medir();
    l.cargar({ ...entradas, ...entradasConsumo([]) });
    expect(medir()).toEqual(a);
  }, 120_000);

  it('suma nivel de vía, CV, CM y PD (por categoría) a los totales de la ficha', () => {
    l.cargar(entradas);
    const a = medir();
    l.cargar({ ...entradas, ...entradasConsumo([
      { tipo: 'via', n: 'Ars Gnosis', nivel: 20, cv: 0, cm: 0, pd: 15, cat: 2 },
      { tipo: 'disciplina', n: 'Resonancia', nivel: 0, cv: 2, cm: 0, pd: 0, cat: 1 },
      { tipo: 'ars', n: 'Sello', nivel: 0, cv: 0, cm: 30, pd: 40, cat: 1 },
    ]) });
    const d = medir();
    expect(d.nivel - a.nivel).toBe(20);
    expect(d.cv - a.cv).toBe(2);
    expect(d.cm - a.cm).toBe(30);
    expect(d.pd[0] - a.pd[0]).toBe(40);
    expect(d.pd[1] - a.pd[1]).toBe(15);
    expect(d.pd.slice(2)).toEqual(a.pd.slice(2));
  }, 120_000);

  it('pasarse de nivel de magia avisa con el aviso del Excel y deshacerlo lo quita', () => {
    l.cargar(entradas);
    expect(l.valor('Místicos!C29')).toBe('');
    l.poner('Gremio!B1', 5000);
    expect(l.valor('Místicos!C29')).toBe('Exceso de Nivel de Magia');
    l.poner('Gremio!B1', 0);
    expect(l.valor('Místicos!C29')).toBe('');
  }, 120_000);

  it('exceso de CV y de PD avisa sin bloquear', () => {
    l.cargar(entradas);
    l.poner('Gremio!B2', 99);
    expect(l.valor('Psíquicos!C22')).toBe('Exceso de CVs');
    l.poner('Gremio!B2', 0);
    l.poner('Gremio!B4', 100000);
    expect(String(l.valor('PDs!T194'))).toMatch(/Exceso de PDs|Límite por Categoría/);
    l.poner('Gremio!B4', 0);
  }, 120_000);
});
