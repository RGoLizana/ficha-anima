"""Exporta al compendio la convocatoria: Arcanos, otras invocaciones, reglas resumidas y tablas.

Salida: src/data/convocatoria.json
  Cada bloque lleva `fuente` (hoja/celdas del Excel o capítulo/página del libro oficial).
  Las cifras de dificultad, zeón, costes en PD y costes de poderes salen SIEMPRE de la plantilla (public/plantilla.json,
  copia de la ficha Excel 8.7.0): si el libro y el Excel chocan, manda el Excel.
  Del Core Exxet (cap. 12 «La Convocatoria», p. 194-209 del libro = PDF 196-211) salen los textos de reglas, resumidos
  a mano en una o dos frases con sus cifras (no se copia el libro). Lo que no se ha podido verificar queda a null.
  Solo libros oficiales: Core Exxet y Arcana Exxet (convocatoria en masa e invocadores). Nada fanmade.
Uso: python tools/export_convocatoria.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = "Core Exxet, cap. 12 «La Convocatoria»"
ARCANA = "Arcana Exxet"

# Grandes Bestias del índice de Arcana Exxet, cap. 5 (p. 58-71). Las demás de la lista del Excel (Rudraskha, Zvilpogghua,
# Vilfain) no aparecen como invocación en los libros oficiales consultados (Core, Arcana, Dominus, Gaïa 1 y 2, Prometeus):
# se dejan con libro = null (no verificado). Las Encarnaciones están todas en el cap. 6 (p. 72-87).
BESTIAS_ARCANA = ("Hermod", "Enamon", "Naaga", "Huginn", "Idea", "Galgaliel", "Lix Tetrax", "Garuda", "Raksasha", "Idún", "Ethelthryth", "Eir", "Veles",
                  "Thanathos", "Caronte", "Pandora", "Kagutsuchi", "Forseti", "Druaga", "Behemoth", "Leviathan", "Ziz", "Seiryu", "Genbu", "Suzaku", "Byakko",
                  "Kirin", "El Vendedor", "Tawil")

# ---- Arcanos (Core p. 200-209, PDF 202-211): acción, HA, HD, duración, efecto y pacto resumidos ----
# La dificultad y el zeón NO están aquí: se leen del Excel (Tablas!AB1066:AD1109).
D10 = "por cada 10 que supere la dificultad"
PUROS = [
    ("0", "Activa", None, None, f"1 hora {D10}", "Anula todo bonificador o penalizador (rituales, efectos sobrenaturales) a las invocaciones posteriores del invocador: solo cuenta su habilidad.", "Iniciar y cumplir un pacto con otro Arcano."),
    ("I", "Pasiva (variable)", "120", "120", f"Instantáneo; el conjuro, si es mantenido, dura 1 asalto {D10}", "Lanza cualquier conjuro de libre acceso de nivel 50 o menos, en su grado base y sin añadidos. Si el conjuro es activo, espera a la acción del invocador.", "Alcanzar la maestría en una habilidad."),
    ("II", "Pasiva", None, "160", f"1 asalto {D10}", "Escudo de luz que defiende con la habilidad de la Sacerdotisa y resiste 800 puntos de daño, +100 por cada 10 sobre la dificultad.", "Resolver sin ayuda un acertijo que ella plantea."),
    ("III", "Pasiva", None, None, f"1 asalto {D10}", "+20 a todas las Resistencias del invocador o de quien designe, +10 más por cada 10 sobre la dificultad.", "Proteger de por vida a una persona débil y cercana que ella elige."),
    ("IV", "Activa", "120", None, "Instantáneo", "Un guerrero ataca con daño base 60 en Filo, Contundente o Penetrante; aparece uno más por cada 10 sobre la dificultad.", "Convertirse en un líder al que siga por voluntad propia un grupo numeroso."),
    ("V", "Activa", "160", None, f"1 minuto {D10}", "Descarga de energía (como conjuro de Ataque) con daño base 100, doble contra seres de oscuridad o malignos; puede esperar junto al invocador antes de atacar.", "Expiar o recibir el perdón por todos sus pecados."),
    ("VI", "Pasiva", None, None, f"1 asalto {D10}", "Quien declare un ataque contra el invocador debe superar una RM o RP contra 140 o no puede atacarle (efecto automático).", "Encontrar a alguien con quien compartir la vida y amarle por encima de todo."),
    ("VII", "Pasiva", None, "200", f"1 asalto {D10}", "Usa su defensa como esquiva del invocador y nunca sufre penalizadores por el área de los ataques.", "Viajar a un lugar muy lejano que nunca haya visitado."),
    ("VIII", "Activa", "200", None, "Instantáneo", "Ataque físico en Energía con daño base 100, +10 por cada 10 sobre la dificultad.", "Vencer con sus propios medios a la entidad que trae (normalmente de nivel 6 o menos)."),
    ("IX", "Pasiva", None, None, f"1 asalto {D10}", "El invocador se defiende como un ser con acumulación: 1.000 PV adicionales con TA 6, +100 por cada 10 sobre la dificultad; renuncia a sus otras defensas.", "Resolver de forma pacífica un conflicto concreto."),
    ("X", "Pasiva (variable)", "Variable", "Variable", "Variable", "Invoca otro Arcano al azar (Tabla 67 del Core) y le aplica el margen obtenido sobre la dificultad de La Rueda.", "La Rueda acepta o rechaza el pacto al azar."),
    ("XI", "Pasiva", "Variable", "240", "Instantáneo", "Contraataca con su defensa (escudo mágico) y devuelve un ataque del asalto con su habilidad y daño originales; uno más por cada 10 sobre la dificultad. Si no lo para, el invocador no suma defensa.", "Juzgar una situación difícil e impedir una injusticia."),
    ("XII", "Activa", "240+", None, "Instantáneo", "Descarga de energía (como conjuro de Ataque) con daño base igual a 4 veces los PV que sacrifica el invocador; +5 a la HA por cada 10 sobre la dificultad.", "Arriesgar de verdad la vida de forma heroica."),
    ("XIII", "Activa", None, None, "Instantáneo", "Cura por completo al invocador o a quien designe: regenera todo daño (incluso miembros) y anula penalizadores y efectos sobrenaturales perjudiciales.", "Superar por sí mismo el estado entre la vida y la muerte."),
    ("XIV", "Activa", None, None, f"1 día {D10}", "Suma 100 al margen sobre la dificultad de cualquier otra invocación, incluidos los Arcanos invertidos.", "Llegar a nivel 6-8 (subiendo al menos uno desde que se propone el pacto)."),
    ("XV", "Activa", "300", "300", f"5 asaltos {D10}", "El invocador ataca y defiende con 300 (parada sobrenatural o esquiva); el ataque tiene daño base 80 en Filo, Contundente o Penetrante. Los contraataques le alcanzan a él.", "Impedir que cierto invocador selle un pacto con un Arcano invertido."),
    ("XVI", "Activa", "320", None, f"1 día {D10}", "Ataque como conjuro Anímico; si daña, RM contra 160 o se pierden temporalmente todas las capacidades sobrenaturales, mágicas, psíquicas y de Ki.", "Matar al actual poseedor de la invocación (solo hay uno a la vez)."),
    ("XVII", "Pasiva", None, "350+", f"5 asaltos {D10}", "Barrera indestructible (escudo mágico) con defensa 350, +10 por cada 10 sobre la dificultad.", "Erigir un símbolo de esperanza para un pueblo o etnia."),
    ("XVIII", "Activa", "350", None, f"1 asalto {D10}", "Quien esté a 100 m y falle una RM contra 160 (Anímico) queda a merced del invocador, que puede cambiar su estado o transformarlo, sin matarlo.", "Proponerle un enigma que no resuelva o vencerla en ingenio."),
    ("XIX", "Activa", "300", None, "Instantáneo", "Descarga de calor contra uno o varios blancos en 100 m, daño base 300 +10 por cada 10 sobre la dificultad; permite elegir blancos.", "Sobrevivir a su ataque."),
    ("XX", "Activa", None, None, "Instantáneo", "Devuelve todo lo que hay a 1 km a como estaba hasta 1 minuto antes (+1 minuto por cada 10 sobre la dificultad); no deshace actos de seres con Gnosis superior a 40.", "Superar su juicio sobre su vida; si falla, RM contra 160 o desaparece."),
    ("XXI", "Activa", None, None, f"1 minuto {D10}", "Inmunidad total a daño y efectos perjudiciales y éxito automático en controles enfrentados que no sean de conocimiento; no afecta a seres con Gnosis superior a 40.", "Haber logrado todos los objetivos que se marcó en la vida."),
]
INVERTIDOS = [
    ("0", "Activa", None, None, f"1 minuto {D10}", "Las invocaciones realizadas en su presencia sufren −50 a la habilidad final.", "Pedir un pacto a un Arcano y fracasar al sellarlo."),
    ("I", "Activa", "140", None, f"1 asalto {D10}", "Descarga de energía oscura (como conjuro de Ataque) con daño base 100; puede esperar junto al invocador mientras dure.", "Convocar una criatura y dejarla libre sin controlarla."),
    ("II", "Activa", "160", None, "Instantáneo", "Ataque de energía oscura en 20 m de radio (como conjuro de Ataque), daño base 80; +10 m por cada 10 sobre la dificultad. No permite elegir blancos.", "Destruir un objeto o criatura sobrenatural."),
    ("III", "Activa", "160", None, f"1 asalto {D10}", "Ataque Anímico en Energía; si afecta, RM contra 120 (+5 por cada 10 sobre la dificultad) o repite cada asalto la misma acción activa.", "Destruir sus obras y matar a su descendencia."),
    ("IV", "Activa", "180", None, f"5 asaltos de dominio {D10}", "Ataque Anímico en Energía; si afecta, RM o RP contra 140 o obedece ciegamente al invocador (nueva tirada ante órdenes contrarias a su naturaleza).", "Reducir a la esclavitud a varias personas libres."),
    ("V", "Pasiva", None, "180", "Instantáneo", "Escudo mágico de Oscuridad que defiende con su habilidad y resiste 1.000 puntos de daño, +100 por cada 10 sobre la dificultad.", "Fundar y liderar una secta engañosa."),
    ("VI", "Activa", "200", None, "Instantáneo", "Ataque Anímico; si afecta, RM contra 120 (+5 por cada 10) o pierde tantos PV y Zeon como el fallo, que absorbe el invocador.", "Sacrificar aquello que más quiere."),
    ("VII", "Activa", "220", None, "Instantáneo", "Ataque Anímico; si afecta, RM contra 160 o es enviado a un lugar al azar a 100 km (+100 km por cada 10). Se puede usar sobre uno mismo.", "Regresar del lugar lejano al que le envía y volver a invocarlo."),
    ("VIII", "Activa", "220", None, f"1 asalto {D10}", "Ataque Contundente cada asalto con daño base 100, +20 acumulativo cada vez que no causa daño; si no tiene a quién atacar, ataca al invocador.", "Iniciar las peleas que le susurra hasta que quede satisfecha."),
    ("IX", "Activa", None, None, "Instantáneo", "Ataque Anímico en Energía; RM contra 140 (+5 por cada 10) o queda aislado en la Vigilia 1 minuto por cada punto de fallo.", "Vivir solo al menos un año sin ver a ningún ser vivo."),
    ("X", "Activa", "240", None, "Instantáneo", "Ataque sobrenatural en 100 m de radio; RM contra 120 (+5 por cada 10) o se pierde para siempre un nivel, más uno por cada 40 de fallo.", "Romper al azar uno de sus pactos (necesita tener al menos cuatro)."),
    ("XI", "Activa", "240", None, f"Los poderes quedan drenados 1 minuto {D10}", "Ataque Anímico; RM contra 140 o pierde temporalmente sus habilidades de combate, sobrenaturales o psíquicas, que pasan al invocador.", "Cometer actos injustos que causen un caos masivo."),
    ("XII", "Activa", "260", None, "Instantáneo", "Ataque sobrenatural a blancos en 50 m; RM contra 140 (+5 por cada 10) o penalizador a toda acción igual al fallo (se recupera a 10 por hora; de por vida si falla por más de 80).", "Sufrir Dolor intenso (−80) hasta que alguien acepte cargar con él para siempre."),
    ("XIII", "Activa", "240+", None, "Instantáneo", "Ataque Anímico cuerpo a cuerpo, visible para cualquiera; RM contra 140 o muere. +10 a la HA por cada 10 sobre la dificultad.", "Causar sin motivo una masacre (normalmente de 50 personas o más)."),
    ("XIV", "Pasiva", None, "280", f"Escudo instantáneo; el poder detenido queda disperso 1 día {D10}", "Escudo de 500 puntos que solo para daño sobrenatural; si detiene un poder, el atacante hace RM contra 160 o pierde temporalmente ese tipo de poder.", "Perder dos niveles de experiencia."),
    ("XV", "Activa", "300", None, f"10 asaltos {D10}", "RM contra 140 (Anímico) o queda poseído y ataca a sus allegados con HA 300 sin defenderse; si muere, salta a su asesino. Acaba cuando alguien supera la RM.", "Cometer un acto de pura maldad."),
    ("XVI", "Activa", "300", None, "Instantáneo", "Ataque Anímico en Energía; si daña, 13 RM contra 120 (estados del cap. 14) más veneno y enfermedad de nivel 60 (+5 por cada 10); las superadas rebotan al invocador.", "Matar a quien posee la invocación oscura."),
    ("XVII", "Activa", "320", None, f"5 asaltos {D10}", "Descarga de energía oscura (como conjuro de Ataque) con daño base 200, y otra cada asalto; ese daño solo se cura con poderes místicos.", "Destruir la esperanza de un país o etnia."),
    ("XVIII", "Activa", None, "350", f"1 asalto {D10}", "Usa su defensa como esquiva del invocador y crea una imagen ilusoria suya por cada defensa con éxito (distinguirla: Inhumano en Buscar o Detección de Ki).", "Urdir una mentira capaz de engañar a una nación."),
    ("XIX", "Activa", "350", None, "Instantáneo", "Descarga de calor con daño base 300 en un área de 500 m (+500 m por cada 10 sobre la dificultad); no permite elegir blancos.", "Sobrevivir un día perdiendo 1 PV por asalto, que solo recupera matando."),
    ("XX", "Activa", None, None, f"1 minuto {D10}", "Reduce a 0 el Gnosis de las entidades a 1 km (salvo el suyo; no afecta a Gnosis 45 o más); efecto automático.", "Aceptar la condena que dicte su mayor enemigo."),
    ("XXI", "Activa", None, None, f"1 minuto {D10}", "En 1 km (+1 km por cada 10) todos pifian cada tirada; anula a otros Arcanos, no afecta a Gnosis superior a 45 y se anula con El Mundo puro.", "Haber fracasado y perdido todo, y fracasar al invocarlo."),
]

HABILIDADES = [
    {"n": "Convocar", "car": "POD", "resumen": "Llama a un ser sobrenatural de una tipología decidida de antemano, que aparece en el asalto siguiente. Sin conocer bien el tipo de criatura: −50."},
    {"n": "Dominar", "car": "VOL", "resumen": "Somete a un ser presente, que no puede negarse a ninguna orden. Puede intentar liberarse cada hora o ante órdenes contrarias a su naturaleza (nuevo control sin gastar Zeon)."},
    {"n": "Atar", "car": "POD", "resumen": "Encierra al ser en un objeto o ser vivo de presencia igual o mayor (un ser vivo, hasta el doble de la suya). Mantenerlo cuesta cada día el Zeon de la atadura; atado es inmune a otras habilidades y no sube de nivel."},
    {"n": "Desconvocar", "car": "POD", "resumen": "Expulsa al ser al flujo de almas; el margen sobre la dificultad son los días que tarda en poder volver por sí mismo."},
]
REGLAS = [
    ("Desarrollo", "Se desarrollan como las secundarias: base mínima de 5 puntos y maestría posible."),
    ("Uso", "Siempre son acciones activas con turno +20; se pueden usar varias en un asalto sin penalizador, pero solo un control de cada una por turno."),
    ("Enfrentadas", "Gana el resultado más alto. Convocar se opone a Convocar y Desconvocar; Dominar solo a sí misma. Un ser atado no puede ser convocado, dominado ni desconvocado."),
    ("Varios seres", "Convocar, Dominar o Desconvocar a un grupo de la misma clase: −50 y una sola tirada, pagando el Zeon de cada ser. Atar siempre es uno a uno."),
    ("Gnosis", "Gnosis superior a 30: no puede ser dominado; superior a 35: no puede ser atado; superior a 40: no puede ser convocado ni desconvocado sin su consentimiento."),
    ("Resistencia", "Los bonos especiales a la RM del ser (no su RM entera) se suman a la dificultad."),
    ("Círculo de convocadores", "Con habilidades a 50 puntos o menos entre sí y el mismo tiempo de ritual, el mejor suma +10 por cada otro miembro; el Zeon se reparte (mínimo 10 cada uno)."),
    ("Regeneración de seres atados", "No recuperan Zeon por sí mismos: absorben el que el convocador gasta a diario en la atadura."),
    ("Familiares", "Atar como si el ser tuviera dos niveles más y gastar diez veces el Zeon; el lazo consume a diario la mitad del coste de atar un ser de ese nivel. Presencias a 5 puntos o menos de diferencia."),
]
INVOCACION = [
    ("Pacto", "Se usa Convocar; al primer éxito la entidad propone un pacto. Cumplido, se la vuelve a llamar para sellarlo; pedirlo sin cumplirlo hace perder esa invocación para siempre."),
    ("Uso", "Cada uso exige superar su dificultad con Convocar y pagar su Zeon. Admite los bonos por tiempo (Tabla 65) pero no los de la Tabla 66. Turno +20; cada invocación es activa o pasiva según su naturaleza."),
    ("Margen", "Cuanto más se supere la dificultad, más potente es el efecto (casi siempre «por cada 10 que supere la dificultad»)."),
    ("Opuestos", "No se puede pactar con el Arcano opuesto a uno que ya se tiene (con La Justicia, nunca La Justicia invertida)."),
]
RITUALES = [("Inmediato", -100), ("Un asalto completo", -50), ("Tres asaltos", -20), ("Cinco asaltos", 0), ("Un minuto", 10), ("Una hora", 20),
            ("Seis horas", 30), ("Un día", 40), ("Una semana", 50), ("Un mes", 60), ("Seis meses", 70), ("Un año", 80), ("Cinco años", 90),
            ("Diez años", 100), ("Más de cincuenta años", 120)]
MODIFICADORES = [("Conocer el verdadero nombre del ser", 20), ("Tener una pertenencia suya", 10), ("Tener una parte de él", 20), ("No conocer el tipo de criatura (solo Convocar)", -50)]
# Tabla 64 (Core p. 194): nivel del ser -> [dificultad, zeón] de Convocar, Dominar, Atar, Desconvocar
TABLA64 = [
    (0, 140, 10, 180, 20, 160, 5, 100, 5), (1, 160, 20, 200, 40, 180, 10, 120, 5), (2, 180, 40, 220, 80, 200, 20, 140, 10),
    (3, 200, 60, 240, 120, 220, 30, 160, 15), (4, 220, 80, 260, 160, 240, 40, 180, 20), (5, 240, 100, 280, 200, 260, 50, 200, 25),
    (6, 260, 120, 300, 240, 280, 60, 220, 30), (7, 280, 140, 320, 280, 300, 70, 240, 40), (8, 300, 160, 340, 320, 320, 80, 260, 50),
    (9, 320, 180, 360, 360, 340, 90, 280, 60), (10, 340, 200, 380, 400, 360, 100, 300, 80), (11, 360, 220, 400, 440, 380, 120, 320, 100),
    (12, 380, 240, 420, 480, 400, 140, 340, 120), (13, 400, 260, 440, 520, 420, 160, 360, 140), (14, 420, 280, 460, 560, 440, 180, 380, 160),
    (15, 440, 300, 480, 600, 460, 200, 400, 180),
]
# Arcana Exxet, Tabla 2 (p. 10): seres afectados, diferencia de nivel requerida, niveles que sube la dificultad (y el Zeon se dobla)
MASA = [(2, 5, 1), (5, 6, 2), (10, 7, 3), (25, 8, 4), (50, 9, 5), (100, 10, 6), (250, 11, 7), (500, 12, 8), (1000, 13, 9)]
FRACASO = [
    ("−1 a −10", "No funciona; no se pierde Zeon."),
    ("−11 a −25", "No funciona y se pierde el Zeon."),
    ("−26 a −50", "No funciona y se pierde el doble de Zeon."),
    ("−51 a −75", "Convocar: aparece otro ser opuesto y de nivel superior, sin poder controlarlo ni atarlo (doble de Zeon). Dominar, Atar o Desconvocar: el ser se vuelve inmune a esa habilidad (doble de Zeon; al Atar, además, se liberan todos sus seres)."),
    ("−76 a −100", "El efecto se invierte: una horda opuesta (Convocar), el ser domina al convocador (Dominar), se liberan sus seres y ganan inmunidad (Atar) o aparecen más seres inmunes (Desconvocar). Cuádruple de Zeon."),
    ("Más de −100", "Consecuencias extremas: viajar ante una entidad opuesta, quedar dominado de por vida, ligar su destino al del ser o una legión inmune. Por lo general pierde todo su Zeon."),
]
ESPIRITUALES = {  # Core p. 313 (Habilidades espirituales, solo espíritus)
    "Interacción con el mundo": "Aun siendo inmaterial, puede tocar el mundo físico y atacar con sus armas naturales u objetos.",
    "Manifestación": "Se deja ver y oír por cualquiera cuando quiere, no solo por quien ve espíritus.",
    "Encarnación": "Se materializa a voluntad con forma corpórea; aun así solo le daña lo que puede dañar energía.",
}


def val(h, c):
    v = h.get(c)
    if isinstance(v, str):
        if v.startswith("="):
            return None
        return v[1:] if v.startswith("'") else v
    return v


def main():
    hojas = json.load(open(os.path.join(ROOT, "public", "plantilla.json"), encoding="utf-8"))["sheets"]
    t = hojas["Tablas"]

    arcanos = []
    for i, (r0, grupo, libro, pag) in enumerate([(1066, "Arcanos mayores", PUROS, "p. 200-205"), (1088, "Arcanos invertidos", INVERTIDOS, "p. 205-209")]):
        for k, (num, a, ha, hd, dur, e, pacto) in enumerate(libro):
            r = r0 + k
            arcanos.append({"n": val(t, f"AB{r}"), "g": grupo, "num": num, "dif": val(t, f"AC{r}"), "zeon": val(t, f"AD{r}"), "a": a, "ha": ha or "NA", "hd": hd or "NA",
                            "dur": dur, "e": e, "pacto": pacto, "libro": f"{CORE}, {pag}"})
    assert len(arcanos) == 44 and all(x["n"] and isinstance(x["dif"], int) and isinstance(x["zeon"], int) for x in arcanos)
    assert all(x["n"].endswith(("invertido", "invertida", "invertidos")) == (x["g"] == "Arcanos invertidos") for x in arcanos)

    otras, grupo = [], None
    for r in range(1110, 1232):
        n = val(t, f"AB{r}")
        if not n:
            continue
        if n.startswith(">"):
            grupo = {"> GRANDES BESTIAS": "Grandes bestias", "> ENCARNACIONES": "Encarnaciones"}[n.strip()]
            continue
        libro = f"{ARCANA}, cap. 6 «Encarnaciones»" if grupo == "Encarnaciones" else f"{ARCANA}, cap. 5 «Invocaciones»" if n.startswith(BESTIAS_ARCANA) else None
        otras.append({"n": n, "g": grupo, "num": None, "dif": val(t, f"AC{r}"), "zeon": val(t, f"AD{r}"), "a": None, "ha": None, "hd": None, "dur": None, "e": None, "pacto": None,
                      "libro": libro})
    # efectos resumidos de Arcana Exxet (cap. 5 Invocaciones y cap. 6 Encarnaciones), en tools/invocaciones.json; las que no aparecen en los libros quedan a null
    resumen = json.load(open(os.path.join(ROOT, "tools", "invocaciones.json"), encoding="utf-8")) if os.path.exists(os.path.join(ROOT, "tools", "invocaciones.json")) else {}
    for x in otras:
        x.update(resumen.get(x["n"], {}))
    assert all(isinstance(x["dif"], int) and isinstance(x["zeon"], int) for x in otras)

    pd = [{"cat": val(t, f"D{r}"), "c": [val(t, f"{c}{r}") for c in ("AA", "AB", "AC", "AD")]} for r in range(202, 224)]
    assert all(p["cat"] and all(isinstance(x, int) for x in p["c"]) for p in pd), pd

    espirituales = []
    for r in range(1535, 1538):
        n = val(t, f"O{r}").replace("Habilidades espirituales ", "")
        espirituales.append({"n": n, "coste": val(t, f"Q{r}"), "gnosis": val(t, f"P{r}"), "e": ESPIRITUALES[n]})

    out = {
        "arcanos": {"fuente": f"Excel Tablas!AB1066:AD1109 (nombre, dificultad, zeón); {CORE}, p. 200-209 (PDF 202-211) (resto)", "lista": arcanos},
        "otras": {"fuente": f"Excel Tablas!AB1110:AD1231 (nombre, dificultad, zeón). Efectos resumidos de {ARCANA}, cap. 5 y 6 (tools/invocaciones.json); Rudraskha, Zvilpogghua y Vilfain no aparecen en los libros oficiales consultados",
                  "lista": otras},
        "habilidades": {"fuente": f"{CORE}, p. 194-197 (PDF 196-199); característica según el libro; nombres del panel Místicos!J24:J29", "lista": HABILIDADES,
                        "reglas": [{"t": a, "e": b} for a, b in REGLAS]},
        "dificultades": {"fuente": f"{CORE}, Tabla 64, p. 194 (PDF 196); no está en el Excel", "cols": ["Convocar", "Dominar", "Atar", "Desconvocar"],
                         "filas": [{"nivel": f[0], "v": [[f[1], f[2]], [f[3], f[4]], [f[5], f[6]], [f[7], f[8]]]} for f in TABLA64]},
        "rituales": {"fuente": f"{CORE}, Tabla 65, p. 196 (PDF 198)", "filas": [{"t": a, "bono": b} for a, b in RITUALES]},
        "modificadores": {"fuente": f"{CORE}, Tabla 66, p. 197 (PDF 199)", "filas": [{"t": a, "bono": b} for a, b in MODIFICADORES]},
        "masa": {"fuente": f"{ARCANA}, Tabla 2, p. 10; nivel teórico en Excel Místicos!Q25 (nivel + ventaja Tablas!E395:E397)",
                 "nota": "La ficha calcula el nivel para convocar en masa como el nivel del personaje más la ventaja Convocador de masas (1, 2 o 3); un Invocador no puede.",
                 "filas": [{"seres": a, "dif_nivel": b, "sube": c} for a, b, c in MASA]},
        "especialidades": {"fuente": f"Excel Místicos!N27 y Q33; {CORE}, p. 198 (Elementalismo); {ARCANA}, p. 11 (Invocadores)", "lista": [
            {"n": "Elementalismo", "e": "+30 a toda habilidad de convocatoria sobre seres de su elemento, −30 sobre el resto y −60 sobre los del elemento opuesto. No se puede cambiar."},
            {"n": "Invocador", "e": "No puede convocar criaturas, pero paga la mitad del Zeon de cualquier invocación; ata, domina y desconvoca con normalidad."}]},
        "fracaso": {"fuente": f"{CORE}, Recuadro XI, p. 198 (PDF 200)", "filas": [{"nivel": a, "e": b} for a, b in FRACASO]},
        "invocacion": {"fuente": f"{CORE}, p. 199-200 (PDF 201-202)", "reglas": [{"t": a, "e": b} for a, b in INVOCACION]},
        "espirituales": {"fuente": "Excel Tablas!O1535:Q1537 (coste en PD y Gnosis); Core Exxet, cap. 26, p. 313 (PDF 315) (efecto)", "filas": espirituales},
        "pd": {"fuente": "Excel Tablas!D202:D223 y AA201:AD223 (coste en PD por punto de habilidad)", "cols": ["Convocar", "Dominar", "Atar", "Desconvocar"], "filas": pd},
    }
    salida = os.path.join(ROOT, "src", "data", "convocatoria.json")
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(len(arcanos), "arcanos,", len(otras), "otras invocaciones (", sum(x["libro"] is None for x in otras), "sin libro verificado),", len(pd), "categorías ->", os.path.relpath(salida, ROOT))


if __name__ == "__main__":
    main()
