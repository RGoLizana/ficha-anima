"""Pruebas de las herramientas que transforman el Excel. Uso: npm run test:tools  (python -m unittest discover -s tools)"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import openpyxl  # noqa: E402
from export_formulas import adaptar_lista, fix, narrow  # noqa: E402
from extract import trasladar  # noqa: E402
from migrate import RENAMES, moved, row_map  # noqa: E402
from pdf_layout import calibrate, pdf_size  # noqa: E402

NAMES = {"tabla_combate": "Combate!$AW$30:$BF$46", "nephilim": "General!$J$23", "bonos": "Tablas!$K$130:$AB$131",
         "elan!cercanía_dragón": "Elan!$U$10:$Y$12", "cercanía_dragón": "Personalización!$C$40:$G$42"}


class Estrechar(unittest.TestCase):
    """tools/export_formulas.narrow: reescrituras que hacen que el motor calcule como Excel."""

    def n(self, f, sheet="Principal", consts=None):
        return narrow(f, sheet, NAMES, consts or {})

    def test_vlookup_exacta_columna_fija(self):
        self.assertEqual(self.n("=VLOOKUP(A1,Tablas!$C$14:$D$33,2,FALSE)"),
                         "=INDEX('Tablas'!$D$14:$D$33,MATCH(A1,'Tablas'!$C$14:$C$33,0))")

    def test_vlookup_aproximada_usa_matchapprox(self):
        self.assertEqual(self.n("=VLOOKUP(G11,Tablas!$C$14:$D$33,2)"),
                         "=INDEX('Tablas'!$D$14:$D$33,MATCHAPPROX(G11,'Tablas'!$C$14:$C$33,1))")

    def test_vlookup_aproximada_sobre_textos_desordenados_es_exacta(self):
        consts = {("Tablas", "C1"): "Aire", ("Tablas", "C2"): "Agua", ("Tablas", "C3"): "Fuego"}
        self.assertIn("MATCH(X,'Tablas'!$C$1:$C$3,0)", self.n("=VLOOKUP(X,Tablas!$C$1:$D$3,2)", consts=consts))

    def test_vlookup_columna_variable_aproximada(self):
        self.assertEqual(self.n("=VLOOKUP(O15,Tablas!$D$198:$CI$223,MATCH(E1,Tablas!$D$201:$CI$201,0))"),
                         "=INDEX(Tablas!$D$198:$CI$223,MATCHAPPROX(O15,'Tablas'!$D$198:$D$223,1),"
                         "MATCH(E1,Tablas!$D$201:$CI$201,0))")

    def test_vlookup_columna_variable_exacta_no_se_toca(self):
        f = "=VLOOKUP(H1,$G$2033:$J$2038,G1+1,0)"
        self.assertEqual(self.n(f, "Tablas"), f)

    def test_hlookup_es_index_de_fila(self):
        self.assertEqual(self.n('=HLOOKUP("Natura",Bonos,2,FALSE)'),
                         "=INDEX('Tablas'!$K$131:$AB$131,1,MATCH(\"Natura\",'Tablas'!$K$130:$AB$130,0))")

    def test_index_columna_fija_y_celda(self):
        self.assertEqual(self.n("=INDEX(Tabla_Combate,,2)"), "='Combate'!$AX$30:$AX$46")
        self.assertEqual(self.n("=INDEX(Tabla_Combate,4,2)"), "='Combate'!$AX$33")

    def test_index_con_fila_en_celda_constante(self):
        consts = {("Combate", "AT40"): 11}
        self.assertEqual(self.n("=INDEX(Tabla_Combate,$AT$40,AW39)", "Combate", consts),
                         "=INDEX('Combate'!$AW$40:$BF$40,1,AW39)")

    def test_index_de_una_fila_con_un_indice_es_columna(self):
        self.assertEqual(self.n("=INDEX($I$6:$R$6,3)", "Tablas psiquica"), "=INDEX($I$6:$R$6,1,3)")

    def test_column_de_index(self):
        self.assertEqual(self.n("=COLUMN(INDEX('Tablas'!$AN$850:$AP$850,1,$AL850))", "Tablas"), "=(40+($AL850)-1)")

    def test_match_aproximado(self):
        self.assertEqual(self.n("=MATCH(A1,B1:B9)"), "=MATCHAPPROX(A1,B1:B9)")
        self.assertEqual(self.n("=MATCH(A1,B1:B9,1)"), "=MATCHAPPROX(A1,B1:B9,1)")
        self.assertEqual(self.n("=MATCH(A1,B1:B9,0)"), "=MATCH(A1,B1:B9,0)")

    def test_nombres_de_rango_se_sustituyen_y_respetan_el_ambito_de_hoja(self):
        self.assertEqual(self.n('=IF(Nephilim<>"",1,0)'), "=IF('General'!$J$23<>\"\",1,0)")
        self.assertEqual(self.n('=COUNTIF(Cercanía_Dragón,"x")', "Elan"), "=COUNTIF('Elan'!$U$10:$Y$12,\"x\")")
        self.assertEqual(self.n('=COUNTIF(Cercanía_Dragón,"x")'), "=COUNTIF('Personalización'!$C$40:$G$42,\"x\")")

    def test_comillas_escapadas(self):
        self.assertEqual(self.n('=IF(A1,"x","""")'), '=IF(A1,"x",(""&CHAR(34)&""))')

    def test_matrices_constantes_intactas(self):
        self.assertEqual(self.n("=IF(A1={1,2;3,4},1,0)"), "=IF(A1={1,2;3,4},1,0)")


class Arreglar(unittest.TestCase):
    def test_true_false_como_funcion_salvo_en_textos(self):
        f = fix('=IF(A1=TRUE,"TRUE",FALSE)', "H", {})
        self.assertEqual(f, '=IF(A1=TRUE(),"TRUE",FALSE())')

    def test_quita_prefijos_xlfn(self):
        self.assertEqual(fix("=_xlfn.TEXTJOIN(\",\",TRUE,A1:A3)", "H", {}), '=TEXTJOIN(",",TRUE(),A1:A3)')

    def test_lista_de_desplegable_conserva_indirect(self):
        self.assertEqual(adaptar_lista("INDIRECT($AN$32)", "Principal", NAMES, {}), "INDIRECT($AN$32)")
        self.assertEqual(adaptar_lista("IF(A1=TRUE,Nephilim,\"\")", "Principal", NAMES, {}),
                         "IF(A1=TRUE(),'General'!$J$23,\"\")")


class Listas(unittest.TestCase):
    def test_trasladar_formulas_relativas(self):
        self.assertEqual(trasladar("INDIRECT($AK13)", "AG13", "AG14"), "INDIRECT($AK14)")
        self.assertEqual(trasladar("L43", "M43", "O44"), "N44")
        self.assertEqual(trasladar("$A$1", "B2", "C9"), "$A$1")


class Migracion(unittest.TestCase):
    def libro(self, filas):
        wb = openpyxl.Workbook()
        ws = wb.active
        for r, etiquetas in enumerate(filas, 1):
            for c, t in enumerate(etiquetas, 1):
                if t:
                    ws.cell(r, c, t)
        return ws

    def test_empareja_filas_por_etiqueta_aunque_se_inserten_filas(self):
        viejo = self.libro([["Nombre"], ["Raza"], ["Nivel"]])
        nuevo = self.libro([["Nombre"], ["Nuevo campo"], ["Raza"], ["Nivel"]])
        self.assertEqual(row_map(viejo, nuevo), {1: 1, 2: 3, 3: 4})

    def test_bloques_movidos_por_version(self):
        self.assertEqual(moved("8.5.0", "PDs", 5, 16), (7, 15))  # categoría P5 -> O7
        self.assertEqual(moved("8.4.3", "Personalización", 25, 3), (30, 3))
        self.assertIsNone(moved("8.7.0", "PDs", 5, 16))

    def test_opciones_renombradas(self):
        self.assertEqual(RENAMES["Si"], "Sí")


class Pdf(unittest.TestCase):
    def test_tamano_de_letra_como_excel(self):
        for pt, esperado in [(10, 9.36), (9, 8.4), (8, 7.56), (12, 11.28), (6, 5.64), (14, 13.2), (16, 15.0)]:
            self.assertAlmostEqual(pdf_size(pt), esperado, places=2)

    def test_calibrado_engancha_bordes_e_interpola(self):
        bounds = [0, 10, 20, 30]
        edges = [5.0, 12.4, 26.9]  # la frontera 20 no tiene borde: se interpola
        self.assertEqual(calibrate(bounds, edges, 5.0, 0.742), [5.0, 12.4, 19.65, 26.9])


if __name__ == "__main__":
    unittest.main()
