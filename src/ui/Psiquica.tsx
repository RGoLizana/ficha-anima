import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt } from './campos';
import { ElementosGremio } from './ElementosGremio';

// Hoja Psíquicos del Excel
const p = (col: string, fila: number) => `Psíquicos!${col}${fila}`;
const impares = (a: number, b: number) => Array.from({ length: (b - a) / 2 + 1 }, (_, i) => a + 2 * i);

/** Filas ocupadas más una libre: nunca se bloquea añadir otra. */
function visibles(f: Ficha, filas: number[], cols: string[]) {
  const llena = (r: number) => cols.some((c) => f.entradas[p(c, r)]);
  const ultima = filas.reduce((x, r, i) => (llena(r) ? i : x), -1);
  return filas.slice(0, Math.min(filas.length, ultima + 2));
}

const SALIDAS: [string, number, string][] = [
  ['C', 12, 'CVs totales'], ['E', 12, 'CVs usados'], ['H', 11, 'Potencial'],
  ['O', 12, 'Turno'], ['P', 12, 'Proyección ataque'], ['Q', 12, 'Proyección defensa'],
];

/** Aviso de una celda del Excel solo si su texto cumple `re` (C22 avisa de CVs y de innatos). */
function AvisoDe({ clave, re }: { clave: string; re: RegExp }) {
  return re.test(txt(clave)) ? <Avisos claves={[clave]} /> : null;
}

export function Psiquica({ f }: { f: Ficha }) {
  return (
    <>
      <Panel title="Potencial psíquico" extra={<span class="muted small">{txt(p('L', 5))} · nivel {txt(p('P', 5))}</span>}>
        <div class="salidas">
          {SALIDAS.map(([c, r, t]) => (
            <div class="stat" key={t}><div class="stat-v">{txt(p(c, r)) || '—'}</div><div class="muted small">{t}</div></div>
          ))}
        </div>
        <div class="grid-fields">
          <Campo f={f} clave={p('M', 10)} label="CVs" />
          <Campo f={f} clave={p('M', 13)} label="Nº de innatos" tipo="numero" />
          <Campo f={f} clave={p('J', 13)} label="Cristal Psi" />
          <Campo f={f} clave={p('J', 16)} label="CVs libres actuales" tipo="numero" />
        </div>
        <table class="tabla">
          <thead><tr><th scope="col" class="left">Uso de CVs</th><th scope="col">CVs</th></tr></thead>
          <tbody>
            {[15, 16, 17, 18, 19, 20].map((r) => (
              <tr key={r}><th scope="row" class="left">{txt(p('C', r))}</th><td class="total">{txt(p('F', r))}</td></tr>
            ))}
          </tbody>
        </table>
        <AvisoDe clave={p('C', 22)} re={/CVs/} />
      </Panel>

      <div class="cols-2">
        <Panel title="Disciplinas afines" extra={<span class="muted small">{txt(p('F', 24))}</span>}>
          {visibles(f, impares(25, 35), ['C']).map((r) => (
            <div class="compra" key={r}>
              <Campo f={f} clave={p('C', r)} label="Disciplina" class="grow" />
              <span class="muted small">{txt(p('F', r))}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Patrones mentales">
          <p><strong>{txt(p('C', 39)) || '—'}</strong></p>
          <p class="muted small">{txt(p('F', 39))}{txt(p('F', 40)) ? ` · ${txt(p('F', 40))}` : ''}</p>
        </Panel>
      </div>

      <Panel title="Poderes psíquicos" extra={<span class="muted small">CVs gastados en cada poder</span>}>
        {visibles(f, impares(11, 63), ['V', 'AA']).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={p('V', r)} label="Poder" class="grow" />
            <Campo f={f} clave={p('AA', r)} label="CVs" tipo="numero" class="mini" />
            <span class="muted small">{txt(p('AB', r)) && `Bono ${txt(p('AB', r))}`}{txt(p('V', r + 1)) ? ` · ${txt(p('V', r + 1))} nv ${txt(p('Z', r + 1))}` : ''}</span>
          </div>
        ))}
        <ElementosGremio f={f} tipo="disciplina" />
        <Avisos claves={['PDs!V120']} />
      </Panel>

      <Panel title="Poderes innatos" extra={<span class="muted small">{txt(p('AD', 16))}</span>}>
        <div class="compra">
          <Campo f={f} clave={p('AD', 11)} label="Poder a potenciar" class="grow" />
          <Campo f={f} clave={p('AO', 12)} label="Característica" />
          <span class="muted small">Potencial {txt(p('AI', 11))} {txt(p('AL', 11))}</span>
        </div>
        {visibles(f, impares(17, 61), ['AD', 'AI', 'AJ']).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={p('AD', r)} label="Poder innato" class="grow" />
            <Campo f={f} clave={p('AI', r)} label="CVs" tipo="numero" class="mini" />
            <Campo f={f} clave={p('AJ', r)} label="Otros" tipo="numero" class="mini" />
            <span class="muted small">{txt(p('AK', r))} {txt(p('AL', r))}</span>
          </div>
        ))}
        <AvisoDe clave={p('C', 22)} re={/innatos/} />
      </Panel>

      <Panel title="Dificultades y notas">
        <div class="grid-fields">
          <Campo f={f} clave={p('J', 63)} label="Dificultad personalizada" />
        </div>
        <Campo f={f} clave={p('C', 53)} label="Notas psíquicas (salen en la página de notas del PDF)" tipo="area" />
      </Panel>
    </>
  );
}
