import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt } from './campos';
import { ElementosGremio } from './ElementosGremio';
import { editar } from '../store';
import { MAX_CV, NIVELES, POR_CV, avisos, bonoDe, dominadosMantenibles, efecto, innatosDe, nivelMantenido, siguiente, ventajasDe } from '../psiquica/mantenidos';

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

const nv = (i: number) => NIVELES[i] ?? '—';

/** Ayudante de poderes mantenidos: nivel de cada innato (el del Excel), CV mínimos para el siguiente y ventajas. Solo avisa. */
function Mantenidos({ f }: { f: Ficha }) {
  const vs = ventajasDe(txt);
  const bono = bonoDe(vs);
  const innatos = innatosDe(txt);
  const nombres = new Set(innatos.map((i) => i.n));
  const otros = dominadosMantenibles(txt).filter((x) => !nombres.has(x.n));
  const cvIncr = innatos.reduce((t, i) => t + i.cv, 0);
  const libres = Number(txt(p('F', 20))) || 0;
  const comprados = Number(txt(p('M', 13))) || 0;
  const lista = avisos({ activos: innatos.length, innatos: comprados, cvIncr, cvLibres: libres, porPoder: innatos.map((i) => i.cv) });
  return (
    <Panel title="Poderes mantenidos" extra={<span class="muted small">{innatos.length}/{comprados} innatos · {cvIncr} CV incrementando · {libres} CV libres</span>}>
      <p class="muted small">Los innatos se mantienen sin tirada en el nivel que da tu potencial (o en la dificultad mínima del poder). Cada CV libre suma +{POR_CV}, hasta {MAX_CV}, y no se recupera mientras lo mantengas (Core p. 212-213).</p>
      {vs.length > 0 && <p class="small">{vs.map((v) => <span class="chip" key={v.n} title={v.ref}>{v.n}: +{v.efecto} nivel</span>)}</p>}
      {innatos.map((i) => {
        const datos = { nat: i.nat, cv: i.cv, bono, min: i.poder?.min ?? 0 };
        const ahora = i.excel >= 0 ? i.excel : nivelMantenido(datos);
        const sig = siguiente(datos);
        return (
          <div class="mant-psi" key={i.fila}>
            <div class="row between wrap"><strong>{i.n}</strong><span class="chip">{nv(ahora)}{efecto(i.poder, ahora) ? ` · ${efecto(i.poder, ahora)}` : ''}</span></div>
            <span class="muted small">Potencial {i.nat}{i.cv ? ` + ${POR_CV * i.cv} (${i.cv} CV)` : ''}{i.poder ? ` · mínima ${nv(i.poder.min)}` : ' · no está en la tabla de poderes mantenibles'}</span>
            {sig ? (
              <div class="row wrap">
                <span class="small">Siguiente: <strong>{nv(sig.nivel)}</strong>{efecto(i.poder, sig.nivel) ? ` (${efecto(i.poder, sig.nivel)})` : ''} con {sig.extra} CV más ({sig.cv} en total)</span>
                <button type="button" class="btn" onClick={() => editar(f.id, p('AI', i.fila), sig.cv)}>Poner {sig.cv} CV</button>
              </div>
            ) : <span class="muted small">Con {MAX_CV} CV no sube de nivel.</span>}
          </div>
        );
      })}
      {!innatos.length && <p class="muted small">Ningún innato activo: elige poderes en «Poderes innatos».</p>}
      {otros.length > 0 && (
        <p class="small">Otros mantenibles: {otros.map((x) => `${x.n} (${nv(nivelMantenido({ nat: x.nat, cv: 0, bono, min: x.poder.min }))})`).join(' · ')}</p>
      )}
      {lista.map((t) => <p class="aviso" role="status" key={t}>{t}</p>)}
    </Panel>
  );
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
        <Panel title="Disciplinas afines" plegable extra={<span class="muted small">{txt(p('F', 24))}</span>}>
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

      <Panel title="Poderes psíquicos" plegable extra={<span class="muted small">CVs gastados en cada poder</span>}>
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

      <Panel title="Poderes innatos" plegable extra={<span class="muted small">{txt(p('AD', 16))}</span>}>
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

      <Mantenidos f={f} />

      <Panel title="Dificultades y notas" plegable>
        <div class="grid-fields">
          <Campo f={f} clave={p('J', 63)} label="Dificultad personalizada" />
        </div>
        <Campo f={f} clave={p('C', 53)} label="Notas psíquicas (salen en la página de notas del PDF)" tipo="area" />
      </Panel>
    </>
  );
}
