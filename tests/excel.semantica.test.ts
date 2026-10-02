// Semántica de Excel que el motor debe respetar (plugins + configuración), probada en un libro diminuto.
import { describe, expect, it } from 'vitest';
import { Libro, sustituirIndirect } from '../src/engine/libro';
import { matcher, matchApprox } from '../src/engine/plugins';

/** Libro de una hoja "H" con los datos dados; devuelve el valor de la fórmula puesta en Z1. */
function calc(formula: string, celdas: Record<string, string | number | boolean> = {}) {
  // los textos van con ' delante, como los deja tools/export_formulas.py en la plantilla
  const texto = Object.fromEntries(Object.entries(celdas).map(([k, v]) => [k, typeof v === 'string' && !v.startsWith('=') ? `'${v}` : v]));
  const l = new Libro({ sheets: { H: { ...texto, Z1: formula } }, names: {} });
  return l.valor('H!Z1');
}

describe('COUNTIF / SUMIF con criterios de Excel', () => {
  const datos = { A1: 'Mutación (1)', A2: ' > Mutación (1)', A3: 5, A4: '5', A5: 'Desplazamiento rápido', A6: '' };
  it('el operador solo cuenta si es el primer carácter', () => {
    expect(calc('=COUNTIF(A1:A6," > Mutación (1)")', datos)).toBe(1); // texto literal con espacio delante
    expect(calc('=COUNTIF(A1:A6,">4")', datos)).toBe(1);
  });
  it('números y textos numéricos', () => {
    expect(calc('=COUNTIF(A1:A6,5)', datos)).toBe(2);
    expect(calc('=COUNTIF(A1:A6,"<>5")', datos)).toBe(4);
  });
  it('comodines * ? y ~, sin distinguir mayúsculas', () => {
    expect(calc('=COUNTIF(A1:A6,"*mutación*")', datos)).toBe(2);
    expect(calc('=COUNTIF(A1:A6,"desplazamiento rápid?")', datos)).toBe(1);
    expect(calc('=COUNTIF(A1:A2,"~*")', { A1: '*', A2: 'x' })).toBe(1);
  });
  it('criterio vacío cuenta celdas vacías', () => {
    // A5 ocupa la hoja hasta la fila 5: el motor recorta los rangos al área usada (en el libro real no pasa)
    expect(calc('=COUNTIF(A1:A3,"")', { A1: 'x', A5: 'y' })).toBe(2);
  });
  it('SUMIF con y sin rango de suma', () => {
    expect(calc('=SUMIF(A1:A3,"a",B1:B3)', { A1: 'a', A2: 'b', A3: 'A', B1: 1, B2: 2, B3: 4 })).toBe(5);
    expect(calc('=SUMIF(A1:A3,">1")', { A1: 1, A2: 2, A3: 3 })).toBe(5);
  });
  it('matcher directo', () => {
    expect(matcher('>=10')(10)).toBe(true);
    expect(matcher('<b')('A')).toBe(true);
    expect(matcher(true)(true)).toBe(true);
  });
});

describe('búsquedas', () => {
  it('MATCHAPPROX encuentra textos en listas ordenadas (el MATCH aproximado del motor fallaba)', () => {
    const t = { A1: 'Conocida', A2: 'Distinta', A3: 'Mixta', A4: 'Similar' };
    expect(calc('=MATCHAPPROX("Conocida",A1:A4,1)', t)).toBe(1);
    expect(calc('=MATCHAPPROX("Mixta",A1:A4)', t)).toBe(3);
    expect(calc('=MATCHAPPROX("Zeta",A1:A4,1)', t)).toBe(4);
    expect(calc('=MATCHAPPROX("Aa",A1:A4,1)', t)).toBe('#N/A');
  });
  it('MATCHAPPROX numérico y descendente', () => {
    expect(matchApprox(7, [1, 5, 10], 1)).toBe(2);
    expect(matchApprox(0, [1, 5, 10], 1)).toBe(null);
    expect(matchApprox(7, [10, 5, 1], -1)).toBe(1);
  });
  it('SEARCH con comodines y sin mayúsculas; FIND distingue mayúsculas', () => {
    expect(calc('=SEARCH("b*d","aBcd")')).toBe(2);
    expect(calc('=FIND("B","aBcd")')).toBe(2);
    expect(calc('=ISERROR(FIND("b","aBcd"))')).toBe(true);
  });
  it('RANK descendente y ascendente', () => {
    expect(calc('=RANK(5,A1:A3)', { A1: 1, A2: 5, A3: 9 })).toBe(2);
    expect(calc('=RANK(5,A1:A3,1)', { A1: 1, A2: 5, A3: 9 })).toBe(2);
    expect(calc('=RANK(9,A1:A3,1)', { A1: 1, A2: 5, A3: 9 })).toBe(3);
  });
});

describe('coerciones como Excel', () => {
  it('""+1 es #VALUE! (el motor daba 1)', () => {
    expect(calc('=""+1')).toBe('#VALUE!');
    expect(calc('=A1+1', { A1: '' })).toBe('#VALUE!');
  });
  it('=CeldaVacía vale 0, y una celda vacía es igual a "" y a 0', () => {
    expect(calc('=A1')).toBe(0);
    expect(calc('=A1=""')).toBe(true);
    expect(calc('=A1=0')).toBe(true);
  });
  it('distingue acentos al comparar textos (Ánima ≠ Anima) pero no mayúsculas', () => {
    expect(calc('="Ánima"="Anima"')).toBe(false);
    expect(calc('="ánima"="ÁNIMA"')).toBe(true);
  });
  it('los textos con forma de fecha no se convierten en fechas', () => {
    expect(calc('=ISNUMBER(A1)', { A1: '1/2' })).toBe(false);
  });
  it('textos guardados con forma de número siguen siendo texto', () => {
    expect(calc('=ISTEXT(A1)', { A1: '1.' })).toBe(true);
    expect(calc('=LEFT(A1,LEN(A1)-1)', { A1: '10.' })).toBe('10');
  });
  it('errores con nombre de Excel', () => {
    expect(calc('=NA()')).toBe('#N/A');
    expect(calc('=1/0')).toBe('#DIV/0!');
  });
});

describe('INDIRECT en listas', () => {
  it('sustituye INDIRECT anidados, con paréntesis y textos dentro', () => {
    const r = sustituirIndirect('IF(A1="x(",INDIRECT($B1),INDIRECT(VLOOKUP(C1,T,2,0)))', (a) => `<${a}>`);
    expect(r).toBe('IF(A1="x(",<$B1>,<VLOOKUP(C1,T,2,0)>)');
  });
  it('lista() resuelve INDIRECT(celda) a un nombre y luego al rango', () => {
    const l = new Libro({ sheets: { H: { A1: "'Opciones", B1: "'uno", B2: "'dos", B3: "'uno" } }, names: { Opciones: '=H!$B$1:$B$3' } });
    expect(l.lista('INDIRECT($A$1)', 'H')).toEqual(['uno', 'dos']); // sin duplicados
    expect(l.lista('"Sí,No"', 'H')).toEqual(['Sí', 'No']);
  });
});
