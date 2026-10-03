"""Resumen de las artes marciales para la ficha: qué es cada arte (una frase) y, por cada nivel (Base/Avanzado/Supremo o Base/Arcano),
su daño base, su CM y sus bonos, sacados de la 'Tabla general de Artes Marciales' (hoja Tablas, filas 851-939). El efecto especial de cada
nivel no se copia: la web lo lee en vivo de la celda del Excel (Combate!AF31…), que a veces depende de otras compras (p. ej. Emp).

Salida: src/data/artes-marciales.json
  artes:  {"Aikido": "qué hace el arte (una frase)"}
  niveles:{"Aikido (Base)": {a arte, n nivel, t 'básica'|'avanzada', d daño base ('10 + FUE' | null), cm, b [[bono, valor]]}}
Uso: python tools/export_artes_marciales.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Una frase por arte, de lo que dicen el Core y el propio Excel; lo que no está en los libros oficiales se deduce de la tabla.
ARTES = {
    "Aikido": "Defensa que vuelve la fuerza del atacante contra él: destaca en el contraataque y en presas y derribos.",
    "Boxeo": "Combate de puños, rápido: da bono de turno y, en contraataque, un bono especial.",
    "Capoeira": "Patadas acrobáticas y amplias: sus ataques en área cuentan como armas medianas o grandes.",
    "Grappling": "Agarres, presas y derribos con poco o ningún penalizador.",
    "Kardad": "Estilo defensivo contra presas y derribos: bonos a los controles para librarse de ellos.",
    "Kempo": "Combinaciones rápidas de golpes: ataques adicionales con menos penalizador.",
    "Kuan": "Especialista en parar proyectiles sin los penalizadores habituales.",
    "Kung Fu": "Estilo versátil: cada asalto se reparte un bono variable entre ataque, parada, esquiva, turno o daño.",
    "Lama": "Estilo de defensa: permite defensas adicionales sin penalizador.",
    "Malla-yuddha": "Lucha de resistencia: parar con las manos sin sufrir daño y desarmar al contraatacar.",
    "Moai Thai": "Codos y rodillas de gran daño; en su nivel supremo mejora el nivel de los críticos.",
    "Pankration": "Combate completo centrado en la presa: menos penalizador y habilidad plena mientras apresa.",
    "Sambo": "Defensa personal sin armas: reduce a la mitad los penalizadores de derribo, desarmar, presa, área y apuntados.",
    "Shotokan": "Golpes fuertes y ofensivos: mucho daño base y bono al ataque.",
    "Soo Bahk": "Lucha sin miedo al flanco: reduce o anula los penalizadores por flanco y por derribado.",
    "Tae Kwon Do": "Patadas combinables con armas: un ataque adicional incluso tras atacar con armas.",
    "Tai Chi": "Usa la energía interna: el daño base crece con el Poder y da mucho conocimiento marcial.",
    "Xing Quan": "Ataque único aprovechando la iniciativa: bono a la habilidad de ataque si va primero.",
    "Asakusen": "Origen mortal del Kung Fu: aplica a la vez su bono de +10 a ataque, parada, esquiva, turno y daño.",
    "Dumah": "«El arte del viento»: manos y piernas como filos; reduce la TA del defensor y suma rotura.",
    "Emp": "Especialista en desarmar: sin penalizador y con bono a los controles enfrentados.",
    "Enuth": "Golpes de inconsciencia a puntos vitales, con mucho nivel de crítico.",
    "Exelion": "Daño que no se puede modificar de ninguna manera.",
    "Godhand": "Sacrifica un ataque para un golpe devastador al comienzo del turno siguiente.",
    "Hakyoukuken": "Rompe las armaduras blandas y multiplica el nivel de los críticos.",
    "Hanja": "Combate sin penalizadores por posición: espalda, espacio reducido, amenazado, parálisis.",
    "Lama Tsu": "Defensa múltiple: defensas adicionales sin penalizador, llegando a no aplicarlo nunca.",
    "Melkaiah": "Agarres y derribos de efectividad inhumana, con bono a los controles enfrentados.",
    "Mushin": "Convierte el fracaso del rival en daño: contraataca con puntos de presión.",
    "Rex Frame": "El cuerpo como armadura: TA contra todo y una barrera de daño.",
    "Selene": "Proyecta la fuerza del atacante sobre él: dobla el bono de contraataque.",
    "Seraphite": "Estilo arriesgado: más ataque a cambio de defensa.",
    "Shephon": "La defensa más perfecta: la defensa total concede un gran bono.",
    "Suyanta": "Golpea también la reserva de Ki del rival, además de sus PV.",
    "Velez": "Canaliza la energía interna: golpea la TA de Energía.",
}
BONOS = [("H", "Ataque"), ("I", "Esquiva"), ("J", "Parada"), ("K", "Turno"), ("L", "Entereza"), ("M", "Rotura")]
STAT = {"H14": "FUE", "H17": "POD"}


def val(h, c):
    v = h.get(c)
    if isinstance(v, str) and not v.startswith("="):
        return v[1:] if v.startswith("'") else v
    return v


def dano(e):
    """Daño base de la tabla: '10 + 2×FUE'. None si no es un daño por fórmula conocida (o es 0: usa el del estilo básico)."""
    m = isinstance(e, str) and re.fullmatch(r"=(\d+)\+(?:(\d)\*)?'Principal'!\$H\$(\d+)", e)
    if not m or "H" + m.group(3) not in STAT:
        return None
    return f"{m.group(1)} + {m.group(2) + '×' if m.group(2) else ''}{STAT['H' + m.group(3)]}"


def main():
    t = json.load(open(os.path.join(ROOT, "public", "plantilla.json"), encoding="utf-8"))["sheets"]["Tablas"]
    niveles = {}
    tipo = "básica"
    for r in range(850, 940):
        n = val(t, f"D{r}")
        if not n:
            continue
        if str(n).startswith(">"):
            tipo = "avanzada" if "AVANZADAS" in str(n) else "básica"
            continue
        m = re.fullmatch(r"(.*) \((.*)\)", n)
        arte, nivel = m.group(1), m.group(2)
        bonos = [[et, val(t, f"{c}{r}")] for c, et in BONOS if val(t, f"{c}{r}")]
        niveles[n] = {"a": arte, "n": nivel, "t": tipo, "d": dano(t.get(f"E{r}")), "cm": val(t, f"G{r}") or 0, "b": bonos}
    faltan = {v["a"] for v in niveles.values()} - set(ARTES)
    sobran = set(ARTES) - {v["a"] for v in niveles.values()}
    assert not faltan and not sobran, (faltan, sobran)
    salida = os.path.join(ROOT, "src", "data", "artes-marciales.json")
    with open(salida, "w", encoding="utf-8") as f:
        json.dump({"artes": ARTES, "niveles": niveles}, f, ensure_ascii=False, separators=(",", ":"))
    print(len(ARTES), "artes,", len(niveles), "niveles ->", os.path.relpath(salida, ROOT), os.path.getsize(salida) // 1024, "KB")
    for k in ("Aikido (Avanzado)", "Tai Chi (Base)", "Exelion (Base)", "Boxeo (Base)", "Kung Fu (Avanzado)"):
        print(k, niveles[k])


if __name__ == "__main__":
    main()
