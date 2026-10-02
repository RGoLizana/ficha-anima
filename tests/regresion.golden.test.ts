// Fallos encontrados verificando con fichas reales (golden/): se quedan como pruebas de regresión.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { leerFicha } from '../src/import/xlsm';
import { listas, motor, read } from './helpers';

describe('ROW(IF(...)) del Excel (Tablas!AC777 → Personalización!AN3)', () => {
  it('da el rango de armas igual que Excel (antes #N/A y los desplegables de armas salían vacíos)', () => {
    const l = motor();
    l.cargar(read('ref/fichas/lock.json').entradas);
    expect(l.valor('Personalización!AN3')).toBe('Tablas!$AG$639:$AG$639');
    expect(l.valor('Tablas!AC777')).toBe('Tablas!$AG$639:$AG$639');
  }, 120_000);

  it('el desplegable de armas "A 1 mano" de Personalización tiene opciones', () => {
    const l = motor();
    l.cargar({ ...read('ref/fichas/lock.json').entradas, 'Personalización!AA93': 'A 1 mano' });
    const formula = listas()['Personalización!AC93'];
    expect(formula).toBeTruthy();
    expect(l.lista(formula, 'Personalización').length).toBeGreaterThan(0);   // antes: []
  }, 120_000);
});

// Estas dos usan fichas reales de golden/ que no se suben al repositorio: sin ellas se omiten (en CI)
const ficha = (n: string) => join(import.meta.dirname, '..', 'golden', n);
const JULIA = 'Ficha_Anima_Julia Vicens level 1.xlsm', AGLAEA = 'Ficha_Anima_Memento_Aglaea, level 5.xlsm';

describe.skipIf(!existsSync(ficha(JULIA)))('migración 8.4.2 → 8.7.0 (Julia Vicens)', () => {
  it('el legado de sangre propio del bloque derecho de Personalización no se pierde', () => {
    const r = leerFicha(new Uint8Array(readFileSync(ficha(JULIA))));
    expect(r.entradas['Personalización!V80']).toBe('Ojos del Pecado');
    expect(r.entradas['Personalización!AB80']).toBe(1);
    expect(r.avisos.join(' ')).not.toContain('Personalización!V78');
    const l = motor();
    l.cargar(r.entradas);
    expect(l.valor('Principal!J34')).toBe(0);     // puntos de creación: Excel guardó 0 (con el legado perdido salía 1)
  }, 120_000);
});

describe.skipIf(!existsSync(ficha(AGLAEA)))('ficha de gremio con filas añadidas (Aglaea)', () => {
  it('avisa de que General y Personalización no tienen la disposición de la 8.7.0 base', () => {
    const r = leerFicha(new Uint8Array(readFileSync(ficha(AGLAEA))));
    expect(r.avisos.join(' ')).toMatch(/La disposición de General, Personalización no es la de la 8\.7\.0 base/);
  });
});
