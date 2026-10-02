"""Compara los valores calculados de la hoja Resumen: ficha original vs golden migrada a 8.7.0.
Uso: python tools/compare.py [nombre ...]
"""
import os
import sys
import openpyxl
from migrate import FICHAS, OUT, row_map

SHEETS = ["Resumen", "Principal", "Combate"]


def main(names):
    for name in names:
        old_f = openpyxl.load_workbook(FICHAS[name])           # fórmulas, para emparejar filas
        old_v = openpyxl.load_workbook(FICHAS[name], data_only=True)
        new_f = openpyxl.load_workbook(os.path.join(OUT, name + ".xlsm"))
        new_v = openpyxl.load_workbook(os.path.join(OUT, name + ".xlsm"), data_only=True)
        print(f"== {name}")
        for sheet in SHEETS:
            rm = row_map(old_f[sheet], new_f[sheet])
            same = diff = 0
            for row in old_v[sheet].iter_rows(max_col=39):
                for c in row:
                    if c.value in (None, "") or c.row not in rm:
                        continue
                    nv = new_v[sheet].cell(rm[c.row], c.column).value
                    if nv == c.value:
                        same += 1
                    else:
                        diff += 1
                        print(f"   {sheet}!{c.coordinate}: {str(c.value)[:50]!r} -> {str(nv)[:50]!r}")
            print(f"   -- {sheet}: {same} iguales, {diff} distintos")


if __name__ == "__main__":
    main(sys.argv[1:] or list(FICHAS))
