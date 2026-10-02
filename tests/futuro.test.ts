// Pruebas pendientes de los pasos 4-10: especificación de lo que hay que comprobar al hacer cada sección.
// Los valores del motor que esas pantallas deben enseñar YA se comprueban en secciones.test.ts y avisos.test.ts;
// aquí queda lo de interfaz. Al implementar un paso: convertir sus it.todo en pruebas (modelo: ui.test.tsx) y
// añadir la sección a la lista de "todas las casillas escriben en celdas de entrada reales" de ui.test.tsx.
import { describe, it } from 'vitest';

describe('Paso 4 · Combate (hecho: ver ui.test.tsx > Combate)', () => {
  it.todo('estilos de combate y tablas (Combate fila 18+): hoy solo se ven las compradas en Desarrollo, en solo lectura');
  it.todo('combinar armas (R22:W25) con un caso real de dos armas y comprobar el nombre combinado de la ranura (D27)');
  it.todo('Lock/Ayane con armas elegidas: valores de la ranura contra el Excel (hoy solo Sesshomaru tiene armas)');
});

describe('Paso 5 · Ki y técnicas (hecho: ver ui.test.tsx > Ki / Técnicas de Ki y cobertura.test.tsx)', () => {
  it.todo('Lock: la técnica con Sin Armadura (valor que la 8.7.0 no tiene en la lista) se conserva y se muestra (Creación de Técnicas!V234)');
  it.todo('técnicas 2-10 con efectos rellenos: coste de CM y Ki frente al Excel (hoy solo la 1.ª de Lock tiene datos)');
  it.todo('Técnicas para resumen (Ki!AM24) y habilidades del Ki en el Resumen (H39) tras cambiar compras');
});

describe('Paso 6 · Magia (hecho: ver ui.test.tsx > Magia / Metamagia / Grimorios y cobertura.test.tsx)', () => {
  it.todo('Vía cerrada a Shamanica (Místicos!C29) con Teorema Shamanica + Nigromancia: aviso del Excel');
  it.todo('Exceso de Nivel de Magia inicial / de Vía inicial (Tablas!X21 activo con Personalización!F6)');
  it.todo('Grimorio de Vía de Lock con sus vías propias (Fuego, Creación, Esencia, Oscuridad-Umbra) frente al PDF de referencia');
  it.todo('exportar PDF de grimorio (A4 apaisado, dos páginas de conjuros por hoja): paso 9');
  it.todo('Teoremas de magia (Místicos!AS5..BI24): tabla de referencia de Ofudas/teoremas; hoy no se muestra');
});

describe('Paso 8 · Sheele, Elan, Equipo, Personalización', () => {
  it.todo('avisos Personalización!I16 (habilidades de ventajas) e I51 (bonos de transformación)');
  it.todo('Ayane: crítico de arma personalizada "FIL" sin arma elegida se conserva (excepción conocida)');
});

describe('Paso 9 · Resumen y PDF', () => {
  it.todo('páginas opcionales Sheele / Equipo según Resumen!AU15/AU17; grimorios en A4 apaisado');
  it.todo('nombre de fichero <Nombre>.pdf y <Nombre> - <Grimorio>.pdf');
  it.todo('comparación con el PDF del Excel: python tools/pdf_check.py → ≤1 palabra por ficha desviada >1,5 pt');
  it.todo('botón PDF de la cabecera activado (ahora deshabilitado)');
});

describe('Paso 2 pendiente · asistente de nueva ficha', () => {
  it.todo('Nueva ficha abre un asistente: origen (nombre, raza, categoría, nivel) → características → PD → poderes → equipo');
  it.todo('el asistente escribe en las mismas celdas que las secciones (General!F22/F23, PDs!O7/S7, Principal!E11:E18…)');
  it.todo('se puede saltar pasos y terminar en cualquier momento (nunca bloquea)');
});

describe('Paso 10 · (opcional) nube', () => {
  it.todo('login y sincronización; el formato JSON de la ficha no cambia (version 2)');
});

describe('General', () => {
  it.todo('importar fichas .xlsm directamente (migrate.py en el navegador o conversión previa)');
  it.todo('rendimiento: el motor arranca en < 6 s en el navegador (medido con [motor] en consola) y edita en < 100 ms');
  it.todo('accesibilidad: todas las casillas con etiqueta; navegación con teclado por secciones');
});
