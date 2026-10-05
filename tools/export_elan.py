"""Dones de Elan de cada entidad (hoja 'Tablas', filas 1764-1963) para el resumen de la pestaña Elan.

Salida: src/data/elan.json
  {"Mikael": [{"n": nombre del don, "e": Elan que pide, "c": coste, "d": descripción (null si la calcula el Excel)}], ...}
Uso: python tools/export_elan.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def texto(v):
    return v[1:] if isinstance(v, str) and v.startswith("'") else v


def main():
    t = json.load(open(os.path.join(ROOT, "public", "plantilla.json"), encoding="utf-8"))["sheets"]["Tablas"]
    ent, actual = {}, None
    for r in range(1764, 1964):
        e, g = t.get(f"E{r}"), t.get(f"G{r}")
        if e is None or (isinstance(e, str) and e.startswith("=")):
            continue
        if g == "'Elan":                               # fila de cabecera: abre la entidad
            actual = texto(e)
            ent[actual] = []
        elif actual and isinstance(g, (int, float)):
            l, c = t.get(f"L{r}"), t.get(f"I{r}")
            ent[actual].append({"n": texto(e), "e": g, "c": c if isinstance(c, (int, float)) else None,
                                "d": None if (l is None or (isinstance(l, str) and l.startswith("="))) else texto(l)})
    salida = os.path.join(ROOT, "src", "data", "elan.json")
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(ent, f, ensure_ascii=False, separators=(",", ":"))
    print(len(ent), "entidades,", sum(len(v) for v in ent.values()), "dones ->", os.path.relpath(salida, ROOT), os.path.getsize(salida) // 1024, "KB")


if __name__ == "__main__":
    main()
