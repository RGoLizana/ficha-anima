import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt } from './campos';

// Hoja Místicos del Excel
const m = (col: string, fila: number) => `Místicos!${col}${fila}`;
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Filas ocupadas más una libre: nunca se bloquea añadir otra. */
function visibles(f: Ficha, filas: number[], cols: string[]) {
  const llena = (r: number) => cols.some((c) => f.entradas[m(c, r)]);
  const ultima = filas.reduce((x, r, i) => (llena(r) ? i : x), -1);
  return filas.slice(0, Math.min(filas.length, ultima + 2));
}

// libre acceso: vías que tiene el personaje (Místicos C15:C25) y, si el conjuro es de libre elección, «-» con la lista de niveles más amplia
const LIBRE = '-';
const NIVELES_LIBRES = "'Tablas'!$V$1090:$V$1109";

export function Magia({ f }: { f: Ficha }) {
  const viasQueTiene = [LIBRE, ...new Set(rango(15, 25).map((r) => txt(m('C', r))).filter(Boolean))];
  return (
    <>
      <Avisos claves={['Místicos!C29', 'PDs!V104']} />

      <Panel title="Nivel de magia" extra={<Barra usado={Number(txt(m('E', 12))) || 0} total={Number(txt(m('C', 12))) || 0} />}>
        <div class="salidas">
          {[['C', 'Nivel máximo'], ['E', 'Nivel usado'], ['G', 'Metamagia'], ['I', 'Acumulación'], ['J', 'Reg. zeónica'], ['L', 'ACT'],
            ['O', 'Turno'], ['P', 'Ataque'], ['Q', 'Defensa']].map(([c, t]) => (
            <div class="stat" key={c}><div class="stat-v">{txt(m(c, 12)) || '—'}</div><div class="muted small">{t}</div></div>
          ))}
        </div>
        <div class="grid-fields">
          <Campo f={f} clave={m('AT', 10)} label="Teorema empleado" />
          <Campo f={f} clave={m('Q', 14)} label="Desequilibrio ofensivo" />
          <Campo f={f} clave={m('AS', 32)} label="Especialidad de proyección" />
        </div>
        <p class="muted small">Potencial innato <strong>{txt(m('L', 14))}</strong> · Vías opuestas: {txt(m('E', 27)) || '—'} · Conjuros seleccionados: {txt(m('H', 26)) || 0}</p>
      </Panel>

      <Panel title="Vías de magia" extra={<span class="muted small">Nivel usado en cada vía</span>}>
        {visibles(f, rango(15, 25), ['C', 'E', 'G']).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={m('C', r)} label="Vía" />
            <Campo f={f} clave={m('E', r)} label="Subvía" />
            <Campo f={f} clave={m('G', r)} label="Nivel usado" tipo="numero" class="mini" />
            <p class="muted small">Nivel {txt(m('H', r)) || '—'}{txt(m('I', r)) ? ` · acumulación ${txt(m('I', r))}` : ''}</p>
          </div>
        ))}
      </Panel>

      <div class="cols-2">
        <Panel title="Zeón" extra={<span class="muted small">Total <strong>{txt(m('K', 18)) || 0}</strong></span>}>
          <div class="grid-fields">
            <Campo f={f} clave={m('M', 18)} label="Zeón actual" tipo="numero" />
            <Campo f={f} clave={m('L', 20)} label="Contenedor" tipo="numero" />
            <Campo f={f} clave={m('L', 21)} label="Amplificador" tipo="numero" />
          </div>
        </Panel>
        <Panel title="Convocatoria">
          <table class="tabla">
            <thead><tr><th scope="col" class="left">Habilidad</th><th scope="col">Especial</th><th scope="col">Total</th></tr></thead>
            <tbody>
              {[26, 27, 28, 29].map((r) => (
                <tr key={r}>
                  <th scope="row" class="left">{txt(m('J', r))}</th>
                  <td><Campo f={f} clave={m('L', r)} label={<span class="sr-only">Especial {txt(m('J', r))}</span>} tipo="numero" class="mini" /></td>
                  <td class="total">{txt(m('M', r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div class="grid-fields">
            <Campo f={f} clave={m('P', 26)} label="Especialidad" />
          </div>
          <p class="muted small">Convocación en masa: {txt(m('Q', 25)) || '—'}</p>
        </Panel>
      </div>

      <Panel title="Conjuros seleccionados" extra={<span class="muted small">{txt(m('H', 26)) || 0} elegidos</span>}>
        {visibles(f, rango(12, 50), ['W', 'Y']).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={m('W', r)} label="Vía" />
            <Campo f={f} clave={m('Y', r)} label="Conjuro" class="grow" />
            <span class="muted small nivel-op">{txt(m('AC', r)) && `Nv ${txt(m('AC', r))}`}</span>
          </div>
        ))}
      </Panel>

      <Panel title="Conjuros de libre acceso" extra={<span class="muted small">Restantes: <strong>{txt(m('AK', 10))}</strong></span>}>
        <p class="muted small">Elige primero la vía a la que pertenece (solo las que tienes, o «-» si es de libre elección) y su nivel; después sale la lista de conjuros.</p>
        {visibles(f, rango(12, 50), ['AE', 'AG', 'AK']).map((r) => {
          const libre = f.entradas[m('AE', r)] === LIBRE;
          return (
            <div class="compra" key={r}>
              <Campo f={f} clave={m('AE', r)} label={`Vía asociada (${LIBRE} si es libre)`} fijas={viasQueTiene} />
              <Campo f={f} clave={m('AK', r)} label="Nivel" class="mini" {...(libre ? { lista: NIVELES_LIBRES } : {})} />
              <Campo f={f} clave={m('AG', r)} label="Conjuro" class="grow" />
            </div>
          );
        })}
      </Panel>

      <Panel title="Conjuros activos, criaturas atadas e invocaciones" extra={<span class="muted small">Coste zeónico al día: <strong>{txt(m('H', 61)) || txt(m('G', 61)) || 0}</strong></span>}>
        {visibles(f, rango(33, 60), ['C', 'H', 'J']).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={m('C', r)} label="Conjuro activo / criatura atada" class="grow" />
            <Campo f={f} clave={m('H', r)} label="Zeón diario" tipo="numero" class="mini" />
            <Campo f={f} clave={m('J', r)} label="Invocación o encarnación" class="grow" />
            {f.entradas[m('J', r)] && <span class="muted small">Dif. {txt(m('P', r))} · Zeón {txt(m('Q', r))}</span>}
          </div>
        ))}
      </Panel>

      <Panel title="Ofudas preparados">
        {visibles(f, rango(62, 72), ['AP', 'AR', 'AV']).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={m('AP', r)} label="Vía" />
            <Campo f={f} clave={m('AR', r)} label="Conjuro" class="grow" />
            <Campo f={f} clave={m('AV', r)} label="Cantidad" tipo="numero" class="mini" />
            {f.entradas[m('AR', r)] && <span class="muted small">Zeón {txt(m('AW', r))}</span>}
          </div>
        ))}
      </Panel>

      <Teoremas />

      <Habilidades />

      <Panel title="Notas de magia">
        <Campo f={f} clave={m('C', 64)} label="Notas (salen en la página de notas del PDF)" tipo="area" />
      </Panel>
    </>
  );
}

function Barra({ usado, total }: { usado: number; total: number }) {
  const p = total > 0 ? Math.min(100, (100 * usado) / total) : 0;
  return <div class="barra" style={{ width: '160px' }}><div class={usado > total ? 'over' : ''} style={{ width: `${p}%` }} /></div>;
}

/** Habilidades metamágicas conseguidas (solo lectura; se compran en la sección Metamagia). */
function Habilidades() {
  const items = rango(53, 73).map((r) => [txt(m('W', r)), txt(m('AB', r))]).filter(([n]) => n);
  if (!items.length) return null;
  return (
    <Panel title="Habilidades metamágicas" extra={<span class="muted small">Se compran en Metamagia</span>}>
      {items.map(([n, d]) => <p class="small" key={n}><strong>{n}</strong>{d ? ` — ${d}` : ''}</p>)}
    </Panel>
  );
}

/** Tablas de referencia del teorema empleado (Místicos AR5:BI34). Solo lectura; cambian con el teorema elegido arriba. */
const fila = (cols: string[], r: number) => cols.map((c) => txt(m(c, r)).replace(/\s+/g, ' '));
function Rejilla({ titulo, cabecera, cols, filas }: { titulo: string; cabecera: number; cols: string[]; filas: number[] }) {
  const cuerpo = filas.map((r) => [r, fila(cols, r)] as const).filter(([, c]) => c.some(Boolean));
  if (!cuerpo.length) return null;
  return (
    <div>
      <h3>{titulo}</h3>
      <table class="tabla">
        <thead><tr>{fila(cols, cabecera).map((t, i) => <th scope="col" key={i}>{t}</th>)}</tr></thead>
        <tbody>{cuerpo.map(([r, c]) => <tr key={r}>{c.map((t, i) => <td key={i}>{t}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Teoremas() {
  const tramos = ['BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI'];
  return (
    <Panel title="Teoremas de magia" extra={<span class="muted small">Referencia del teorema «{txt(m('AT', 10)) || 'General'}»; se cambia en Nivel de magia</span>}>
      <div class="cols-2">
        <Rejilla titulo="Efectos máximos" cabecera={15} cols={['AS', 'AT', 'AU', 'AV', 'AW']} filas={rango(16, 22)} />
        <Rejilla titulo="Modificadores" cabecera={23} cols={['AR', 'AS', 'AU', 'AV', 'AW']} filas={rango(24, 36)} />
      </div>
      <Rejilla titulo={`Tramos · ${[txt(m('BA', 12)), txt(m('BD', 12)), txt(m('BG', 12))].filter(Boolean).join(' / ')}`} cabecera={12} cols={tramos} filas={rango(13, 23)} />
    </Panel>
  );
}
