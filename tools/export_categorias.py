"""Tabla de categorías del Excel (hoja Tablas, filas 202-223, columnas E..CG) para el editor de categorías del modo gremio.

Salida: src/data/categorias.json
  cols:      [{c: columna, l: etiqueta legible}]     las 81 columnas editables (E..CG); las fórmulas C, CH y CJ no se tocan
  oficiales: [{n: nombre, fila: fila en Tablas, v: {columna: valor}}]   solo las celdas con valor (las vacías no están)
Uso: python tools/export_categorias.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def num(c):
    n = 0
    for ch in c:
        n = n * 26 + ord(ch) - 64
    return n


def nombre(n):
    s = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def texto(v):
    return v[1:] if isinstance(v, str) and v.startswith("'") else v


def main():
    hojas = json.load(open(os.path.join(ROOT, "public", "plantilla.json"), encoding="utf-8"))["sheets"]
    t = hojas["Tablas"]

    def ref(hoja, celda):
        v = hojas[hoja].get(celda)
        return texto(v) if not (isinstance(v, str) and v.startswith("=")) else celda

    def etiqueta(c):
        h = t.get(f"{c}201")
        if not (isinstance(h, str) and h.startswith("=")):
            return texto(h) or c
        m = re.fullmatch(r'="Coste"&(\w+)!\$?([A-Z]+)\$?(\d+)', h)
        if m:
            return "Coste " + str(ref(m.group(1), m.group(2) + m.group(3)))
        m = re.fullmatch(r"=(\w+)!\$?([A-Z]+)\$?(\d+)", h)
        if m:
            return str(ref(m.group(1), m.group(2) + m.group(3)))
        return c

    cols = [nombre(i) for i in range(num("E"), num("CG") + 1)]
    etiquetas = []
    for c in cols:
        l = etiqueta(c)
        l = re.sub(r"^Coste(?=[A-ZÁÉÍÓÚ])", "Coste ", l)       # CosteKi -> Coste Ki
        l = l.replace("Coste MultiploPV", "Coste de PV").replace("Limite ", "Límite ")
        etiquetas.append({"c": c, "l": l})
    oficiales = []
    for r in range(202, 224):
        n = texto(t.get(f"D{r}"))
        v = {}
        for c in cols:
            x = t.get(f"{c}{r}")
            if x is None or x == "":
                continue
            v[c] = texto(x)
        oficiales.append({"n": n, "fila": r, "v": v})
    salida = os.path.join(ROOT, "src", "data", "categorias.json")
    with open(salida, "w", encoding="utf-8") as f:
        json.dump({"cols": etiquetas, "oficiales": oficiales}, f, ensure_ascii=False, separators=(",", ":"))
    print(len(cols), "columnas,", len(oficiales), "categorías ->", os.path.relpath(salida, ROOT), os.path.getsize(salida) // 1024, "KB")
    print([e["l"] for e in etiquetas][:40])


if __name__ == "__main__":
    main()
