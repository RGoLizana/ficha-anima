// Categorías de gremio: editor de la biblioteca (propias, oficiales modificadas, oficiales ocultas), las que usa cada personaje y el selector de
// categoría de la ficha. Una categoría define costes en PD, límites y bonos por nivel (una fila de «Tablas» del Excel); las propias ocupan,
// solo en la ficha que las usa, la fila de una oficial que no tiene (ver src/gremio/categorias.ts). Nada de esto bloquea: avisa.
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Ficha } from '../model/ficha';
import { elegirCategoria, guardarCategorias } from '../store';
import { biblioteca, guardarBiblioteca } from '../gremio/almacen';
import {
  ARQUETIPOS, COLUMNAS, COLS_TEXTO, OFICIALES, categoriaDesde, categoriasUsadas, oficialDe, validarNombre, type CategoriaGremio,
} from '../gremio/categorias';
import { Panel } from './campos';

const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const LIMITES = ['I', 'J', 'K'];
/** Las 81 columnas de la tabla, agrupadas para que el editor se pueda leer. */
const GRUPOS: { t: string; ayuda?: string; cols: string[] }[] = [
  { t: 'Generales', cols: ['E', 'F', 'G', 'H', 'L'] },
  { t: 'Límites (% de los PD totales)', ayuda: 'Cuánto de los PD puede ir a combate, magia y psíquica antes de que salga el aviso.', cols: LIMITES },
  { t: 'Bonos por nivel', cols: ['M', 'N', 'O', 'P', 'Q'] },
  { t: 'Costes en PD: combate', cols: ['R', 'S', 'T', 'U'] },
  { t: 'Costes en PD: ki, magia, convocatoria y psíquica', cols: COLUMNAS.map((c) => c.c).filter((c) => colNum(c) >= colNum('V') && colNum(c) <= colNum('AF')) },
  { t: 'Costes en PD: secundarias', cols: COLUMNAS.map((c) => c.c).filter((c) => colNum(c) >= colNum('AG') && colNum(c) <= colNum('BA')) },
  { t: 'Bonos por nivel a secundarias y ki', cols: COLUMNAS.map((c) => c.c).filter((c) => colNum(c) >= colNum('BB') && colNum(c) <= colNum('CE')) },
  { t: 'Arquetipos', ayuda: 'Cuentan para el coste de cambiar de categoría.', cols: COLS_TEXTO },
];
const etiqueta = (c: string) => COLUMNAS.find((x) => x.c === c)?.l ?? c;
const REGLAS_POR_NOMBRE = ['Novel', 'Maestro en Armas', 'Tao'];
const minus = (s: string) => s.toLowerCase();
const igual = (a: CategoriaGremio, b: CategoriaGremio) => JSON.stringify([a.v, a.nota]) === JSON.stringify([b.v, b.nota]);

function Num({ c, cat, poner }: { c: string; cat: CategoriaGremio; poner: (v: CategoriaGremio['v']) => void }) {
  const x = cat.v[c];
  const limite = LIMITES.includes(c);
  const mostrar = x === undefined ? '' : limite ? String(Math.round(Number(x) * 1000) / 10) : String(x);
  return (
    <label class="field mini"><span class="lbl">{etiqueta(c)}{limite ? ' %' : ''}</span>
      <input type="number" inputMode="decimal" value={mostrar} onChange={(e) => {
        const t = e.currentTarget.value, v = { ...cat.v };
        if (t === '') delete v[c]; else v[c] = limite ? Number(t) / 100 : Number(t);
        poner(v);
      }} />
    </label>
  );
}

function EditorCategoria({ cat, cambiar, borrar }: { cat: CategoriaGremio; cambiar: (c: CategoriaGremio) => void; borrar: () => void }) {
  const ofi = oficialDe(cat.n);
  return (
    <div class="stack">
      {cat.oficial && <p class="muted small">Modificación de la categoría oficial «{cat.n}». Cada personaje la adopta con «Usar en este personaje»; no se aplica sola.</p>}
      {!cat.oficial && REGLAS_POR_NOMBRE.includes(cat.base) && (
        <p class="aviso" role="status">Copiada de «{cat.base}»: las reglas que el Excel ata al nombre (bono Novel, mitad de coste de Maestro en Armas y Tao) no se heredan; solo lo que está en la tabla.</p>
      )}
      {GRUPOS.map((g) => (
        <details class="panel" key={g.t}>
          <summary><strong>{g.t}</strong></summary>
          {g.ayuda && <p class="muted small">{g.ayuda}</p>}
          <div class="grid-fields">
            {g.cols.map((c) => COLS_TEXTO.includes(c)
              ? (
                <label class="field" key={c}><span class="lbl">{etiqueta(c)}</span>
                  <select value={String(cat.v[c] ?? 'Sin')} onChange={(e) => cambiar({ ...cat, v: { ...cat.v, [c]: e.currentTarget.value } })}>
                    {ARQUETIPOS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
              )
              : <Num key={c} c={c} cat={cat} poner={(v) => cambiar({ ...cat, v })} />)}
          </div>
        </details>
      ))}
      <label class="field"><span class="lbl">Nota</span><input type="text" value={cat.nota} onChange={(e) => cambiar({ ...cat, nota: e.currentTarget.value })} /></label>
      <div class="row wrap">
        {ofi && cat.oficial && <button type="button" class="btn" onClick={() => cambiar({ ...cat, v: { ...ofi.v } })}>Volver a los valores oficiales</button>}
        <button type="button" class="btn" onClick={borrar}>Borrar {cat.oficial ? 'la modificación' : 'la categoría'}</button>
      </div>
    </div>
  );
}

/** Panel de la biblioteca (global) y panel del personaje. */
export function CategoriasGremio({ f }: { f: Ficha }) {
  const b = biblioteca.value;
  const [nuevo, setNuevo] = useState('');
  const [base, setBase] = useState(OFICIALES[0].n);
  const [oficialAMod, setOficialAMod] = useState(OFICIALES[0].n);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [adoptar, setAdoptar] = useState('');
  const guardar = (categorias: CategoriaGremio[], extra: { ocultas?: string[] } = {}) => guardarBiblioteca({ ...b, categorias, ...extra });

  const crear = () => {
    const error = validarNombre(nuevo, b.categorias.filter((c) => !c.oficial).map((c) => c.n));
    if (error) { setMensaje(error); return; }
    guardar([...b.categorias, categoriaDesde(base, nuevo)]);
    setMensaje(''); setAbierta(nuevo.trim()); setNuevo('');
  };
  const modificar = () => {
    if (!b.categorias.some((c) => c.oficial && c.n === oficialAMod)) guardar([...b.categorias, categoriaDesde(oficialAMod, '', true)]);
    setAbierta(oficialAMod);
  };
  const cambiar = (c: CategoriaGremio, nueva: CategoriaGremio) => guardar(b.categorias.map((x) => (x === c ? nueva : x)));
  const alternarOculta = (n: string) => guardar(b.categorias, { ocultas: b.ocultas.includes(n) ? b.ocultas.filter((x) => x !== n) : [...b.ocultas, n] });

  // ---- personaje ----
  const propias = f.categorias ?? [];
  const usadas = categoriasUsadas(f.entradas);
  const desconocidas = usadas.filter((n) => !oficialDe(n) && !propias.some((c) => minus(c.n) === minus(n)));
  const ocultasEnUso = usadas.filter((n) => b.ocultas.some((o) => minus(o) === minus(n)));
  const libres = b.categorias.filter((c) => !propias.some((p) => p.oficial === c.oficial && minus(p.n) === minus(c.n)));
  const adoptarCategoria = () => { const c = libres.find((x) => `${x.oficial ? 'o' : 'p'}:${x.n}` === adoptar); if (c) { guardarCategorias(f.id, [...propias, JSON.parse(JSON.stringify(c))]); setAdoptar(''); } };

  return (
    <>
      <Panel title="Categorías de gremio" extra={<span class="muted small">{b.categorias.filter((c) => !c.oficial).length} propias · {b.categorias.filter((c) => c.oficial).length} oficiales modificadas · {b.ocultas.length} ocultas</span>}>
        <p class="muted small">Una categoría define sus costes en PD, límites y bonos por nivel. Las propias se crean copiando una oficial; en la ficha que las usa ocupan la fila de una oficial que ese personaje no tiene, así que no cambia ninguna fórmula. Los valores raros avisan, no bloquean.</p>
        <div class="row end wrap">
          <label class="field grow"><span class="lbl">Nueva categoría</span><input type="text" value={nuevo} placeholder="Nombre" onInput={(e) => setNuevo(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') crear(); }} /></label>
          <label class="field"><span class="lbl">Copiar de</span><select value={base} onChange={(e) => setBase(e.currentTarget.value)}>{OFICIALES.map((o) => <option key={o.n}>{o.n}</option>)}</select></label>
          <button type="button" class="btn primary" onClick={crear}>Crear</button>
        </div>
        <div class="row end wrap">
          <label class="field grow"><span class="lbl">Modificar una oficial</span>
            <select value={oficialAMod} onChange={(e) => setOficialAMod(e.currentTarget.value)}>{OFICIALES.map((o) => <option key={o.n}>{o.n}</option>)}</select>
          </label>
          <button type="button" class="btn" onClick={modificar}>Modificar</button>
        </div>
        {mensaje && <p class="aviso" role="status">{mensaje}</p>}
        {b.categorias.map((c) => (
          <details key={`${c.oficial}:${c.n}`} class="panel" open={abierta === c.n} onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) setAbierta(c.n); }}>
            <summary><strong>{c.n}</strong> <span class="muted small">{c.oficial ? 'oficial modificada' : `propia · copia de ${c.base}`}</span></summary>
            {abierta === c.n && <EditorCategoria cat={c} cambiar={(n) => cambiar(c, n)} borrar={() => { guardar(b.categorias.filter((x) => x !== c)); setAbierta(null); }} />}
          </details>
        ))}
        <details class="panel">
          <summary><strong>Ocultar categorías oficiales</strong> <span class="muted small">no se ofrecen al elegir; los personajes que ya las tienen no cambian</span></summary>
          <div class="grid-fields">
            {OFICIALES.map((o) => (
              <label class="check" key={o.n}><input type="checkbox" checked={b.ocultas.includes(o.n)} onChange={() => alternarOculta(o.n)} /> <span>{o.n}</span></label>
            ))}
          </div>
        </details>
      </Panel>

      <Panel title="Categorías en este personaje" extra={<span class="muted small">Ahora: {usadas.join(' · ') || 'ninguna elegida'}</span>}>
        {desconocidas.map((n) => <p class="aviso" role="status" key={n}>«{n}» no es una categoría oficial ni está en este personaje: las fórmulas no la encuentran. Elígela en la lista o añádela abajo.</p>)}
        {ocultasEnUso.map((n) => <p class="muted small" key={n}>«{n}» está oculta en tu biblioteca, pero este personaje la sigue usando.</p>)}
        {propias.length === 0 && <p class="muted">Este personaje no usa categorías de gremio.</p>}
        {propias.map((c) => {
          const lib = b.categorias.find((x) => x.oficial === c.oficial && minus(x.n) === minus(c.n));
          const enUso = usadas.some((u) => minus(u) === minus(c.n));
          return (
            <div class="compra" key={`${c.oficial}:${c.n}`}>
              <strong class="grow">{c.n} <span class="muted small">{c.oficial ? 'oficial modificada' : 'propia'}{enUso ? ' · en uso' : ' · sin elegir'}</span></strong>
              {!lib && <span class="muted small">No está en tu biblioteca</span>}
              {lib && !igual(lib, c) && <button type="button" class="btn" onClick={() => guardarCategorias(f.id, propias.map((p) => (p === c ? JSON.parse(JSON.stringify(lib)) : p)))}>Actualizar desde la biblioteca</button>}
              <button type="button" class="icon-btn" aria-label={`Quitar ${c.n}`} title="Quitar" onClick={() => guardarCategorias(f.id, propias.filter((p) => p !== c))}>×</button>
            </div>
          );
        })}
        {libres.length > 0 && (
          <div class="row end wrap">
            <label class="field grow"><span class="lbl">Usar en este personaje</span>
              <select value={adoptar} onChange={(e) => setAdoptar(e.currentTarget.value)}>
                <option value="">—</option>
                {libres.map((c) => <option key={`${c.oficial}:${c.n}`} value={`${c.oficial ? 'o' : 'p'}:${c.n}`}>{c.n} ({c.oficial ? 'oficial modificada' : 'propia'})</option>)}
              </select>
            </label>
            <button type="button" class="btn primary" disabled={!adoptar} onClick={adoptarCategoria}>Añadir</button>
          </div>
        )}
        <p class="muted small">Elige la categoría del personaje en Principal (o en el asistente); las propias de tu biblioteca salen ahí marcadas «gremio».</p>
      </Panel>
    </>
  );
}

/** Selector de categoría de PDs (Principal y asistente): las oficiales no ocultas, las propias de la biblioteca y las que ya tiene la ficha. */
/** Categorías que se pueden elegir en una ficha: las oficiales no ocultas, las propias de la biblioteca y las que la ficha ya trae. */
export function opcionesCategoria(f: Ficha, actual: string) {
  const b = biblioteca.value;
  const propias = [...b.categorias.filter((c) => !c.oficial), ...(f.categorias ?? []).filter((c) => !c.oficial && !b.categorias.some((x) => !x.oficial && x.n === c.n))];
  const oficiales = OFICIALES.map((o) => o.n).filter((n) => !b.ocultas.includes(n) || n === actual);
  return { propias, oficiales, todas: [...oficiales, ...propias.map((c) => c.n)] };
}
/** Copia de una categoría propia para llevarla a la ficha al elegirla (undefined si es oficial). */
export const copiaPropia = (propias: CategoriaGremio[], n: string): CategoriaGremio | undefined => JSON.parse(JSON.stringify(propias.find((c) => c.n === n) ?? null)) ?? undefined;

export function CampoCategoria({ f, clave, label }: { f: Ficha; clave: string; label: ComponentChildren }) {
  const actual = String(f.entradas[clave] ?? '');
  const { propias, oficiales, todas } = opcionesCategoria(f, actual);
  const id = `c-${clave.replace(/[^A-Za-z0-9]/g, '_')}`;
  return (
    <div class="field" data-clave={clave}>
      <label for={id}>{label}</label>
      <select id={id} value={actual} onChange={(e) => {
        const n = e.currentTarget.value;
        elegirCategoria(f.id, clave, n, copiaPropia(propias, n));
      }}>
        <option value="">—</option>
        {actual && !todas.includes(actual) && <option value={actual}>{actual}</option>}
        {oficiales.map((n) => <option key={n} value={n}>{n}</option>)}
        {propias.map((c) => <option key={c.n} value={c.n}>{c.n} · gremio</option>)}
      </select>
    </div>
  );
}
