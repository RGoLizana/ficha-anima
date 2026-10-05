import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Panel, Proximamente, txt } from './campos';
import COLORES from '../data/vias-colores.json';

// Grimorios informativos: todas las vías del mago (o disciplinas del psíquico) a la vez, sin elegir una sola como en
// la hoja "Grimorio de Vía" del Excel. Los datos salen de las tablas del Excel (tools/export_grimorios.py).
type Conjuro = { n: string; v: string; l: number; d: string; t: string; a: string; g: [number, number, number, string][]; e: string };
type Poder = { n: string; d: string; l: number; m: string; a: string; f: string[] };
type Datos = { conjuros: Conjuro[]; poderes: Poder[] };

let cache: Datos | null = null;
function useDatos() {
  const [datos, setDatos] = useState<Datos | null>(cache);
  useEffect(() => {
    if (!cache) void import('../data/grimorios.json').then((m) => { cache = m.default as Datos; setDatos(cache); });
  }, []);
  return datos;
}

// Colores de cada vía, los del formato condicional de la hoja "Grimorio de Vía" (tools/export_vias_colores.py).
// Sin entrada en el Excel (p. ej. Libre acceso) la vía se pinta en neutro.
const COLORES_VIAS = COLORES as Record<string, { f: string[]; t: string | null }>;
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();
const luz = (h: string) => { const [r, g, b] = rgb(h).map((x) => { const v = x / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

/** Color de acento de una vía legible sobre el tema oscuro: el primer color del Excel con luminancia suficiente (relleno, si no el de texto); si todos son muy oscuros, el más claro aclarado. */
export function acentoVia(via: string): string | null {
  const c = COLORES_VIAS[via];
  if (!c) return null;
  const cand = [...c.f, ...(c.t ? [c.t] : [])];
  const bueno = cand.find((h) => luz(h) >= 0.15);
  if (bueno) return bueno;
  let h = cand.reduce((a, b) => (luz(b) > luz(a) ? b : a));
  for (let i = 0; i < 10 && luz(h) < 0.15; i++) h = hex(rgb(h).map((x) => x + (255 - x) * 0.2));
  return h;
}

/** Variable CSS --via con el acento de la vía (la clase .con-via la usa para borde, fondo suave y barra). */
export function estiloVia(via: string) {
  const a = acentoVia(via);
  return a ? { '--via': a } as Record<string, string> : undefined;
}
export const claseVia = (via: string) => (COLORES_VIAS[via] ? ' con-via' : '');

/** Nombre de vía como etiqueta con su color (el texto sigue diciendo la vía, el color es solo un apoyo). */
export function ViaChip({ via }: { via: string }) {
  return <span class={'via-chip' + claseVia(via)} style={estiloVia(via)}>{via}</span>;
}

const GRADOS = ['Base', 'Intermedio', 'Avanzado', 'Arcano'];
const DIFICULTADES = ['Rutinario', 'Fácil', 'Medio', 'Difícil', 'Muy difícil', 'Absurdo', 'Casi imposible', 'Imposible', 'Inhumano', 'Zen'];
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const unicos = (xs: string[]) => [...new Set(xs.filter(Boolean))];

function Carta({ c, aprendido }: { c: Conjuro; aprendido: boolean }) {
  return (
    <article class={'arma info' + (aprendido ? ' aprendido' : ' sin-aprender bloqueado')}>
      <h3 class="arma-titulo">{c.n}</h3>
      <p class="small muted">Nivel <strong>{c.l}</strong> · {aprendido ? 'Alcanzado' : `Bloqueado: requiere nivel de vía ${c.l}`} · {c.t} · {c.a} · Diario {c.d}</p>
      <table class="tabla grados">
        <thead><tr><th scope="col" class="left">Grado</th><th scope="col">Int. R.</th><th scope="col">Zeón</th><th scope="col">Mant.</th><th scope="col" class="left">Efecto</th></tr></thead>
        <tbody>
          {c.g.map(([i, z, m, e], k) => <tr key={k}><th scope="row" class="left">{GRADOS[k]}</th><td>{i}</td><td>{z}</td><td>{m}</td><td class="left small">{e}</td></tr>)}
        </tbody>
      </table>
      <p class="small">{c.e}</p>
    </article>
  );
}

/** Desplegables de un panel: cerrados al principio (se ve la lista de vías, no cientos de tarjetas) y con botones para abrir o cerrar todos. */
function useAbiertas() {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  return {
    abiertas,
    alternar: (k: string) => setAbiertas((a) => { const n = new Set(a); if (!n.delete(k)) n.add(k); return n; }),
    todas: (ks: string[]) => setAbiertas(new Set(ks)),
    ninguna: () => setAbiertas(new Set()),
  };
}

function Desplegable({ k, abierto, alternar, titulo, resumen, children, estilo, clase = '', barra }: { k: string; abierto: boolean; alternar: (k: string) => void; titulo: ComponentChildren; resumen?: string; children: ComponentChildren; estilo?: Record<string, string>; clase?: string; barra?: ComponentChildren }) {
  return (
    <div class={`desplegable${abierto ? ' abierto' : ''}${clase}`} style={estilo}>
      <button type="button" class="desp-cab" aria-expanded={abierto} onClick={() => alternar(k)}>
        <span class="chevron" aria-hidden="true">{'▶'}</span>
        <strong>{titulo}</strong>
        {resumen && <span class="muted small">{resumen}</span>}
        <span class="verbo muted small">{abierto ? 'Ocultar' : 'Mostrar'}</span>
      </button>
      {barra}
      {abierto && <div class="cuerpo-desp">{children}</div>}
    </div>
  );
}

function Botones({ claves, ab }: { claves: string[]; ab: ReturnType<typeof useAbiertas> }) {
  return (
    <div class="row wrap">
      <button class="btn" onClick={() => ab.todas(claves)}>Desplegar todo</button>
      <button class="btn" onClick={ab.ninguna}>Plegar todo</button>
      <button class="btn" disabled title="Todavía no está disponible">Descargar grimorio en PDF</button><Proximamente />
    </div>
  );
}

const NIVEL_MAX = 100;

/** Barra de nivel de vía: lo alcanzado relleno y una marca por cada conjuro (llena si ya se alcanza, hueca si falta). */
function BarraNivel({ via, nivel, niveles }: { via: string; nivel: number; niveles: number[] }) {
  const n = Math.max(0, Math.min(NIVEL_MAX, nivel));
  const alcanzados = niveles.filter((l) => l <= nivel).length;
  return (
    <div class="nivel-via">
      <div class="nivel-barra" role="progressbar" aria-label={`Nivel de la vía ${via}`} aria-valuemin={0} aria-valuemax={NIVEL_MAX} aria-valuenow={n} aria-valuetext={`nivel ${n} de ${NIVEL_MAX}`}>
        <div class="nivel-relleno" style={{ width: `${n}%` }} />
        {niveles.map((l, i) => <span key={i} class={'marca' + (l <= nivel ? ' lleno' : '')} style={{ left: `${Math.min(l, NIVEL_MAX)}%` }} />)}
      </div>
      <span class="small muted">nivel {n} de {NIVEL_MAX} · {alcanzados} de {niveles.length} conjuros alcanzados</span>
    </div>
  );
}

/** Todas las vías de Místicos (y su subvía) con sus conjuros por nivel. Lo que está por encima del nivel aprendido sale atenuado. */
export function GrimorioVias() {
  const datos = useDatos();
  const ab = useAbiertas();
  const filas = rango(15, 25).map((r) => ({ via: txt(`Místicos!C${r}`), sub: txt(`Místicos!E${r}`), nivel: Number(txt(`Místicos!H${r}`)) || 0 })).filter((x) => x.via);
  return (
    <Panel title="Todas mis vías" extra={<span class="muted small">Informativo: los conjuros de cada vía que tiene el personaje (en gris, los aún no alcanzados)</span>}>
      {!filas.length && <p class="muted">Elige vías en la sección Magia para verlas aquí.</p>}
      {filas.length > 0 && !datos && <p class="muted">Cargando conjuros…</p>}
      {datos && filas.length > 0 && <Botones claves={filas.map((x) => x.via)} ab={ab} />}
      {datos && filas.map(({ via, sub, nivel }) => {
        const niveles = unicos([via, sub]).flatMap((v) => datos.conjuros.filter((c) => c.v === v).map((c) => c.l)).sort((a, b) => a - b);
        return (
          <Desplegable key={via} k={via} abierto={ab.abiertas.has(via)} alternar={ab.alternar} estilo={estiloVia(via)} clase={claseVia(via)}
            titulo={<>{via}{sub ? <> · <ViaChip via={sub} /></> : ''}</>} resumen={`nivel aprendido ${nivel} · ${niveles.length} conjuros`}
            barra={<BarraNivel via={via} nivel={nivel} niveles={niveles} />}>
            {unicos([via, sub]).map((v) => {
              const lista = datos.conjuros.filter((c) => c.v === v).sort((a, b) => a.l - b.l);
              return (
                <div key={v} class={'conjuros-via' + claseVia(v)} style={estiloVia(v)}>
                  {v !== via && <h4>{v}</h4>}
                  {!lista.length && <p class="muted small">Sin conjuros propios (solo libre acceso).</p>}
                  <div class="armas">{lista.map((c) => <Carta key={c.n} c={c} aprendido={c.l <= nivel} />)}</div>
                </div>
              );
            })}
          </Desplegable>
        );
      })}
    </Panel>
  );
}

function PoderCarta({ p, aprendido }: { p: Poder; aprendido: boolean }) {
  return (
    <article class={'arma info' + (aprendido ? '' : ' sin-aprender')}>
      <h3 class="arma-titulo">{p.n}</h3>
      <p class="small muted">Nivel <strong>{p.l}</strong> · {aprendido ? 'Aprendido' : 'No aprendido'} · Mantenido: {p.m} · {p.a}</p>
      <table class="tabla grados">
        <thead><tr><th scope="col" class="left">Dificultad</th><th scope="col" class="left">Efecto</th></tr></thead>
        <tbody>{DIFICULTADES.map((d, i) => <tr key={d}><th scope="row" class="left">{d}</th><td class="left small">{p.f[i]}</td></tr>)}</tbody>
      </table>
    </article>
  );
}

/** Todas las disciplinas afines del psíquico con sus poderes; los ya elegidos en Psíquica salen destacados. */
export function GrimorioDisciplinas() {
  const datos = useDatos();
  const ab = useAbiertas();
  const disciplinas = [25, 27, 29, 31, 33, 35].map((r) => txt(`Psíquicos!C${r}`)).filter(Boolean);
  const aprendidos = new Set(rango(17, 43).map((r) => txt(`Psíquicos!AS${r}`)).filter(Boolean));
  return (
    <Panel title="Todas mis disciplinas" extra={<span class="muted small">Informativo: los poderes de cada disciplina afín (en gris, los no aprendidos)</span>}>
      {!disciplinas.length && <p class="muted">Elige disciplinas afines arriba para verlas aquí.</p>}
      {disciplinas.length > 0 && !datos && <p class="muted">Cargando poderes…</p>}
      {datos && disciplinas.length > 0 && <Botones claves={disciplinas} ab={ab} />}
      {datos && disciplinas.map((d) => {
        const poderes = datos.poderes.filter((p) => p.d === d).sort((a, b) => a.l - b.l);
        return (
          <Desplegable key={d} k={d} abierto={ab.abiertas.has(d)} alternar={ab.alternar} titulo={d} resumen={`${poderes.filter((p) => aprendidos.has(p.n)).length} aprendidos · ${poderes.length} poderes`}>
            <div class="armas">{poderes.map((p) => <PoderCarta key={p.n} p={p} aprendido={aprendidos.has(p.n)} />)}</div>
          </Desplegable>
        );
      })}
    </Panel>
  );
}
