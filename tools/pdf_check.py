"""Compara el PDF de la web con el del Excel, palabra por palabra.
Imprime ref/pdf/web/<ficha>.html a PDF con Edge (sin ventana) y mide la distancia de cada palabra
a su homóloga en el PDF exportado por el Excel.
Uso: python tools/pdf_check.py   (antes: python tools/pdf_layout.py)
"""
import os
import subprocess
import pdfplumber
from migrate import ROOT

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
FICHAS = {"sesshomaru": "Sesshomaru.pdf", "lock": "Lock.pdf", "ayane": "Ayane Akame.pdf"}


def print_pdf(html_path, pdf_path):
    subprocess.run([EDGE, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf_path}", "file:///" + html_path.replace("\\", "/")],
                   check=True, capture_output=True, timeout=120)


def words(path):
    with pdfplumber.open(path) as pdf:
        return [p.extract_words(extra_attrs=["size", "fontname"]) for p in pdf.pages]


def compare(excel, web, tol=1.5):
    worst, missing, total = [], [], 0
    for n, (pe, pw) in enumerate(zip(excel, web)):
        pool = list(pw)
        for w in pe:
            total += 1
            cands = [x for x in pool if x["text"] == w["text"]]
            if not cands:
                missing.append((n + 1, w["text"], round(w["x0"]), round(w["top"])))
                continue
            x = min(cands, key=lambda x: abs(x["x0"] - w["x0"]) + abs(x["top"] - w["top"]))
            pool.remove(x)
            d = max(abs(x["x0"] - w["x0"]), abs(x["top"] - w["top"]))
            if d > tol:
                worst.append((round(d, 1), n + 1, w["text"], round(w["x0"], 1), round(w["top"], 1), round(x["x0"], 1), round(x["top"], 1)))
    return total, sorted(worst, reverse=True), missing


def main():
    for name, ref in FICHAS.items():
        html_path = os.path.join(ROOT, "ref", "pdf", "web", name + ".html")
        out = os.path.join(ROOT, "ref", "pdf", "web", name + ".pdf")
        print_pdf(html_path, out)
        total, worst, missing = compare(words(os.path.join(ROOT, "ref", "pdf", ref)), words(out))
        print(f"== {name}: {total} palabras, {len(worst)} desplazadas >1.5pt, {len(missing)} sin encontrar")
        for w in worst[:12]:
            print("   desplazada", w)
        for m in missing[:12]:
            print("   falta", m)


if __name__ == "__main__":
    main()
