"""Reconstruye el árbol de Metamagia de la ficha (hoja 'Metamagia') para dibujarlo en la web.

Cómo se deduce (la hoja no tiene formas: el árbol son bordes de celda):
  * Cada habilidad es una caja de 2 columnas x 4 filas: la casilla de compra en (col, fila) —las claves de
    src/data/listas.json que empiezan por 'Metamagia!' salvo R6—, el nombre en (col-1, fila-3), el coste en (col+1, fila)
    y el nivel de personaje mínimo (la etiqueta "Nv X", que R6 oculta cuando ya se alcanza) en (col+1, fila-3).
  * Las conexiones son los bordes de las celdas que quedan fuera de las cajas. Se pasa cada borde a un segmento de la
    retícula de esquinas de celda; los segmentos con los dos extremos dentro del rectángulo de una caja son de la caja.
    El resto son "cables": se agrupan por extremos compartidos y cada grupo une todas las cajas que toca (una línea en
    T une a sus tres cajas). Las reglas de formato condicional (iluminar la caja comprada) y las fórmulas 1/0 bajo
    cada caja no aportan conexiones.
  * Raíces (por dónde se puede empezar): las cajas sin requisito de nivel (sin etiqueta "Nv"). Las habilidades más
    caras (Doble daño, Alta magia, Avatar, Zeón ilimitado...) están en el centro de la hoja con Nv 9-10, y el nivel
    crece al alejarse de las cajas sin Nv: se avanza desde ellas hacia dentro por cajas conectadas.
  * Las aristas se dan sin dirección (una caja se puede tomar si tiene comprada alguna conectada); "nivel" es la
    distancia en saltos desde la raíz más cercana, solo para orientar el dibujo.
  Validación: las compras de las fichas de golden/ son conexas y contienen una raíz (se imprime al final).

Salida: src/data/metamagia-arbol.json  {nodos: [{c clave, n nombre, p coste, nv nivel mínimo|null, col, fila, raiz}],
                                       aristas: [[clave, clave]], raices: [clave],
                                       lineas: [{cajas: [clave], s: [[[fila, col], [fila, col]]]}]  (trazos para el dibujo)}
Uso: python tools/export_metamagia.py
"""
import glob
import json
import os
import re
import warnings

import openpyxl
from openpyxl.utils import column_index_from_string, get_column_letter

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def cajas():
    listas = json.load(open(os.path.join(ROOT, "src", "data", "listas.json"), encoding="utf-8"))
    out = []
    for k in listas:
        m = re.fullmatch(r"Metamagia!([A-Z]+)(\d+)", k)
        if m and k != "Metamagia!R6":
            out.append((k, column_index_from_string(m.group(1)), int(m.group(2))))
    return sorted(out, key=lambda x: (x[2], x[1]))


def segmentos(ws):
    """Bordes como segmentos de la retícula: ((fila, col), (fila, col)) con la esquina superior izquierda de la celda."""
    segs = set()
    for fila in ws.iter_rows():
        for cel in fila:
            b, r, c = cel.border, cel.row, cel.column
            if b.left.style: segs.add(((r, c), (r + 1, c)))
            if b.right.style: segs.add(((r, c + 1), (r + 1, c + 1)))
            if b.top.style: segs.add(((r, c), (r, c + 1)))
            if b.bottom.style: segs.add(((r + 1, c), (r + 1, c + 1)))
    return segs


def arbol(ws, cajas_):
    rect = {k: (f - 3, c - 1, f + 1, c + 1) for k, c, f in cajas_}   # esquinas: filas f-3..f+1, columnas c-1..c+1
    dentro = lambda p, q: q[0] <= p[0] <= q[2] and q[1] <= p[1] <= q[3]
    cables = [s for s in segmentos(ws) if not any(dentro(s[0], q) and dentro(s[1], q) for q in rect.values())]
    # agrupa cables por extremos compartidos (unión-búsqueda sobre puntos)
    padre = {}
    def raiz(p):
        while padre.setdefault(p, p) != p:
            p = padre[p]
        return p
    for a, b in cables:
        padre[raiz(a)] = raiz(b)
    grupos, trazos = {}, {}
    for a, b in cables:
        g = grupos.setdefault(raiz(a), set())
        trazos.setdefault(raiz(a), []).append([list(a), list(b)])
        for p in (a, b):
            g.update(k for k, q in rect.items() if dentro(p, q))
    aristas, lineas = set(), []
    for g, toca in grupos.items():
        t = sorted(toca)
        aristas.update((x, y) for i, x in enumerate(t) for y in t[i + 1:])
        if len(t) > 1:   # el marco, el cuadro de totales y las celdas de "Nv" no tocan dos cajas
            lineas.append({"cajas": t, "s": sorted(trazos[g])})
    return sorted(aristas), sorted(lineas, key=lambda l: l["cajas"])


def main():
    wb = openpyxl.load_workbook(os.path.join(ROOT, "golden", "lock.xlsm"))
    ws = wb["Metamagia"]
    cs = cajas()
    aristas, lineas = arbol(ws, cs)
    val = lambda c, f: ws.cell(f, c).value
    nodos = []
    for k, c, f in cs:
        nv = val(c + 1, f - 3)
        nodos.append({"c": k, "n": str(val(c - 1, f - 3)).strip(), "p": val(c + 1, f), "nv": nv if isinstance(nv, (int, float)) else None,
                      "col": c, "fila": f, "raiz": not isinstance(nv, (int, float))})
    raices = [n["c"] for n in nodos if n["raiz"]]
    salida = os.path.join(ROOT, "src", "data", "metamagia-arbol.json")
    with open(salida, "w", encoding="utf-8") as fh:
        json.dump({"nodos": nodos, "aristas": aristas, "raices": raices, "lineas": lineas}, fh, ensure_ascii=False, separators=(",", ":"))
    print(len(nodos), "nodos,", len(aristas), "aristas,", len(raices), "raíces ->", os.path.relpath(salida, ROOT))
    validar(nodos, aristas)


def validar(nodos, aristas):
    vecinos = {n["c"]: set() for n in nodos}
    for a, b in aristas:
        vecinos[a].add(b)
        vecinos[b].add(a)
    raices = {n["c"] for n in nodos if n["raiz"]}
    for ruta in sorted(glob.glob(os.path.join(ROOT, "golden", "*.xlsm"))):
        wb = openpyxl.load_workbook(ruta, data_only=True, read_only=True)
        if "Metamagia" not in wb.sheetnames:
            continue
        celdas = {f"Metamagia!{c.coordinate}": c.value for fila in wb["Metamagia"].iter_rows(max_row=66, max_col=37) for c in fila if hasattr(c, "coordinate")}
        compradas = {n["c"] for n in nodos if celdas.get(n["c"]) not in (None, "")}
        if not compradas:
            print(" ", os.path.basename(ruta), "sin compras")
            continue
        vistos, pila = set(), [next(iter(compradas))]
        while pila:
            x = pila.pop()
            if x not in vistos:
                vistos.add(x)
                pila += [y for y in vecinos[x] if y in compradas]
        ok = vistos == compradas and compradas & raices
        print(" ", os.path.basename(ruta), "OK" if ok else "NO VÁLIDO", sorted(compradas))


if __name__ == "__main__":
    main()
