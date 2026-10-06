import { signal } from '@preact/signals';
import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt } from './campos';
import { ElementosGremio } from './ElementosGremio';
import { GrimorioDisciplinas, MisPoderes, misPoderes } from './GrimoriosInfo';
import { GrimorioPsiquica } from './GrimorioPsiquica';
import { editar } from '../store';
import { MAX_CV, NIVELES, POR_CV, avisos, bonoDe, dominadosMantenibles, efecto, innatosDe, nivelMantenido, siguiente, ventajasDe } from '../psiquica/mantenidos';

// Hoja Psíquicos del Excel
const p = (col: string, fila: number) => `Psíquicos!${col}${fila}`;
const impares = (a: number, b: number) => Array.from({ length: (b - a) / 2 + 1 }, (_, i) => a + 2 * i);

const elegidas = (f: Ficha, col: string, filas: number[]) => filas.map((r) => String(f.entradas[p(col, r)] ?? '')).filter(Boolean);
/** Nombres repetidos entre las casillas elegidas (una ficha importada puede traerlos): se avisa, no se borra. */
const repetidos = (xs: string[]) => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];

/** Solo las filas ocupadas y la primera libre (aunque haya huecos entre ellas): nunca se bloquea añadir otra. */
function visibles(f: Ficha, filas: number[], cols: string[]) {
  const llena = (r: number) => cols.some((c) => f.entradas[p(c, r)]);
  const libre = filas.find((r) => !llena(r));
  return [...filas.filter(llena), ...(libre ? [libre] : [])];
}

const SALIDAS: [string, number, string][] = [
  ['C', 12, 'CVs totales'], ['E', 12, 'CVs usados'], ['H', 11, 'Potencial'],
  ['O', 12, 'Turno'], ['P', 12, 'Proyección ataque'], ['Q', 12, 'Proyección defensa'],
];

/** Pestañas de la sección: todos los paneles siguen en la página, solo se ve el de la pestaña elegida. */
const PESTANAS = [['resumen', 'Resumen'], ['poderes', 'Mis poderes'], ['disciplinas', 'Disciplinas'], ['mantenidos', 'Mantenidos'], ['construccion', 'Construcción']] as const;
type Pestana = (typeof PESTANAS)[number][0];
export const pestanaPsi = signal<Pestana>('resumen');
const oculto = (t: Pestana) => pestanaPsi.value !== t;

/** Aviso de una celda del Excel solo si su texto cumple `re` (C22 avisa de CVs y de innatos). */
function AvisoDe({ clave, re }: { clave: string; re: RegExp }) {
  return re.test(txt(clave)) ? <Avisos claves={[clave]} /> : null;
}

const nv = (i: number) => NIVELES[i] ?? '—';

/** Casilla numérica con −/+ de 44 px a los lados (escribe en la misma celda). */
function Pasos({ f, clave, label }: { f: Ficha; clave: string; label: string }) {
  const n = Number(f.entradas[clave] ?? txt(clave)) || 0;
  return (
    <div class="psi-pasos">
      <span class="psi-pasos-t" aria-hidden="true">{label}</span>
      <button type="button" class="btn" aria-label={`Quitar 1 a ${label}`} onClick={() => editar(f.id, clave, n > 1 ? n - 1 : null)}>−</button>
      <Campo f={f} clave={clave} label={label} tipo="numero" class="mini" />
      <button type="button" class="btn" aria-label={`Sumar 1 a ${label}`} onClick={() => editar(f.id, clave, n + 1)}>+</button>
    </div>
  );
}

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
    <Panel title="Poderes mantenidos" area="mantenidos" oculto={oculto('mantenidos')} extra={<span class="muted small">{innatos.length}/{comprados} innatos · {cvIncr} CV incrementando · {libres} CV libres</span>}>
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

/** Lo que se mira en partida sin bajar: disciplinas, poderes dominados e innatos con su nivel. */
function Vistazo() {
  const disciplinas = impares(25, 35).map((r) => txt(p('C', r))).filter(Boolean);
  const poderes = misPoderes();
  const innatos = innatosDe(txt);
  const ir = (t: Pestana) => <button type="button" class="btn" onClick={() => { pestanaPsi.value = t; }}>{PESTANAS.find((x) => x[0] === t)![1]} →</button>;
  return (
    <Panel title="De un vistazo" area="resumen" oculto={oculto('resumen')}>
      <div class="psi-vistazo">
        <div><span class="muted small">Disciplinas afines</span><p>{disciplinas.length ? disciplinas.map((d) => <span class="chip psi-acento" key={d}>{d}</span>) : '—'}</p></div>
        <div><span class="muted small">Poderes dominados</span><p><strong>{poderes.length}</strong> {ir('poderes')}</p></div>
        <div><span class="muted small">Innatos ({innatos.length}/{txt(p('M', 13)) || 0})</span>
          <p>{innatos.length ? innatos.map((i) => <span class="chip psi-acento" key={i.fila}>{i.n} · {nv(i.excel)}</span>) : '—'} {ir('mantenidos')}</p></div>
      </div>
    </Panel>
  );
}

export function Psiquica({ f }: { f: Ficha }) {
  const innatos = new Set(innatosDe(txt).map((i) => i.n));
  const filasPoder = visibles(f, impares(11, 63), ['V', 'AA']);
  const ocupadas = filasPoder.filter((r) => txt(p('V', r)) || f.entradas[p('AA', r)]);
  const libre = filasPoder.find((r) => !ocupadas.includes(r));
  const grupos = [...new Set(ocupadas.map((r) => txt(p('V', r + 1)) || 'Sin disciplina'))].sort((a, b) => a.localeCompare(b, 'es'));
  const nPoderes = misPoderes().length;
  return (
    <div class="stack psiquica">
      <div class="psi-tabs" role="tablist" aria-label="Partes de la psíquica">
        {PESTANAS.map(([id, t]) => (
          <button type="button" role="tab" key={id} id={`psi-${id}`} aria-selected={pestanaPsi.value === id} aria-controls="psi-panel"
            class="psi-tab" onClick={() => { pestanaPsi.value = id; }}>
            {t}{id === 'poderes' && nPoderes ? <small> {nPoderes}</small> : ''}
          </button>
        ))}
      </div>
      <div id="psi-panel" role="tabpanel" aria-labelledby={`psi-${pestanaPsi.value}`} class="stack">
        <Panel title="Potencial psíquico" area="resumen" oculto={oculto('resumen')} extra={<span class="muted small">{txt(p('L', 5))} · nivel {txt(p('P', 5))}</span>}>
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
        <Vistazo />
        <Panel title="Patrones mentales" area="resumen" oculto={oculto('resumen')}>
          <p><strong>{txt(p('C', 39)) || '—'}</strong></p>
          <p class="muted small">{txt(p('F', 39))}{txt(p('F', 40)) ? ` · ${txt(p('F', 40))}` : ''}</p>
        </Panel>

        <MisPoderes oculto={oculto('poderes')} innatos={innatos} />
        <GrimorioDisciplinas oculto={oculto('disciplinas')} />
        <Mantenidos f={f} />

        <Panel title="Disciplinas afines" plegable area="construccion" oculto={oculto('construccion')} extra={<span class="muted small">{txt(p('F', 24))}</span>}>
          <div class="psi-cartas">
            {visibles(f, impares(25, 35), ['C']).map((r) => (
              <div class="psi-carta" key={r}>
                <Campo f={f} clave={p('C', r)} label={f.entradas[p('C', r)] ? 'Disciplina' : '+ Añadir disciplina'} excluir={elegidas(f, 'C', impares(25, 35))} />
                {txt(p('F', r)) && <span class="muted small">{txt(p('F', r))}</span>}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Poderes psíquicos" plegable area="construccion" oculto={oculto('construccion')} extra={<span class="muted small">CVs gastados en cada poder</span>}>
          {grupos.map((g) => (
            <section key={g} class="psi-grupo" aria-label={g}>
              <h3 class="psi-grupo-t">{g}</h3>
              <div class="psi-cartas">
                {ocupadas.filter((r) => (txt(p('V', r + 1)) || 'Sin disciplina') === g).map((r) => (
                  <div class="psi-carta" key={r}>
                    <Campo f={f} clave={p('V', r)} label="Poder" excluir={elegidas(f, 'V', impares(11, 63))} />
                    <div class="row between wrap">
                      <span class="muted small">{txt(p('Z', r + 1)) && `Nivel ${txt(p('Z', r + 1))}`}{txt(p('AB', r)) ? ` · bono +${txt(p('AB', r))}` : ''}</span>
                      <Pasos f={f} clave={p('AA', r)} label="CVs" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {libre && (
            <div class="psi-carta libre">
              <Campo f={f} clave={p('V', libre)} label="+ Añadir poder" excluir={elegidas(f, 'V', impares(11, 63))} />
            </div>
          )}
          {repetidos(elegidas(f, 'V', impares(11, 63))).map((n) => <p class="aviso" role="status" key={n}>«{n}» está elegido dos veces: cuenta doble en CVs. Quita uno.</p>)}
          <ElementosGremio f={f} tipo="disciplina" />
          <Avisos claves={['PDs!V120']} />
        </Panel>

        <Panel title="Poderes innatos" plegable area="construccion" oculto={oculto('construccion')} extra={<span class="muted small">{txt(p('AD', 16))}</span>}>
          <div class="psi-carta">
            <Campo f={f} clave={p('AD', 11)} label="Poder a potenciar" />
            <div class="row between wrap">
              <span class="muted small">Potencial {txt(p('AI', 11))} {txt(p('AL', 11))}</span>
              <Campo f={f} clave={p('AO', 12)} label="Característica" />
            </div>
          </div>
          <div class="psi-cartas">
            {visibles(f, impares(17, 61), ['AD', 'AI', 'AJ']).map((r) => {
              const usada = ['AD', 'AI', 'AJ'].some((c) => f.entradas[p(c, r)]);
              return (
                <div class={'psi-carta' + (usada ? '' : ' libre')} key={r}>
                  <Campo f={f} clave={p('AD', r)} label={usada ? 'Poder innato' : '+ Añadir innato'} excluir={elegidas(f, 'AD', impares(17, 61))} />
                  {usada && (
                    <div class="row between wrap">
                      <span class="muted small">{txt(p('AK', r))} {txt(p('AL', r))}</span>
                      <Pasos f={f} clave={p('AI', r)} label="CVs" />
                      <Campo f={f} clave={p('AJ', r)} label="Otros" tipo="numero" class="mini" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {repetidos(elegidas(f, 'AD', impares(17, 61))).map((n) => <p class="aviso" role="status" key={n}>«{n}» está elegido como innato dos veces. Quita uno.</p>)}
          <AvisoDe clave={p('C', 22)} re={/innatos/} />
        </Panel>

        <Panel title="Dificultades y notas" plegable area="construccion" oculto={oculto('construccion')}>
          <div class="grid-fields">
            <Campo f={f} clave={p('J', 63)} label="Dificultad personalizada" />
          </div>
          <Campo f={f} clave={p('C', 53)} label="Notas psíquicas (salen en la página de notas del PDF)" tipo="area" />
        </Panel>
        <GrimorioPsiquica f={f} oculto={oculto('construccion')} />
      </div>
    </div>
  );
}
