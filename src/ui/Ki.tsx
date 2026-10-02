import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Compra, Panel, txt } from './campos';
import { formulaLista } from '../engine';

// Hoja Ki del Excel
const k = (col: string, fila: number) => `Ki!${col}${fila}`;
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const GLIFO = /^[\s│├└─]*$/; // trazos del árbol de habilidades

const CARACT = [12, 14, 16, 18, 20, 22]; // AGI, CON, DES, FUE, POD, VOL
const ELEMENTOS = [11, 13, 15, 17, 19];  // Madera, Metal, Aire, Agua, Fuego

/** Primer texto de la fila (entre las columnas dadas) que no sea un trazo del árbol, con su profundidad. */
function nombreDe(fila: number, cols: string[]): { nombre: string; nivel: number } | null {
  for (let i = 0; i < cols.length; i++) {
    const t = txt(k(cols[i], fila));
    if (t && !GLIFO.test(t)) return { nombre: t, nivel: i };
  }
  return null;
}

export function Ki({ f }: { f: Ficha }) {
  return (
    <>
      <Avisos claves={['Ki!C31']} />

      <Panel title="Puntos de Ki" extra={<Campo f={f} clave={k('I', 10)} label="Unificación" class="inline" />}>
        <div class="table-wrap">
          <table class="tabla">
            <thead><tr><th scope="col" class="left"></th><th scope="col">Acumulación</th><th scope="col">Mitad</th><th scope="col">Ki</th><th scope="col">Actual</th></tr></thead>
            <tbody>
              {CARACT.map((r) => (
                <tr key={r}>
                  <th scope="row" class="left">{txt(k('C', r))}</th>
                  <td>{txt(k('D', r))}</td><td>{txt(k('E', r))}</td><td>{txt(k('F', r)) || '—'}</td>
                  <td><Campo f={f} clave={k('G', r)} label={<span class="sr-only">Ki actual {txt(k('C', r))}</span>} tipo="numero" class="mini" /></td>
                </tr>
              ))}
              <tr class="total-fila">
                <th scope="row" class="left">Total</th>
                <td class="total">{txt(k('D', 24))}</td><td class="total">{txt(k('E', 24))}</td><td class="total">{txt(k('F', 24))}</td>
                <td class="muted small">{txt(k('G', 24))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Puntos de CM" extra={<span class="muted small">Límites libres: <strong>{txt(k('I', 39)) || 0}</strong></span>}>
        <p>CM usados <strong>{txt(k('E', 29)) || 0}</strong> de <strong>{txt(k('C', 29)) || 0}</strong></p>
        <Barra usado={Number(txt(k('E', 29))) || 0} total={Number(txt(k('C', 29))) || 0} />
        <div class="grid-fields">
          <Campo f={f} clave={k('C', 40)} label="Límite 1" />
          <Campo f={f} clave={k('C', 41)} label="Límite 2" />
        </div>
      </Panel>

      <Panel title="Habilidades del Ki" extra={<span class="muted small">Marca las que has comprado (coste en CM)</span>}>
        <div class="habs">
          {rango(10, 64).map((r) => {
            const n = nombreDe(r, ['K', 'L', 'M', 'N']);
            if (!n || !formulaLista(k('Q', r))) return null;
            return (
              <div class="hab" key={r} style={{ paddingLeft: `${n.nivel * 18}px` }}>
                <Compra f={f} clave={k('Q', r)} label={n.nombre} />
                <span class="muted small">{txt(k('P', r)) && txt(k('P', r)) !== '-' ? `${txt(k('P', r))} CM` : ''}</span>
              </div>
            );
          })}
        </div>
        <div class="grid-fields">
          <Campo f={f} clave={k('E', 35)} label={`${txt(k('C', 35)) || 'Detección del Ki'}: especial`} tipo="numero" />
          <Campo f={f} clave={k('E', 36)} label={`${txt(k('C', 36)) || 'Ocultación del Ki'}: especial`} tipo="numero" />
        </div>
        <p class="muted small">Detección total <strong>{txt(k('F', 35))}</strong> · Ocultación total <strong>{txt(k('F', 36))}</strong></p>
      </Panel>

      <Panel title="Némesis, Vacío y Anulación">
        <div class="habs">
          {rango(43, 64).map((r) => {
            const n = nombreDe(r, ['C', 'D', 'E', 'F', 'G']);
            if (!n || !formulaLista(k('I', r))) return null;
            return (
              <div class="hab" key={r} style={{ paddingLeft: `${n.nivel * 18}px` }}>
                <Compra f={f} clave={k('I', r)} label={n.nombre} />
                <span class="muted small">{txt(k('H', r)) ? `${txt(k('H', r))} CM` : ''}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <div class="cols-2">
        <Panel title="Sellos Dragón">
          <div class="habs">
            {rango(28, 37).map((r) => <Compra key={r} f={f} clave={k('H', r)} />)}
          </div>
        </Panel>
        <Panel title="Sellos de invocación">
          <div class="table-wrap">
            <table class="tabla">
              <thead><tr><th scope="col" class="left">Elemento</th><th scope="col">Menor</th><th scope="col">Mayor</th></tr></thead>
              <tbody>
                {ELEMENTOS.map((r) => (
                  <tr key={r}>
                    <th scope="row" class="left">{txt(k('V', r))}</th>
                    <td><Compra f={f} clave={k('X', r)} label={<span class="sr-only">Menor {txt(k('V', r))}</span>} /></td>
                    <td><Compra f={f} clave={k('Y', r)} label={<span class="sr-only">Mayor {txt(k('V', r))}</span>} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {Number(txt(k('Q', 37))) > 0 && (
        <Panel title="Ataque elemental">
          <div class="grid-fields">
            {['Y', 'AA', 'AC', 'AE', 'AG', 'AI'].map((c, i) => <Campo key={c} f={f} clave={k(c, 22)} label={`Elemento ${i + 1}`} />)}
          </div>
        </Panel>
      )}

      <Panel title="Pactos de sangre" extra={<span class="muted small">Criaturas invocables</span>}>
        {rango(12, 20).filter((r, i) => i === 0 || f.entradas[k('AA', r - 1)] || f.entradas[k('AD', r - 1)]).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={k('AA', r)} label="Criatura" class="grow" />
            <Campo f={f} clave={k('AD', r)} label="Sellos necesarios" class="grow" />
          </div>
        ))}
      </Panel>

      <TecnicasDominio f={f} />

      <Panel title="Notas de Ki">
        <Campo f={f} clave={k('C', 67)} label="Notas (salen en la página de notas del PDF)" tipo="area" />
      </Panel>
    </>
  );
}

function Barra({ usado, total }: { usado: number; total: number }) {
  const p = total > 0 ? Math.min(100, (100 * usado) / total) : 0;
  return <div class="barra"><div class={usado > total ? 'over' : ''} style={{ width: `${p}%` }} /></div>;
}

const BLOQUES = [26, 34, 42, 50, 58, 66];

/** Técnicas de dominio: 10 técnicas (dos por bloque) elegidas de la tabla de técnicas. */
function TecnicasDominio({ f }: { f: Ficha }) {
  const casillas = BLOQUES.flatMap((r) => [{ r, col: 'V', sal: ['AA', 'AB'] }, { r, col: 'AD', sal: ['AI', 'AJ'] }]);
  const ultima = casillas.reduce((m, x, i) => (f.entradas[k(x.col, x.r)] ? i : m), -1);
  return (
    <Panel title="Técnicas de dominio">
      <div class="armas">
        {casillas.slice(0, Math.min(casillas.length, ultima + 2)).map((x, i) => {
          const lineas = rango(x.r + 1, x.r + 7).map((r) => txt(k(x.col, r))).filter((t) => t && t !== 'Nivel:');
          const elegida = Boolean(f.entradas[k(x.col, x.r)]);
          return (
            <article class="arma" key={i}>
              <Campo f={f} clave={k(x.col, x.r)} label={`Técnica ${i + 1}`} />
              {elegida && (
                <>
                  <p class="small">Nivel <strong>{txt(k(x.sal[0], x.r + 1))}</strong> · CM <strong>{txt(k(x.sal[1], x.r + 1))}</strong></p>
                  {lineas.map((t) => <p class="muted small" key={t}>{t}</p>)}
                </>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
