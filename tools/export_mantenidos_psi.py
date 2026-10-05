"""Extrae de la plantilla lo que necesita el ayudante de poderes psíquicos mantenidos (innatos): la tabla de dificultades
(Tablas!T26:U36), el +20 por CV y el máximo de 5 CV de «Incrementar Innato» (Psíquicos!K20/L20) y los poderes que se pueden
mantener ('Tablas psiquica' D:R con Mantenido = Sí) con su dificultad mínima (la primera que no es «Fatiga», como
'Tablas psiquica'!V8). Comprueba además que la fórmula del nivel mantenido (Psíquicos!AK17) sigue usando las ventajas que se
describen a mano abajo; si la plantilla cambia, falla en vez de exportar datos que ya no cuadran.

Reglas (Core Exxet, cap. 14): innatos p. 212 (2 CV permanentes por innato; se mantienen en la dificultad natural del potencial,
sin tirada ni otros bonos, o en la mínima del poder si es mayor); Incrementar un innato p. 212-213 (+20 por CV libre, hasta 5,
no se recuperan mientras se mantenga); Mantenimiento añadido p. 21 (un nivel por encima de lo que permite el potencial).
Si el libro choca con el Excel manda el Excel (p. ej. el Excel suma el bono de Fortalecer, AB, al potencial del innato).

Salida: src/data/mantenidos-psi.json
  umbrales [0, 20, 40, 80…]  niveles ['-', 'RUT', 'FAC'…]  porCV 20  maxCV 5
  ventajas [{n, celdas, efecto, ref}]
  poderes  [{n nombre, d disciplina, l nivel, min índice en niveles, f [efecto RUT..ZEN]}]
Uso: python tools/export_mantenidos_psi.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIFICULTADES = "IJKLMNOPQR"

VENTAJAS = [
    {"n": "Mantenimiento añadido", "celdas": ["Tablas!G453", "Tablas!H1393"], "efecto": 1,
     "ref": "Core Exxet p. 21: los innatos se mantienen un nivel de dificultad por encima de lo que permite el potencial (Excel Psíquicos!AK17)"},
    {"n": "Introversión", "celdas": ["Psíquicos!C39:E50"], "efecto": 1,
     "ref": "Patrón mental; solo en el Excel (Psíquicos!AK17), no verificado en los libros oficiales disponibles"},
]


def val(hoja, celda):
    v = hoja.get(celda)
    if isinstance(v, str):
        if v.startswith("="):
            return None
        return v[1:] if v.startswith("'") else v
    return v


def main():
    hojas = json.load(open(os.path.join(ROOT, "public", "plantilla.json"), encoding="utf-8"))["sheets"]
    t, tp, ps = hojas["Tablas"], hojas["Tablas psiquica"], hojas["Psíquicos"]
    umbrales = [int(val(t, f"T{r}")) for r in range(26, 37)]
    niveles = [val(t, f"U{r}") for r in range(26, 37)]
    por_cv = int(re.search(r"\d+", val(ps, "K20")).group())
    max_cv = int(re.search(r"\d+", val(ps, "L20")).group()) // por_cv
    ak = ps["AK17"]
    for x in ("Tablas!$G$453", "Tablas!$H$1393", '"Introversión"', "AL17-20*AI17"):
        assert x in ak, f"Psíquicos!AK17 ya no usa {x}: revisa VENTAJAS"
    poderes = []
    for r in range(7, 146):
        nombre, disc = val(tp, f"D{r}"), val(tp, f"E{r}")
        if not nombre or str(nombre).startswith(">") or not disc or val(tp, f"G{r}") != "Sí":
            continue
        f = [val(tp, f"{c}{r}") for c in DIFICULTADES]
        fatigas = sum(1 for x in f if x and "fatiga" in str(x).lower())
        poderes.append({"n": nombre, "d": disc, "l": val(tp, f"F{r}"), "min": fatigas + 1, "f": f})
    salida = os.path.join(ROOT, "src", "data", "mantenidos-psi.json")
    with open(salida, "w", encoding="utf-8") as fh:
        json.dump({"umbrales": umbrales, "niveles": niveles, "porCV": por_cv, "maxCV": max_cv, "ventajas": VENTAJAS, "poderes": poderes},
                  fh, ensure_ascii=False, separators=(",", ":"))
    print(len(poderes), "poderes mantenibles ->", os.path.relpath(salida, ROOT), os.path.getsize(salida) // 1024, "KB")


if __name__ == "__main__":
    main()
