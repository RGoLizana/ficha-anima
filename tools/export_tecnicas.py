"""Extrae de la plantilla las tablas de 'Tablas Técnicas' (efectos y desventajas de las técnicas de ki) para el asistente de técnicas
y para la vista previa de costes. Son las tablas oficiales fijas; los efectos personalizados (hoja Personalización) no entran.

Salida: src/data/tecnicas.json
  efectos:    [{n nombre, c categoría, t tipo, k clase, p característica principal, o {car: recargo}, e [elementos],
                b [etiqueta '', kiPrim, kiSec, cm, mant, sostMenor, sostMayor, nivel] | null,  <- fila sin nombre: el Excel la suma siempre
                g [[etiqueta, kiPrim, kiSec, cm, mant, sostMenor, sostMayor, nivel]],   <- grados (excluyentes, tienen nivel)
                x [[...igual, nivel 0...]]}]                                            <- extras (sin nivel, se suman)
  desventajas:[{n nombre, k clase, o [[opción, cm, nivel]]}]
Uso: python tools/export_tecnicas.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def val(hoja, celda):
    v = hoja.get(celda)
    if isinstance(v, str):
        if v.startswith("="):
            return None
        return v[1:] if v.startswith("'") else v
    return v


def main():
    t = json.load(open(os.path.join(ROOT, "public", "plantilla.json"), encoding="utf-8"))["sheets"]["Tablas Técnicas"]

    # opciones de cada efecto: filas con el mismo nombre (columna C), sin distinguir mayúsculas como hace el MATCH de Excel
    opciones = {}
    for r in range(10, 644):
        c = val(t, f"C{r}")
        if c is None or str(c).startswith(">"):
            continue
        fila = [val(t, f"D{r}") or "", *[val(t, f"{col}{r}") for col in "EFGHIJK"]]
        fila = [fila[0]] + [(0 if x is None else x) for x in fila[1:7]] + [fila[7]]
        opciones.setdefault(str(c).lower(), []).append(fila)

    efectos, categoria = [], ""
    for r in range(9, 89):
        n = val(t, f"O{r}")
        if n is None:
            continue
        if str(n).startswith(">"):
            categoria = str(n).lstrip(">").strip().capitalize().replace("Efectos ", "")
            continue
        if re.match(r"Efecto Personalizado", str(n)) or str(n).lower() not in opciones:
            continue
        carac = val(t, f"S{r}") or ""
        m = re.match(r"(\w{3}) \((.*)\)", carac)
        if not m:
            continue
        opt = {x[:3]: int(x[4:]) for x in m.group(2).split(", ")}
        filas = opciones[str(n).lower()]
        efectos.append({
            "n": n, "c": categoria, "t": val(t, f"Q{r}"), "k": val(t, f"R{r}"), "p": m.group(1), "o": opt,
            "e": [e for e in (val(t, f"T{r}"), val(t, f"U{r}"), val(t, f"V{r}")) if e],
            "b": next(([*f[:7], int(f[7] or 0)] for f in filas if f[0] == ""), None),          # fila sin nombre: el Excel la suma siempre
            "g": [f[:7] + [int(f[7])] for f in filas if f[0] != "" and f[7] not in (None, "")],
            "x": [f[:7] + [0] for f in filas if f[0] != "" and f[7] in (None, "")],
        })

    desventajas = []
    for r in range(165, 193):
        n = val(t, f"O{r}")
        if n is None or str(n).startswith(">") or re.match(r"Desventaja Personalizada", str(n)):
            continue
        ops = [[val(t, f"P{q}") or "", val(t, f"Q{q}"), max(1, val(t, f"R{q}") or 1)] for q in range(201, 302) if str(val(t, f"O{q}")).lower() == str(n).lower()]
        if ops:
            desventajas.append({"n": n, "k": val(t, f"Q{r}"), "o": ops})

    salida = os.path.join(ROOT, "src", "data", "tecnicas.json")
    with open(salida, "w", encoding="utf-8") as f:
        json.dump({"efectos": efectos, "desventajas": desventajas}, f, ensure_ascii=False, separators=(",", ":"))
    print(len(efectos), "efectos,", len(desventajas), "desventajas ->", os.path.relpath(salida, ROOT), os.path.getsize(salida) // 1024, "KB")
    for e in efectos[:3] + efectos[-2:]:
        print(e["n"], e["c"], e["p"], e["o"], e["e"], len(e["g"]), len(e["x"]))


if __name__ == "__main__":
    main()
