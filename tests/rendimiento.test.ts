// Rendimiento del motor de fórmulas (sin worker ni red): construir, cargar una ficha y editar.
// Objetivos del plan: arranque < 6 s y edición < 100 ms en el navegador. En las pruebas se dejan márgenes más amplios
// porque la máquina de CI varía; los números reales salen en la consola.
import { describe, expect, it } from 'vitest';
import { Libro, type Plantilla } from '../src/engine/libro';
import { HOJAS_VISIBLES, read } from './helpers';

const medir = <T>(f: () => T): [T, number] => { const t = performance.now(); const r = f(); return [r, performance.now() - t]; };
const p = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
const log = (...a: unknown[]) => process.stdout.write(['[rendimiento]', ...a].join(' ') + String.fromCharCode(10));

describe('rendimiento del motor', () => {
  const plantilla = read('public/plantilla.json') as Plantilla;
  const ficha = read('ref/fichas/lock.json');

  it('construir el libro, cargar una ficha y leer todas las hojas', () => {
    const [libro, construir] = medir(() => new Libro(plantilla));
    const [, cargar] = medir(() => libro.cargar(ficha.entradas));
    const [valores, leer] = medir(() => libro.hojas(HOJAS_VISIBLES));
    log(`construir ${Math.round(construir)} ms · cargar ficha ${Math.round(cargar)} ms · leer ${Object.keys(valores).length} valores ${Math.round(leer)} ms`);
    expect(construir).toBeLessThan(15_000);   // objetivo 6 s; en la suite completa el equipo va cargado
    expect(cargar).toBeLessThan(5_000);
    expect(leer).toBeLessThan(2_000);
  }, 120_000);

  it('cada edición se recalcula en menos de 200 ms (p95; objetivo 100 ms), cambios típicos', () => {
    const libro = new Libro(plantilla);
    libro.cargar(ficha.entradas);
    const ediciones = [
      ['Principal!E11', 9], ['Principal!E12', 8], ['Principal!E15', 10], ['PDs!M25', 40], ['PDs!M26', 30], ['PDs!S7', 8],
      ['Místicos!G15', 40], ['Místicos!M18', 900], ['Combate!H12', 5], ['General!F22', 'Lock Prueba'], ['Principal!P11', 120],
      ['Psíquicos!M10', 3], ['General!AL11', 4], ['Principal!E11', 7], ['Principal!E11', 9],
    ] as [string, number | string][];
    const tiempos = ediciones.map(([k, v]) => medir(() => libro.poner(k, v))[1]);
    // y leer lo que cambió, como hace la interfaz tras cada edición
    const lectura = ediciones.map(() => medir(() => libro.hojas(HOJAS_VISIBLES))[1]);
    log(`edición: media ${Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)} ms, p95 ${Math.round(p(tiempos, 0.95))} ms, máx ${Math.round(Math.max(...tiempos))} ms · lectura completa p95 ${Math.round(p(lectura, 0.95))} ms`);
    expect(p(tiempos, 0.95)).toBeLessThan(200);   // objetivo 100 ms
  }, 120_000);
});
