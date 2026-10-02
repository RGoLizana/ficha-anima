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

describe('Paso 6 · Magia (Místicos, Metamagia, Grimorios)', () => {
  it.todo('Lock: zeón 1110, ACT 60, proyección 175, reg. zeónica 60, convocar 20, dominar 5 (Resumen!V48, F50, J48, AD48, S50, X50)');
  it.todo('vías (Místicos!C15:G25): vía, subvía y nivel usado; nivel de magia total vs usado (C12/E12)');
  it.todo('conjuros de libre acceso y seleccionados (Místicos W12:AK27) con nivel según vía (lista NivelesLA_*)');
  it.todo('aviso Místicos!C29 "Exceso de Nivel de Magia" (Lock con G15=500)');
  it.todo('Metamagia: árbol de esferas con coste; total en Resumen');
  it.todo('Grimorio Magia / Grimorio de Vía: listado de conjuros con grados Base/Intermedio/Avanzado/Arcano como el PDF de Lock');
  it.todo('Grimorio de Vía: selector de vía (Grimorio de Vía!J6) y "Nivel de vía aprendido"');
});

describe('Paso 7 · Psíquica', () => {
  it.todo('Ayane: CV libres 3, potencial 100, proyección 150, innatos 2, patrón "Psicopatía" (Resumen!H60, J62, K64, O60)');
  it.todo('disciplinas afines (Psíquicos C25+) y poderes (V11:V27 lista Poderes_Psi_Disponibles según disciplinas)');
  it.todo('potenciar poderes con CV (columnas AA/AD) y ver el efecto por dificultad');
  it.todo('innatos (AD17+ lista Pod_Psi_Innatos_Disponibles)');
  it.todo('avisos Psíquicos!C22: "Exceso de CVs" (M10=50) y "Exceso de innatos activos" (M13=-1)');
  it.todo('Grimorio Psíquica: listado de poderes con efectos');
});

describe('Paso 8 · Sheele, Elan, Equipo, Personalización', () => {
  it.todo('Sheele: tipo (Sheele!M5), vinculada (O5), características y mejoras (lista Mejoras_<tipo>)');
  it.todo('Elan: entidades (Elan!C11, C13:C25) con dones y coste; G11 disponible; aviso Elan!C26 "Exceso de Elán utilizado"');
  it.todo('Equipo (hoja General X12:AL30): objetos, localización y peso; equipo de combate');
  it.todo('Personalización aparte ("Fuera de las reglas"): ventajas, poderes, armas (AA93+, críticos AD102/AD103), armaduras propias');
  it.todo('lo personalizado aparece marcado como personalizado allí donde se use (p.ej. arma en Combate)');
  it.todo('avisos Personalización!I16 (habilidades de ventajas) e I51 (bonos de transformación)');
  it.todo('Ayane: crítico de arma personalizada "FIL" sin arma elegida se conserva (excepción conocida)');
});

describe('Paso 9 · Resumen y PDF', () => {
  it.todo('vista de impresión que pinta src/data/pdf-layout.json con los valores de Resumen (portar render() de tools/pdf_layout.py)');
  it.todo('página 1: fondo de 537 rectángulos, logo de Anima del Excel, retrato del personaje');
  it.todo('página 2 (Notas): "Lenguas: …" en negrita 12 pt + notas por sección como FillPDFNotes (MostrarIdiomas, MostrarNotas)');
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
