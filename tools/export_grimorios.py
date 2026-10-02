"""Extrae de la plantilla las tablas de conjuros ('Tablas Magia') y poderes psíquicos ('Tablas psiquica')
para los grimorios informativos de la web (todas las vías / disciplinas del personaje a la vez, sin pasar por el
selector de una sola vía del Excel).

Salida: src/data/grimorios.json
  conjuros: [{n nombre, v vía, l nivel, d diario, t tipo, a acción, g [[int, zeón, mant, efecto] x4 grados], e descripción}]
  poderes:  [{n nombre, d disciplina, l nivel, m mantenido, a acción, f [efecto por dificultad RUT..ZEN]]}]
Uso: python tools/export_grimorios.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRADOS = [("J", "N", "R", "V"), ("K", "O", "S", "W"), ("L", "P", "T", "X"), ("M", "Q", "U", "Y")]
DIFICULTADES = "IJKLMNOPQR"


def val(hoja, celda):
    v = hoja.get(celda)
    if isinstance(v, str):
        if v.startswith("="):
            return None
        return v[1:] if v.startswith("'") else v
    return v


def main():
    hojas = json.load(open(os.path.join(ROOT, "public", "plantilla.json"), encoding="utf-8"))["sheets"]
    tm, tp = hojas["Tablas Magia"], hojas["Tablas psiquica"]
    conjuros, poderes = [], []
    for r in range(6, 681):
        nombre, via, nivel = val(tm, f"D{r}"), val(tm, f"E{r}"), val(tm, f"F{r}")
        if not nombre or str(nombre).startswith(">") or not via or via == "Libre acceso" or nivel is None:
            continue
        conjuros.append({"n": nombre, "v": via, "l": nivel, "d": val(tm, f"G{r}"), "t": val(tm, f"H{r}"), "a": val(tm, f"I{r}"),
                         "g": [[val(tm, f"{c}{r}") for c in g] for g in GRADOS], "e": val(tm, f"Z{r}")})
    for r in range(7, 146):
        nombre, disc = val(tp, f"D{r}"), val(tp, f"E{r}")
        if not nombre or str(nombre).startswith(">") or not disc:
            continue
        poderes.append({"n": nombre, "d": disc, "l": val(tp, f"F{r}"), "m": val(tp, f"G{r}"), "a": val(tp, f"H{r}"),
                        "f": [val(tp, f"{c}{r}") for c in DIFICULTADES]})
    salida = os.path.join(ROOT, "src", "data", "grimorios.json")
    with open(salida, "w", encoding="utf-8") as f:
        json.dump({"conjuros": conjuros, "poderes": poderes}, f, ensure_ascii=False, separators=(",", ":"))
    print(len(conjuros), "conjuros,", len(poderes), "poderes ->", os.path.relpath(salida, ROOT), os.path.getsize(salida) // 1024, "KB")


if __name__ == "__main__":
    main()
