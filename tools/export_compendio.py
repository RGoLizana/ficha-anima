"""Extrae de la plantilla el compendio de magia y de psíquica (mentalismo) para la web.

Salida: src/data/compendio.json
  magia:
    vias:    [{n, tipo: Mayor|Menor, opuestas: [vías], subvias: [subvías permitidas]}]
    subvias: [{n, prohibidas: [vías en las que no se puede tomar]}]   (Caos, Guerra, Literae, Muerte…)
    conjuros:[{n nombre, v vía/subvía o 'Libre acceso', l nivel, d diario, t tipo, a acción, c vía cerrada (o null),
               g [[int, zeón, mant, efecto] x4 grados: Base, Intermedio, Avanzado, Arcano], e descripción}]
  psiquica:
    disciplinas: [{n, mod: modificador de la disciplina}]
    poderes:     [{n, d disciplina, l nivel, m mantenido, a acción, f [efecto por dificultad: Rutinario…Zen]}]
    cvs:         [{cvs, bono}]   (tabla de mejora de potencial psíquico por CVs)
    dificultades:[Rutinario…Zen]  valores:[20…440] (valor a alcanzar en cada dificultad)
Uso: python tools/export_compendio.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRADOS = [("J", "N", "R", "V"), ("K", "O", "S", "W"), ("L", "P", "T", "X"), ("M", "Q", "U", "Y")]
VALORES_DIFICULTAD = [20, 40, 80, 120, 140, 180, 240, 280, 320, 440]  # tabla de dificultades de Anima (misma que en Grimorio Psíquica!C12:C21)
DIFICULTADES = ["Rutinario", "Fácil", "Medio", "Difícil", "Muy difícil", "Absurdo", "Casi imposible", "Imposible", "Inhumano", "Zen"]
OPUESTAS = [("Luz", "Oscuridad"), ("Fuego", "Agua"), ("Aire", "Tierra"), ("Creación", "Destrucción"), ("Esencia", "Ilusión")]
COL_PERMITIDAS = "MNOPQRSTUVW"  # Luz, Oscuridad, Creación, Destrucción, Fuego, Agua, Tierra, Aire, Esencia, Ilusión, Nigromancia


def val(hoja, celda):
    v = hoja.get(celda)
    if isinstance(v, str):
        if v.startswith("="):
            return None
        return v[1:] if v.startswith("'") else v
    return v


def nivel_de(hoja, r):
    """Nivel de un conjuro: número, o fórmula tipo =F407+10 (libre acceso) resuelta en cadena."""
    v = hoja.get(f"F{r}")
    if isinstance(v, str) and v.startswith("="):
        m = re.fullmatch(r"=F(\d+)\+(\d+)", v)
        return nivel_de(hoja, int(m.group(1))) + int(m.group(2)) if m else None
    return v


def main():
    hojas = json.load(open(os.path.join(ROOT, "public", "plantilla.json"), encoding="utf-8"))["sheets"]
    tm, tp, t = hojas["Tablas Magia"], hojas["Tablas psiquica"], hojas["Tablas"]

    conjuros = []
    for r in range(6, 681):
        nombre, via, nivel = val(tm, f"D{r}"), val(tm, f"E{r}"), nivel_de(tm, r)
        if not nombre or str(nombre).startswith(">") or not via or nivel is None:
            continue
        conjuros.append({"n": nombre, "v": via, "l": nivel, "d": val(tm, f"G{r}"), "t": val(tm, f"H{r}"), "a": val(tm, f"I{r}"),
                         "c": val(tm, f"AA{r}"), "g": [[val(tm, f"{c}{r}") for c in g] for g in GRADOS], "e": val(tm, f"Z{r}")})

    # vías mayores y menores (Tablas E1089:F1099) y sus opuestas
    vias = []
    for r in range(1089, 1100):
        n, tipo = val(t, f"E{r}"), val(t, f"F{r}")
        if n and tipo:
            opu = [b if a == n else a for a, b in OPUESTAS if n in (a, b)]
            vias.append({"n": n, "tipo": tipo, "opuestas": opu if n != "Nigromancia" else [x for x in [val(t, f"E{q}") for q in range(1089, 1099)] if x]})
    # subvías permitidas por vía (columnas M..W, desde la fila 1120 hasta '> PROHIBIDAS')
    for col, via in zip(COL_PERMITIDAS, ["Luz", "Oscuridad", "Creación", "Destrucción", "Fuego", "Agua", "Tierra", "Aire", "Esencia", "Ilusión", "Nigromancia"]):
        permitidas = []
        for r in range(1120, 1135):
            x = val(t, f"{col}{r}")
            if x and str(x).startswith("> PROHIBIDAS"):
                break  # lo que sigue son las prohibidas
            if x and not str(x).startswith(">"):
                permitidas.append("Umbral" if x == "Umbra" else x)
        for v in vias:
            if v["n"] == via:
                v["subvias"] = permitidas
    subvias = []
    for r in range(1119, 1133):
        n = val(t, f"C{r}")
        if n:
            subvias.append({"n": n, "prohibidas": [val(t, f"{c}{r}") for c in "DEFGHIJ" if val(t, f"{c}{r}")]})

    poderes = []
    for r in range(7, 146):
        nombre, disc = val(tp, f"D{r}"), val(tp, f"E{r}")
        if not nombre or str(nombre).startswith(">") or not disc:
            continue
        poderes.append({"n": nombre, "d": disc, "l": val(tp, f"F{r}"), "m": val(tp, f"G{r}"), "a": val(tp, f"H{r}"),
                        "f": [val(tp, f"{c}{r}") for c in "IJKLMNOPQR"]})
    disciplinas = [{"n": val(t, f"D{r}"), "mod": val(t, f"E{r}") or "Sin modificador"} for r in range(1190, 1204) if val(t, f"D{r}")]
    cvs = [{"cvs": val(t, f"L{r}"), "bono": val(t, f"M{r}")} for r in range(1104, 1114) if val(t, f"L{r}") is not None]

    out = {"magia": {"vias": vias, "subvias": subvias, "conjuros": conjuros},
           "psiquica": {"disciplinas": disciplinas, "poderes": poderes, "cvs": cvs, "dificultades": DIFICULTADES, "valores": VALORES_DIFICULTAD}}
    salida = os.path.join(ROOT, "src", "data", "compendio.json")
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(len(vias), "vías,", len(subvias), "subvías,", len(conjuros), "conjuros,", len(disciplinas), "disciplinas,", len(poderes), "poderes ->",
          os.path.relpath(salida, ROOT), os.path.getsize(salida) // 1024, "KB")


if __name__ == "__main__":
    main()
