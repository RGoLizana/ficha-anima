import type { ComponentChildren, JSX } from 'preact';
import type { Ficha } from '../model/ficha';
import { formulaLista } from '../engine';
import { Campo, Panel, txt, v } from './campos';

// Hoja "Personalización" del Excel: contenido que no está en las reglas de Anima
const p = (c: string) => `Personalización!${c}`;
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
type Tipo = 'texto' | 'numero' | 'lista' | 'area';

const lleno = (f: Ficha, c: string) => {
  const x = f.entradas[p(c)] ?? v(p(c));
  return x !== null && x !== undefined && x !== '';
};
/** Filas ocupadas más una libre: nunca se bloquea añadir otra. */
function visibles(f: Ficha, filas: number[], cols: string[]) {
  const ultima = filas.reduce((x, r, i) => (cols.some((c) => lleno(f, c + r)) ? i : x), -1);
  return filas.slice(0, Math.min(filas.length, ultima + 2));
}

const Marca = () => <span class="chip">Personalizado</span>;
const PanelP = ({ title, children }: { title: string; children: ComponentChildren }) =>
  <Panel title={title} extra={<Marca />}>{children}</Panel>;

export function Personalizacion({ f }: { f: Ficha }) {
  // casilla de la hoja; sin tipo, Campo decide (desplegable si el Excel tiene lista)
  const C = (c: string, label: ComponentChildren, tipo?: Tipo, cls?: string) =>
    <Campo key={c} f={f} clave={p(c)} label={label} tipo={tipo} class={cls} />;
  const N = (c: string, label: ComponentChildren, cls = 'mini') => C(c, label, 'numero', cls);
  const sr = (t: string) => <span class="sr-only">{t}</span>;

  return (
    <div class="stack personalizado">
      <p class="extra-note">Contenido fuera de las reglas de Anima: todo lo que añadas aquí queda marcado como personalizado.</p>

      <PanelP title="Ajustes de campaña">
        <div class="grid-fields">
          {C('F6', 'Nivel sobrenatural de la campaña')}
          {C('F9', 'Criatura con PCs')}
          {C('L6', 'Ajuste de nivel por raza')}
          {C('O6', 'Ajuste de nivel por artefacto')}
          {C('L7', 'Ajuste de nivel por legados')}
          {C('O7', 'Ajuste de nivel por PDs')}
        </div>
        <h3 class="sub">Raíces culturales</h3>
        <p class="muted small">{txt(p('C13'))} · {txt(p('E13'))}</p>
        <div class="grid-fields">
          {C('E12', txt(p('C12')) || 'Aplicar bonos')}
          {C('E15', txt(p('C15')) || 'Bono especial 1')}
          {C('E16', 'Bono especial 2')}
        </div>
      </PanelP>

      <PanelP title="Ventajas en secundarias">
        <table class="tabla">
          <thead><tr><th scope="col" class="left">Ventaja</th><th scope="col">Libres</th><th scope="col">Habilidad 1</th><th scope="col">Habilidad 2</th><th scope="col">Habilidad 3</th></tr></thead>
          <tbody>
            {rango(11, 15).map((r) => (
              <tr key={r}>
                <th scope="row" class="left">{txt(p(`I${r}`))}</th>
                <td class="total">{txt(p(`K${r}`))}</td>
                {['L', 'N', 'P'].map((c, i) => <td key={c}>{C(c + r, sr(`${txt(p(`I${r}`))} habilidad ${i + 1}`))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </PanelP>

      <div class="cols-2">
        <PanelP title="Raíces culturales personalizadas">
          <div class="grid-fields">
            {C('C20', 'Región', 'texto')}
            {C('C21', 'Clase social', 'texto')}
          </div>
          {rango(18, 21).map((r) => (
            <div class="compra" key={r}>
              {(r === 21 ? ['F', 'I', 'L'] : ['F', 'I', 'L', 'O']).map((c) => <Pareja key={c} C={C} N={N} r={r} c={c} />)}
            </div>
          ))}
          <p class="muted small">Suma total: <strong>{txt(p('Q21'))}</strong></p>
        </PanelP>

        <PanelP title="Lenguas personalizadas">
          {[24, 25, 26].map((r) => (
            <div class="compra" key={r}>
              {C(`C${r}`, 'Lengua', 'texto', 'grow')}
              {['F', 'I', 'L', 'O'].map((c) => <Pareja key={c} C={C} N={N} r={r} c={c} />)}
            </div>
          ))}
        </PanelP>
      </div>

      <div class="cols-2">
        <PanelP title="Ventajas personalizadas">
          {visibles(f, rango(30, 33), ['C', 'G']).map((r) => (
            <div class="compra" key={r}>
              {C(`C${r}`, 'Ventaja', 'texto', 'grow')}
              {N(`G${r}`, 'Coste')}
            </div>
          ))}
          <div class="grid-fields">{C('G34', 'Incluir ventajas especiales')}</div>
        </PanelP>

        <PanelP title="Habilidades esenciales personalizadas">
          {visibles(f, rango(30, 34), ['I', 'P', 'Q']).map((r) => (
            <div class="compra" key={r}>
              {C(`I${r}`, 'Habilidad', 'texto', 'grow')}
              {N(`P${r}`, 'Gnosis')}
              {N(`Q${r}`, 'PDs')}
            </div>
          ))}
        </PanelP>
      </div>

      <PanelP title="Poderes de criatura personalizados">
        <div class="grid-fields">
          {C('F36', 'Armas naturales: crítico 1')}
          {C('F37', 'Armas naturales: crítico 2')}
        </div>
        {visibles(f, rango(38, 47), ['I', 'P', 'Q']).map((r) => (
          <div class="compra" key={r}>
            {C(`I${r}`, 'Poder', 'texto', 'grow')}
            {N(`P${r}`, 'Gnosis')}
            {N(`Q${r}`, 'PDs')}
          </div>
        ))}
      </PanelP>

      <PanelP title="Razas y estados especiales">
        <h3 class="sub">Turak: cercanía con el dragón</h3>
        <div class="grid-fields">{[40, 41, 42].map((r, i) => C(`C${r}`, `Rasgo ${i + 1}`))}</div>
        <h3 class="sub">Vetala</h3>
        <div class="grid-fields">
          {C('G45', 'Atributo éxtasis sanguíneo')}
          {C('G46', 'Aplicar bono éxtasis')}
          {C('G47', 'Aplicar bono nocturno')}
          {C('G48', 'Aplicar bien alimentado')}
        </div>
        <h3 class="sub">Tuan Dalyr</h3>
        <div class="grid-fields">
          {['N', 'O', 'P', 'Q'].map((c, i) => C(`${c}49`, `Bono de transformación ${i + 1}`))}
          {C('L50', 'Transformado')}
          {C('P50', 'Fase lunar actual')}
        </div>
        {txt(p('I51')) && <p class="muted small">{txt(p('I51'))}</p>}
        <h3 class="sub">Otros</h3>
        <div class="grid-fields">
          {C('E50', "Ebudan: Sue' Aman")}
          <div class="field"><span class="muted small">Trascendido</span><strong>{txt(p('E52')) || '—'}</strong></div>
        </div>
      </PanelP>

      <PanelP title="Técnicas de Ki: efectos personalizados">
        {[57, 61, 65, 69, 73].map((b, i) => (
          <section class="stack-sm" key={b}>
            <h3 class="sub">Efecto personalizado {i + 1}</h3>
            <div class="compra">
              {C(`D${b + 1}`, 'Efecto', 'texto', 'grow')}
              {[['K', 'Coste 1'], ['L', 'Coste 2'], ['M', 'CM'], ['N', 'Mant.'], ['O', 'Sost. menor'], ['P', 'Sost. mayor']].map(([c, t]) => N(`${c}${b + 1}`, t))}
              {C(`Q${b + 1}`, 'Nivel', formulaLista(p(`Q${b + 1}`)) ? undefined : 'numero', 'mini')}
            </div>
            <div class="grid-fields">
              {C(`D${b + 2}`, 'Tipo')}
              {C(`H${b + 2}`, 'Car. primaria')}
              {['L', 'N', 'P'].map((c, j) => C(`${c}${b + 2}`, `Elemento afín ${j + 1}`))}
              {C(`D${b + 3}`, 'Clase')}
            </div>
            <div class="mods">
              {[['J', 'K'], ['L', 'M'], ['N', 'O'], ['P', 'Q']].map(([c, m], j) => (
                <div class="mod" key={c}>
                  {C(`${c}${b + 3}`, `Car. opcional ${j + 1}`)}
                  {C(`${m}${b + 3}`, sr(`Bono car. opcional ${j + 1}`), undefined, 'mini')}
                </div>
              ))}
            </div>
          </section>
        ))}
      </PanelP>

      <PanelP title="Desventajas de técnicas de Ki">
        {visibles(f, rango(79, 83), ['F', 'M', 'O', 'Q']).map((r) => (
          <div class="compra" key={r}>
            {C(`F${r}`, 'Desventaja', 'texto', 'grow')}
            {N(`M${r}`, 'Reducción CM')}
            {C(`O${r}`, 'Clase')}
            {C(`Q${r}`, 'Nivel')}
          </div>
        ))}
      </PanelP>

      <PanelP title="Modificadores especiales de armas">
        <div class="tabla-scroll">
          <table class="tabla">
            <thead><tr><th scope="col" />{MOD_ARMAS.map(([t]) => <th scope="col" key={t}>{t}</th>)}</tr></thead>
            <tbody>
              {['Turno', 'HA', 'HD', 'Daño'].map((t, i) => (
                <tr key={t}>
                  <th scope="row">{t}</th>
                  {MOD_ARMAS.map(([a, c, r]) => <td key={a}>{N(`${c}${r + i}`, sr(`${a} ${t}`))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelP>

      <PanelP title="Armas personalizadas">
        {[18, 22, 26].map((b, i) => (
          <section class="stack-sm" key={b}>
            <h3 class="sub">{txt(p(`X${b}`)) || `Arma personalizada ${i + 1}`}</h3>
            <div class="grid-fields">
              {C(`X${b}`, 'Nombre', 'texto')}
              {C(`X${b + 1}`, 'Conocida')}
              {C(`W${b + 2}`, 'Tipo 1')}
              {C(`W${b + 3}`, 'Tipo 2')}
              {C(`Z${b + 3}`, 'Atributo')}
              {C(`AA${b + 3}`, 'Crítico 1')}
              {C(`AB${b + 3}`, 'Crítico 2')}
              {C(`AF${b + 3}`, 'Mágico')}
            </div>
            <div class="compra">
              {N(`Z${b + 1}`, 'Turno')}
              {N(`Z${b + 2}`, 'Daño')}
              {N(`AC${b + 1}`, 'FUE req. 1M')}
              {N(`AE${b + 1}`, 'FUE req. 2M')}
              {N(`AC${b + 3}`, 'Entereza')}
              {N(`AD${b + 3}`, 'Rotura')}
              {N(`AE${b + 3}`, 'Presencia')}
              {[0, 1, 2].map((o) => N(`AJ${b + 1 + o}`, txt(p(`AG${b + 1 + o}`)) || ['Escudo / proyectil 1', 'Escudo / proyectil 2', 'Alcance'][o], ''))}
            </div>
            {C(`AC${b}`, 'Notas', 'texto')}
          </section>
        ))}
      </PanelP>

      <PanelP title="Armaduras personalizadas">
        {[['Y', 'W', 'AA', 'AC', 0], ['AF', 'AD', 'AH', 'AJ', 7]].map(([nom, req, res, ent, d], i) => (
          <section class="stack-sm" key={nom}>
            <h3 class="sub">{txt(p(`${nom}31`)) || `Armadura personalizada ${i + 1}`}</h3>
            <div class="grid-fields">
              {C(`${nom}31`, 'Nombre', 'texto')}
              {C(`${nom}37`, 'Tipo')}
              {C(`${nom}38`, 'Localización')}
            </div>
            <div class="compra">
              {N(`${req}33`, 'Requerimiento')}
              {N(`${nom}33`, txt(p(`${nom}32`)) || 'Pen. natural')}
              {N(`${res}33`, 'Restricción movimiento')}
              {N(`${ent}37`, 'Entereza')}
              {N(`${ent}38`, 'Presencia')}
            </div>
            <div class="mods">
              {TA.map((t, j) => (
                <div class="mod" key={t}>
                  <span class="muted small">{t}</span>
                  {N(`${COLS_TA[(d as number) + j]}35`, sr(`TA ${t}`))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </PanelP>

      <PanelP title="Tablas de armas personalizadas">
        <div class="cols-2">
          {['Y', 'AB', 'AE', 'AH'].map((c, i) => (
            <section class="stack-sm" key={c}>
              {C(`${c}41`, `Tabla ${i + 1}: nombre`, 'texto')}
              {visibles(f, rango(43, 47), [c]).map((r) => C(`${c}${r}`, `Arma ${r - 42}`))}
            </section>
          ))}
        </div>
      </PanelP>

      <div class="cols-2">
        <PanelP title="Invocaciones personalizadas">
          {visibles(f, rango(55, 61), ['V', 'AB', 'AC']).map((r) => (
            <div class="compra" key={r}>
              {C(`V${r}`, 'Nombre', 'texto', 'grow')}
              {N(`AB${r}`, 'Dificultad')}
              {N(`AC${r}`, 'Zeón')}
            </div>
          ))}
        </PanelP>

        <PanelP title="Conjuros especializados">
          {visibles(f, rango(55, 61), ['AF']).map((r) => (
            <div class="compra" key={r}>
              {C(`AF${r}`, 'Conjuro', undefined, 'grow')}
              <span class="muted small">Límite {txt(p(`AE${r}`)) || 0}{txt(p(`AJ${r}`)) && ` · Nivel ${txt(p(`AJ${r}`))}`}</span>
            </div>
          ))}
          <h3 class="sub">Familiar demonio: dones demoníacos</h3>
          <div class="grid-fields">
            {C('AB63', 'Dones demoníacos')}
            {C('AC63', 'Don 1')}
            {C('AG63', 'Don 2')}
          </div>
        </PanelP>
      </div>

      <PanelP title="Patrones mentales personalizados">
        {[66, 70].map((r) => (
          <section class="stack-sm" key={r}>
            <div class="compra">
              {C(`W${r}`, 'Patrón mental', 'texto', 'grow')}
              {N(`AB${r}`, 'Coste')}
              {N(`AC${r}`, 'Coste 2')}
            </div>
            {C(`AD${r}`, 'Descripción', 'texto')}
            <div class="grid-fields">
              {C(`Y${r + 1}`, 'Bonificadores', 'texto', 'span2')}
              {C(`Y${r + 2}`, 'Penalizadores', 'texto', 'span2')}
            </div>
          </section>
        ))}
      </PanelP>

      <div class="cols-2">
        <PanelP title="Legados de sangre personalizados">
          {visibles(f, rango(80, 82), ['V', 'AB']).map((r) => (
            <div class="compra" key={r}>
              {C(`V${r}`, 'Nombre', 'texto', 'grow')}
              {N(`AB${r}`, 'Coste')}
            </div>
          ))}
        </PanelP>
        <PanelP title="Ars Magnus personalizados">
          {visibles(f, rango(80, 82), ['AD', 'AI', 'AJ']).map((r) => (
            <div class="compra" key={r}>
              {C(`AD${r}`, 'Nombre', 'texto', 'grow')}
              {N(`AI${r}`, 'PD')}
              {N(`AJ${r}`, 'CM')}
            </div>
          ))}
        </PanelP>
      </div>

      <PanelP title="Opciones de legados y Ars Magnus">
        <div class="grid-fields">
          {[85, 86, 87, 88].map((r, i) => C(`V${r}`, `Armas naturales ${i + 1}`))}
        </div>
        <h3 class="sub">Sangre de Kami: Señor de la Guerra</h3>
        <div class="grid-fields">
          {C('Z87', 'Arma seleccionada')}
          {C('AB88', 'Bono acum. Ki')}
        </div>
        <h3 class="sub">Sagittarius Magister</h3>
        <div class="grid-fields">
          {C('AF85', 'Proyectil exclusivo')}
          {[86, 87, 88].map((r, i) => C(`AD${r}`, `Opción ${i + 1}`))}
        </div>
        <h3 class="sub">Cáncer Magister</h3>
        <div class="grid-fields">{[85, 86, 87].map((r, i) => C(`AH${r}`, `Opción ${i + 1}`))}</div>
        <h3 class="sub">Erebus</h3>
        <p class="muted small">{txt(p('F89'))} · Bonos finales: INT {txt(p('N91'))}, POD {txt(p('O91'))}, VOL {txt(p('P91'))}</p>
        <div class="grid-fields">
          {['H', 'I', 'J', 'K', 'L'].map((c, i) => C(`${c}90`, `Demiurgo ${i + 1}`))}
          {C('H91', 'Influjo')}
        </div>
      </PanelP>

      <PanelP title="Géminis: marionetas">
        {[92, 108, 124].map((b, i) => <Marioneta key={b} C={C} N={N} b={b} n={i + 1} />)}
      </PanelP>

      <PanelP title="Elan personalizado">
        {C('F93', 'Nombre de la entidad', 'texto')}
        {visibles(f, rango(95, 110), ['D', 'G', 'H', 'I']).map((r) => (
          <div class="compra" key={r}>
            {C(`D${r}`, 'Poder', 'texto', 'grow')}
            {N(`G${r}`, 'Elan')}
            {N(`H${r}`, 'Coste')}
            {C(`I${r}`, 'Descripción', 'texto', 'grow')}
          </div>
        ))}
        <div class="cols-2">
          {[['Elan inferior a 50', 113, [113, 116, 119]], ['Elan superior a 50', 121, [122, 125]]].map(([t, a, pens]) => (
            <section class="stack-sm" key={t as string}>
              <h3 class="sub">{t}</h3>
              {rango(a as number, (a as number) + 6).map((r) => (
                <div class="compra" key={r}>
                  {C(`E${r}`, 'Bono', 'texto', 'grow')}
                  {N(`K${r}`, 'Valor')}
                </div>
              ))}
              {(pens as number[]).map((r) => (
                <div class="compra" key={r}>
                  {C(`L${r}`, 'Penalizador', 'texto', 'grow')}
                  {N(`O${r}`, 'Valor')}
                </div>
              ))}
            </section>
          ))}
        </div>
      </PanelP>

      <PanelP title="Notas de personalización">
        {C('C134', 'Notas (salen en la página de notas del PDF)', 'area')}
      </PanelP>
    </div>
  );
}

// [cabecera, columna, primera fila]: "Sin armas" y Armas 1..10 (impares en las filas 7-10, pares en las 12-15)
const MOD_ARMAS: [string, string, number][] = [
  ['Sin armas', 'Y', 7],
  ...Array.from({ length: 10 }, (_, i): [string, string, number] => [`Arma ${i + 1}`, ['AA', 'AC', 'AE', 'AG', 'AI'][i >> 1], i % 2 ? 12 : 7]),
];
const TA = ['FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE'];
const COLS_TA = ['W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ'];

type Hace = (c: string, label: ComponentChildren, tipo?: Tipo, cls?: string) => JSX.Element;
type HaceN = (c: string, label: ComponentChildren, cls?: string) => JSX.Element;

/** Habilidad y su bono (p.ej. F18 + H18: la columna del bono está dos a la derecha). */
function Pareja({ C, N, r, c }: { C: Hace; N: HaceN; r: number; c: string }) {
  const bono = String.fromCharCode(c.charCodeAt(0) + 2);
  return (
    <>
      {C(`${c}${r}`, 'Habilidad', undefined, 'grow')}
      {N(`${bono}${r}`, 'Bono')}
    </>
  );
}

/** Marioneta de Géminis: bloque de 16 filas desde la del nombre (b). */
function Marioneta({ C, N, b, n }: { C: Hace; N: HaceN; b: number; n: number }) {
  const t = (c: string) => txt(p(c));
  return (
    <section class="stack-sm">
      <h3 class="sub">{t(`X${b}`) || `Marioneta ${n}`}</h3>
      <p class="muted small">PV {t(`Z${b + 1}`) || '—'} · TA {t(`Z${b + 3}`) || '—'} · Cualidades disponibles {t(`X${b + 3}`) || 0}</p>
      <div class="grid-fields">
        {C(`X${b}`, 'Nombre', 'texto')}
        {C(`AF${b}`, 'Tamaño')}
        {C(`AJ${b}`, 'Enjambre')}
        {C(`V${b + 2}`, 'Calidad de confección')}
      </div>
      <div class="mods">
        {['AGI', 'DES', 'FUE'].map((a, i) => (
          <div class="mod" key={a}>
            <span class="muted small">{a} {t(`Z${b + 6 + i}`)}</span>
            {N(`Y${b + 6 + i}`, <span class="sr-only">{a} especial</span>)}
          </div>
        ))}
      </div>
      <div class="grid-fields">
        {rango(b + 9, b + 14).map((r, i) => C(`W${r}`, `Cualidad extraordinaria ${i + 1}`))}
      </div>
      <div class="cols-2">
        {[['AA', 'AC', 'AB', 'AD', 'AE'], ['AF', 'AH', 'AG', 'AI', 'AJ']].map(([emp, arma, cal, nat, bon], i) => (
          <div class="stack-sm" key={emp}>
            <h4 class="sub">Arma {i + 1}</h4>
            <p class="muted small">At. {t(`${emp}${b + 3}`)} · Def. {t(`${cal}${b + 3}`)} · Turno {t(`${nat}${b + 3}`)} · Daño {t(`${bon}${b + 3}`)}</p>
            <div class="grid-fields">
              {C(`${emp}${b + 1}`, 'Empuñadura')}
              {C(`${arma}${b + 1}`, 'Arma')}
              {C(`${cal}${b + 7}`, t(`${emp}${b + 7}`) || 'Calidad')}
              {C(`${nat}${b + 10}`, t(`${emp}${b + 10}`) || 'Crítico 1')}
              {C(`${nat}${b + 11}`, t(`${emp}${b + 11}`) || 'Crítico 2')}
            </div>
            <div class="compra">
              {N(`${arma}${b + 13}`, 'HA')}
              {N(`${bon}${b + 13}`, 'Turno')}
              {N(`${arma}${b + 14}`, 'HD')}
              {N(`${bon}${b + 14}`, 'Daño')}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
