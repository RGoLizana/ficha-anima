// Avisos que calcula el propio Excel ("Exceso de…"): la web los muestra y nunca bloquea (ver PLAN.md, filosofía).
// Cada caso: ficha, celda de aviso, cambios que lo provocan y texto esperado. Incluye secciones aún sin interfaz.
import { describe, expect, it } from 'vitest';
import type { Entrada } from '../src/engine/libro';
import { golden, motor, type NombreFicha } from './helpers';

const T = 300_000;

type Caso = [NombreFicha, string, Record<string, Entrada>, string];
const CASOS: Caso[] = [
  // Principal
  ['sesshomaru', 'Principal!C19', { 'Principal!E11': 12 }, 'Exceso de AGI inicial'],
  // Desarrollo (PD)
  ['sesshomaru', 'PDs!T194', { 'PDs!M25': 400 }, 'Exceso de PDs gastados'],
  ['sesshomaru', 'PDs!V86', { 'PDs!M42': 100 }, 'Exceso de PDs en Conocimiento Marcial'],
  ['lock', 'PDs!V104', { 'PDs!M96': 400 }, 'Exceso en Proyección Mágica'],
  ['ayane', 'PDs!V120', { 'PDs!M112': 300 }, 'Exceso en Proyección Psíquica'],
  ['sesshomaru', 'PDs!Z29', { 'PDs!M25': 400 }, 'Ataque + Defensa no debe superar:'],
  // Ki (paso 5)
  ['sesshomaru', 'Ki!C31', { 'Ki!Y11': 1, 'Ki!Y13': 1, 'Ki!Y15': 1 }, 'Exceso de CM'],
  // Magia (paso 6)
  ['lock', 'Místicos!C29', { 'Místicos!G15': 500 }, 'Exceso de Nivel de Magia'],
  // Psíquica (paso 7)
  ['ayane', 'Psíquicos!C22', { 'Psíquicos!M10': 50 }, 'Exceso de CVs'],
  ['ayane', 'Psíquicos!C22', { 'Psíquicos!M13': -1 }, 'Exceso de innatos activos'],
  // Elan (paso 8)
  ['sesshomaru', 'Elan!C26', { 'Elan!G11': -1 }, 'Exceso de Elán utilizado'],
];

describe('avisos del Excel', () => {
  it.each(CASOS)('%s · %s aparece al pasarse y desaparece al deshacer', (n, celda, cambios, texto) => {
    const l = motor();
    const g = golden(n);
    l.cargar(g.entradas);
    expect(l.valor(celda) ?? '').toBe('');                     // la ficha de referencia no tiene excesos
    for (const [k, v] of Object.entries(cambios)) l.poner(k, v); // nada impide escribir el valor
    expect(String(l.valor(celda))).toBe(texto);
    for (const k of Object.keys(cambios)) l.poner(k, g.entradas[k] ?? null);
    expect(l.valor(celda) ?? '').toBe('');
  }, T);

  it('el límite de Ataque + Defensa trae la cifra en la celda de al lado (Z29 + AA29)', () => {
    const l = motor();
    l.cargar(golden('sesshomaru').entradas);
    l.poner('PDs!M25', 400);
    expect(l.valor('PDs!AA29')).toBe(450);
  }, T);

  it('notas informativas (no avisos): "Endeble con: 43 PVs" de Ayane y la ayuda de poderes', () => {
    const l = motor();
    l.cargar(golden('ayane').entradas);
    expect(String(l.valor('Principal!N14')).trim()).toBe('Endeble con: 43 PVs');
    expect(String(l.valor('Principal!V70'))).toMatch(/^Agrupa poderes/);
  }, T);

  it('ninguna ficha de referencia tiene avisos activos', () => {
    const l = motor();
    const celdas = [...new Set(CASOS.map((c) => c[1]))];
    for (const n of ['sesshomaru', 'lock', 'ayane'] as const) {
      l.cargar(golden(n).entradas);
      expect(celdas.filter((c) => /exceso|faltan|insuficiente|excedido/i.test(String(l.valor(c) ?? ''))), n).toEqual([]);
    }
  }, T);
});
