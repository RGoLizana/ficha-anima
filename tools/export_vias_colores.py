"""Extrae del Excel los colores de cada vía de magia: las reglas de formato condicional de la hoja 'Grimorio de Vía'
(celda C22, regla M22="<vía>") dan el relleno (uno o dos colores si es degradado) y el color de texto de cada vía.
Los colores de tema se resuelven con la paleta de xl/theme/theme1.xml y su tinte. Lo que el Excel no colorea
(p. ej. Libre acceso) no aparece y la web lo pinta en neutro.

Salida: src/data/vias-colores.json
  { vía: { f: [hex de relleno, 1 o 2 colores], t: hex de texto o null } }
Uso: python tools/export_vias_colores.py [ficha.xlsm]   (por defecto golden/lock.xlsm; solo hace falta para regenerar)
"""
import colorsys
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOJA = "xl/worksheets/sheet22.xml"  # Grimorio de Vía
CELDA = "C22"
# orden de índices de tema de Excel: lt1, dk1, lt2, dk2, accent1..6
TEMA = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6"]


def paleta(z):
    xml = z.read("xl/theme/theme1.xml").decode("utf-8")
    p = {}
    for n in TEMA:
        m = re.search(rf"<a:{n}>.*?(?:srgbClr val|lastClr)=\"([0-9A-Fa-f]{{6}})\"", xml, re.S)
        p[n] = m.group(1).upper()
    return [p[n] for n in TEMA]


def con_tinte(hexa, tinte):
    r, g, b = (int(hexa[i:i + 2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = l * (1 + tinte) if tinte < 0 else l * (1 - tinte) + tinte
    return "#" + "".join(f"{round(c * 255):02X}" for c in colorsys.hls_to_rgb(h, l, s))


def color(tag, pal):
    """<color .../> o <bgColor .../> -> '#RRGGBB' (None si es 'auto' o no hay)."""
    m = re.search(r'rgb="FF([0-9A-F]{6})"', tag)
    if m:
        return "#" + m.group(1)
    m = re.search(r'theme="(\d+)"', tag)
    if m:
        t = re.search(r'tint="([-0-9.E]+)"', tag)
        return con_tinte(pal[int(m.group(1))], float(t.group(1)) if t else 0.0)
    return None


def main():
    ficha = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "golden", "lock.xlsm")
    z = zipfile.ZipFile(ficha)
    pal = paleta(z)
    estilos = z.read("xl/styles.xml").decode("utf-8")
    dxfs = re.findall(r"<dxf>.*?</dxf>", re.search(r"<dxfs.*?</dxfs>", estilos, re.S).group(0), re.S)
    hoja = z.read(HOJA).decode("utf-8")
    bloque = re.search(rf'<conditionalFormatting sqref="{CELDA}">.*?</conditionalFormatting>', hoja, re.S).group(0)
    vias = {}
    for dxf, formula in re.findall(r'<cfRule[^>]*dxfId="(\d+)"[^>]*><formula>(.*?)</formula>', bloque):
        m = re.fullmatch(r'M\d+="(.+)"', formula)
        if not m:
            continue
        d = dxfs[int(dxf)]
        relleno = re.search(r"<fill>.*?</fill>", d, re.S).group(0)
        f = [color(c, pal) for c in re.findall(r"<(?:bgColor|color) [^>]*/>", relleno)]
        fuente = re.search(r"<font>.*?</font>", d, re.S)
        t = color(re.search(r"<color [^>]*/>", fuente.group(0)).group(0), pal) if fuente and "<color" in fuente.group(0) else None
        vias[m.group(1)] = {"f": [c for c in f if c], "t": t}
    salida = os.path.join(ROOT, "src", "data", "vias-colores.json")
    with open(salida, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(vias.items())), fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(len(vias), "vías ->", os.path.relpath(salida, ROOT))


if __name__ == "__main__":
    main()
