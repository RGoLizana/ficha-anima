// Mapa de pantallas: qué celdas muestra cada sección (hechas y futuras) y sus valores en las fichas de referencia.
// Los valores salen de los PDF exportados por el Excel 8.7.0 (ref/pdf/*.pdf): prueba independiente del motor.
// Cuando se haga la interfaz de una sección, estas son las celdas que debe enseñar.
import { describe, expect, it } from 'vitest';
import { golden, motor, type NombreFicha } from './helpers';

const T = 300_000;
type Fila = [string, string, Partial<Record<NombreFicha, string | number>>];

const MAPA: Record<string, Fila[]> = {
  'Principal (paso 2)': [
    ['Principal!N11', 'Puntos de vida', { sesshomaru: 190, lock: 150, ayane: 130 }],
    ['Principal!K5', 'Categoría', { sesshomaru: 'Guerrero Acróbata', lock: 'Hechicero', ayane: 'Mentalista' }],
    ['Principal!O6', 'Nivel', { sesshomaru: '4 + 4', lock: '6', ayane: '4' }],
    ['Principal!K6', 'Tamaño', { sesshomaru: 16, lock: 14, ayane: 13 }],
    ['Principal!G11', 'AGI total', { sesshomaru: 11, lock: 9, ayane: 8 }],
    ['Principal!G13', 'DES total', { sesshomaru: 10, lock: 8, ayane: 10 }],
    ['Principal!G17', 'POD total', { sesshomaru: 6, lock: 12, ayane: 6 }],
    ['Principal!G18', 'VOL total', { sesshomaru: 8, lock: 6, ayane: 12 }],
    ['Principal!J57', 'Presencia', { sesshomaru: 45, lock: 55, ayane: 45 }],
    ['Principal!J58', 'RF', { sesshomaru: 55, lock: 70, ayane: 70 }],
    ['Principal!J61', 'RM', { sesshomaru: 25, lock: 95, ayane: 70 }],
    ['Principal!J62', 'RP', { sesshomaru: 55, lock: 70, ayane: 80 }],
    ['Principal!N16', 'Cansancio', { sesshomaru: 8, lock: 9, ayane: 8 }],
    ['Principal!J16', 'Movimiento', { sesshomaru: 12, lock: 9, ayane: 8 }],
    ['Principal!K17', 'Movimiento (texto)', { sesshomaru: '50 m / asalto', lock: '32 m / asalto', ayane: '28 m / asalto' }],
    ['Principal!J11', 'Regeneración', { sesshomaru: 2, lock: 3, ayane: 3 }],
    ['Principal!J32', 'Acciones por turno', { sesshomaru: 4, lock: 3, ayane: 3 }],
    ['Principal!D31', 'Turno total', { sesshomaru: 115, lock: 90, ayane: 85 }],
    ['Principal!H24', 'H. Ataque', { sesshomaru: 150, lock: 10, ayane: 15 }],
    ['Principal!H26', 'H. Defensa', { sesshomaru: 150, lock: 10, ayane: 15 }],
    ['Principal!Q22', 'Acrobacias', { sesshomaru: 95, lock: 55, ayane: 25 }],
    ['Principal!Q36', 'Advertir', { sesshomaru: 130, lock: 80, ayane: 75 }],
  ],
  'Desarrollo (paso 3)': [
    ['PDs!T17', 'PD totales', { sesshomaru: 900 }],
    ['PDs!J194', 'PD disponibles categoría 1', { sesshomaru: 900 }],
    ['PDs!K194', 'PD usados categoría 1', { sesshomaru: 900 }],
    ['PDs!M86', 'PD usados en combate', { sesshomaru: 470 }],
    ['PDs!AA25', 'H. Ataque (PDs)', { sesshomaru: 150 }],
    ['PDs!AA27', 'H. Esquiva (PDs)', { sesshomaru: 150 }],
    ['PDs!Z188', 'Puntos de vida (PDs)', { sesshomaru: 190 }],
  ],
  'Combate (paso 4)': [
    ['Combate!H29', 'Arma 1 · turno', { sesshomaru: 95 }],
    ['Combate!I29', 'Arma 1 · ataque', { sesshomaru: 150 }],
    ['Combate!J29', 'Arma 1 · defensa', { sesshomaru: 150 }],
    ['Combate!K29', 'Arma 1 · tipo de defensa', { sesshomaru: 'Esq' }],
    ['Combate!L29', 'Arma 1 · daño', { sesshomaru: 70 }],
    ['Combate!S29', 'Arma 2 · turno', { sesshomaru: 115 }],
    ['Combate!W29', 'Arma 2 · daño', { sesshomaru: 50 }],
    ['Combate!H21', 'Desarmado · turno', { sesshomaru: 115 }],
    ['Combate!I21', 'Desarmado · ataque', { sesshomaru: 90 }],
    ['Combate!I16', 'TA total FIL', { sesshomaru: 2, lock: 3, ayane: 1 }],
    ['Combate!K16', 'TA total PEN', { sesshomaru: 3, lock: 4, ayane: 1 }],
    ['Combate!M16', 'TA total ELE', { sesshomaru: 3, lock: 4, ayane: 2 }],
    ['Resumen!H19', 'Turno (resumen)', { sesshomaru: '115 Desarmado, 95 Katana, 115 Armas naturales' }],
    ['Resumen!H22', 'H. Ataque (resumen)', { sesshomaru: '90 Desarmado, 150 Katana, 150 Armas naturales' }],
    ['Resumen!H28', 'Daño (resumen)', { sesshomaru: '20 Desarmado (CON), 70 Katana (FIL), 50 Armas naturales (FIL / PEN)' }],
  ],
  'Ki (paso 5)': [
    ['Resumen!I35', 'Puntos de Ki', { sesshomaru: '(52)', lock: '(51)', ayane: '(52)' }],
    ['Resumen!I37', 'Acumulaciones', { sesshomaru: '(8)', lock: '(7)', ayane: '(8)' }],
    ['Resumen!H39', 'Habilidades del Ki', { sesshomaru: 'Uso del Ki, Extrusión de presencia, Uso de la energía necesaria, Inhumanidad' }],
    ['PDs!AA42', 'Conocimiento marcial total', { sesshomaru: 140 }],
  ],
  'Magia (paso 6)': [
    ['Resumen!J48', 'Proyección mágica (texto en el Excel)', { sesshomaru: '15', lock: '175', ayane: '15' }],
    ['Resumen!V48', 'Zeón', { sesshomaru: 85, lock: 1110, ayane: 85 }],
    ['Resumen!AD48', 'Regeneración zeónica', { lock: 60 }],
    ['Resumen!F50', 'ACT', { sesshomaru: 5, lock: 60, ayane: 5 }],
    ['Resumen!S50', 'Convocar', { lock: 20 }],
    ['Resumen!X50', 'Dominar', { lock: 5 }],
  ],
  'Psíquica (paso 7)': [
    ['Resumen!H60', 'CV libres', { lock: 2, ayane: 3 }],
    ['Resumen!J62', 'Potencial psíquico', { lock: 20, ayane: 100 }],
    ['Resumen!K64', 'Proyección psíquica', { lock: 10, ayane: 150 }],
  ],
  'Resumen / PDF (paso 9)': [
    ['Resumen!M3', 'Nombre', { sesshomaru: 'Sesshomaru', lock: 'Lock', ayane: 'Ayane Akame' }],
    ['Resumen!E12', 'PV', { sesshomaru: '   190', lock: '   150', ayane: '   130' }],
    ['Resumen!G93', 'Tamaño', { sesshomaru: '16, Medio', lock: '14, Medio', ayane: '13, Medio' }],
    ['Resumen!AG95', 'Acciones por turno', { sesshomaru: '  4', lock: '  3', ayane: '  3' }],
  ],
};

describe.each(Object.entries(MAPA))('%s', (_seccion, filas) => {
  it.each(['sesshomaru', 'lock', 'ayane'] as const)('%s: valores de la pantalla', (n) => {
    const l = motor();
    l.cargar(golden(n).entradas);
    const esperado = filas.filter(([, , v]) => v[n] !== undefined).map(([c, d, v]) => [c, d, v[n]]);
    const obtenido = esperado.map(([c, d]) => [c, d, l.valor(c as string)]);
    expect(obtenido).toEqual(esperado);
  }, T);
});
