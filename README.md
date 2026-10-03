# Fichas Anima

Web: https://rgolizana.github.io/ficha-anima/

Ficha de **Anima Beyond Fantasy** como aplicación web: crear, ver y editar personajes, con los mismos cálculos que la
ficha de Excel v8.7.0 y PDF igual que el del Excel. Funciona en el navegador, sin servidor: las fichas se guardan en el
propio navegador y se pueden exportar/importar como `.json`.

Estado y plan por pasos: [PLAN.md](PLAN.md).

## Cómo funciona

La web carga las ~35.000 fórmulas de la plantilla del Excel (`public/plantilla.json`) en un motor de fórmulas
([HyperFormula](https://hyperformula.handsontable.com/), dentro de un Web Worker) y le da las entradas de la ficha.
Una ficha guarda solo lo que escribe el jugador, por celda del Excel: `{"Principal!E11": 10, "General!F23": "Humano"}`.
Todo lo demás se calcula, así que los resultados coinciden con Excel (las pruebas lo exigen).

## Desarrollo

```bash
npm install
npm run dev          # servidor local
npm run build        # compilación en dist/
npm run test:all     # pruebas de la web (Vitest) + de las herramientas (Python)
```

Requisitos: Node 22 o superior. Las pruebas de las herramientas necesitan `pip install openpyxl pdfplumber`.

## Regenerar los datos desde el Excel

Los JSON de `public/` y `src/data/` se generan con los scripts de `tools/` a partir de la ficha de Excel. Hace falta
Windows con Excel y `pip install openpyxl pywin32 pdfplumber`; las rutas de los ficheros originales están en
`tools/migrate.py`. Los ficheros `.xlsm` y los PDF no se suben al repositorio.

| Script | Para qué |
|---|---|
| `tools/migrate.py` | Pasa fichas de versiones antiguas a la plantilla 8.7.0 y las recalcula con Excel |
| `tools/extract.py` | Saca `golden/*.json`, desplegables (`src/data/listas.json`) e inventario de celdas |
| `tools/export_formulas.py` | Exporta las fórmulas adaptadas al motor (`public/plantilla.json`) |
| `tools/pdf_layout.py`, `tools/pdf_check.py` | Maqueta del PDF idéntica al del Excel y su comprobación |

## Publicar en GitHub Pages

El flujo `.github/workflows/deploy.yml` compila y publica la web, pero está en modo **manual** (Actions → Deploy →
Run workflow). Antes hay que activar Pages en *Settings → Pages → Source: GitHub Actions*.

La web está publicada (repositorio público, Pages activado). Para actualizarla: Actions → Deploy → Run workflow.

Sobre la publicación, ten en cuenta:

- **El sitio de GitHub Pages es público**, aunque el repositorio sea privado (y en planes gratuitos Pages solo está
  disponible para repositorios públicos). Publicar la web publica también `plantilla.json`, que contiene las tablas y
  textos del reglamento de Anima: comprueba que puedes hacerlo.
- **Licencia:** HyperFormula es GPL-3.0 para uso no comercial. Si publicas la web, el código fuente debe poder
  distribuirse bajo una licencia compatible (GPL-3.0).
- Para que se despliegue en cada `push`, cambia el disparador de `deploy.yml` a `push` en `main`.

## Licencia y contenido del juego

- **Código:** GPL-3.0 (ver `LICENSE`). Usa HyperFormula bajo su licencia GPL-3.0.
- **Contenido del juego:** *Anima: Beyond Fantasy*, su reglamento, tablas, textos y logotipo pertenecen a sus propietarios
  (Anima Project Studio / Edge Entertainment). Este proyecto es una herramienta no oficial de aficionados, sin ánimo de
  lucro; los datos de las tablas se extraen de la ficha de Excel de la comunidad y se incluyen solo para que la web calcule
  igual que ella. Si eres titular de los derechos y quieres que algo se retire, abre una *issue*.

