# Plan: Ficha Anima Beyond Fantasy → Web

Origen: `Ficha Anima v8.7.0.xlsm` (23 hojas, ~33.000 fórmulas, 644 rangos con nombre).
- La lógica está en **fórmulas**, no en VBA. El VBA solo hace UI (autocompletar combos, modo presentación, exportar PDF) → no se porta, el navegador ya lo cubre.
- Hojas ocultas `Tablas`, `Tablas Técnicas`, `Tablas Magia`, `Tablas Sheele`, `Tablas psiquica`, `NamedRangesList` = datos del reglamento (categorías, costes, armas, conjuros...).
- Hojas visibles = formularios de la ficha (entrada + cálculos).

## Decisiones técnicas
| Tema | Decisión | Por qué / cuándo cambiar |
|---|---|---|
| Interfaz | **Preact + TypeScript**, build con **Vite** | Ligero; TS tipa la ficha y los cálculos |
| Estado | `@preact/signals` | Los derivados se recalculan solos al editar |
| Rutas | hash (`#/ficha/:id/combate`), sin librería | Funciona abriendo en local o en cualquier hosting estático |
| Estilos | CSS plano con variables, sin framework CSS | Pocas pantallas; añadir uno si crece |
| Guardado | `localStorage` + exportar/importar `.json` | Nube (Supabase) solo si se pide; el formato JSON no cambia |
| Formato ficha | JSON con `version` | Permite migrar fichas viejas al cambiar el esquema |
| Cálculos | **Motor de fórmulas** (HyperFormula, GPL-3) con las 35.000 fórmulas de la plantilla 8.7.0 | Idéntico a Excel sin reescribir reglas. Si se publica, el código debe ser abierto (GPL) |
| Plantilla | `public/plantilla.json` generado por `tools/export_formulas.py` | Se regenera si sale una nueva versión del Excel |
| Tests | **Vitest**: las 3 fichas de referencia deben dar los mismos valores que Excel | `tests/libro.test.ts` |
| PDF | vista A4 + `@page` + `window.print()` | Descarga directa con librería si se pide |
| Hosting | **solo local** (`npm run dev` / `npm run build`) | La build es estática: GitHub Pages/Netlify sin cambios |
| Diseño | **Rediseño libre** tipo app (no copia del Excel) | Ver abajo |

### Diseño (rediseño libre)
- Creación guiada para fichas nuevas: Raza/Categoría → Características → PDs → Combate/Ki/Magia/Psíquica → Equipo.
- Edición: ficha con secciones/pestañas por tema, valores derivados siempre visibles en una barra lateral (PV, turno, HA/HP/HE, TA, zeon, CV...).
- Secciones de Ki, Magia y Psíquica se ocultan si el personaje no las usa.
- Adaptado a móvil (una columna) y escritorio.
- El PDF sí mantiene una maqueta fija tipo hoja de personaje.

### Estructura
```
tools/export_formulas.py  plantilla 8.7.0 -> public/plantilla.json (fórmulas adaptadas al motor)
tools/extract.py          golden/<ficha>.json, ref/inputs.json (celdas de entrada), ref/nombres.json
src/engine/libro.ts       Libro: plantilla + entradas -> valores (HyperFormula)
src/engine/plugins.ts     funciones con semántica Excel (COUNTIF, SUMIF, SEARCH, FIND, RANK, MATCHAPPROX)
src/engine/worker.ts      el motor en un Web Worker (no congela la página)
src/engine/index.ts       señal `valores` de la ficha abierta; abrir / poner / rango
src/model/ficha.ts        Ficha v2: {entradas: {"Hoja!Celda": valor}} + migraciones
src/ui/                   componentes Preact (campos.tsx: Campo ligado a una celda, Dato calculado)
tests/                    Vitest
```

## Modelo
```
Ficha (JSON) = solo lo que escribe el jugador, por celda del Excel: {"Principal!E11": 10, "General!F23": "Humano"}
Motor = plantilla 8.7.0 + entradas -> todos los valores, igual que Excel
UI = Campo(clave) edita una entrada; Dato(clave) muestra un valor calculado
```
Nunca se guardan valores derivados (salvo `resumen`, una copia para pintar la lista) → no se desincronizan.

### Motor de fórmulas: cómo se consigue que sea idéntico a Excel
`tools/export_formulas.py` adapta las fórmulas y `src/engine/plugins.ts` añade o corrige funciones:
- `INDIRECT(celda)` → el rango fijo que contiene; `INDIRECT("Mejoras_"&…)` → elección explícita.
- `VLOOKUP/HLOOKUP/INDEX` con columna o fila fija → solo esa columna/fila (evita falsos ciclos del motor).
- Nombres que apuntan a rangos → el rango (el motor evalúa los nombres como fórmulas).
- `TRUE/FALSE` → `TRUE()/FALSE()`; comillas escapadas → `CHAR(34)`; textos con `'` delante (si no, "1." se vuelve número).
- `INDEX(fila, n)` → `INDEX(fila, 1, n)`; búsquedas aproximadas → `MATCHAPPROX` (la del motor falla con textos);
  aproximadas sobre textos desordenados → exactas (lo que Excel devuelve en la práctica).
- `COUNTIF/SUMIF` con criterios de Excel; `""+1` = #VALUE!; `=CeldaVacía` = 0; distingue acentos; sin fechas.
- Arranque: ~6 s en el navegador (construir el libro), empieza nada más abrir la web. Editar: ~20-50 ms.

## Pasos

### 0. Extracción de datos
- Script `tools/extract.py`: vuelca las hojas `Tablas*` y `NamedRangesList` a JSON.
- Inventario de celdas de entrada por hoja (celdas desbloqueadas = input; el VBA `SelectUnlockedCells` lo confirma) → define el esquema de `Ficha`.
- Volcar 2–3 fichas de ejemplo rellenas del Excel con sus valores calculados → **casos de prueba** (golden files).

#### Fichas de prueba disponibles
| Ficha | Categoría | Nivel | Versión Excel | Cubre |
|---|---|---|---|---|
| `aa-Sesshomaru/Sesshomaru 4.xlsm` | Guerrero Acróbata | 4 (+4) | 8.5.0 | Combate, Ki, técnicas |
| `a-Lock/Ficha_lock lvl 6.xlsm` | Hechicero | 6 | 8.4.3 | Magia, vías (+5 hojas propias) |
| `Pilars of reborn/Ayane akame lvl4.xlsm` | Mentalista | 4 | 8.6.1 | Psíquica |

Ninguna es v8.7.0: las referencias a `Tablas` se han desplazado entre versiones, así que sus valores
cacheados no sirven tal cual como referencia de la 8.7.0.
- **Migración**: `tools/migrate.py` copia las celdas de entrada (desbloqueadas) de cada ficha a una copia
  de la plantilla 8.7.0, y Excel (COM, instalado v16) recalcula y guarda → golden files 8.7.0.
- Celdas de entrada iguales entre versiones salvo: **PDs** y **Sheele** (8.4/8.5), **Personalización** (8.4.3).
  Esas se mapean por etiqueta de fila, no por coordenada.
- Comprobación: PV, turno, HA/HP/HE, zeon, CV de la ficha migrada ≈ ficha original; las diferencias se revisan
  a mano (cambios de reglas entre versiones o error de migración).
- Las hojas propias de Lock (`Grimorio de Vía <X>`, `Ventajas y desventajas`) se ignoran.

**Extracción hecha** (`python tools/extract.py`, requiere `pip install openpyxl pywin32`):
- `src/data/tablas.json` — 293 tablas (cabeceras + filas). Ya no se usa para calcular (lo hace el motor); queda de referencia.
- `ref/inputs.json` — celdas de entrada por hoja con etiqueta aproximada, valor por defecto y desplegable. Referencia para
  diseñar el tipo `Ficha` en cada paso (muchas son rejillas vacías: PDs 1134, Técnicas 1341, Personalización 751).
- `ref/nombres.json` — 322 rangos con nombre de una celda (`Categoría_1`, `ResumenNombre`...): nombres para el esquema.
- `golden/<ficha>.json` — `entradas` y `valores` calculados (`"Hoja!Celda": valor`) de las 3 fichas: base de los tests.

**Migración hecha** → `golden/{sesshomaru,lock,ayane}.xlsm` (`tools/migrate.py`, verificado con `tools/compare.py`).
Diferencias restantes = maquetación de Resumen, textos de etiquetas y cambios de reglas 8.x→8.7.0
(p.ej. Presencia de arma). Lock: `Yamato-shu` (idioma propio) y `Sin Armadura` (técnica) no están en los desplegables 8.7.0.

### 1. Esqueleto ✅
- Proyecto Vite + Preact + TS, lista de fichas (crear / duplicar / borrar / importar / exportar JSON), navegación por secciones, estilos base y diseño móvil.
- `npm run dev` · `npm test` · `npm run build` (sale en `dist/`). Estado en `src/store.ts`, modelo en `src/model/ficha.ts`.
- "Nueva ficha" crea una ficha vacía; el asistente de creación llega con el paso 2 (necesita categorías y características).

### 2. Principal + General ✅
- Motor de fórmulas integrado: las 3 fichas de referencia dan **todos** los valores igual que Excel (14.073 celdas).
- Principal: nombre, raza, nephilim, tipo de criatura, gnosis, categoría + cambios de categoría y niveles,
  características (base/temp → total/bono), resistencias (especial editable), habilidades secundarias (solo lectura).
- Trasfondo (hoja General): descripción, textos de historia y personalidad, dinero, títulos, contactos.
- Barra lateral: PV, turno, ataque, defensa, presencia, cansancio, movimiento, regeneración, acciones, resistencias.
- Fichas de ejemplo importables: `ref/fichas/{sesshomaru,lock,ayane}.json`.
- Pendiente para pasos siguientes: lenguas, poderes de criatura y habilidades esenciales (Principal), asistente de creación.

### 3. PDs (Puntos de Desarrollo) ✅
- Desarrollo: resumen por categoría (PD usados/disponibles y límites de combate, magia y psíquica con barras),
  límite de primarias; tablas de habilidades de combate, Ki y CM, místicas, psíquicas, PV y secundarias
  (una columna de PD por categoría con el coste a la vista, especial, total; bonos naturales/novel opcionales);
  compras con desplegable (tablas de armas + arma, estilos, artes marciales, AM con armas, Ars Magnus, tablas místicas
  y psíquicas, patrones mentales); ajustes de nivel.
- Ventajas y poderes: ventajas comunes, del Don/psíquicas, de trasfondo, legados de sangre, desventajas, bonos a
  características con PC, habilidades esenciales (+opción) y poderes de criatura (+opción, agrupables por nombre).
- Lenguas en Trasfondo.
- Desplegables: los del propio Excel (`src/data/listas.json`, 2.144 celdas, incluidas las validaciones x14 que openpyxl
  descarta). `INDIRECT(celda)` se resuelve leyendo el nombre de lista de esa celda; se recargan al enfocar.
- Pendiente: habilidades secundarias personalizadas (filas 180-184), costes de cambio de categoría (Z7/AA7), notas de PD.

### 4. Combate ✅
- 10 ranuras de arma (1-6 cuerpo a cuerpo, 7-10 proyectiles con munición y calidad de munición): manos, arma, tamaño,
  calidad → turno, ataque, defensa (parada/esquiva), daño, críticos, entereza, rotura, presencia, rango/recarga.
  Siempre queda una ranura libre; los separadores de la lista ("-- CONOCIDAS --", "> …") no se pueden elegir.
- Desarmado (equipo + calidad), armadura (3 piezas + yelmo con calidad y Enc., TA total por tipo, restricción de
  movimiento y penalizadores), combate con armas adicionales (mano hábil/torpe), modificadores a toda acción y a
  acciones físicas, calculadora de daño (Daño × % → final), capacidades compradas en Desarrollo (solo lectura),
  notas de combate (celdas C67/AB67, las que usa la página de notas del PDF).
- Pendiente: estilos de combate editables desde aquí (hoy se compran en Desarrollo) y probar con armas en Lock/Ayane.

### 5. Ki + Creación de Técnicas ✅
- **Ki** (hoja Ki): puntos de Ki por característica (acumulación, mitad, Ki, actual) con Unificación; CM usados/total con
  barra y límites; habilidades del Ki como árbol con casillas de compra (el coste sale de la lista del Excel: casilla si
  hay una opción, desplegable si hay varias, p.ej. Ataque elemental); detección/ocultación especiales; Némesis, Vacío y
  Anulación; sellos Dragón; sellos de invocación (menor/mayor por elemento); ataque elemental (aparece al comprarlo);
  pactos de sangre; 6 bloques = 12 técnicas de dominio con nivel, CM y descripción; notas de Ki (C67, van al PDF).
- **Técnicas de Ki** (Creación de Técnicas): 10 técnicas desplegables (bloques de 34 filas, el 6.º de 35): nombre, nivel,
  combinable, hasta 5 efectos (tipo, efecto, mantenido/sostenido, CM/Ki/Ki mant. y Ki por característica al activar y
  mantener), desventajas con elementos y reducciones, opciones de cada efecto con su nivel, descripción y árbol de técnicas.
  Los avisos de cada técnica (D43, D77…) se muestran como avisos.
- Nuevo `tests/cobertura.test.tsx`: rellena TODAS las casillas de una hoja y comprueba que cada celda de entrada del Excel
  tiene su casilla en la web. Cubre Principal, PDs, Combate, Ki y Técnicas al 100 %; General con huecos documentados
  (retrato y equipo/artefactos/contactos, paso 8). Destapó y cerró huecos de los pasos 2-4 (PV y cansancio actuales,
  tipo de movimiento, arma desarrollada, habilidades secundarias propias, especialidades, notas de PD/Principal/poderes…).

### 6. Místicos + Metamagia + Grimorio Magia + Grimorio de Vía ✅
- **Magia** (Místicos): nivel de magia (máximo/usado/metamagia) con barra y acumulación, regeneración zeónica, ACT, turno,
  ataque y defensa; teorema empleado, desequilibrio, especialidad de proyección; vías con subvía y nivel usado; zeón
  (total, actual, contenedor, amplificador); convocatoria (convocar, dominar, atar, desconvocar + especialidad); conjuros
  seleccionados (vía → conjuro con su nivel), de libre acceso (vía asociada, conjuro, nivel), activos/criaturas
  atadas/invocaciones con coste zeónico al día, ofudas preparados, habilidades metamágicas conseguidas y notas (van al PDF).
- **Metamagia:** el árbol como tarjetas por habilidad con casillas de grado y coste (el nombre está 3 filas por encima y 1
  columna a la izquierda de cada casilla en la hoja) y nivel de magia usado en metamagia.
- **Grimorios de magia:** 20 conjuros elegibles con nivel, tipo, acción, grados (Int. R., zeón, mantenimiento, efecto) y
  descripción; **de vía:** vía/subvía/colores y todos los conjuros por niveles 2-100 de la vía elegida.
- Avisos: Místicos!C29 ("Exceso de Nivel de Magia", "Vía cerrada a Shamanica"…) y los de PD de magia.
- Pendiente: teoremas de magia (tabla de referencia) y el PDF de los grimorios (paso 9).

### 7. Psíquicos + Grimorio Psíquica ✅
- `Psiquica.tsx`: CVs totales/usados, potencial, turno y proyección, reparto de CVs, disciplinas afines, patrones mentales,
  poderes (lista según disciplinas, CVs gastados), poderes innatos y potenciación, notas. Filas "ocupadas + una libre".
- `GrimorioPsiquica.tsx`: 4 disciplinas (S6, AT6, BU6, CV6) con sus poderes (5 bandas × 3) y dificultades.
- Aviso `Psíquicos!C22` ("Exceso de CVs", "Exceso de innatos activos"): solo avisa, no bloquea.
- Cobertura 100% de casillas de `Psíquicos` y `Grimorio Psíquica`; 4 tests de UI.

### 8. Sheele, Elan, Equipo, Personalización ✅
- `Sheele.tsx`, `Elan.tsx`, `Equipo.tsx` (peso, equipo, artefactos, contactos, dinero, fama, salud mental, experiencia) y
  `Personalizacion.tsx` (22 paneles marcados "Personalizado"; 751 casillas, 29 sin uso en el Excel quedan en HUECOS).
- Tests: `tests/paso8.test.tsx`, `tests/personalizacion.test.tsx` y cobertura de las hojas Sheele, Elan, Personalización y General.
- Equipo/inventario, Elan y dones.
- **Personalización va aparte** (grupo "Fuera de las reglas" en el menú): contenido extra que no está en las reglas de
  Anima (ventajas, poderes, armas, armaduras... propias). Lo que se añada ahí debe verse marcado como personalizado.

### 9. Resumen + PDF (en curso)
- Hecho: `src/pdf/Pagina.tsx` (port de `render()`), `src/pdf/notas.ts` (FillPDFNotes), vista `#/imprimir/<id>` con botón PDF
  (imprime con el navegador, A4, opciones de notas) y `tests/pdf.test.tsx`; `tools/pdf_check.py` mide 1 palabra >1,5 pt (1,6 pt).
- Pendiente: retrato (General!M5), páginas de Sheele y Equipo, PDF de grimorios (faltan PDF de referencia del Excel).
Igual que la macro `ExportPDF` del Excel:
- **PDF de ficha**: página Resumen (con imagen del personaje) + páginas opcionales según casillas
  *Mostrar Sheele*, *Mostrar Equipo*, *Mostrar Notas* (= `MostrarSheele`, `MostrarEquipo`, `MostrarNotasPag`).
- **PDF de grimorio** (= `ExportPDFGrimorio`): botón en Grimorio Magia / de Vía / Psíquica que saca solo esa hoja.
- Nombre de fichero: `<Nombre personaje>.pdf` y `<Nombre> - <Grimorio>.pdf`.
- **Idéntico al del Excel**: `tools/pdf_layout.py` genera `src/data/pdf-layout.json` (fondo copiado del PDF que
  exporta la macro + cada celda de Resumen calibrada contra él; fuente = pt·0,94 redondeado a 0,12; interlineado 1,28;
  letter-spacing 0,0025em). La web pinta esa plantilla con los valores calculados.
  `tools/pdf_check.py` imprime la versión web con Edge y la compara palabra a palabra con `ref/pdf/*.pdf`
  (hoy: 1 palabra por ficha desviada >1,5 pt, máx 1,6 pt). Pendiente: Sheele, Equipo y grimorios (falta PDF de referencia).
- Implementación: vista `/imprimir/:id?paginas=...` en A4 con CSS `@page` + `@media print`,
  y `window.print()` → "Guardar como PDF". Sin librerías; el texto queda seleccionable.
- Si hace falta descargar el `.pdf` directamente sin diálogo de impresión: añadir `html2pdf`/`pdf-lib` entonces.

### 10. (Opcional, solo si se pide) Nube
- Login + sync de fichas (p.ej. Supabase). Hasta entonces JSON local basta.

Pasos 3-8: el cálculo ya lo hace el motor; son solo interfaz (qué celdas editar y mostrar en cada sección).

**Filosofía: los límites avisan, nunca bloquean.** Se puede escribir cualquier valor; si algo se pasa de las reglas
se muestra un aviso. Se usan los avisos que ya calcula el Excel (componente `Avisos` de `src/ui/campos.tsx`):
- Hechos: Principal C19, N14 · PDs T194, V86, V104, V120, Z29+AA29 · Principal V70 · lenguas (propio: adicionales > E67).
- Pendientes con su sección: Ki C31 · Creación de Técnicas D43, D77, D111, D145, D179, D214, D248, D282, D316, D350 ·
  Místicos C29 · Psíquicos C22 · Elan C26, U26 · Personalización I16, I51.

## Verificación
`npm run test:all` (≈1 min): un paso no se cierra si algo falla.

| Archivo | Qué comprueba |
|---|---|
| `tests/libro.test.ts` | Las 3 fichas de referencia coinciden al 100 % con Excel (14.073 celdas) |
| `tests/motor.edicion.test.ts` | Cambiar de ficha sin arrastrar datos, vaciar/restaurar cada entrada, textos tipo "1.", sin #CICLO!/#NAME?, 5 categorías, rendimiento |
| `tests/motor.listas.test.ts` | Los 2.144 desplegables se resuelven; cada valor elegido está en su lista (excepciones conocidas documentadas) |
| `tests/excel.semantica.test.ts` | COUNTIF/SUMIF, MATCHAPPROX, SEARCH/FIND, RANK, ""+1, celdas vacías, acentos, fechas, INDIRECT en listas |
| `tests/avisos.test.ts` | Cada aviso del Excel (también Ki, Magia, Psíquica, Elan) aparece al pasarse y desaparece al deshacer |
| `tests/secciones.test.ts` | Mapa de pantallas: celdas que enseña cada sección (hechas y futuras) con valores de los PDF del Excel |
| `tests/datos.test.ts` | Integridad de plantilla.json, listas.json, golden, ref/fichas y pdf-layout.json |
| `tests/store.test.ts` | Crear/editar/duplicar/borrar, importar (v1, duplicados, basura), exportar, guardado y errores de espacio |
| `tests/ui.test.tsx` | Interfaz con el motor real: barra lateral, ediciones, tabulador, lenguas, PD, artes marciales, avisos, y que **toda casilla escribe en una celda de entrada real** |
| `tests/cobertura.test.tsx` | Toda celda de entrada del Excel de cada hoja ya implementada tiene su casilla en la web (huecos documentados en el propio archivo) |
| `tests/futuro.test.ts` | `it.todo` con la especificación de los pasos 4-10: convertirlos en pruebas al implementar cada paso |
| `tools/test_herramientas.py` | Reescrituras del exportador, listas relativas, migración, tamaños y calibrado del PDF |

Fallos reales encontrados por estas pruebas (corregidos): `poner` con celda inválida dejaba el motor roto ·
`COUNTIF(rango,"")` no contaba vacías · `"<>5"` contaba el texto "5" · VLOOKUP aproximada con columna variable
(5ª categoría) · listas con INDIRECT dentro de nombres, anidado o con rango dinámico · casilla "Especial" de PV
escribía sobre una fórmula (PDs!Z188).
