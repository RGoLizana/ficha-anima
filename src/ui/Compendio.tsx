import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { abrir, abierta, valores } from '../engine';
import { buscar } from '../store';
import { nombreDe, entradasMotor } from '../model/ficha';
import { txt } from './campos';
import { biblioteca } from '../gremio/almacen';
import { OFICIALES } from '../gremio/categorias';
import type { Biblioteca } from '../gremio/modelo';
import '../compendio.css';

// Compendio de magia, mentalismo y convocatoria (#/compendio o #/compendio/<id de ficha>): consulta de todas las vías,
// conjuros, disciplinas, poderes e invocaciones. Los datos salen de src/data/compendio.json (tools/export_compendio.py) y
// src/data/convocatoria.json (tools/export_convocatoria.py). Con una ficha, el modo "Mi personaje" resalta lo que tiene;
// nunca edita nada.
interface ConjuroDato { n: string; v: string; l: number; d: string; t: string; a: string; c: string | null; g: [number | null, number | null, string | number | null, string][]; e: string }
interface PoderDato { n: string; d: string; l: number; m: string; a: string; f: string[] }
interface Datos {
  magia: { vias: { n: string; tipo: string; opuestas: string[]; subvias: string[] }[]; subvias: { n: string; prohibidas: string[] }[]; conjuros: ConjuroDato[] };
  psiquica: { disciplinas: { n: string; mod: string }[]; poderes: PoderDato[]; dificultades: string[]; valores: number[] };
}
/** Invocación (Arcano, Gran Bestia o Encarnación): dificultad y zeón del Excel; el resto, resumen del libro o null si no está verificado. */
interface InvDato { n: string; g: string; num: string | null; dif: number; zeon: number; a: string | null; ha: string | null; hd: string | null; dur: string | null; e: string | null; pacto: string | null; libro: string | null }
type Regla = { t: string; e: string };
type Bono = { t: string; bono: number };
interface Conv {
  arcanos: { fuente: string; lista: InvDato[] }; otras: { fuente: string; lista: InvDato[] };
  habilidades: { fuente: string; lista: { n: string; car: string; resumen: string }[]; reglas: Regla[] };
  dificultades: { fuente: string; cols: string[]; filas: { nivel: number; v: [number, number][] }[] };
  rituales: { fuente: string; filas: Bono[] }; modificadores: { fuente: string; filas: Bono[] };
  masa: { fuente: string; nota: string; filas: { seres: number; dif_nivel: number; sube: number }[] };
  especialidades: { fuente: string; lista: { n: string; e: string }[] };
  fracaso: { fuente: string; filas: { nivel: string; e: string }[] };
  invocacion: { fuente: string; reglas: Regla[] };
  espirituales: { fuente: string; filas: { n: string; coste: number; gnosis: number; e: string }[] };
  pd: { fuente: string; cols: string[]; filas: { cat: string; c: number[] }[] };
}
type Tab = 'magia' | 'psi' | 'conv' | 'fav';
type Sec = Exclude<Tab, 'fav'>;
interface Item {
  k: Sec; id: string; n: string; grupo: string; l: number; a: string; mant: boolean; txt: string;
  diario?: boolean; tipos?: string[]; t?: string; cerr?: string[]; g?: ConjuroDato['g']; e?: string; f?: string[]; z?: InvDato;
}
const GRUPOS_CONV: [string, string[]][] = [['Arcanos', ['Arcanos mayores', 'Arcanos invertidos']], ['Otras invocaciones', ['Grandes bestias', 'Encarnaciones']]];
const REGLAS_CONV = ['Habilidades de convocatoria', 'Encarnación y manifestación', 'Costes en PD'];
const UNO: Record<Sec, [string, string]> = { magia: ['conjuro', 'conjuros'], psi: ['poder', 'poderes'], conv: ['invocación', 'invocaciones'] };
interface Filtros { q: string; lmin: string; lmax: string; accion: string; mant: string; diario: string; tipos: string[]; cerrado: string; niveles: number[] }
const VACIOS: Filtros = { q: '', lmin: '', lmax: '', accion: '', mant: '', diario: '', tipos: [], cerrado: '', niveles: [] };

const GRADOS = ['Base', 'Intermedio', 'Avanzado', 'Arcano'];
const TIPOS = ['Ataque', 'Defensa', 'Efecto', 'Anímico', 'Detección', 'Automático'];
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const esNo = (v: unknown) => v == null || /^(no|\.|)$/i.test(String(v).trim());
const mantTxt = (v: unknown) => (esNo(v) ? '—' : String(v));
/** El Excel escribe los tipos de muchas formas ("Auto", "Animico", "Efec. / Ataq."…): se reducen a 6. */
function tiposDe(t: string): string[] {
  const s = norm(t), r: string[] = [];
  if (/\befe|\befc/.test(s)) r.push('Efecto');
  if (/ataq/.test(s)) r.push('Ataque');
  if (/defen/.test(s)) r.push('Defensa');
  if (/anim/.test(s)) r.push('Anímico');
  if (/det/.test(s)) r.push('Detección');
  if (/auto/.test(s)) r.push('Automático');
  return r;
}

const almacen = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v === null ? d : (JSON.parse(v) as T) ?? d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento: sigue en memoria */ } },
};

/** Datos oficiales + biblioteca propia del gremio (vías, subvías, disciplinas y poderes). Los nombres que ya existen se ignoran. */
function fusionar(D: Datos, B: Biblioteca): { D: Datos; propias: Set<string> } {
  const propias = new Set<string>();
  const vias = D.magia.vias.map((v) => v.n.toLowerCase()), subs = D.magia.subvias.map((v) => v.n.toLowerCase()), discs = D.psiquica.disciplinas.map((d) => d.n.toLowerCase());
  const nuevasVias = B.vias.filter((v) => ![...vias, ...subs].includes(v.n.toLowerCase()));
  const nuevasDisc = B.disciplinas.filter((d) => !discs.includes(d.n.toLowerCase()));
  for (const v of nuevasVias) propias.add(v.n);
  for (const d of nuevasDisc) propias.add(d.n);
  return {
    propias,
    D: {
      magia: {
        vias: [...D.magia.vias, ...nuevasVias.filter((v) => v.tipo !== 'Subvía').map((v) => ({ n: v.n, tipo: v.tipo === 'Vía mayor' ? 'Mayor' : 'Menor', opuestas: [], subvias: [] }))],
        subvias: [...D.magia.subvias, ...nuevasVias.filter((v) => v.tipo === 'Subvía').map((v) => ({ n: v.n, prohibidas: [] }))],
        conjuros: [...D.magia.conjuros, ...nuevasVias.flatMap((v) => v.conjuros.map((c) => ({ n: c.n, v: v.n, l: c.l, d: c.d, t: c.t, a: c.a, c: null, g: c.g, e: c.e })))],
      },
      psiquica: {
        ...D.psiquica,
        disciplinas: [...D.psiquica.disciplinas, ...nuevasDisc.map((d) => ({ n: d.n, mod: d.mod }))],
        poderes: [...D.psiquica.poderes, ...nuevasDisc.flatMap((d) => d.poderes.map((p) => ({ n: p.n, d: d.n, l: p.l, m: p.m, a: p.a, f: p.f })))],
      },
    },
  };
}

function preparar(D: Datos, C: Conv) {
  const conjuros: Item[] = D.magia.conjuros.map((c) => {
    const tipos = tiposDe(c.t);
    return { k: 'magia', id: `c:${c.v}:${c.n}`, n: c.n, grupo: c.v, l: c.l, diario: /^s/i.test(c.d || ''), tipos, t: tipos.join(', ') || String(c.t ?? '').trim(),
      a: c.a || '—', mant: c.g.some((g) => !esNo(g[2])), cerr: c.c ? c.c.split(',').map((s) => s.trim()) : [], g: c.g, e: c.e || '', txt: norm(`${c.n} ${c.e}`) };
  });
  const disc = (d: string) => D.psiquica.disciplinas.find((x) => norm(x.n) === norm(d));
  const poderes: Item[] = D.psiquica.poderes.map((p) => ({
    k: 'psi', id: `p:${p.d}:${p.n}`, n: p.n, grupo: disc(p.d)?.n ?? p.d, l: p.l, mant: /^s/i.test(p.m || ''), a: p.a, f: p.f, txt: norm(`${p.n} ${p.f.join(' ')}`) }));
  const invocaciones: Item[] = [...C.arcanos.lista, ...C.otras.lista].map((z) => ({
    k: 'conv', id: `i:${z.n}`, n: z.n, grupo: z.g, l: z.dif, a: z.a?.split(' ')[0] ?? '—', mant: false, z, txt: norm(`${z.n} ${z.e ?? ''} ${z.pacto ?? ''}`) }));
  return { conjuros, poderes, invocaciones, porId: new Map([...conjuros, ...poderes, ...invocaciones].map((x) => [x.id, x])), disc };
}

export function Compendio({ id }: { id?: string }) {
  const [D0, setD] = useState<Datos | null>(null);
  const [C, setC] = useState<Conv | null>(null);
  const [tab, setTab] = useState<Tab>('magia');
  const [sel, setSel] = useState<Record<Sec, string>>({ magia: '', psi: '', conv: '' });
  const [filtros, setFiltros] = useState<Record<Sec, Filtros>>({ magia: VACIOS, psi: VACIOS, conv: VACIOS });
  const [orden, setOrden] = useState('nivel');
  const [vista, setVista] = useState<'lista' | 'tarjetas'>(() => almacen.get('anima.compendio.vista', 'lista'));
  const [fav, setFav] = useState<Set<string>>(() => new Set(almacen.get<string[]>('anima.compendio.fav', [])));
  const [cmp, setCmp] = useState<Record<Sec, string[]>>({ magia: [], psi: [], conv: [] });
  const [aviso, setAviso] = useState('');
  const [mostrar, setMostrar] = useState(60);   // tarjetas visibles: 640 fichas completas a la vez tardan ~230 ms en pintarse
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verCmp, setVerCmp] = useState(false);
  const [pj, setPj] = useState(false);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches);

  useEffect(() => {
    void import('../data/compendio.json').then((m) => setD(m.default as unknown as Datos));
    void import('../data/convocatoria.json').then((m) => setC(m.default as unknown as Conv));
  }, []);
  const f = id ? buscar(id) : undefined;
  useEffect(() => { if (f) void abrir(id!, entradasMotor(f)); }, [id]);

  const B = biblioteca.value;
  const fus = useMemo(() => (D0 ? fusionar(D0, B) : null), [D0, B]);
  const D = fus?.D ?? null;
  const propias = fus?.propias ?? new Set<string>();
  const P = useMemo(() => (D && C ? preparar(D, C) : null), [D, C]);
  const guardarFav = (s: Set<string>) => { setFav(s); almacen.set('anima.compendio.fav', [...s]); };
  const alternarFav = (x: Item) => { const s = new Set(fav); if (!s.delete(x.id)) s.add(x.id); guardarFav(s); if (abierto === x.id && tab === 'fav' && !s.has(x.id)) setAbierto(null); };
  const alternarCmp = (x: Item) => {
    const l = cmp[x.k]; setAviso('');
    if (l.includes(x.id)) setCmp({ ...cmp, [x.k]: l.filter((i) => i !== x.id) });
    else if (l.length >= 3) setAviso(`Máximo 3. Quite uno para añadir ${x.n}.`);
    else setCmp({ ...cmp, [x.k]: [...l, x.id] });
  };

  // ---- personaje activo (solo lectura de los valores calculados de la ficha) ----
  const listo = !!f && abierta.value === id && Object.keys(valores.value).length > 0;
  const PJ = useMemo(() => {
    if (!listo) return null;
    const vias: Record<string, number> = {};
    for (let r = 15; r <= 25; r++) { const v = txt(`Místicos!C${r}`); if (v) vias[v] = Number(txt(`Místicos!H${r}`)) || 0; const s = txt(`Místicos!E${r}`); if (s) vias[s] = vias[v] ?? 0; }
    const lista = (col: string, a: number, b: number, paso: number) => { const o = new Set<string>(); for (let r = a; r <= b; r += paso) { const t = txt(`${col}${r}`); if (t) o.add(t); } return o; };
    const disciplinas = [...lista('Psíquicos!C', 25, 35, 2)];
    const conjuros = lista('Místicos!Y', 12, 50, 1); for (const n of lista('Místicos!AG', 12, 50, 1)) conjuros.add(n);
    return { nombre: nombreDe(f!), vias, disciplinas, conjuros, poderes: lista('Psíquicos!V', 11, 63, 2), invocaciones: lista('Místicos!J', 33, 60, 1) };
  }, [listo, valores.value]);
  const nivelMax = PJ ? Math.max(0, ...Object.values(PJ.vias)) : 0;
  const marca = (x: Item): [string, string] | null => {
    if (!pj || !PJ) return null;
    if (x.k === 'conv') return PJ.invocaciones.has(x.n) ? ['grimorio', 'En su ficha'] : null;
    if (x.k === 'magia') {
      if (PJ.conjuros.has(x.n)) return ['grimorio', 'En su grimorio'];
      if ((PJ.vias[x.grupo] ?? -1) >= x.l) return ['alcance', 'A su nivel'];
      if (x.grupo === 'Libre acceso' && x.l <= nivelMax && !x.cerr?.some((v) => v in PJ.vias)) return ['alcance', 'A su nivel'];
      return null;
    }
    if (PJ.poderes.has(x.n)) return ['dominado', 'Dominado'];
    if (PJ.disciplinas.includes(x.grupo)) return ['afin', 'Disciplina afín'];
    return null;
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (verCmp) setVerCmp(false); else if (abierto) setAbierto(null); } };
    addEventListener('keydown', tecla); return () => removeEventListener('keydown', tecla);
  }, [verCmp, abierto]);

  if (!P || !D || !C) return <div class="comp"><p class="aviso-muestra">Cargando el compendio…</p></div>;
  const { conjuros, poderes, invocaciones, porId, disc } = P;
  const SUB = D.magia.subvias.map((s) => s.n), VIAS = D.magia.vias.map((v) => v.n);
  const base = tab === 'magia' ? conjuros : tab === 'conv' ? invocaciones : poderes;
  const cuentaEn = (g: string) => base.filter((x) => x.grupo === g).length;

  // ---- filtrado ----
  const tk: Sec = tab === 'fav' ? 'magia' : tab;
  const F = filtros[tk];
  const setF = (p: Partial<Filtros>) => setFiltros({ ...filtros, [tk]: { ...F, ...p } });
  const n = (v: string) => (v === '' ? null : Number(v));
  const grupoSel = tab === 'fav' ? '' : sel[tab];
  const enReglas = tab === 'conv' && REGLAS_CONV.includes(grupoSel);
  const resultados = tab === 'fav' ? [] : base.filter((x) =>
    (!grupoSel || x.grupo === grupoSel) && (!F.q || x.txt.includes(norm(F.q.trim()))) && (!F.accion || x.a === F.accion) &&
    (!F.mant || x.mant === (F.mant === 'si')) && (n(F.lmin) == null || x.l >= n(F.lmin)!) && (n(F.lmax) == null || x.l <= n(F.lmax)!) &&
    (!F.tipos.length || x.tipos?.some((t) => F.tipos.includes(t))) && (!F.diario || x.diario === (F.diario === 'si')) &&
    (!F.cerrado || !x.cerr?.includes(F.cerrado)) && (!F.niveles.length || F.niveles.includes(x.l)));
  const ordenGrupo = tab === 'magia' ? [...VIAS, ...SUB, 'Libre acceso'] : tab === 'conv' ? GRUPOS_CONV.flatMap(([, gs]) => gs) : D.psiquica.disciplinas.map((d) => d.n);
  const porNombre = (a: Item, b: Item) => a.n.localeCompare(b.n, 'es');
  resultados.sort(orden === 'nombre' ? porNombre
    : orden === 'grupo' ? (a, b) => ordenGrupo.indexOf(a.grupo) - ordenGrupo.indexOf(b.grupo) || a.l - b.l || porNombre(a, b)
    : (a, b) => a.l - b.l || porNombre(a, b));
  const nActivos = [F.accion, F.mant, F.lmin !== '', F.lmax !== '', F.tipos.length, F.diario, F.cerrado, F.niveles.length].filter(Boolean).length;
  const favoritos = [...fav].map((i) => porId.get(i)).filter((x): x is Item => !!x).sort((a, b) => a.l - b.l || porNombre(a, b));

  const cambiarTab = (t: Tab) => { if (t !== tab) { setTab(t); setAbierto(null); setAviso(''); } };
  const ir = (g: string) => { setSel({ ...sel, [tab]: g }); setAbierto(null); };
  const abiertoItem = abierto ? porId.get(abierto) ?? null : null;
  const ids = tab === 'fav' ? [] : cmp[tab];

  // ---- piezas ----
  const Estrella = ({ x }: { x: Item }) => (
    <button class="ico fav" aria-pressed={fav.has(x.id)} aria-label={`Favorito: ${x.n}`} onClick={() => alternarFav(x)}>{fav.has(x.id) ? '★' : '☆'}</button>
  );
  const Comparar = ({ x }: { x: Item }) => (
    <button class="ico cmp" aria-pressed={cmp[x.k].includes(x.id)} aria-label={`Comparar: ${x.n}`} title="Añadir a comparar" onClick={() => alternarCmp(x)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /></svg>
    </button>
  );
  const Marca = ({ x }: { x: Item }) => { const m = marca(x); return m ? <span class={`marca ${m[0]}`}>{m[1]}</span> : null; };

  const Ficha = ({ x, nivel }: { x: Item; nivel: 2 | 3 }) => {
    const H = nivel === 2 ? 'h2' : 'h3';
    const ceja = x.k === 'magia' ? (x.grupo === 'Libre acceso' ? 'Libre acceso' : `${SUB.includes(x.grupo) ? 'Subvía' : 'Vía'} de ${x.grupo}`)
      : x.k === 'conv' ? `${x.grupo}${x.z!.num ? ` · ${x.z!.num}` : ''}` : `Disciplina: ${x.grupo}`;
    const cab = (
      <div class="ficha-cab">
        <div>
          <p class="eyebrow">{ceja}{propias.has(x.grupo) ? ' · del gremio' : ''}</p>
          <H {...(nivel === 2 ? { id: 'det-t', tabIndex: -1 } : {})}>{x.n}</H>
        </div>
        <div class="acc">{Estrella({ x })}{Comparar({ x })}{nivel === 2 && <button class="ico cerrar" aria-label="Cerrar detalle" onClick={() => setAbierto(null)}>{'✕'}</button>}</div>
      </div>
    );
    if (x.k === 'magia') {
      return (
        <article class="ficha magia">{cab}{Marca({ x })}
          <dl class="meta"><div class="nivel"><dt>Nivel</dt><dd>{x.l}</dd></div><div><dt>Tipo</dt><dd>{x.t}</dd></div><div><dt>Acción</dt><dd>{x.a}</dd></div>
            <div><dt>Diario</dt><dd>{x.diario ? 'Sí' : 'No'}</dd></div><div><dt>Mantenible</dt><dd>{x.mant ? 'Sí' : 'No'}</dd></div></dl>
          {!!x.cerr?.length && <p class="nota cerrado">Cerrado a la vía de {x.cerr.join(' y ')}</p>}
          <table class="grados"><caption class="sr-only">Grados de {x.n}</caption>
            <thead><tr><th scope="col" class="l">Grado</th><th scope="col">INT req.</th><th scope="col">Zeón</th><th scope="col">Mant.</th></tr></thead>
            {x.g!.map(([i, z, m, e], k) => (
              <tbody key={k}>
                <tr><th scope="rowgroup">{GRADOS[k]}</th><td class="num">{i ?? '—'}</td><td class="num zeon">{z ?? '—'}</td><td class="num">{mantTxt(m)}</td></tr>
                <tr><td colSpan={4} class="efecto">{e}</td></tr>
              </tbody>
            ))}
          </table>
          <p class="desc">{x.e}</p>
        </article>
      );
    }
    if (x.k === 'conv') {
      const z = x.z!;
      return (
        <article class="ficha conv">{cab}{Marca({ x })}
          <dl class="meta"><div class="nivel"><dt>Dificultad</dt><dd>{z.dif}</dd></div><div class="nivel"><dt>Zeón</dt><dd>{z.zeon}</dd></div>
            <div><dt>Acción</dt><dd>{z.a ?? '—'}</dd></div><div><dt>H. Ataque</dt><dd>{z.ha ?? '—'}</dd></div><div><dt>H. Defensa</dt><dd>{z.hd ?? '—'}</dd></div></dl>
          {z.e
            ? <dl class="conv-dl"><div><dt>Efecto</dt><dd>{z.e}</dd></div><div><dt>Duración</dt><dd>{z.dur ?? '—'}</dd></div><div><dt>Pacto habitual</dt><dd>{z.pacto ?? '—'}</dd></div></dl>
            : <p class="nota">Efecto, duración y pacto aún sin resumir{z.libro ? `: consulte ${z.libro}` : ''}.</p>}
          <p class="muted small">Dificultad y zeón: ficha Excel · {z.libro ? `Reglas: ${z.libro}` : 'Sin libro oficial verificado'}</p>
        </article>
      );
    }
    const d = disc(x.grupo);
    return (
      <article class="ficha psi">{cab}{Marca({ x })}
        <dl class="meta"><div class="nivel"><dt>Nivel</dt><dd>{x.l}</dd></div><div><dt>Acción</dt><dd>{x.a}</dd></div><div><dt>Mantenido</dt><dd>{x.mant ? 'Sí' : 'No'}</dd></div></dl>
        {d && d.mod !== 'Sin modificador' && <p class="nota">{d.mod}</p>}
        <table class="difs"><caption class="sr-only">Efecto de {x.n} por dificultad alcanzada</caption>
          <tbody>{D.psiquica.dificultades.map((df, i) => (
            <tr key={df} class={/^fatiga/i.test(x.f![i] ?? '') ? 'fallo' : ''}><th scope="row">{df}<small>{D.psiquica.valores[i]}</small></th><td>{x.f![i]}</td></tr>
          ))}</tbody>
        </table>
      </article>
    );
  };

  const Fila = ({ x, sinCmp }: { x: Item; sinCmp?: boolean }) => {
    const m = marca(x);
    return (
      <li key={x.id} class={`fila m-${m?.[0]}${abierto === x.id ? ' abierta' : ''}`}>
        <button class="fila-main" aria-controls="detalle" onClick={() => setAbierto(x.id)}>
          <span class="nv"><small>{x.k === 'conv' ? 'Dif' : 'Nv'}</small><b>{x.l}</b></span>
          <span><span class="fila-n">{x.n}</span>
            <span class="fila-sub">
              {(!grupoSel || tab === 'fav') && <span>{x.grupo}</span>}
              {x.k === 'magia'
                ? <><span>{x.t}</span><span>{x.a}</span>{x.diario && <span class="flag">DIARIO</span>}{x.mant && <span class="flag">MANT.</span>}{!!x.cerr?.length && <span class="flag" title="Vía cerrada">CERRADO</span>}</>
                : x.k === 'conv' ? <><span>{x.z!.zeon} zeón</span>{x.z!.a && <span>{x.z!.a}</span>}</>
                  : <><span>{x.a}</span>{x.mant && <span class="flag">MANTENIDO</span>}</>}
              {propias.has(x.grupo) && <span class="flag" title="Contenido propio del gremio">GREMIO</span>}
              {Marca({ x })}
            </span></span>
        </button>
        {Estrella({ x })}{sinCmp ? <span /> : Comparar({ x })}
      </li>
    );
  };

  const Boton = ({ g, label }: { g: string; label?: string }) => (
    <button key={g} class="exp-btn" aria-current={grupoSel === g} onClick={() => ir(g)}>
      <span class="n">{label ?? g}</span>
      {pj && PJ && (tab === 'magia' ? PJ.vias[g] !== undefined && <span class="pj" title="Nivel de vía aprendido">Nv {PJ.vias[g]}</span> : tab === 'psi' && PJ.disciplinas.includes(g) && <span class="pj">Afín</span>)}
      {!REGLAS_CONV.includes(g) && <span class="c">{g ? cuentaEn(g) : base.length}</span>}
    </button>
  );
  const grupos: [string, string[]][] = tab === 'psi' ? [['Disciplinas', D.psiquica.disciplinas.map((d) => d.n)]]
    : tab === 'conv' ? [...GRUPOS_CONV, ['Reglas', REGLAS_CONV]]
      : [['Vías mayores', D.magia.vias.filter((v) => v.tipo === 'Mayor').map((v) => v.n)], ['Vías menores', D.magia.vias.filter((v) => v.tipo === 'Menor').map((v) => v.n)], ['Subvías', SUB], ['Sin vía', ['Libre acceso']]];
  const todo = tab === 'magia' ? 'Todo el grimorio' : tab === 'conv' ? 'Todas las invocaciones' : 'Todas las disciplinas';

  const Pildora = ({ n: nombre }: { n: string }) => <button key={nombre} class="pill" onClick={() => ir(nombre)}>{nombre}</button>;
  const Contexto = () => {
    const g = grupoSel;
    if (!g || tab === 'fav') return null;
    if (tab === 'conv') return (
      <section class="ctx conv" aria-labelledby="ctx-t">
        <div class="ctx-cab"><h2 id="ctx-t">{g}</h2></div>
        <p class="muted small">{cuentaEn(g)} invocaciones · Fuente: {g.startsWith('Arcanos') ? C.arcanos.fuente : C.otras.fuente}</p>
      </section>
    );
    const total =tab === 'magia' ? D.magia.conjuros.filter((c) => c.v === g).length : D.psiquica.poderes.filter((p) => norm(p.d) === norm(g)).length;
    let cab: ComponentChildren, dl: ComponentChildren;
    if (tab === 'psi') {
      cab = <><span class="pill">Disciplina</span>{pj && PJ?.disciplinas.includes(g) && <span class="pill oro">Afín a su personaje</span>}</>;
      dl = <div><dt>Modificador del entorno</dt><dd><span>{disc(g)?.mod || 'Sin modificador'}</span></dd></div>;
    } else if (g === 'Libre acceso') {
      cab = <span class="pill">Sin vía</span>;
      dl = <div><dt>Quién puede aprenderlos</dt><dd><span>Cualquier vía, salvo las que cada conjuro indica como cerradas. Use el filtro «Ocultar los cerrados a la vía».</span></dd></div>;
    } else if (VIAS.includes(g)) {
      const v = D.magia.vias.find((x) => x.n === g)!;
      const prohib = SUB.filter((s) => !v.subvias.includes(s));
      cab = <><span class="pill">Vía {v.tipo.toLowerCase()}</span>{pj && PJ?.vias[g] !== undefined && <span class="pill oro">Nivel {PJ.vias[g]} aprendido</span>}</>;
      dl = <>
        <div><dt>{v.opuestas.length > 1 ? 'Opuesta a' : 'Vía opuesta'}</dt><dd>{v.opuestas.length > 5 ? <span>Todas las demás vías</span> : v.opuestas.map((o) => Pildora({ n: o }))}</dd></div>
        <div><dt>Subvías permitidas</dt><dd>{v.subvias.map((s) => Pildora({ n: s }))}</dd></div>
        {!!prohib.length && <div><dt>Subvías prohibidas</dt><dd>{prohib.map((s) => <span class="pill tachado" key={s}>{s}</span>)}</dd></div>}
      </>;
    } else {
      const s = D.magia.subvias.find((x) => x.n === g)!;
      cab = <><span class="pill">Subvía</span>{pj && PJ?.vias[g] !== undefined && <span class="pill oro">Nivel {PJ.vias[g]} aprendido</span>}</>;
      dl = <>
        <div><dt>Se puede tomar con</dt><dd>{VIAS.filter((v) => !s.prohibidas.includes(v)).map((v) => Pildora({ n: v }))}</dd></div>
        <div><dt>Prohibida para</dt><dd>{s.prohibidas.map((v) => <span class="pill tachado" key={v}>{v}</span>)}</dd></div>
      </>;
    }
    const nota = B.vias.find((v) => v.n === g)?.nota;
    return (
      <section class={`ctx ${tab}`} aria-labelledby="ctx-t">
        <div class="ctx-cab"><h2 id="ctx-t">{g}</h2>{cab}{propias.has(g) && <span class="pill oro">Del gremio</span>}</div>{nota && propias.has(g) && <p class="nota">{nota}</p>}<dl class="ctx-dl">{dl}</dl>
        <p class="muted small">{total} {tab === 'magia' ? 'conjuros' : 'poderes'} en {g}</p>
      </section>
    );
  };

  const Op = ({ tipo, nombre, valor, marcado, onChange, children }: { tipo: 'radio' | 'checkbox'; nombre: string; valor: string; marcado: boolean; onChange: () => void; children: ComponentChildren }) => (
    <label class="op">{tipo === 'radio' ? <input type="radio" name={nombre} value={valor} checked={marcado} onChange={onChange} /> : <input type="checkbox" name={nombre} value={valor} checked={marcado} onChange={onChange} />}<span>{children}</span></label>
  );
  const alt = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((i) => i !== v) : [...l, v]);
  const radios = (campo: 'accion' | 'mant' | 'diario', opciones: [string, string][]) => (
    <div class="chips">{opciones.map(([v, t]) => <Op key={v} tipo="radio" nombre={campo} valor={v} marcado={F[campo] === v} onChange={() => setF({ [campo]: v })}>{t}</Op>)}</div>
  );

  const Comparacion = () => {
    const xs = (tab === 'fav' ? [] : cmp[tab]).map((i) => porId.get(i)!).filter(Boolean);
    const fila = (t: ComponentChildren, c: (x: Item) => ComponentChildren, cls = '') => <tr class={cls}><th scope="row">{t}</th>{xs.map((x) => <td key={x.id}>{c(x)}</td>)}</tr>;
    const zeonMin = (k: number) => Math.min(...xs.map((x) => x.g?.[k][1] ?? Infinity));
    const menor = (v: (x: Item) => number) => (x: Item) => <span class={`num ${xs.length > 1 && v(x) === Math.min(...xs.map(v)) ? 'mejor' : ''}`}>{v(x)}</span>;
    return (
      <div class="cmp-velo" onClick={(e) => { if (e.target === e.currentTarget) setVerCmp(false); }}>
        <div class="cmp-dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-cmp-t">
          <div class="dlg-cab"><h2 id="dlg-cmp-t">Comparar {UNO[tk][1]}</h2><button class="btn" onClick={() => setVerCmp(false)}>Cerrar</button></div>
          <div class="cmp-wrap"><table class={`tabla-cmp ${tab}`}>
            <thead><tr><td></td>{xs.map((x) => <th scope="col" key={x.id}>{x.n}</th>)}</tr></thead>
            <tbody>
              {tab === 'conv' ? <>
                {fila('Tipo', (x) => x.grupo)}{fila('Dificultad', menor((x) => x.z!.dif))}{fila('Zeón', menor((x) => x.z!.zeon))}{fila('Acción', (x) => x.z!.a ?? '—')}
                {fila('H. Ataque', (x) => x.z!.ha ?? '—')}{fila('H. Defensa', (x) => x.z!.hd ?? '—')}{fila('Duración', (x) => x.z!.dur ?? '—')}
                {fila('Efecto', (x) => x.z!.e ?? 'Sin resumir', 'grado')}{fila('Pacto', (x) => x.z!.pacto ?? '—')}
              </> : tab === 'magia' ? <>
                {fila('Nivel', (x) => <span class="num">{x.l}</span>)}{fila('Vía', (x) => x.grupo)}{fila('Tipo', (x) => x.t)}{fila('Acción', (x) => x.a)}
                {fila('Diario', (x) => (x.diario ? 'Sí' : 'No'))}{fila('Cerrado a', (x) => x.cerr?.join(', ') || '—')}
                {GRADOS.map((gr, k) => (
                  <tr class="grado" key={gr}><th scope="row">{gr}</th>{xs.map((x) => { const [i, z, m, e] = x.g![k]; return (
                    <td key={x.id}><span class="num">INT {i ?? '—'}</span> · <span class={`num ${z === zeonMin(k) && xs.length > 1 ? 'mejor' : ''}`}>{z ?? '—'} zeón</span> · mant. {mantTxt(m)}<br />{e}</td>); })}</tr>
                ))}
                {fila('Descripción', (x) => x.e)}
              </> : <>
                {fila('Nivel', (x) => <span class="num">{x.l}</span>)}{fila('Disciplina', (x) => x.grupo)}{fila('Acción', (x) => x.a)}{fila('Mantenido', (x) => (x.mant ? 'Sí' : 'No'))}
                {D.psiquica.dificultades.map((df, i) => fila(<>{df} <small class="muted">{D.psiquica.valores[i]}</small></>, (x) => x.f![i], 'grado'))}
              </>}
            </tbody>
          </table></div>
        </div>
      </div>
    );
  };

  const Leyenda = ({ conComparar = true }: { conComparar?: boolean }) => (
    <ul class="leyenda-iconos" aria-label="Leyenda de iconos">
      <li><span class="ley-ico">{'☆'}</span> Favorito: guarda el elemento en la pestaña Favoritos</li>
      {conComparar && <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /></svg> Comparar: marca hasta 3 para verlos en paralelo</li>}
      {tab === 'conv'
        ? <><li><b>Dif</b> Dificultad a superar con Convocar</li><li><b>Zeón</b> coste de cada uso (un Invocador paga la mitad)</li><li><b>NA</b> no aplica</li></>
        : <li><b>Nv</b> Nivel</li>}
      {tab === 'magia'
        ? <><li><span class="flag">DIARIO</span> solo una vez al día</li><li><span class="flag">MANT.</span> admite mantenimiento</li><li><span class="flag">CERRADO</span> vía cerrada para algunas vías</li><li><b>INT</b> Inteligencia necesaria para lanzar el grado</li></>
        : tab === 'conv' ? null
          : <><li><span class="flag">MANTENIDO</span> el poder se mantiene</li><li>Bajo cada dificultad: el valor a alcanzar; en rojo, los resultados con fatiga</li></>}
    </ul>
  );

  // ---- reglas de convocatoria (resumen; las cifras de PD y poderes salen del Excel) ----
  const Fuente = (f: string) => <p class="muted small">Fuente: {f}</p>;
  const tabla = (titulo: string, cab: string[], filas: ComponentChildren[][]) => (
    <div class="tabla-wrap"><table class="tabla-reglas"><caption class="sr-only">{titulo}</caption>
      <thead><tr>{cab.map((c) => <th scope="col" key={c}>{c}</th>)}</tr></thead>
      <tbody>{filas.map((f, i) => <tr key={i}>{f.map((c, j) => (j ? <td key={j} class={typeof c === 'number' ? 'num' : ''}>{c}</td> : <th scope="row" key={j}>{c}</th>))}</tr>)}</tbody>
    </table></div>
  );
  /** Costes de convocatoria por categoría: las oficiales del Excel (con los valores de gremio si están modificadas) y las propias del gremio. */
  const filasCategorias = (): ComponentChildren[][] => {
    const COLS = ['AA', 'AB', 'AC', 'AD'];                         // Convocar, Dominar, Atar, Desconvocar en Tablas
    const marca = <span class="flag" title="Contenido propio del gremio">GREMIO</span>;
    const oficiales = C.pd.filas.map((p, i) => {
      const mod = B.categorias.find((c) => c.oficial && OFICIALES[i]?.n === c.n);
      return mod ? [<>{p.cat} {marca}</>, ...COLS.map((c, k) => Number(mod.v[c] ?? p.c[k]))] : [p.cat, ...p.c];
    });
    const propias = B.categorias.filter((c) => !c.oficial).map((c) => [<>{c.n} {marca}</>, ...COLS.map((k) => Number(c.v[k] ?? 0))]);
    return [...oficiales, ...propias];
  };
  const lista = (rs: Regla[]) => <ul class="reglas-lista">{rs.map((r) => <li key={r.t}><b>{r.t}.</b> {r.e}</li>)}</ul>;
  const signo = (v: number) => (v > 0 ? `+${v}` : String(v).replace('-', '−'));
  const Reglas = () => {
    const g = grupoSel;
    let cuerpo: ComponentChildren;
    if (g === 'Costes en PD') {
      cuerpo = <section class="regla">
        <p>Coste en PD de cada punto de las habilidades de convocatoria según la categoría del personaje.</p>
        {tabla('Coste en PD por categoría', ['Categoría', ...C.pd.cols], filasCategorias())}{Fuente(C.pd.fuente)}
      </section>;
    } else if (g === 'Encarnación y manifestación') {
      cuerpo = <section class="regla">
        <p>Habilidades espirituales: poderes que solo pueden adquirir los espíritus (creación de seres). El coste es en PD del ser.</p>
        {tabla('Habilidades espirituales', ['Poder', 'Coste', 'Gnosis', 'Efecto'], C.espirituales.filas.map((h) => [h.n, h.coste, h.gnosis, h.e]))}{Fuente(C.espirituales.fuente)}
      </section>;
    } else {
      const H = C.habilidades, T = C.dificultades;
      cuerpo = <>
        <section class="regla" aria-labelledby="r-hab"><h3 id="r-hab">Las cuatro habilidades</h3>
          <dl class="ctx-dl">{H.lista.map((h) => <div key={h.n}><dt>{h.n} · {h.car}</dt><dd><span>{h.resumen}</span></dd></div>)}</dl>
          {lista(H.reglas)}{Fuente(H.fuente)}</section>
        <section class="regla" aria-labelledby="r-t64"><h3 id="r-t64">Dificultad y zeón según el nivel del ser</h3>
          {tabla('Dificultad / zeón por nivel del ser', ['Nivel', ...T.cols], T.filas.map((f) => [f.nivel, ...f.v.map(([d, z]) => `${d} / ${z}`)]))}
          <p class="muted small">Cada celda: dificultad / zeón. Los bonos especiales a la RM del ser se suman a la dificultad.</p>{Fuente(T.fuente)}</section>
        <section class="regla" aria-labelledby="r-esp"><h3 id="r-esp">Especialidades</h3>
          {lista(C.especialidades.lista.map((e) => ({ t: e.n, e: e.e })))}{Fuente(C.especialidades.fuente)}</section>
        <section class="regla" aria-labelledby="r-rit"><h3 id="r-rit">Rituales y modificadores</h3>
          {tabla('Tiempo del ritual', ['Tiempo dedicado', 'Bono'], C.rituales.filas.map((r) => [r.t, signo(r.bono)]))}{Fuente(C.rituales.fuente)}
          {tabla('Modificadores de convocatoria', ['Circunstancia', 'Bono'], C.modificadores.filas.map((r) => [r.t, signo(r.bono)]))}{Fuente(C.modificadores.fuente)}</section>
        <section class="regla" aria-labelledby="r-masa"><h3 id="r-masa">Convocatoria en masa</h3>
          <p>{C.masa.nota} La dificultad sube como si el ser tuviera más niveles y el zeón se dobla; Atar sigue siendo uno a uno.</p>
          {tabla('Convocatoria en masa', ['Seres afectados', 'Diferencia de nivel', 'Sube la dificultad'], C.masa.filas.map((m) => [m.seres.toLocaleString('es'), m.dif_nivel, `+${m.sube} nivel${m.sube > 1 ? 'es' : ''}`]))}{Fuente(C.masa.fuente)}</section>
        <section class="regla" aria-labelledby="r-inv"><h3 id="r-inv">Invocaciones</h3>{lista(C.invocacion.reglas)}{Fuente(C.invocacion.fuente)}</section>
        <section class="regla" aria-labelledby="r-fra"><h3 id="r-fra">Fracaso</h3>
          {tabla('Efecto del fracaso según el nivel de fracaso', ['Nivel de fracaso', 'Efecto'], C.fracaso.filas.map((f) => [f.nivel, f.e]))}{Fuente(C.fracaso.fuente)}</section>
      </>;
    }
    return <section class="ctx conv reglas" aria-labelledby="ctx-t"><div class="ctx-cab"><h2 id="ctx-t">{g}</h2><span class="pill">Reglas</span></div>{cuerpo}</section>;
  };

  const nombreEnTab = UNO[tk][1];
  return (
    <div class={`comp${pj ? ' con-pj' : ''}${tab === 'fav' ? ' v-fav' : ''}`} data-vista={vista}>
      <header class="topbar">
        <a class="btn" href={id ? `#/ficha/${id}/magia` : '#/'} aria-label={id ? 'Volver a la ficha' : 'Volver a la lista de fichas'}>&larr; {id ? 'Ficha' : 'Fichas'}</a>
        <h1 class="brand">ANIMA <span>Compendio</span></h1>
        {PJ && <button class="btn" aria-pressed={pj} title="Resalta lo que tiene el personaje. No cambia nada de la ficha." onClick={() => setPj(!pj)}>Mi personaje</button>}
      </header>
      {pj && PJ && (
        <div class="pj-banner"><strong>{PJ.nombre}</strong>
          <span>Vías: {Object.entries(PJ.vias).map(([v, nv]) => `${v} ${nv}`).join(' · ') || 'ninguna'}</span>
          <span>Disciplinas afines: {PJ.disciplinas.join(', ') || 'ninguna'}</span><span class="muted">Solo se resalta; la ficha no cambia.</span></div>
      )}

      <div class="tabs" role="tablist" aria-label="Sección del compendio" onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const T: Tab[] = ['magia', 'psi', 'conv', 'fav']; const nt = T[(T.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : T.length - 1)) % T.length]; cambiarTab(nt);
        setTimeout(() => document.getElementById(`tab-${nt}`)?.focus());
      }}>
        {([['magia', 'Magia', conjuros.length], ['psi', 'Mentalismo', poderes.length], ['conv', 'Convocatoria', invocaciones.length], ['fav', '★ Favoritos', fav.size]] as [Tab, string, number][]).map(([t, titulo, c]) => (
          <button role="tab" id={`tab-${t}`} data-tab={t} key={t} aria-selected={tab === t} aria-controls="layout" tabIndex={tab === t ? 0 : -1} onClick={() => cambiarTab(t)}>{titulo} <small>{c}</small></button>
        ))}
      </div>

      <div class={`layout${vista === 'tarjetas' ? ' tarjetas' : ''}${enReglas ? ' sin-detalle' : ''}${ids.length ? ' con-bandeja' : ''}`} id="layout" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <nav class="explorador" aria-label="Explorar">
          <div class="exp-grupo">{Boton({ g: "", label: todo })}</div>
          {grupos.map(([t, gs]) => <div class="exp-grupo" key={t}><p class="exp-tit">{t}</p>{gs.map((g) => Boton({ g }))}</div>)}
        </nav>

        <section class="resultados" aria-label="Resultados">
          <label class="exp-movil" for="exp-select"><span>{tab === 'magia' ? 'Vía, subvía o libre acceso' : tab === 'conv' ? 'Tipo de invocación o reglas' : 'Disciplina'}</span>
            <select id="exp-select" value={grupoSel} onChange={(e) => ir(e.currentTarget.value)}>
              <option value="">{todo}</option>
              {grupos.map(([t, gs]) => <optgroup label={t} key={t}>{gs.map((g) => <option value={g} key={g}>{g}{REGLAS_CONV.includes(g) ? '' : ` (${cuentaEn(g)})`}{pj && PJ?.vias[g] !== undefined && tab === 'magia' ? ` · Nv ${PJ.vias[g]}` : ''}</option>)}</optgroup>)}
            </select>
          </label>
          {enReglas ? Reglas() : Contexto()}

          {tab !== 'fav' && !enReglas && <>
            <div class="buscador"><label for="q">Buscar en nombre y descripción</label>
              <input type="search" id="q" placeholder="Ej.: escudo, fuego, invisible" autocomplete="off" value={F.q} onInput={(e) => setF({ q: e.currentTarget.value })} /></div>

            <details class="filtros" open={filtrosAbiertos} onToggle={(e) => setFiltrosAbiertos((e.currentTarget as HTMLDetailsElement).open)}>
              <summary>Filtros {nActivos > 0 && <span class="pill">{nActivos} {nActivos === 1 ? 'activo' : 'activos'}</span>}</summary>
              <form class="f-cuerpo" onSubmit={(e) => e.preventDefault()}>
                {tab === 'magia' ? <>
                  <fieldset><legend>Nivel</legend>
                    <div class="rango">
                      <input type="number" inputMode="numeric" min={0} max={100} step={2} placeholder="0" aria-label="Nivel desde" value={F.lmin} onInput={(e) => setF({ lmin: e.currentTarget.value })} />
                      <span class="muted">a</span>
                      <input type="number" inputMode="numeric" min={0} max={100} step={2} placeholder="100" aria-label="Nivel hasta" value={F.lmax} onInput={(e) => setF({ lmax: e.currentTarget.value })} />
                    </div></fieldset>
                  <fieldset><legend>Acción</legend>{radios('accion', [['', 'Todas'], ['Activa', 'Activa'], ['Pasiva', 'Pasiva']])}</fieldset>
                  <fieldset class="f-ancho"><legend>Tipo (cualquiera de los marcados)</legend>
                    <div class="chips">{TIPOS.map((t) => <Op key={t} tipo="checkbox" nombre="tipo" valor={t} marcado={F.tipos.includes(t)} onChange={() => setF({ tipos: alt(F.tipos, t) })}>{t}</Op>)}</div></fieldset>
                  <fieldset><legend>Mantenimiento</legend>{radios('mant', [['', 'Igual'], ['si', 'Mantenible'], ['no', 'No']])}</fieldset>
                  <fieldset><legend>Diario</legend>{radios('diario', [['', 'Igual'], ['si', 'Diario'], ['no', 'No diario']])}</fieldset>
                  <fieldset><legend><label for="cerrado">Ocultar los cerrados a la vía</label></legend>
                    <select id="cerrado" value={F.cerrado} onChange={(e) => setF({ cerrado: e.currentTarget.value })}>
                      <option value="">No ocultar</option>{VIAS.map((v) => <option value={v} key={v}>{v}</option>)}
                    </select></fieldset>
                </> : tab === 'conv' ? <>
                  <fieldset><legend>Dificultad</legend>
                    <div class="rango">
                      <input type="number" inputMode="numeric" min={0} max={600} step={10} placeholder="0" aria-label="Dificultad desde" value={F.lmin} onInput={(e) => setF({ lmin: e.currentTarget.value })} />
                      <span class="muted">a</span>
                      <input type="number" inputMode="numeric" min={0} max={600} step={10} placeholder="600" aria-label="Dificultad hasta" value={F.lmax} onInput={(e) => setF({ lmax: e.currentTarget.value })} />
                    </div></fieldset>
                  <fieldset><legend>Acción</legend>{radios('accion', [['', 'Todas'], ['Activa', 'Activa'], ['Pasiva', 'Pasiva']])}</fieldset>
                </> : <>
                  <fieldset><legend>Nivel del poder</legend>
                    <div class="chips">{[1, 2, 3].map((nv) => <Op key={nv} tipo="checkbox" nombre="nivel" valor={String(nv)} marcado={F.niveles.includes(nv)} onChange={() => setF({ niveles: alt(F.niveles, nv) })}>Nivel {nv}</Op>)}</div></fieldset>
                  <fieldset><legend>Acción</legend>{radios('accion', [['', 'Todas'], ['Activa', 'Activa'], ['Pasiva', 'Pasiva']])}</fieldset>
                  <fieldset><legend>Mantenido</legend>{radios('mant', [['', 'Igual'], ['si', 'Sí'], ['no', 'No']])}</fieldset>
                </>}
                <div class="f-pie f-ancho"><button type="button" class="btn" onClick={() => setF({ ...VACIOS, q: F.q })}>Quitar filtros</button></div>
              </form>
            </details>

            <div class="res-cab">
              <p class="contador" aria-live="polite"><strong>{resultados.length}</strong> {resultados.length === 1 ? UNO[tk][0] : nombreEnTab} <span class="muted">de {grupoSel ? cuentaEn(grupoSel) : base.length}</span></p>
              <label for="orden">Orden
                <select id="orden" value={orden} onChange={(e) => setOrden(e.currentTarget.value)}>
                  <option value="nivel">{tab === 'conv' ? 'Dificultad' : 'Nivel'}</option><option value="nombre">Nombre</option><option value="grupo">{tab === 'magia' ? 'Vía' : tab === 'conv' ? 'Tipo' : 'Disciplina'}</option>
                </select>
              </label>
              <div class="seg" role="group" aria-label="Vista">
                {(['lista', 'tarjetas'] as const).map((v) => <button type="button" key={v} aria-pressed={vista === v} onClick={() => { setVista(v); almacen.set('anima.compendio.vista', v); }}>{v === 'lista' ? 'Lista' : 'Tarjetas'}</button>)}
              </div>
            </div>

            {Leyenda({})}
            {resultados.length === 0
              ? <div class="vacio"><span>{tab === 'conv' ? 'Ninguna invocación' : `Ningún ${UNO[tk][0]}`} cumple estos filtros{grupoSel ? ` en ${grupoSel}` : ''}.</span><button class="btn" onClick={() => setF(VACIOS)}>Quitar filtros y búsqueda</button></div>
              : vista === 'tarjetas'
                ? <>
                  <ul class="cartas">{resultados.slice(0, mostrar).map((x) => <li class={`carta ${x.k} m-${marca(x)?.[0]}`} key={x.id}>{Ficha({ x, nivel: 3 })}</li>)}</ul>
                  {resultados.length > mostrar && <button class="btn" onClick={() => setMostrar(mostrar + 60)}>Mostrar {Math.min(60, resultados.length - mostrar)} más ({resultados.length - mostrar} sin mostrar)</button>}
                </>
                : <ul class={`lista ${tab}`}>{resultados.map((x) => Fila({ x }))}</ul>}
          </>}

          {tab === 'fav' && (
            <>
              <div class="fav-cab"><p class="contador" aria-live="polite"><strong>{favoritos.length}</strong> favorito{favoritos.length === 1 ? '' : 's'}</p>
                {favoritos.length > 0 && <button class="btn" onClick={() => guardarFav(new Set())}>Quitar todos</button>}</div>
              {Leyenda({ conComparar: false })}
              {(['magia', 'psi', 'conv'] as const).map((k) => {
                const l = favoritos.filter((x) => x.k === k); const titulo = { magia: 'Conjuros favoritos', psi: 'Poderes favoritos', conv: 'Invocaciones favoritas' }[k];
                return (
                  <section class={`fav-sec ${k}`} aria-label={titulo} key={k}>
                    <h2>{titulo} <span class="muted small">{l.length}</span></h2>
                    {l.length ? <ul class={`lista ${k}`}>{l.map((x) => Fila({ x, sinCmp: true }))}</ul>
                      : <div class="vacio">Aún no hay {titulo.toLowerCase()}. Pulse la estrella de cualquier {UNO[k][0]} para {k === 'conv' ? 'guardarla' : 'guardarlo'} aquí.</div>}
                  </section>
                );
              })}
            </>
          )}
        </section>

        <aside class={`detalle${abiertoItem ? ' abierta' : ''}`} id="detalle" aria-label="Detalle">
          {abiertoItem ? Ficha({ x: abiertoItem, nivel: 2 })
            : <div class="det-vacio"><strong>Elija {tab === 'psi' ? 'un poder' : tab === 'conv' ? 'una invocación' : 'un conjuro'}</strong><span>Aquí verá {tab === 'psi' ? 'su efecto en cada una de las diez dificultades'
              : tab === 'conv' ? 'su dificultad, zeón, acción, habilidades de ataque y defensa, efecto, duración y pacto' : 'sus cuatro grados (INT requerida, zeón, mantenimiento y efecto) y la descripción'}.</span></div>}
        </aside>
      </div>
      {abiertoItem && <div class="velo" onClick={() => setAbierto(null)} />}

      {ids.length > 0 && (
        <div class="bandeja">
          <span class="tit">Comparar {ids.length}/3</span>
          <div class="sel">{ids.map((i) => <button class="pill" key={i} aria-label={`Quitar ${porId.get(i)!.n} de comparar`} onClick={() => alternarCmp(porId.get(i)!)}>{porId.get(i)!.n} {'✕'}</button>)}</div>
          <button class="btn" onClick={() => { setCmp({ ...cmp, [tk]: [] }); setAviso(''); }}>Vaciar</button>
          <button class="btn primary" disabled={ids.length < 2} title={ids.length < 2 ? 'Marque al menos 2' : undefined} onClick={() => setVerCmp(true)}>Comparar</button>
          {aviso && <p class="msg" role="status">{aviso}</p>}
        </div>
      )}
      {verCmp && ids.length > 1 && Comparacion()}
    </div>
  );
}
