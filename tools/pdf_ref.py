"""Genera con Excel (macros de la ficha 8.7.0) el PDF de referencia de cada ficha golden.
Es lo mismo que hace el botón "Exportar PDF", sin el diálogo de guardar.
Uso: python tools/pdf_ref.py   -> ref/pdf/<ficha>.pdf
"""
import os
import shutil
import sys
import tempfile
import win32com.client
from migrate import FICHAS, OUT, ROOT


def export(name, dst):
    tmp = os.path.join(tempfile.mkdtemp(), name + ".xlsm")  # copia: las macros crean/borran hojas
    shutil.copyfile(os.path.join(OUT, name + ".xlsm"), tmp)
    xl = win32com.client.DispatchEx("Excel.Application")
    xl.Visible = True  # las macros copian/pegan con la selección: con Excel oculto fallan
    xl.DisplayAlerts = False
    xl.AutomationSecurity = 1  # macros activadas: es la propia plantilla de la ficha
    try:
        wb = xl.Workbooks.Open(tmp)
        def run(macro):
            print("  ", macro, flush=True)
            xl.Run(f"'{wb.Name}'!{macro}")
        run("deletePDF")
        run("FillPDFResumen")
        sheets = ["PDF"]
        for flag, macro, sheet in [("MostrarSheele", "FillPDFSheele", "PDFSheele"),
                                   ("MostrarEquipo", "FillPDFEquipo", "PDFEquipo"),
                                   ("MostrarNotasPag", "FillPDFNotes", "PDFNotas")]:
            if wb.Names(flag).RefersToRange.Value:
                run(macro)
                sheets.append(sheet)
        wb.Worksheets(sheets).Select()
        xl.ActiveSheet.ExportAsFixedFormat(Type=0, Filename=dst, Quality=0, IncludeDocProperties=False,
                                           IgnorePrintAreas=False, OpenAfterPublish=False)
        wb.Close(False)
        print(f"{name}: {', '.join(sheets)} -> {os.path.relpath(dst, ROOT)}")
    finally:
        xl.Quit()


if __name__ == "__main__":
    out = os.path.join(ROOT, "ref", "pdf")
    os.makedirs(out, exist_ok=True)
    for name in sys.argv[1:] or list(FICHAS):
        export(name, os.path.join(out, name + ".pdf"))
