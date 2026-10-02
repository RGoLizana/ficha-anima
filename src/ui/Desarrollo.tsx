import { useState } from 'preact/hooks';
import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt, v } from './campos';

// Hoja PDs del Excel. Cada habilidad tiene, por categoría (hasta 5), una columna de coste y otra de PD invertidos.
const PRIM = { pd: ['M', 'O', 'Q', 'S', 'U'], coste: ['L', 'N', 'P', 'R', 'T'] };   // primarias, Ki, místicas, psíquicas
const SEC = { pd: ['K', 'M', 'O', 'Q', 'S'], coste: ['J', 'L', 'N', 'P', 'R'] };    // secundarias y PV
const FILA_CAT = [7, 9, 11, 13, 15];
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const num = (k: string) => Number(v(k)) || 0;

export function Desarrollo({ f }: { f: Ficha }) {
  const cats = FILA_CAT.map((r) => txt(`PDs!O${r}`)).filter(Boolean);
  const n = Math.max(1, cats.length);
  const [avanzado, setAvanzado] = useState(false);

  return (
    <>
      <Avisos claves={['PDs!T194', 'PDs!V86', 'PDs!V104', 'PDs!V120', 'PDs!Z29+PDs!AA29']} />
      <Panel title="Puntos de desarrollo" extra={<span class="muted small">Nivel total {txt('PDs!R17')} · {txt('PDs!T17')} PD</span>}>
        <div class="pd-cats">
          {Array.from({ length: n }, (_, i) => (
            <ResumenCategoria key={i} i={i} nombre={cats[i] || 'Sin categoría'} />
          ))}
        </div>
        <div class="grid-fields">
          <Campo f={f} clave="PDs!Z15" label="Límite de habilidades primarias" />
        </div>
        <p class="muted small">{txt('PDs!V16')}</p>
      </Panel>

      <Bloque f={f} n={n} cats={cats} titulo="Habilidades de combate" filas={rango(25, 28)} cols={PRIM} />
      <Compras f={f} n={n} titulo="Tablas de armas" filas={rango(43, 48)} extra="Y" />
      <Compras f={f} n={n} titulo="Tablas de estilos" filas={rango(49, 58)} />
      <Compras f={f} n={n} titulo="Artes marciales" filas={rango(59, 77)} grado="J" />
      <Compras f={f} n={n} titulo="Tablas de artes marciales con armas" filas={rango(78, 80)} />
      <Compras f={f} n={n} titulo="Ars Magnus" filas={rango(81, 85)} />
      <Bloque f={f} n={n} cats={cats} titulo="Ki" filas={rango(30, 42)} cols={PRIM} grupo />
      <Bloque f={f} n={n} cats={cats} titulo="Habilidades místicas" filas={rango(93, 101)} cols={PRIM} grupo />
      <Compras f={f} n={n} titulo="Tablas místicas" filas={[102, 103]} />
      <Bloque f={f} n={n} cats={cats} titulo="Habilidades psíquicas" filas={[111, 112]} cols={PRIM} />
      <Compras f={f} n={n} titulo="Tablas psíquicas" filas={[113]} />
      <Compras f={f} n={n} titulo="Patrones mentales" filas={rango(114, 119)} />
      <Bloque f={f} n={n} cats={cats} titulo="Puntos de vida" filas={[188]} cols={SEC} total="Z" esp={null}
        extra={[['X', 'Bono nat.']]} />
      <Bloque f={f} n={n} cats={cats} titulo="Habilidades secundarias" filas={rango(129, 179)} cols={SEC} grupo
        extra={avanzado ? [['I', 'Especialidad', 'texto'], ['W', 'Bono nat.'], ['X', 'Hab. nat.'], ['Y', 'Novel']] : []}
        cabecera={<label class="check"><input type="checkbox" checked={avanzado} onChange={(e) => setAvanzado(e.currentTarget.checked)} />Especialidad, bonos naturales y novel</label>} />
      <SecundariasPropias f={f} n={n} />

      <Panel title="Notas de PD">
        <Campo f={f} clave="PDs!D197" label="Notas (salen en la página de notas del PDF)" tipo="area" />
      </Panel>

      <Panel title="Ajustes de nivel">
        <div class="grid-fields">
          <Campo f={f} clave="Principal!Y23" label="Ajuste por Gnosis" />
          <Campo f={f} clave="Principal!Y24" label="Ajuste por legados" />
          <Campo f={f} clave="Principal!Y25" label="Artefacto vinculado" />
          <Campo f={f} clave="Principal!Y26" label="PD adicionales (nivel)" tipo="numero" />
          <Campo f={f} clave="Principal!AB26" label="PD adicionales" tipo="numero" />
        </div>
        <p class="muted small">Ajuste total: nivel <strong>{txt('Principal!AA27')}</strong> · <strong>{txt('Principal!AB27')}</strong> PD</p>
      </Panel>
    </>
  );
}

function ResumenCategoria({ i, nombre }: { i: number; nombre: string }) {
  const disp = num(`PDs!${'JLNPR'[i]}194`);
  const usado = num(`PDs!${'KMOQS'[i]}194`);
  const limites = [['Combate', 86], ['Magia', 104], ['Psíquica', 120]] as const;
  return (
    <div class="pd-cat">
      <div class="row between"><strong>{nombre}</strong><span class={usado > disp ? 'error' : ''}>{usado} / {disp} PD</span></div>
      <Barra v={usado} max={disp} />
      {limites.map(([k, r]) => {
        const lim = num(`PDs!${PRIM.coste[i]}${r}`);
        const u = num(`PDs!${PRIM.pd[i]}${r}`);
        return (
          <div key={k} class="pd-lim">
            <div class="row between small"><span class="muted">{k}</span><span class={u > lim ? 'error' : ''}>{u} / {Math.round(lim)}</span></div>
            <Barra v={u} max={lim} />
          </div>
        );
      })}
    </div>
  );
}

function Barra({ v: x, max }: { v: number; max: number }) {
  const p = max > 0 ? Math.min(100, (100 * x) / max) : 0;
  return <div class="barra"><div class={x > max ? 'over' : ''} style={{ width: `${p}%` }} /></div>;
}

type Cols = { pd: string[]; coste: string[] };

function Bloque({ f, n, cats, titulo, filas, cols, grupo, total = 'AA', esp = 'Z', extra = [], cabecera }: {
  f: Ficha; n: number; cats: string[]; titulo: string; filas: number[]; cols: Cols; grupo?: boolean;
  total?: string; esp?: string | null; extra?: string[][]; cabecera?: preact.ComponentChildren;
}) {
  return (
    <Panel title={titulo} extra={cabecera}>
      <div class="table-wrap">
        <table class="tabla pd">
          <thead>
            <tr>
              <th scope="col" class="left">Habilidad</th>
              {Array.from({ length: n }, (_, i) => <th scope="col" key={i}>PD {n > 1 ? cats[i] || `Cat. ${i + 1}` : ''}</th>)}
              {extra.map(([, t]) => <th scope="col" key={t}>{t}</th>)}
              {esp && <th scope="col">Especial</th>}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => {
              const g = grupo ? txt(`PDs!D${r}`) : '';
              const nombre = txt(`PDs!E${r}`);
              return (
                <tr key={r} class={g ? 'grupo' : ''}>
                  <th scope="row" class="left">{g && <span class="muted small">{g} · </span>}{nombre}</th>
                  {Array.from({ length: n }, (_, i) => (
                    <td key={i}>
                      <Campo f={f} clave={`PDs!${cols.pd[i]}${r}`} tipo="numero" class="mini"
                        label={<span class="coste" title="Coste por punto">×{txt(`PDs!${cols.coste[i]}${r}`)}<span class="sr-only"> PD en {nombre}</span></span>} />
                    </td>
                  ))}
                  {extra.map(([c, t, tipo]) => (
                    <td key={c}><Campo f={f} clave={`PDs!${c}${r}`} tipo={tipo === 'texto' ? 'texto' : 'numero'} class="mini" label={<span class="sr-only">{t} {nombre}</span>} /></td>
                  ))}
                  {esp && <td><Campo f={f} clave={`PDs!${esp}${r}`} tipo="numero" class="mini" label={<span class="sr-only">Especial {nombre}</span>} /></td>}
                  <td class="total">{txt(`PDs!${total}${r}`)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Filas de compra (tablas, artes marciales...): un desplegable por fila; se muestra una fila vacía más. */
function Compras({ f, n, titulo, filas, extra, grado }: {
  f: Ficha; n: number; titulo: string; filas: number[]; extra?: string; grado?: string;
}) {
  const llenas = filas.filter((r) => f.entradas[`PDs!E${r}`]);
  const visibles = filas.slice(0, Math.min(filas.length, llenas.length + 1));
  return (
    <Panel title={titulo}>
      {visibles.map((r) => (
        <div class="compra" key={r}>
          <Campo f={f} clave={`PDs!E${r}`} label="Elección" class="grow" />
          {extra && f.entradas[`PDs!E${r}`] && <Campo f={f} clave={`PDs!${extra}${r}`} label="Arma" />}
          {grado && f.entradas[`PDs!E${r}`] && <Campo f={f} clave={`PDs!${grado}${r}`} label="Grado" />}
          {f.entradas[`PDs!E${r}`] && Array.from({ length: n }, (_, i) => (
            <Campo key={i} f={f} clave={`PDs!${PRIM.pd[i]}${r}`} label={n > 1 ? `PD cat. ${i + 1}` : 'PD'} class="mini" />
          ))}
          {txt(`PDs!V${r}`) && <p class="muted small compra-desc">{txt(`PDs!V${r}`)}</p>}
        </div>
      ))}
    </Panel>
  );
}

const FILAS_PROPIAS = [180, 181, 182, 183, 184];

/** Habilidades secundarias que el personaje define por su cuenta: nombre, característica, coste y PD por categoría. */
function SecundariasPropias({ f, n }: { f: Ficha; n: number }) {
  const llena = (r: number) => Boolean(f.entradas[`PDs!E${r}`]);
  const ultima = FILAS_PROPIAS.reduce((m, r, i) => (llena(r) ? i : m), -1);
  const visibles = FILAS_PROPIAS.slice(0, Math.min(FILAS_PROPIAS.length, ultima + 2));
  return (
    <Panel title="Habilidades secundarias propias" extra={<span class="muted small">Las que no están en la lista del juego</span>}>
      {visibles.map((r) => (
        <div class="compra" key={r}>
          <Campo f={f} clave={`PDs!D${r}`} label="Tipo" />
          <Campo f={f} clave={`PDs!E${r}`} label="Habilidad" class="grow" />
          <Campo f={f} clave={`PDs!H${r}`} label="Característica" />
          <Campo f={f} clave={`PDs!I${r}`} label="Especialidad" />
          {Array.from({ length: n }, (_, i) => (
            <span class="row" key={i}>
              <Campo f={f} clave={`PDs!${SEC.coste[i]}${r}`} label={n > 1 ? `Coste cat. ${i + 1}` : 'Coste'} tipo="numero" class="mini" />
              <Campo f={f} clave={`PDs!${SEC.pd[i]}${r}`} label="PD" tipo="numero" class="mini" />
            </span>
          ))}
          {['W', 'X', 'Y', 'Z'].map((c, i) => (
            <Campo key={c} f={f} clave={`PDs!${c}${r}`} label={['Bono cat.', 'Bono nat.', 'Hab. nat.', 'Especial'][i]} tipo="numero" class="mini" />
          ))}
          <p class="muted small compra-desc">Total: <strong>{txt(`PDs!AA${r}`)}</strong></p>
        </div>
      ))}
    </Panel>
  );
}
