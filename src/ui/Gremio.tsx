import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Ficha } from '../model/ficha';
import { guardarPropio } from '../store';
import { biblioteca, errorBiblioteca, exportarBiblioteca, guardarBiblioteca, importarBiblioteca } from '../gremio/almacen';
import { consumo, conjuroNuevo, poderNuevo, type Biblioteca, type Elegido, type TipoElegido, type ViaPropia } from '../gremio/modelo';
import { descargar } from '../export/base';
import { Avisos, Panel, txt } from './campos';
import { CategoriasGremio } from './CategoriasGremio';

// Contenido propio de un gremio: vías/subvías, disciplinas psíquicas y Ars Magnus. La biblioteca es compartible (.json) y global en el
// navegador; cada personaje elige lo que tiene y cada elemento solo consume nivel de vía, CV, CM y PD (no se tocan las tablas del Excel).
const DIFICULTADES = ['Rutinario', 'Fácil', 'Medio', 'Difícil', 'Muy difícil', 'Absurdo', 'Casi imposible', 'Imposible', 'Inhumano', 'Zen'];
const GRADOS = ['Base', 'Intermedio', 'Avanzado', 'Arcano'];
const EJEMPLO: Biblioteca = {
  version: 1, nombre: 'Mi gremio',
  vias: [{ n: 'Ars Ejemplo', tipo: 'Subvía', nota: 'Subvía de ejemplo', conjuros: [{ ...conjuroNuevo(), n: 'Chispa de ejemplo', l: 4, e: 'Descripción del conjuro', g: [[6, 40, 'No', 'Efecto base'], [8, 80, 10, 'Intermedio'], [10, 120, 10, 'Avanzado'], [12, 200, 15, 'Arcano']] }] }],
  disciplinas: [{ n: 'Resonancia', mod: 'Sin modificador', poderes: [{ ...poderNuevo(), n: 'Eco de ejemplo', f: ['Fatiga 2', 'Fatiga 1', '10 m', '50 m', '100 m', '500 m', '1 km', '5 km', '10 km', 'Sin límite'] }] }],
  arsMagnus: [{ n: 'Sello de ejemplo', pd: 30, cm: 20, e: 'Descripción del Ars Magnus' }],
  categorias: [], ocultas: [],
};

function Campo({ label, children, clase }: { label: string; children: ComponentChildren; clase?: string }) {
  return <label class={`field ${clase ?? ''}`}><span class="lbl">{label}</span>{children}</label>;
}
const T = ({ label, v, set, clase, area }: { label: string; v: string; set: (x: string) => void; clase?: string; area?: boolean }) => (
  <Campo label={label} clase={clase}>{area ? <textarea rows={2} value={v} onChange={(e) => set(e.currentTarget.value)} /> : <input type="text" value={v} onChange={(e) => set(e.currentTarget.value)} />}</Campo>
);
const N = ({ label, v, set, clase }: { label: string; v: number | null; set: (x: number | null) => void; clase?: string }) => (
  <Campo label={label} clase={clase}><input type="number" inputMode="numeric" value={v ?? ''} onChange={(e) => set(e.currentTarget.value === '' ? null : Number(e.currentTarget.value))} /></Campo>
);
const S = ({ label, v, op, set }: { label: string; v: string; op: string[]; set: (x: string) => void }) => (
  <Campo label={label}><select value={v} onChange={(e) => set(e.currentTarget.value)}>{op.map((o) => <option key={o} value={o}>{o}</option>)}</select></Campo>
);
const cambiar = <T,>(l: T[], i: number, x: T) => l.map((e, j) => (j === i ? x : e));

type Seccion = 'vias' | 'disciplinas' | 'ars';

export function Gremio({ f }: { f: Ficha }) {
  const b = biblioteca.value;
  const [sec, setSec] = useState<Seccion>('vias');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [unir, setUnir] = useState(true);
  const guardar = (x: Partial<Biblioteca>) => guardarBiblioteca({ ...b, ...x });

  async function importar(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    setMensaje('');
    try {
      for (const archivo of Array.from(input.files ?? [])) importarBiblioteca(await archivo.text(), unir);
      setMensaje('Biblioteca importada.');
    } catch (err) { setMensaje(err instanceof Error ? err.message : String(err)); }
    input.value = '';
  }

  function anadir() {
    const n = nuevo.trim();
    if (!n) return;
    const existe = (l: { n: string }[]) => l.some((x) => x.n.toLowerCase() === n.toLowerCase());
    if (sec === 'vias' && !existe(b.vias)) guardar({ vias: [...b.vias, { n, tipo: 'Subvía', nota: '', conjuros: [] }] });
    else if (sec === 'disciplinas' && !existe(b.disciplinas)) guardar({ disciplinas: [...b.disciplinas, { n, mod: 'Sin modificador', poderes: [] }] });
    else if (sec === 'ars' && !existe(b.arsMagnus)) guardar({ arsMagnus: [...b.arsMagnus, { n, pd: 0, cm: 0, e: '' }] });
    else { setMensaje(`Ya existe «${n}» en la biblioteca.`); return; }
    setMensaje(''); setNuevo(''); setAbierto(n);
  }

  // ---- editores ----
  const EditorVia = ({ v, i }: { v: ViaPropia; i: number }) => {
    const poner = (x: ViaPropia) => guardar({ vias: cambiar(b.vias, i, x) });
    return (
      <div class="stack">
        <div class="grid-fields">
          <T label="Nombre" v={v.n} set={(n) => poner({ ...v, n })} />
          <S label="Tipo" v={v.tipo} op={['Vía mayor', 'Vía menor', 'Subvía']} set={(tipo) => poner({ ...v, tipo: tipo as ViaPropia['tipo'] })} />
          <T label="Nota" v={v.nota} set={(nota) => poner({ ...v, nota })} clase="grow" />
        </div>
        {v.conjuros.map((c, k) => {
          const pc = (x: typeof c) => poner({ ...v, conjuros: cambiar(v.conjuros, k, x) });
          return (
            <article class="arma" key={k}>
              <div class="grid-fields">
                <T label="Conjuro" v={c.n} set={(n) => pc({ ...c, n })} clase="grow" />
                <N label="Nivel" v={c.l} set={(l) => pc({ ...c, l: l ?? 2 })} clase="mini" />
                <T label="Tipo" v={c.t} set={(t) => pc({ ...c, t })} />
                <S label="Acción" v={c.a} op={['Activa', 'Pasiva']} set={(a) => pc({ ...c, a })} />
                <S label="Diario" v={c.d} op={['No', 'Sí']} set={(d) => pc({ ...c, d: d as 'Sí' | 'No' })} />
              </div>
              {GRADOS.map((g, q) => (
                <div class="grid-fields" key={g}>
                  <strong class="small">{g}</strong>
                  <N label="INT" v={c.g[q][0] as number | null} set={(x) => pc({ ...c, g: cambiar(c.g, q, [x, c.g[q][1], c.g[q][2], c.g[q][3]]) })} clase="mini" />
                  <N label="Zeón" v={c.g[q][1] as number | null} set={(x) => pc({ ...c, g: cambiar(c.g, q, [c.g[q][0], x, c.g[q][2], c.g[q][3]]) })} clase="mini" />
                  <T label="Mant." v={String(c.g[q][2] ?? '')} set={(x) => pc({ ...c, g: cambiar(c.g, q, [c.g[q][0], c.g[q][1], x !== '' && !Number.isNaN(Number(x)) ? Number(x) : x || 'No', c.g[q][3]]) })} clase="mini" />
                  <T label="Efecto" v={c.g[q][3]} set={(x) => pc({ ...c, g: cambiar(c.g, q, [c.g[q][0], c.g[q][1], c.g[q][2], x]) })} clase="grow" />
                </div>
              ))}
              <T label="Descripción" v={c.e} set={(e) => pc({ ...c, e })} area />
              <button class="btn" onClick={() => poner({ ...v, conjuros: v.conjuros.filter((_, j) => j !== k) })}>Quitar conjuro</button>
            </article>
          );
        })}
        <div class="row">
          <button class="btn" onClick={() => poner({ ...v, conjuros: [...v.conjuros, conjuroNuevo()] })}>+ Añadir conjuro</button>
          <button class="btn" onClick={() => { guardar({ vias: b.vias.filter((_, j) => j !== i) }); setAbierto(null); }}>Borrar {v.tipo.toLowerCase()}</button>
        </div>
      </div>
    );
  };

  const EditorDisciplina = ({ i }: { i: number }) => {
    const d = b.disciplinas[i];
    const poner = (x: typeof d) => guardar({ disciplinas: cambiar(b.disciplinas, i, x) });
    return (
      <div class="stack">
        <div class="grid-fields"><T label="Nombre" v={d.n} set={(n) => poner({ ...d, n })} /><T label="Modificador del entorno" v={d.mod} set={(mod) => poner({ ...d, mod })} clase="grow" /></div>
        {d.poderes.map((p, k) => {
          const pp = (x: typeof p) => poner({ ...d, poderes: cambiar(d.poderes, k, x) });
          return (
            <article class="arma" key={k}>
              <div class="grid-fields">
                <T label="Poder" v={p.n} set={(n) => pp({ ...p, n })} clase="grow" />
                <N label="Nivel" v={p.l} set={(l) => pp({ ...p, l: l ?? 1 })} clase="mini" />
                <S label="Acción" v={p.a} op={['Activa', 'Pasiva']} set={(a) => pp({ ...p, a })} />
                <S label="Mantenido" v={p.m} op={['No', 'Sí']} set={(m) => pp({ ...p, m: m as 'Sí' | 'No' })} />
              </div>
              <div class="grid-fields">{DIFICULTADES.map((df, q) => <T key={df} label={df} v={p.f[q]} set={(x) => pp({ ...p, f: cambiar(p.f, q, x) })} />)}</div>
              <button class="btn" onClick={() => poner({ ...d, poderes: d.poderes.filter((_, j) => j !== k) })}>Quitar poder</button>
            </article>
          );
        })}
        <div class="row">
          <button class="btn" onClick={() => poner({ ...d, poderes: [...d.poderes, poderNuevo()] })}>+ Añadir poder</button>
          <button class="btn" onClick={() => { guardar({ disciplinas: b.disciplinas.filter((_, j) => j !== i) }); setAbierto(null); }}>Borrar disciplina</button>
        </div>
      </div>
    );
  };

  const EditorArs = ({ i }: { i: number }) => {
    const a = b.arsMagnus[i];
    const poner = (x: typeof a) => guardar({ arsMagnus: cambiar(b.arsMagnus, i, x) });
    return (
      <div class="stack">
        <div class="grid-fields">
          <T label="Nombre" v={a.n} set={(n) => poner({ ...a, n })} clase="grow" />
          <N label="PD" v={a.pd} set={(pd) => poner({ ...a, pd: pd ?? 0 })} clase="mini" />
          <N label="CM" v={a.cm} set={(cm) => poner({ ...a, cm: cm ?? 0 })} clase="mini" />
        </div>
        <T label="Descripción" v={a.e} set={(e) => poner({ ...a, e })} area />
        <button class="btn" onClick={() => { guardar({ arsMagnus: b.arsMagnus.filter((_, j) => j !== i) }); setAbierto(null); }}>Borrar Ars Magnus</button>
      </div>
    );
  };

  const elementos: { n: string; sub: string }[] = sec === 'vias' ? b.vias.map((v) => ({ n: v.n, sub: `${v.tipo} · ${v.conjuros.length} conjuros` }))
    : sec === 'disciplinas' ? b.disciplinas.map((d) => ({ n: d.n, sub: `${d.poderes.length} poderes` }))
      : b.arsMagnus.map((a) => ({ n: a.n, sub: `${a.pd} PD · ${a.cm} CM` }));

  // ---- personaje ----
  const elegidos = f.propio ?? [];
  const total = consumo(elegidos);
  const opciones: [TipoElegido, string][] = [...b.vias.map((v) => ['via', v.n] as [TipoElegido, string]), ...b.disciplinas.map((d) => ['disciplina', d.n] as [TipoElegido, string]), ...b.arsMagnus.map((a) => ['ars', a.n] as [TipoElegido, string])];
  const disponibles = opciones.filter(([t, n]) => !elegidos.some((e) => e.tipo === t && e.n === n));
  const [pick, setPick] = useState('');
  const agregar = () => {
    const [t, ...r] = pick.split(':'); const n = r.join(':');
    if (!t || !n) return;
    const ars = t === 'ars' ? b.arsMagnus.find((a) => a.n === n) : undefined;
    guardarPropio(f.id, [...elegidos, { tipo: t as TipoElegido, n, nivel: 0, cv: t === 'disciplina' ? 1 : 0, cm: ars?.cm ?? 0, pd: ars?.pd ?? 0, cat: 1 }]);
    setPick('');
  };
  const editar = (i: number, x: Partial<Elegido>) => guardarPropio(f.id, cambiar(elegidos, i, { ...elegidos[i], ...x }));
  const cats = [7, 9, 11, 13, 15].map((r) => txt(`PDs!O${r}`));

  return (
    <div class="personalizado">
      <p class="extra-note">Contenido propio de tu gremio: no está en las reglas de Anima. Cada elemento que tenga el personaje solo consume nivel de vía, CV, CM y PD; no se añaden a las tablas del Excel.</p>

      <Panel title="Biblioteca del gremio" extra={<span class="muted small">{b.vias.length} vías · {b.disciplinas.length} disciplinas · {b.arsMagnus.length} Ars Magnus · {b.categorias.length} categorías</span>}>
        <div class="grid-fields"><T label="Nombre del gremio" v={b.nombre} set={(nombre) => guardar({ nombre })} clase="grow" /></div>
        <div class="row wrap">
          <label class="btn">Importar .json<input type="file" accept=".json,application/json" hidden aria-label="Importar biblioteca de gremio" onChange={importar} /></label>
          <label class="check"><input type="checkbox" checked={unir} onChange={(e) => setUnir(e.currentTarget.checked)} /> Unir con lo que ya hay</label>
          <button class="btn" onClick={() => descargar(`${b.nombre || 'Gremio'}.json`, new TextEncoder().encode(exportarBiblioteca()), 'application/json')}>Exportar .json</button>
          <button class="btn" onClick={() => descargar('Biblioteca de ejemplo.json', new TextEncoder().encode(JSON.stringify(EJEMPLO, null, 2)), 'application/json')}>Descargar ejemplo</button>
        </div>
        {(mensaje || errorBiblioteca.value) && <p class={mensaje.startsWith('Biblioteca importada') ? 'muted small' : 'aviso'} role="status">{errorBiblioteca.value || mensaje}</p>}
      </Panel>

      <Panel title="Editar la biblioteca">
        <div class="seg" role="group" aria-label="Qué editar">
          {([['vias', 'Vías y subvías'], ['disciplinas', 'Disciplinas psíquicas'], ['ars', 'Ars Magnus']] as [Seccion, string][]).map(([k, t]) => (
            <button type="button" key={k} aria-pressed={sec === k} onClick={() => { setSec(k); setAbierto(null); }}>{t}</button>
          ))}
        </div>
        <div class="row">
          <label class="field grow"><span class="lbl">Nuevo elemento</span><input type="text" value={nuevo} placeholder="Nombre" onInput={(e) => setNuevo(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') anadir(); }} /></label>
          <button class="btn primary" onClick={anadir}>Añadir</button>
        </div>
        {elementos.length === 0 && <p class="muted">Aún no hay {sec === 'vias' ? 'vías ni subvías' : sec === 'disciplinas' ? 'disciplinas' : 'Ars Magnus'} propios. Añade uno o importa la biblioteca de tu gremio.</p>}
        {elementos.map((el, i) => (
          <details key={el.n} class="panel" open={abierto === el.n} onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) setAbierto(el.n); }}>
            <summary><strong>{el.n}</strong> <span class="muted small">{el.sub}</span></summary>
            <div class="pbody">
              {abierto === el.n && (sec === 'vias' ? EditorVia({ v: b.vias[i], i }) : sec === 'disciplinas' ? EditorDisciplina({ i }) : EditorArs({ i }))}
            </div>
          </details>
        ))}
      </Panel>

      <CategoriasGremio f={f} />

      <Panel title="En este personaje" extra={<span class="muted small">Consume: nivel de vía {total.nivel} · CV {total.cv} · CM {total.cm} · PD {total.pd.reduce((a, c) => a + c, 0)}</span>}>
        <div class="salidas">
          <div class="stat"><div class="stat-v">{txt('Místicos!E12') || 0}/{txt('Místicos!C12') || 0}</div><div class="muted small">Nivel de magia usado</div><Avisos claves={['Místicos!C29']} /></div>
          <div class="stat"><div class="stat-v">{txt('Psíquicos!F20') || 0}</div><div class="muted small">CVs libres</div><Avisos claves={['Psíquicos!C22']} /></div>
          <div class="stat"><div class="stat-v">{txt('Ki!E29') || 0}/{txt('Ki!C29') || 0}</div><div class="muted small">CM usado</div></div>
          <div class="stat"><div class="stat-v">{txt('PDs!AA194') || 0}/{txt('PDs!Z194') || 0}</div><div class="muted small">PD gastados</div><Avisos claves={['PDs!T194']} /></div>
        </div>
        <div class="row">
          <label class="field grow"><span class="lbl">Añadir de la biblioteca</span>
            <select value={pick} onChange={(e) => setPick(e.currentTarget.value)}>
              <option value="">—</option>
              {(['via', 'disciplina', 'ars'] as TipoElegido[]).map((t) => disponibles.some(([x]) => x === t) && (
                <optgroup key={t} label={t === 'via' ? 'Vías y subvías' : t === 'disciplina' ? 'Disciplinas psíquicas' : 'Ars Magnus'}>
                  {disponibles.filter(([x]) => x === t).map(([, n]) => <option key={n} value={`${t}:${n}`}>{n}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <button class="btn primary" disabled={!pick} onClick={agregar}>Añadir</button>
        </div>
        {elegidos.length === 0 && <p class="muted">Este personaje no tiene elementos propios.</p>}
        {elegidos.map((e, i) => (
          <div class="compra" key={`${e.tipo}:${e.n}`}>
            <strong class="grow">{e.n} <span class="muted small">{e.tipo === 'via' ? 'vía' : e.tipo === 'disciplina' ? 'disciplina' : 'Ars Magnus'}</span></strong>
            {e.tipo === 'via' && <N label="Nivel de vía" v={e.nivel} set={(x) => editar(i, { nivel: x ?? 0 })} clase="mini" />}
            {e.tipo === 'disciplina' && <N label="CV" v={e.cv} set={(x) => editar(i, { cv: x ?? 0 })} clase="mini" />}
            {e.tipo === 'ars' && <N label="CM" v={e.cm} set={(x) => editar(i, { cm: x ?? 0 })} clase="mini" />}
            <N label="PD" v={e.pd} set={(x) => editar(i, { pd: x ?? 0 })} clase="mini" />
            <S label="Categoría de los PD" v={String(e.cat)} op={['1', '2', '3', '4', '5']} set={(x) => editar(i, { cat: Number(x) })} />
            <button class="icon-btn" aria-label={`Quitar ${e.n}`} title="Quitar" onClick={() => guardarPropio(f.id, elegidos.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        {elegidos.length > 0 && <p class="muted small">Categorías de PD: {cats.map((c, i) => c && `${i + 1} = ${c}`).filter(Boolean).join(' · ') || 'sin categoría elegida'}. Estos consumos se suman a los totales de la ficha pero no se escriben en el Excel al exportar.</p>}
      </Panel>
    </div>
  );
}
