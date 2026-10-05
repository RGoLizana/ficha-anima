# Plan: categorías propias y modificadas en el modo gremio

Verificado sobre `public/plantilla.json` (scripts de apoyo en este scratchpad: `refs2.py`, `pds.py`, `lit.py`, `lit2.py`, `bs.py`).

## 1. Qué es una categoría en el Excel

### 1.1 La tabla
- `Tablas!C198` = «Tabla general de Categorías». Fila 200 = número de columna (1..83), **fila 201 = cabeceras**
  (nombre `Name_Tabla_Cat` = `Tablas!$D$201:$CI$201`). Algunas cabeceras son fórmulas: `M201 =PDs!E25`, `R201 ="Coste"&PDs!$E$25`…
  (así enlazan con la etiqueta de cada habilidad en PDs).
- **22 filas fijas, `Tablas!D202:CI223`** (`Tabla_Categorías`; `Categorías` = `Tablas!$D$202:$D$223`): Guerrero, Guerrero Acróbata,
  Paladín, Paladín (F), Paladín Oscuro, Paladín Oscuro (RD), Maestro en Armas, Tecnicista, Tao, Explorador, Sombra, Ladrón, Asesino,
  Hechicero, Warlock, Ilusionista, Hechicero Mentalista, Conjurador, Guerrero Conjurador, Mentalista, Guerrero Mentalista, Novel.
- **Justo debajo** están `D224:CE224` («Bono Total», copia de cabeceras) y `E225:CE225` (`=SUMPRODUCT($C$202:$C$223,E$202:E$223)`,
  con `MIN(50,…)` en M,N,O) = nombre `Bonos_Cat_Base`. **No hay filas libres**: añadir filas obliga a mover 224/225 y reescribir rangos.

Columnas de cada fila (constantes salvo C, CH y CJ):
| Columnas | Qué | Ejemplo Guerrero (fila 202) |
|---|---|---|
| C | `=SUMIF(PDs!$AD$6:$AD$10,Tablas!D202,PDs!$AE$6:$AE$10)` = niveles del personaje en esa categoría (fórmula, por NOMBRE) | — |
| D | Nombre | Guerrero |
| E, F | Turno y PV por nivel | 5, 15 |
| G | CosteMultiploPV (coste de PV) | 15 |
| H | Conocimiento Marcial por nivel | 25 |
| I, J, K | Límite Combate / Magia / Psi (fracción: 0,6 / 0,5 …) | 0,6 0,5 0,5 |
| L | Nv/CV (niveles por CV) | 3 |
| M..Q | Bono por nivel: H. Ataque, H. Parada, H. Esquiva, Llevar Armadura, Zeón | 5,5,–,5,– |
| R..BA | **Costes en PD**: H. Ataque…Llevar armadura (R-U), Ki, AcumKi, Zeón, ACT, Proyección mágica, Convocar, Controlar, Atar, Desconvocar, CV, Proyección psíquica, 7 grupos de secundarias y cada secundaria | 2,2,2,2,2,20,3,70… |
| BB..CE | Bono por nivel a secundarias (P. Fuerza…Atar) y Detección/Ocultación de Ki (CD, CE) | |
| CF, CG | Arquetipo 1 y 2 (Luchador, Místico, Psíquico, Acechador, Domine, Sin) | Luchador, Sin |
| CH | `=CF202&CG202` (fórmula) | |
| CJ | `=LEN(D202)` (fórmula, sin uso) | |
Unas 30-36 constantes no vacías por fila; editables por categoría: **81 celdas (E..CG) + nombre (D)**.

### 1.2 Quién la usa (todo por NOMBRE, nunca por fila)
- Elección: `PDs!O7, O9, O11, O13, O15` (nombres `Categoría_1..5`), niveles `PDs!S7..S15`; desplegable de las 5 = `'Tablas'!$D$202:$D$223` (`src/data/listas.json`).
- **524 fórmulas de PDs** + `Principal!D26` + `Ki!F35, F36` + `Tablas!X14` + las 22 `Tablas!C202:C223` + las 79 de `Tablas!E225:CE225`:
  costes `PDs!L25..T122` (`VLOOKUP(L$22,'Tablas'!$D$202:$CI$223,MATCH("Coste"&$E25,…))`), límites `L88/L106/L122` (cols I,J,K),
  coste de PV `J188..T188` (col G), bonos innatos `X25..X42, V129..V184` (fila 225), bono por nivel de secundarias de cada categoría
  `AE/AL/AN/AP/AR/AT129:179`, coste de cambio de categoría `Y7..Y13` (arquetipos CF/CG/CH), totales y avisos (`PDs!T194`, `Z29/AA29`, `V86`, `V104`, `V120`).
- **Reglas fijadas por nombre que una categoría propia NO puede tener** (literales en fórmulas):
  - `"Novel"`: `PDs!AF6:AF10` (bono Novel +5 PD/nivel) y `PDs!Y7..Y13` (cambio desde/hacia Novel cuesta 20).
  - `"Maestro en Armas"`: `PDs!L43…` (½ coste de tablas de armas, 120 celdas).
  - `"Maestro en Armas"` o `"Tao"`: `PDs!L78…` (½ coste de artes marciales, 325 celdas).
- **Bug del Excel que se replica**: la 5.ª categoría en `PDs!AE129:AE179` usa `INDEX(...MATCHAPPROX(O15,'Tablas'!$D$198:$D$223,1))`
  (búsqueda aproximada binaria sobre nombres desordenados → fila equivocada en casi todas). Manda el Excel; afecta igual a propias.

### 1.3 Qué se puede tocar
- **Modificar una oficial**: sí, sobrescribiendo sus constantes E..CG (las fórmulas C/CH/CJ siguen valiendo). No cambiar el nombre (D)
  porque las reglas de 1.2 y las fichas guardadas dependen de él.
- **Añadir**: no hay filas libres en 202..223 y todas las referencias son rangos fijos de 22 filas. Dos caminos: (A) ampliar la tabla
  reescribiendo ~1.900 referencias, o (B) reutilizar, solo para esa ficha, una fila oficial que la ficha no usa (máx. 5 propias por ficha,
  quedan ≥17 filas libres).
- **Quitar una oficial**: nunca borrar la fila (rompería fichas). «Quitar» = ocultarla en los desplegables de la web; las fichas que ya la
  usan siguen calculando y se avisa.

## 2. Diseño

### Alternativas
| | A. Tabla ampliada (hoja interna con 22+5 filas) | **B. Reutilizar filas oficiales libres (recomendada)** | C. Solo «modificar oficial» |
|---|---|---|---|
| Cómo | `conGremio` copia D202:CI223 a una hoja `GremioCat` con 5 filas extra y reescribe ~1.900 referencias (`$D$202:$CI$223`, columnas sueltas, `$D$198:…`, fila 225, `X14`, nombres) | Por ficha, cada categoría propia elegida se escribe (como entradas del motor, igual que `Gremio!B1..B8`) en una fila de `Tablas!D202:CG223` que la ficha no usa; las oficiales modificadas sobrescriben su fila | Igual que B pero sin nombres nuevos |
| Fórmulas tocadas | ~1.900 (riesgo de regresión, hay que repasar golden) | **0** | 0 |
| Con biblioteca vacía | depende de que la reescritura sea exacta | **idéntico por construcción** (no se escribe nada) | idéntico |
| Excel exportado | no puede: la .xlsm no tiene filas libres → habría que hacer B igualmente | **mismo truco**: se escriben esas celdas de `Tablas` en la .xlsm y el Excel calcula y su desplegable muestra la propia | sí |
| Rendimiento | +1 hoja, arranque igual | sin coste de arranque; elegir/cambiar categoría con propias = recarga completa (~0,4 s) | igual |
| Pega | complejo, dos mecanismos | la oficial «prestada» desaparece en esa ficha (no se elige, el desplegable sale de una lista fija) y en su Excel exportado | no cubre «añadir» |
(La opción «categoría que solo consume PD por hoja interna», como las vías, no sirve: una categoría no consume, define costes, límites y bonos.)

### Modelo (src/gremio)
```ts
// Valores por COLUMNA de Tablas (E..CG), p. ej. { E: 5, F: 15, I: 0.6, R: 2, CF: 'Luchador', CG: 'Sin' }
interface CategoriaGremio { n: string; oficial: boolean; base: string; v: Record<string, number | string>; nota: string }
Biblioteca += { categorias: CategoriaGremio[]; ocultas: string[] }   // oficial:true = modificación de una oficial (n = su nombre)
Ficha     += { categorias?: CategoriaGremio[] }                       // COPIA de las que usa: la ficha calcula igual en cualquier navegador
```
- Clave por columna (no por etiqueta: hay cabeceras que son fórmulas). Etiquetas y valores oficiales en `src/data/categorias.json`
  (generado de `tablas.json`/`plantilla.json` con un script en tools; ~15 KB) para el editor («copiar de…») y la lista de oficiales.
- Nueva propia = siempre «copiar de una oficial» (rellena las 81 columnas; nunca quedan huecos).
- Nombres: únicos (sin distinguir mayúsculas), distintos de las 22 oficiales, sin `* ? ~` (comodines de VLOOKUP/SUMIF) ni `< > =` al
  principio (criterios de SUMIF en `Tablas!C`). Es integridad de datos, no un límite de reglas: se rechaza en el editor.
- Valores fuera de lo habitual (coste 0, límite > 100 %…) **avisan**, no bloquean.

### Motor
`entradasCategorias(f)` en `src/gremio/categorias.ts` → `{"Tablas!X2nn": valor}` que `entradasMotor` añade a las entradas:
1. Oficial modificada usada en O7..O15 → sus columnas distintas de la base en su fila.
2. Propia usada en O7..O15 → fila libre (de la 223 hacia arriba, saltando oficiales usadas o modificadas): D = nombre, E..CG = todos
   sus valores (vacío → 0, nunca `''`, que en `poner` significa «volver a la plantilla»).
3. Sin `f.categorias` → `{}` (nada cambia).
`Libro.cargar` ya restaura a la plantilla las celdas de la ficha anterior que no estén en las nuevas → cambiar de ficha limpia `Tablas`.
No se toca `libro.ts` ni `plantilla.json`. Las celdas `Tablas!*` **nunca** se guardan en `f.entradas`.

Cuándo se aplica: al abrir (ya pasa por `entradasMotor`), y si la ficha tiene `categorias`, al cambiar `PDs!O7..O15` o la copia →
recarga completa (`recargar(id, entradasMotor(f))`, ~0,4 s; la fila asignada puede cambiar).

### Elección
`CampoCategoria` (wrapper de `Campo` con `fijas`): oficiales no ocultas + propias de la biblioteca + las que ya tiene la ficha
(si la actual está oculta o no existe, se ve igual: lo hace ya `Campo`). Etiqueta «GREMIO» junto a las propias. Al elegir una propia
o una oficial modificada, se copia en `f.categorias`; al dejar de usarla se quita. Se usa en `Principal.tsx` (O7..O15) y `Asistente.tsx` (O7).

### Compartir
- Biblioteca .json: gana `categorias` y `ocultas` (y `parseBiblioteca` las acepta como biblioteca válida); al unir, mismo criterio por nombre.
- Ficha .json: lleva su copia → otro gremio la abre y calcula igual. Si la biblioteca local tiene otra versión con ese nombre:
  aviso «Tu biblioteca tiene otra versión de X» + botón «Actualizar» (nunca automático).
- Exportar a Excel: `escribirFicha(base, entradas, extras)` escribe también las celdas `Tablas!` de `entradasCategorias` (solo constantes;
  `reescribirHoja` ya no pisa fórmulas). Aviso en `ExportarExcel.tsx`: «En este Excel, *Novel* se sustituye por *Caballero rúnico*».
- Importar Excel (fase 2): leer `Tablas!D202:CG223` de la .xlsm; fila con nombre no oficial → categoría propia; oficial con valores
  distintos → modificada. Se copia en la ficha y se ofrece añadirla a la biblioteca (avisa, no bloquea).

## 3. Pasos (con pruebas)
1. `tools/export_categorias.py` → `src/data/categorias.json` {cols, etiquetas, oficiales:{nombre: {fila, v}}}. Test en `datos.test.ts`:
   coincide con `plantilla.json` `Tablas!D202:CG223`.
2. `src/gremio/categorias.ts` (tipos, `parseCategoria`, `validarNombre`, `entradasCategorias`, `avisosCategoria`) + Biblioteca/almacén
   (`modelo.ts`, `almacen.ts`). Tests `tests/gremio.categorias.test.ts` (unitarios): nombres prohibidos, asignación de filas que evita las
   usadas, sin copia → `{}`, nunca `''`, nunca claves fuera de `Tablas!E..CG202..223` salvo D.
3. `ficha.ts`: `categorias?` en `Ficha`, `parse` (validar con `parseCategoria`), `entradasMotor` añade `entradasCategorias`.
   `engine/index.ts`: `recargar`. `store.ts`: `guardarCategorias` y recarga al editar O7..O15 si hay copia.
4. Pruebas de motor (`tests/gremio.categorias.motor.test.ts`, Libro real):
   - **Regresión**: cada ficha de `ref/fichas` y de `golden/*.xlsm` (si existen, como `golden.motor.test.ts`) da los mismos valores con
     `entradasMotor(f)` que con `f.entradas` cuando no hay categorías (y biblioteca vacía).
   - **Equivalencia**: Lock con propia «Hechicero bis» = copia exacta de Hechicero y O7 = «Hechicero bis» → todos los valores de PDs,
     Principal, Combate, Ki, Místicos, Psíquicos iguales salvo textos con el nombre.
   - Modificar oficial (Hechicero `V` CosteKi 3→1) → cambia `PDs!L30` y PD gastados; límites I/J/K → cambian `L88/L106/L122` y el aviso `T194`/`V104` aparece y desaparece (avisa).
   - Cargar ficha con propia y luego otra sin ella → la segunda da sus valores golden (limpieza de `Tablas`).
   - Propia en 2.ª categoría: coste de cambio `Y7` según arquetipos.
5. UI: sección «Categorías» en `Gremio.tsx` (lista, nueva desde oficial, editar por grupos: generales, límites en %, bonos por nivel,
   costes de primarias, sobrenaturales, secundarias, arquetipos; ocultar oficiales; modificar oficial), `CampoCategoria` en
   `Principal.tsx`/`Asistente.tsx`, aviso en `Desarrollo.tsx`/Principal si la ficha usa una oculta o una propia con reglas por nombre
   perdidas. Tests en `gremio.ui.test.tsx`: el desplegable ofrece la propia, la oculta no (salvo si es la actual), elegirla rellena `f.categorias`.
6. Exportar: `extras` en `escribirFicha` + aviso. Test en `exportar.test.ts`: escribe `Tablas!D2nn..CG2nn`, no toca C/CH, y la
   ida y vuelta por el importador recupera las entradas.
7. (Fase 2) Importador `.xlsm` lee las categorías de `Tablas`; test con una .xlsm sintética. Compendio: filas propias marcadas GREMIO
   en «Coste en PD por categoría» (opcional). PLAN.md: apartado nuevo.
8. `npm run test:all` + golden locales.

## 4. Riesgos (prioridad = probabilidad × impacto)
| # | Riesgo | P | I | Mitigación |
|---|---|---|---|---|
| 1 | Romper fichas existentes o de otros gremios | Baja | Alto | B no toca fórmulas ni plantilla; sin `f.categorias` no se escribe nada; test de regresión con ref/fichas y golden; la copia viaja en la ficha |
| 2 | Ficha cuya categoría se borra/renombra en la biblioteca (el nombre es la clave del desplegable y de `VLOOKUP`) | Alta | Alto | La ficha guarda su copia; borrar/renombrar en la biblioteca no la cambia; renombrar = crear otra; aviso «no está en tu biblioteca» |
| 3 | Excel exportado sin la categoría (#N/A en cascada) | Alta (sin hacer nada) | Alto | Escribir las celdas en `Tablas` de la .xlsm (fila prestada) + aviso de qué oficial se sustituye |
| 4 | Fila prestada que el jugador elige luego como oficial | Media | Medio | El desplegable sale de lista fija; al cambiar O7..O15 se recalcula la asignación y se recarga; test |
| 5 | Nombres duplicados con oficiales o con comodines/criterios (`*`, `?`, `~`, `<`, `>`, `=`) | Media | Alto | Validación en editor y en `parseBiblioteca`/`parse` de ficha (se renombra con sufijo al importar) |
| 6 | Reglas por nombre que la propia no hereda (Novel, Maestro en Armas, Tao) y bug de la 5.ª categoría | Media | Medio | Avisar en el editor si se copia de una de ellas; documentar; manda el Excel |
| 7 | Avisos/límites (PD por categoría, ataque+defensa, límites combate/magia/psi) | Baja | Medio | Salen solos de las fórmulas con los valores de la fila; nunca se bloquea; tests de aviso aparece/desaparece |
| 8 | Rendimiento | Baja | Bajo | Nada al construir; recarga 0,4 s solo al cambiar categoría en fichas con categorías propias |
| 9 | Fichas/bibliotecas en webs antiguas pierden `categorias` | Baja | Medio | Campo opcional, sin cambiar `VERSION`; la copia en la ficha evita depender de la biblioteca |
| 10 | Importar Excel de otro gremio con categorías cambiadas en `Tablas` | Media | Medio | Fase 2: detectar filas distintas; hasta entonces aviso «categoría desconocida» al importar |
| 11 | Compendio/asistente/PDF/modo juego | Baja | Bajo | PDF, modo juego y resumen leen valores del motor → salen solos; asistente usa `CampoCategoria`; compendio opcional |
| 12 | Legalidad/contenido de gremio confundido con oficial; datos sin verificar | Media | Bajo | Etiqueta GREMIO en desplegable, Desarrollo y editor; «copiar de» con valores del Excel; no se inventan valores oficiales |

## 5. Preguntas para el usuario (con opción por defecto)
1. ¿Una oficial modificada en la biblioteca se aplica sola a todas las fichas que la usan, o cada ficha la adopta? **Defecto: cada ficha la adopta (botón), nunca automático.**
2. ¿«Quitar» una oficial = ocultarla en los desplegables (las fichas que la tienen siguen igual)? **Defecto: sí, solo ocultar.**
3. Excel exportado con propia: ¿vale sustituir en ese Excel una oficial que el personaje no usa (empezando por la última, Novel)? **Defecto: sí, con aviso.**
4. ¿Las propias deben poder heredar las reglas por nombre (bono Novel, ½ coste de Maestro en Armas/Tao)? **Defecto: no (solo lo que está en la tabla).**
5. ¿Si la biblioteca cambia una categoría que una ficha ya usa, actualizar la ficha automáticamente? **Defecto: no; aviso + botón «Actualizar».**
6. ¿Importar categorías desde Excel de otros gremios entra ya o en una segunda entrega? **Defecto: segunda entrega.**

## 6. Tamaño
~12-14 archivos, ~750 líneas (≈450 código + 300 tests): `tools/export_categorias.py` (40), `src/data/categorias.json` (generado),
`src/gremio/categorias.ts` (120), `modelo.ts`/`almacen.ts` (+25), `model/ficha.ts` (+12), `engine/index.ts` (+8), `store.ts` (+20),
`ui/Gremio.tsx` (+160 o `ui/CategoriasGremio.tsx` nuevo), `ui/Principal.tsx`/`Asistente.tsx` (+30), `export/xlsm.ts` + `ExportarExcel.tsx` (+25),
tests (~300). Importador (fase 2) +60.
Riesgo de regresión: **bajo** (no se toca ninguna fórmula; todo condicionado a `f.categorias`).

**Versión mínima útil (entrega 1):** pasos 1-6: crear propias copiando una oficial, editar sus valores, modificar oficiales, ocultar
oficiales, elegirlas en Principal/Asistente, cálculo correcto con avisos, copia en la ficha y exportación a Excel con aviso.
Entrega 2: importador de categorías desde .xlsm de gremio, compendio, botón «Actualizar desde biblioteca».
