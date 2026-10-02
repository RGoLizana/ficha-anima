import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt, v } from './campos';

const CARACT = [11, 12, 13, 14, 15, 16, 17, 18];
const RESIST = [57, 58, 59, 60, 61, 62];
const CATEGORIAS = [7, 9, 11, 13, 15]; // PDs!O7/S7 ... cambios de categoría

export function Principal({ f }: { f: Ficha }) {
  const cats = CATEGORIAS.filter((r, i) => i === 0 || f.entradas[`PDs!O${CATEGORIAS[i - 1]}`]);

  return (
    <>
      <Avisos claves={['Principal!C19', 'Principal!N14']} />
      <Panel title="Personaje">
        <div class="grid-fields">
          <Campo f={f} clave="General!F22" label="Nombre" />
          <Campo f={f} clave="General!F23" label="Raza" />
          <Campo f={f} clave="General!J23" label="Nephilim" />
          <Campo f={f} clave="Principal!Y11" label="Tipo de criatura" />
          <Campo f={f} clave="Principal!AB13" label="Gnosis" tipo="numero" />
        </div>
        <div class="stack-sm">
          {cats.map((r, i) => (
            <div class="grid-fields cat-row" key={r}>
              <Campo f={f} clave={`PDs!O${r}`} label={i === 0 ? 'Categoría' : `Cambio de categoría ${i}`} />
              <Campo f={f} clave={`PDs!S${r}`} label="Niveles" tipo="numero" class="narrow" />
              <Campo f={f} clave={`PDs!Z${r}`} label="Cambio: PD de la antigua" tipo="numero" class="narrow" />
              <Campo f={f} clave={`PDs!AA${r}`} label="Cambio: PD de la nueva" tipo="numero" class="narrow" />
            </div>
          ))}
        </div>
        <p class="muted small">
          Clase: <strong>{txt('Principal!K7') || '—'}</strong> · Tamaño: <strong>{txt('Principal!K6')} {txt('Principal!L6')}</strong>
        </p>
      </Panel>

      <Panel title="Estado actual y valores especiales">
        <div class="grid-fields">
          <Campo f={f} clave="Principal!P11" label="PV actuales" tipo="numero" />
          <Campo f={f} clave="Principal!P16" label="Cansancio actual" tipo="numero" />
          <Campo f={f} clave="Principal!J18" label="Tipo de movimiento" />
          <Campo f={f} clave="Principal!L18" label="Movimiento especial" tipo="numero" />
          <Campo f={f} clave="Principal!L13" label="Regeneración especial" tipo="numero" />
          <Campo f={f} clave="Principal!O18" label="Cansancio especial" tipo="numero" />
          <Campo f={f} clave="Principal!D30" label="Turno especial" tipo="numero" />
          <Campo f={f} clave="Principal!Y13" label="Acumulación de daño" />
          <Campo f={f} clave="Principal!Y14" label="Creado con magia" />
          <Campo f={f} clave="Principal!J77" label="Puntos de destino usados" tipo="numero" />
        </div>
      </Panel>

      <Panel title="Características" extra={<span class="muted small">{txt('Principal!D10')}</span>}>
        <div class="caract">
          {CARACT.map((r) => (
            <div class="caract-card" key={r}>
              <div class="row between">
                <span class="caract-name">{txt(`Principal!D${r}`)}</span>
                <span class="muted small">bono <strong class="txt">{signo(v(`Principal!H${r}`))}</strong></span>
              </div>
              <div class="row end">
                <Campo f={f} clave={`Principal!E${r}`} label="Base" tipo="numero" class="mini" />
                <Campo f={f} clave={`Principal!F${r}`} label="Temp" tipo="numero" class="mini" sinTab />
                <div class="grow right">
                  <div class="muted small">Total</div>
                  <div class="big-num">{txt(`Principal!G${r}`)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Resistencias">
        <div class="table-wrap">
          <table class="tabla">
            <thead><tr><th scope="col"></th><th scope="col">Base</th><th scope="col">Bono</th><th scope="col">Raza</th><th scope="col">Especial</th><th scope="col">Total</th></tr></thead>
            <tbody>
              {RESIST.map((r) => (
                <tr key={r}>
                  <th scope="row">{txt(`Principal!D${r}`)}</th>
                  <td>{txt(`Principal!F${r}`)}</td>
                  <td>{txt(`Principal!G${r}`)}</td>
                  <td>{txt(`Principal!H${r}`)}</td>
                  <td><Campo f={f} clave={`Principal!I${r}`} label={<span class="sr-only">Especial {txt(`Principal!D${r}`)}</span>} tipo="numero" class="mini" /></td>
                  <td class="total">{txt(`Principal!J${r}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div class="grid-fields">
          <Campo f={f} clave="Principal!E63" label="Resistencia especial" tipo="numero" />
        </div>
      </Panel>

      <Panel title="Habilidades secundarias" extra={<span class="muted small">Los PD se reparten en Desarrollo (paso 3)</span>}>
        <Secundarias />
      </Panel>

      <Panel title="Notas de la ficha">
        <Campo f={f} clave="Principal!G68" label="Notas (salen en la página de notas del PDF)" tipo="area" />
      </Panel>
    </>
  );
}

const signo = (x: unknown) => (typeof x === 'number' && x > 0 ? `+${x}` : String(x ?? ''));

const GRUPO: Record<string, string> = { Perc: 'Perceptivas' };

function Secundarias() {
  const grupos: { t: string; hab: { k: string; v: string }[] }[] = [];
  for (let r = 22; r <= 72; r++) {
    const g = txt(`Principal!L${r}`);
    if (g || grupos.length === 0) grupos.push({ t: GRUPO[g] ?? (g || 'Atléticas'), hab: [] });
    const nombre = txt(`Principal!M${r}`) || txt(`Principal!N${r}`);
    if (nombre && nombre !== '-') grupos[grupos.length - 1].hab.push({ k: nombre, v: txt(`Principal!Q${r}`) });
  }
  return (
    <div class="skills">
      {grupos.map((g) => (
        <div key={g.t}>
          <h3 class="skill-group">{g.t.toUpperCase()}</h3>
          {g.hab.map((h) => (
            <div class={'skill' + (h.v === '-' ? ' muted' : '')} key={h.k}><span>{h.k}</span><strong>{h.v}</strong></div>
          ))}
        </div>
      ))}
    </div>
  );
}
