import { useEffect, useState } from 'preact/hooks';
import { Panel, txt } from './campos';

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

const GRADOS = ['Base', 'Intermedio', 'Avanzado', 'Arcano'];
const DIFICULTADES = ['Rutinario', 'Fácil', 'Medio', 'Difícil', 'Muy difícil', 'Absurdo', 'Casi imposible', 'Imposible', 'Inhumano', 'Zen'];
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const unicos = (xs: string[]) => [...new Set(xs.filter(Boolean))];

function Carta({ c, aprendido }: { c: Conjuro; aprendido: boolean }) {
  return (
    <article class={'arma info' + (aprendido ? '' : ' sin-aprender')}>
      <h3 class="arma-titulo">{c.n}</h3>
      <p class="small muted">Nivel <strong>{c.l}</strong> · {c.t} · {c.a} · Diario {c.d}</p>
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

/** Todas las vías de Místicos (y su subvía) con sus conjuros por nivel. Lo que está por encima del nivel aprendido sale atenuado. */
export function GrimorioVias() {
  const datos = useDatos();
  const filas = rango(15, 25).map((r) => ({ via: txt(`Místicos!C${r}`), sub: txt(`Místicos!E${r}`), nivel: Number(txt(`Místicos!H${r}`)) || 0 })).filter((x) => x.via);
  return (
    <Panel title="Todas mis vías" extra={<span class="muted small">Informativo: los conjuros de cada vía que tiene el personaje (en gris, los aún no alcanzados)</span>}>
      {!filas.length && <p class="muted">Elige vías en la sección Magia para verlas aquí.</p>}
      {filas.length > 0 && !datos && <p class="muted">Cargando conjuros…</p>}
      {datos && filas.map(({ via, sub, nivel }) => (
        <details key={via} open>
          <summary><strong>{via}{sub ? ` · ${sub}` : ''}</strong> <span class="muted small">nivel aprendido {nivel}</span></summary>
          {unicos([via, sub]).map((v) => {
            const lista = datos.conjuros.filter((c) => c.v === v).sort((a, b) => a.l - b.l);
            return (
              <div key={v}>
                {v !== via && <h4>{v}</h4>}
                {!lista.length && <p class="muted small">Sin conjuros propios (solo libre acceso).</p>}
                <div class="armas">{lista.map((c) => <Carta key={c.n} c={c} aprendido={c.l <= nivel} />)}</div>
              </div>
            );
          })}
        </details>
      ))}
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
  const disciplinas = [25, 27, 29, 31, 33, 35].map((r) => txt(`Psíquicos!C${r}`)).filter(Boolean);
  const aprendidos = new Set(rango(17, 43).map((r) => txt(`Psíquicos!AS${r}`)).filter(Boolean));
  return (
    <Panel title="Todas mis disciplinas" extra={<span class="muted small">Informativo: los poderes de cada disciplina afín (en gris, los no aprendidos)</span>}>
      {!disciplinas.length && <p class="muted">Elige disciplinas afines arriba para verlas aquí.</p>}
      {disciplinas.length > 0 && !datos && <p class="muted">Cargando poderes…</p>}
      {datos && disciplinas.map((d) => (
        <details key={d} open>
          <summary><strong>{d}</strong></summary>
          <div class="armas">
            {datos.poderes.filter((p) => p.d === d).sort((a, b) => a.l - b.l).map((p) => <PoderCarta key={p.n} p={p} aprendido={aprendidos.has(p.n)} />)}
          </div>
        </details>
      ))}
    </Panel>
  );
}
