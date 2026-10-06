// Tarjeta «Nivel y categoría»: arriba de Principal y Desarrollo. Sube o baja el nivel de la categoría actual, muestra los PD libres y permite
// cambiar de categoría ahora o dejarlo programado (reserva PD sin cambiar de nivel ni de categoría). Todo avisa, nada bloquea.
import { useState } from 'preact/hooks';
import type { Ficha } from '../model/ficha';
import { aplicarCambio, editar, programarCambio } from '../store';
import { costeCambio, filasActuales, FILAS, repartir, type Reparto } from '../nivel';
import { copiaPropia, opcionesCategoria } from './CategoriasGremio';
import { Barra } from './Desarrollo';
import { txt, v } from './campos';

const num = (k: string) => Number(v(k)) || 0;
const REPARTOS: [Reparto, string][] = [['antigua', 'Todo la antigua'], ['mitad', 'Mitad y mitad'], ['nueva', 'Todo la nueva']];

export function TarjetaNivel({ f }: { f: Ficha }) {
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState('');
  const [modo, setModo] = useState<Reparto>('mitad');
  const [z, setZ] = useState('');
  const [aa, setAa] = useState('');

  const cats = FILAS.map((r, i) => ({ r, i, n: String(f.entradas[`PDs!O${r}`] ?? '').trim() })).filter((c) => c.n);
  if (!cats.length) return null;
  const { actual, siguiente } = filasActuales(f.entradas);
  const cur = cats[cats.length - 1];
  const nivelDe = (r: number) => Number(f.entradas[`PDs!S${r}`]) || 0;
  const p = f.programado;
  const reservado = p ? p.z + p.aa : 0;
  const disp = cats.reduce((t, c) => t + num(`PDs!${'JLNPR'[c.i]}194`), 0);
  const usado = cats.reduce((t, c) => t + num(`PDs!${'KMOQS'[c.i]}194`), 0);
  const libres = disp - usado - reservado;
  const aviso = txt('PDs!T194');
  const mitad = num('Tablas!G371') > 0;
  // PDs!Y185:AA187: bonos y habilidades naturales y bonos de Novel asignados frente a los que tocan (el Excel los cuenta; aquí solo se avisa)
  const partes = (k: string) => txt(k).split('+').map((x) => Number(x) || 0);
  const pasa = (a: string, b: string) => partes(a).some((x, i) => x > (partes(b)[i] ?? 0));
  const asignaciones: [string, string, string, boolean][] = [
    ['Bonos naturales', txt('PDs!Y185'), txt('PDs!AA185'), pasa('PDs!Y185', 'PDs!AA185')],
    ['Hab. naturales', txt('PDs!Y186'), txt('PDs!AA186'), num('PDs!Y186') > num('PDs!AA186')],
    ...(num('PDs!AA187') || num('PDs!Y187') ? [['Bonos de Novel', txt('PDs!Y187'), txt('PDs!AA187'), num('PDs!Y187') > num('PDs!AA187')] as [string, string, string, boolean]] : []),
  ];
  const { propias, todas } = opcionesCategoria(f, destino);
  const destinos = todas.filter((n) => n.toLowerCase() !== cur.n.toLowerCase());
  const coste = destino ? costeCambio(cur.n, destino, f.categorias, mitad) : 0;
  const zN = Math.max(0, Number(z) || 0), aaN = Math.max(0, Number(aa) || 0);

  const abrir = () => {
    const a = p?.a ?? destinos[0] ?? '';
    setDestino(a);
    if (p) { setZ(String(p.z)); setAa(String(p.aa)); } else fijar(a, 'mitad');
    setAbierto(true);
  };
  const fijar = (a: string, m: Reparto) => {
    const [x, y] = repartir(costeCambio(cur.n, a, f.categorias, mitad), m);
    setModo(m); setZ(String(x)); setAa(String(y));
  };
  const cambio = { a: destino, z: zN, aa: aaN };
  const aplicar = (c = cambio) => { if (aplicarCambio(f.id, c, copiaPropia(propias, c.a))) setAbierto(false); };

  const avisos = [
    cur.n && nivelDe(actual) === 1 && `Cambias tras 1 solo nivel en ${cur.n}.`,
    destino && zN + aaN !== coste && `Lo que pagas (${zN + aaN}) no suma el coste del cambio (${coste}).`,
    destino && zN + aaN > libres + (p ? reservado : 0) && 'No tienes tantos PD libres.',
  ].filter(Boolean) as string[];

  return (
    <section class="panel tarjeta-nivel" aria-label="Nivel y categoría">
      <div class="row between wrap">
        <div class="row tn-cab">
          <div><div class="lbl">Nivel</div><div class="tn-nivel" aria-live="polite">{txt('PDs!R17') || cats.reduce((t, c) => t + nivelDe(c.r), 0)}</div></div>
          <div>
            <div class="lbl">Categoría actual</div>
            <div class="tn-cat">{cur.n}{p && <span class="tn-flecha"> → {p.a}</span>}</div>
            <p class="muted small">{cats.map((c) => `${c.n} ${nivelDe(c.r)}`).join(' · ')} · {txt('PDs!T17')} PD</p>
          </div>
        </div>
        <div class="row wrap">
          <button type="button" class="btn" aria-label="Bajar un nivel" disabled={nivelDe(actual) <= 0} onClick={() => editar(f.id, `PDs!S${actual}`, nivelDe(actual) - 1 || null)}>−1</button>
          <button type="button" class="btn primary" onClick={() => editar(f.id, `PDs!S${actual}`, nivelDe(actual) + 1)}>+1 nivel de {cur.n}</button>
          <button type="button" class="btn" aria-expanded={abierto} disabled={!siguiente} title={siguiente ? undefined : 'Ya tienes 5 categorías'}
            onClick={() => (abierto ? setAbierto(false) : abrir())}>{p ? 'Editar el cambio…' : 'Cambiar de categoría…'}</button>
        </div>
      </div>

      {p && (
        <div class="tn-prog" role="status">
          <button type="button" class="tn-equis" aria-label="Anular el cambio programado" title="Anular el cambio programado" onClick={() => programarCambio(f.id, null)}>×</button>
          <div class="tn-etiqueta">Programada · próxima categoría</div>
          <div class="tn-destino">→ {p.a}</div>
          <div class="row between small"><span class="muted">Paga la antigua ({cur.n})</span><strong>{p.z} PD</strong></div>
          <div class="row between small"><span class="muted">Paga la nueva ({p.a})</span><strong>{p.aa} PD</strong></div>
          <div class="row between small"><span class="muted">Total reservado</span><strong>{reservado} PD</strong></div>
          <p class="muted small">Sigues en {cur.n} y el nivel no cambia hasta que lo apliques.</p>
          <button type="button" class="btn" disabled={!siguiente} onClick={() => aplicar(p)}>Aplicar ahora</button>
        </div>
      )}

      <div class="chips">
        <span class={'chip' + (libres < 0 ? ' mal' : '')}>PD libres <b>{libres}</b></span>
        {p && <span class="chip">Reservados <b>{reservado}</b></span>}
        {asignaciones.map(([t, y, a, mal]) => <span key={t} class={'chip' + (mal ? ' mal' : '')}>{t} <b>{y} de {a}</b></span>)}
        {aviso && <span class="chip mal" role="status">{aviso} · solo avisa</span>}
      </div>

      <div class="tn-cats">
        {cats.map((c) => {
          const d = num(`PDs!${'JLNPR'[c.i]}194`), u = num(`PDs!${'KMOQS'[c.i]}194`);
          return (
            <div key={c.r} class={'tn-catcard' + (c.r === actual ? ' tn-act' : '')}>
              <div class="row between"><strong>{c.n}</strong><span>{nivelDe(c.r)} niv.</span></div>
              <div class="row between small muted"><span>PD</span><span class={u > d ? 'error' : ''}>{u} / {d}</span></div>
              <Barra v={u} max={d} />
            </div>
          );
        })}
      </div>

      {abierto && siguiente && (
        <div class="tn-cambio">
          <div class="lbl">Cambio de categoría</div>
          <div class="row wrap">
            <label for="tn-destino">De <strong>{cur.n}</strong> a</label>
            <select id="tn-destino" value={destino} onChange={(e) => { setDestino(e.currentTarget.value); fijar(e.currentTarget.value, modo); }}>
              {destinos.map((n) => <option key={n} value={n}>{propias.some((c) => c.n === n) ? `${n} · gremio` : n}</option>)}
            </select>
            <span class="chip">Coste <b>{coste} PD</b></span>
          </div>
          <div class="row wrap">
            <span class="muted small">¿Quién lo paga?</span>
            <div class="tn-seg" role="group" aria-label="Reparto del coste">
              {REPARTOS.map(([k, t]) => <button type="button" key={k} aria-pressed={modo === k} onClick={() => fijar(destino, k)}>{t}</button>)}
            </div>
            <label class="field mini"><span class="lbl">Antigua</span><input type="number" min="0" inputMode="numeric" value={z} onInput={(e) => setZ(e.currentTarget.value)} /></label>
            <label class="field mini"><span class="lbl">Nueva</span><input type="number" min="0" inputMode="numeric" value={aa} onInput={(e) => setAa(e.currentTarget.value)} /></label>
          </div>
          {avisos.length > 0 && <p class="aviso" role="status">Aviso: {avisos.join(' ')} No bloquea.</p>}
          <div class="row wrap">
            <button type="button" class="btn primary" disabled={!destino} onClick={() => aplicar()}>Aplicar ahora</button>
            <button type="button" class="btn" disabled={!destino} title="Reserva los PD del cambio sin cambiar de categoría ni de nivel"
              onClick={() => { programarCambio(f.id, cambio); setAbierto(false); }}>Programar para después</button>
            <button type="button" class="btn" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  );
}
