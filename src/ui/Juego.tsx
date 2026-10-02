// Modo juego: una pantalla para jugar la sesión. Lee los valores calculados de la ficha (solo lectura) y guarda el
// estado de la partida en `ficha.sesion`, aparte de las entradas: nada de aquí cambia la ficha ni sus cálculos.
// Sin dados (decisión del usuario). Los límites avisan, nunca bloquean.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Fragment, type ComponentChildren } from 'preact';
import { buscar, guardado, guardarSesion } from '../store';
import { abrir, abierta, errorMotor, motor, valores } from '../engine';
import { nombreDe, type Ficha, type Recurso, type Sesion } from '../model/ficha';
import { Icon } from './Icon';
import { txt } from './campos';

/** Descanso de un día. Provisional: las cifras exactas saldrán de los libros; se cambian aquí y en ningún otro sitio. */
export const REGLAS_DESCANSO = {
  /** La regeneración de la ficha (Principal!K11, p. ej. "30 PV / día") pasada a PV por día según su unidad. */
  pvPorDia: { 'día': 1, min: 24 * 60, turno: 24 * 60 * 20 } as Record<string, number>, // 20 asaltos por minuto
  /** Zeón recuperado = regeneración zeónica (Místicos!J12) × este factor. */
  zeonPorDia: 1,
  /** Lo recuperado no pasa del máximo de la ficha (si ya estaba por encima, se queda como está). */
  topeEnMaximo: true,
  /** Recursos que vuelven al máximo. */
  alMaximo: ['ki', 'cv', 'cans', 'acc'] as Recurso[],
  quitaEfectosConAsaltos: true,
  quitaMantenidos: true,
};

type Valores = Record<Recurso, number>;
const n = (k: string) => Number(txt(k)) || 0;

const REC: Record<Recurso, { n: string; t: string; pasos: number[] }> = {
  pv: { n: 'PV', t: 'Puntos de vida', pasos: [10, 1] },
  zeon: { n: 'Zeón', t: 'Zeón', pasos: [50, 10] },
  ki: { n: 'Ki', t: 'Ki', pasos: [5, 1] },
  cv: { n: 'CV', t: 'CVs libres', pasos: [1] },
  cans: { n: 'Cans.', t: 'Cansancio', pasos: [1] },
  acc: { n: 'Acc.', t: 'Acciones este asalto', pasos: [1] },
};

/** Máximos de la ficha (valores calculados por el motor). */
function maximos(): Valores {
  return { pv: n('Principal!N11'), zeon: n('Místicos!K18'), ki: n('Ki!F24'), cv: n('Psíquicos!F20'), cans: n('Principal!N16'), acc: n('Principal!J32') };
}

/** Sin sesión: PV y zeón actuales de la ficha (Principal!P11, Místicos!M18); el resto, al máximo. */
function inicio(max: Valores): Valores {
  const actual = (k: string, def: number) => (txt(k) === '' || Number.isNaN(Number(txt(k))) ? def : Number(txt(k)));
  return { ...max, pv: actual('Principal!P11', max.pv), zeon: actual('Místicos!M18', max.zeon) };
}

/** PV por día según la regeneración de la ficha; null si la ficha no da una cifra que se entienda. */
export function regeneracionDiaria(texto = txt('Principal!K11')): number | null {
  const m = texto.match(/(-?\d+)\s*PV\s*\/\s*([^\s*]+)/);
  const factor = m ? REGLAS_DESCANSO.pvPorDia[m[2]] : undefined;
  return m && factor ? Number(m[1]) * factor : null;
}

const vacia = (): Sesion => ({ r: {}, asalto: 1, efectos: [], conts: [], mant: [], favH: [], favC: [], notas: '' });
const signo = (x: number) => (x > 0 ? `+${x}` : String(x));
const rango = (a: number, b: number, paso = 1) => Array.from({ length: Math.floor((b - a) / paso) + 1 }, (_, i) => a + i * paso);

export function Juego({ id }: { id: string }) {
  const f = buscar(id);
  useEffect(() => {
    if (f) void abrir(id, f.entradas);
  }, [id]);
  if (!f) {
    return (
      <main class="container stack">
        <h1 class="title">Ficha no encontrada</h1>
        <a href="#/">Volver a la lista</a>
      </main>
    );
  }
  const listo = abierta.value === id && Object.keys(valores.value).length > 0;
  if (!listo) {
    return (
      <div class="page">
        <Cabecera f={f} />
        {motor.value === 'error'
          ? <p class="banner error" role="alert">No se pudo cargar el motor de cálculo: {errorMotor.value}</p>
          : <p class="banner" role="status">Preparando los cálculos de la ficha…</p>}
      </div>
    );
  }
  return <Partida f={f} />;
}

function Cabecera({ f, children }: { f: Ficha; children?: ComponentChildren }) {
  const nombre = nombreDe(f);
  return (
    <header class="topbar juego-top">
      <a class="icon-btn plain" href={`#/ficha/${f.id}/principal`} aria-label="Salir del modo juego (volver a la ficha)" title="Salir del modo juego"><Icon name="back" /></a>
      <div class="avatar sm">{nombre.trim()[0]?.toUpperCase() ?? '?'}</div>
      <div class="grow">
        <div class="char-name">{nombre || 'Sin nombre'}</div>
        <div class="muted small">{[txt('Principal!K5'), txt('Principal!O6') && `Nivel ${txt('Principal!O6')}`, txt('General!F23')].filter(Boolean).join(' · ')}</div>
      </div>
      {children}
    </header>
  );
}

type Aviso = { t: string; d: string; antes?: Sesion };
const TABS = [['estado', 'Estado'], ['combate', 'Combate'], ['habil', 'Habilidades'], ['poderes', 'Poderes']] as const;

function Partida({ f }: { f: Ficha }) {
  const max = maximos();
  const ini = inicio(max);
  const s = f.sesion ?? vacia();
  const val = (k: Recurso) => s.r[k] ?? ini[k];
  const cur = Object.fromEntries(Object.keys(REC).map((k) => [k, val(k as Recurso)])) as Valores;

  /** Cambia la sesión y la guarda (sola, sin botón). Devuelve la sesión nueva. */
  const guardar = (fn: (x: Sesion) => void) => {
    const x = JSON.parse(JSON.stringify(s)) as Sesion;
    fn(x);
    guardarSesion(f.id, x);
    return x;
  };
  const poner = (k: Recurso, v: number) => guardar((x) => { x.r[k] = Math.round(v); });

  const [aviso, setAviso] = useState<Aviso | null>(null);
  const tAviso = useRef<ReturnType<typeof setTimeout>>(undefined);
  const avisar = (t: string, d: string, antes?: Sesion) => {
    setAviso({ t, d, antes });
    clearTimeout(tAviso.current);
    tAviso.current = setTimeout(() => setAviso(null), 6000);
  };
  const [armado, setArmado] = useState(false);
  const tArmado = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => { clearTimeout(tAviso.current); clearTimeout(tArmado.current); }, []);

  const [tab, setTab] = useState<string>('estado');
  const [poder, setPoder] = useState(max.zeon > 0 ? 'magia' : max.ki > 0 ? 'ki' : max.cv > 0 ? 'psi' : 'magia');

  const reiniciar = () => {
    if (!armado) {
      setArmado(true);
      tArmado.current = setTimeout(() => setArmado(false), 3000);
      avisar('¿Reiniciar la sesión?', 'Toca otra vez el botón para confirmar. La ficha no cambia.');
      return;
    }
    clearTimeout(tArmado.current);
    setArmado(false);
    guardarSesion(f.id, { ...vacia(), favH: s.favH, favC: s.favC }); // las favoritas son preferencias: se quedan
    avisar('Sesión reiniciada', 'Valores de la ficha restaurados; la ficha no ha cambiado.');
  };

  const descansar = () => {
    const R = REGLAS_DESCANSO;
    const reg = regeneracionDiaria();
    const zeon = n('Místicos!J12') * R.zeonPorDia;
    const sube = (k: Recurso, c: number) => (R.topeEnMaximo ? Math.max(cur[k], Math.min(max[k], cur[k] + c)) : cur[k] + c);
    const nuevo = guardar((x) => {
      x.r.pv = sube('pv', reg ?? 0);
      x.r.zeon = sube('zeon', zeon);
      for (const k of R.alMaximo) x.r[k] = max[k];
      if (R.quitaEfectosConAsaltos) x.efectos = x.efectos.filter((e) => e.a === null);
      if (R.quitaMantenidos) x.mant = [];
      x.asalto = 1;
    });
    avisar('Un día de descanso',
      `${signo(nuevo.r.pv! - cur.pv)} PV · ${signo(nuevo.r.zeon! - cur.zeon)} zeón · ki, CVs, cansancio y acciones al máximo`
      + (reg === null ? ' · ⚠ La ficha no indica una regeneración diaria: no se recuperan PV.' : ''), s);
  };

  const nuevoAsalto = () => {
    const x = guardar((x) => {
      x.asalto += 1;
      x.r.acc = max.acc;
      x.efectos = x.efectos.map((e) => (e.a === null ? e : { ...e, a: e.a - 1 })).filter((e) => e.a === null || e.a > 0);
    });
    avisar(`Asalto ${x.asalto}`, 'Acciones recuperadas.');
  };

  const gastar = (k: Recurso, cant: number, que: string) => {
    const x = guardar((x) => { x.r[k] = cur[k] - cant; });
    avisar(que, `−${cant} ${REC[k].n.toLowerCase()}` + (x.r[k]! < 0 ? ` · ⚠ ${REC[k].t} por debajo de 0` : ''), s);
  };

  const mod = s.efectos.reduce((t, e) => t + e.m, 0);
  const ctx: Ctx = { f, s, max, cur, guardar, poner, avisar, gastar };
  const conZeon = max.zeon > 0 || cur.zeon !== 0;

  return (
    <div class="page juego">
      <Cabecera f={f}>
        <span class={guardado.value ? 'saved' : 'error'} role="status">{guardado.value ? '● Sesión guardada' : '● No se pudo guardar'}</span>
        <button type="button" class={'btn' + (armado ? ' juego-armado' : '')} onClick={reiniciar} aria-pressed={armado}
          aria-label={armado ? 'Confirmar: reiniciar sesión' : 'Reiniciar sesión'} title="Vuelve todos los valores de sesión a los de la ficha">
          {armado ? 'Toca otra vez' : 'Reiniciar sesión'}
        </button>
      </Cabecera>

      <section class="juego-hud" aria-label="Lo más usado">
        <RecursoFila ctx={ctx} k="pv" hud />
        {conZeon && <RecursoFila ctx={ctx} k="zeon" hud />}
        <div class="juego-hud-stats">
          <Stat v={txt('Principal!D31')} l="Turno" />
          <Stat v={txt('Principal!H24')} l="H. Ataque" />
          <Stat v={txt('Principal!H26')} l={txt('Principal!F26').replace(/:$/, '') || 'H. Defensa'} />
          {conZeon && <Stat v={txt('Místicos!P12')} l="Proy. mágica" />}
          <Stat v={`${cur.acc}/${max.acc}`} l="Acciones" />
          <Stat v={String(s.asalto)} l="Asalto" extra />
          <Stat v={mod ? signo(mod) : '0'} l="Mod. a toda acción" cls={mod ? 'juego-mod' : ''} extra={!mod} />
        </div>
      </section>

      <main class="juego-cuerpo">
        <div class="juego-col">
          <div class={'juego-grupo' + (tab === 'estado' ? ' on' : '')} id="juego-estado" role="tabpanel" aria-labelledby="tab-estado">
            <Estado ctx={ctx} nuevoAsalto={nuevoAsalto} descansar={descansar} />
          </div>
        </div>
        <div class="juego-col">
          <div class={'juego-grupo' + (tab === 'combate' ? ' on' : '')} id="juego-combate" role="tabpanel" aria-labelledby="tab-combate">
            <Combate conZeon={conZeon} />
          </div>
          <div class={'juego-grupo' + (tab === 'habil' ? ' on' : '')} id="juego-habil" role="tabpanel" aria-labelledby="tab-habil">
            <Habilidades ctx={ctx} />
          </div>
          <div class={'juego-grupo' + (tab === 'poderes' ? ' on' : '')} id="juego-poderes" role="tabpanel" aria-labelledby="tab-poderes">
            <div class="juego-segctl" role="group" aria-label="Tipo de poder">
              {[['magia', 'Magia'], ['ki', 'Ki'], ['psi', 'Psíquica']].map(([k, t]) => (
                <button type="button" key={k} aria-pressed={poder === k} onClick={() => setPoder(k)}>{t}</button>
              ))}
            </div>
            <div class={'juego-poder' + (poder === 'magia' ? ' on' : '')}><Magia ctx={ctx} /></div>
            <div class={'juego-poder' + (poder === 'ki' ? ' on' : '')}><Ki ctx={ctx} /></div>
            <div class={'juego-poder' + (poder === 'psi' ? ' on' : '')}><Psi ctx={ctx} /></div>
          </div>
        </div>
      </main>

      <nav class="juego-tabs" role="tablist" aria-label="Secciones del modo juego">
        {TABS.map(([k, t]) => (
          <button type="button" role="tab" key={k} id={`tab-${k}`} aria-selected={tab === k} aria-controls={`juego-${k}`}
            onClick={() => { setTab(k); scrollTo?.(0, 0); }}>{t}</button>
        ))}
      </nav>

      <div class={'juego-toast' + (aviso ? ' on' : '')} role="status" aria-live="polite">
        {aviso && (
          <>
            <div class="small"><strong>{aviso.t}</strong></div>
            <div>{aviso.d}</div>
            {aviso.antes && (
              <button type="button" class="btn" onClick={() => { guardarSesion(f.id, aviso.antes!); setAviso(null); }}>Deshacer</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type Ctx = {
  f: Ficha; s: Sesion; max: Valores; cur: Valores;
  guardar: (fn: (x: Sesion) => void) => Sesion;
  poner: (k: Recurso, v: number) => Sesion;
  avisar: (t: string, d: string, antes?: Sesion) => void;
  gastar: (k: Recurso, cant: number, que: string) => void;
};

function Stat({ v, l, cls = '', extra }: { v: string; l: string; cls?: string; extra?: boolean }) {
  return <div class={'stat' + (extra ? ' juego-extra' : '')}><div class={'stat-v ' + cls}>{v || '—'}</div><span class="juego-lbl">{l}</span></div>;
}

function Panel({ t, pill, open = true, children, color }: { t: string; pill?: string; open?: boolean; children: ComponentChildren; color?: string }) {
  return (
    <details class="panel juego-panel" open={open}>
      <summary><span class="panel-title" style={color ? { color } : undefined}>{t}</span>{pill && <span class="juego-pill">{pill}</span>}</summary>
      <div class="juego-pbody">{children}</div>
    </details>
  );
}

/** Un recurso (PV, zeón…): en el HUD, compacto; en los paneles, con pasos grandes y pequeños. Sin límites. */
function RecursoFila({ ctx, k, hud }: { ctx: Ctx; k: Recurso; hud?: boolean }) {
  const R = REC[k];
  const cur = ctx.cur[k];
  const max = ctx.max[k];
  const p = max > 0 ? Math.max(0, Math.min(100, (100 * cur) / max)) : 0;
  const estado = k === 'pv' ? (p <= 25 ? ' bajo' : p <= 50 ? ' medio' : '') : '';
  const sm = R.pasos[R.pasos.length - 1];
  const big = R.pasos[0];
  const input = (
    <input type="number" inputMode="numeric" value={cur} aria-label={`${R.t} actuales`}
      onChange={(e) => ctx.poner(k, Number(e.currentTarget.value) || 0)} />
  );
  const barra = <div class="barra"><div style={{ width: `${p}%` }} /></div>;
  const b = (d: number) => (
    <button type="button" class={hud ? 'icon-btn' : 'btn'} aria-label={`${d < 0 ? 'Restar' : 'Sumar'} ${Math.abs(d)} ${R.t}`}
      onClick={() => ctx.poner(k, cur + d)}>{hud ? (d < 0 ? '−' : '+') : signo(d).replace('-', '−')}</button>
  );
  if (hud) {
    return (
      <div class={'juego-rec' + estado} data-r={k}>
        <span class="juego-rec-n">{R.n}</span>
        <div class="juego-rec-bar">{barra}<span class="muted">de {max}</span></div>
        {b(-sm)}{input}{b(sm)}
      </div>
    );
  }
  return (
    <div class={'juego-recurso' + estado} data-r={k}>
      <div class="row between"><strong>{R.t}</strong><span class="muted small">máx. {max}</span></div>
      <div class="juego-ctrl">
        {R.pasos.length > 1 ? b(-big) : <span />}
        {b(-sm)}
        <div class="juego-val">{input}<span class="muted">/ {max}</span></div>
        {b(sm)}
        {R.pasos.length > 1 ? b(big) : <span />}
      </div>
      {barra}
    </div>
  );
}

/** Avisos de los recursos: nunca bloquean. */
function avisosRecursos(cur: Valores, max: Valores) {
  const a: string[] = [];
  if (cur.pv <= 0) a.push('PV a 0 o menos: el personaje está inconsciente o muriendo.');
  else if (cur.pv > max.pv) a.push(`PV por encima del máximo de la ficha (${max.pv}).`);
  for (const k of ['zeon', 'ki', 'cv', 'cans', 'acc'] as Recurso[]) {
    if (cur[k] < 0) a.push(`${REC[k].t} por debajo de 0 (${cur[k]}).`);
    else if (cur[k] > max[k]) a.push(`${REC[k].t} por encima del máximo de la ficha (${max[k]}).`);
  }
  return a;
}

function Estado({ ctx, nuevoAsalto, descansar }: { ctx: Ctx; nuevoAsalto: () => void; descansar: () => void }) {
  const { s, cur, max, guardar, poner } = ctx;
  const [cant, setCant] = useState('');
  const [ef, setEf] = useState({ n: '', a: '', m: '', nota: '' });
  const reg = regeneracionDiaria();
  const mod = s.efectos.reduce((t, e) => t + e.m, 0);
  const rapido = (signo: number) => { poner('pv', cur.pv + signo * (Number(cant) || 0)); setCant(''); };
  const visibles = (['pv', 'zeon', 'ki', 'cv', 'cans', 'acc'] as Recurso[]).filter((k) => ['pv', 'cans', 'acc'].includes(k) || max[k] > 0 || cur[k] !== 0);
  return (
    <>
      <Panel t="Estado actual" pill="solo sesión">
        {visibles.map((k) => (
          <Fragment key={k}>
            <RecursoFila ctx={ctx} k={k} />
            {k === 'pv' && (
              <div class="juego-rapido">
                <label class="sr-only" for="juego-cantidad">Cantidad de daño o curación</label>
                <input id="juego-cantidad" type="number" inputMode="numeric" placeholder="Daño / curación" value={cant} onInput={(e) => setCant(e.currentTarget.value)} />
                <button type="button" class="btn juego-quitar" onClick={() => rapido(-1)}>Quitar</button>
                <button type="button" class="btn juego-curar" onClick={() => rapido(1)}>Curar</button>
              </div>
            )}
          </Fragment>
        ))}
        {avisosRecursos(cur, max).map((t) => <p class="aviso" role="status" key={t}>{t}</p>)}
      </Panel>

      <Panel t="Asalto" pill={`Asalto ${s.asalto}`}>
        <button type="button" class="btn primary" onClick={nuevoAsalto}>Nuevo asalto</button>
        <p class="muted small">Recupera las acciones y resta 1 asalto a cada efecto.</p>
      </Panel>

      <Panel t="Descanso" pill="un día">
        <button type="button" class="btn primary" onClick={descansar}>Descansar un día</button>
        <p class="muted small">
          Recupera PV (regeneración {reg === null ? 'no indicada en la ficha' : `${reg}/día`}), zeón (regeneración zeónica {n('Místicos!J12')}/día),
          CVs, ki, cansancio y acciones; quita los efectos con asaltos y los mantenidos. Los valores definitivos saldrán de los libros. Se puede deshacer.
        </p>
        {reg === null && <p class="nota">La ficha no indica una regeneración diaria de PV ({txt('Principal!K11') || 'vacía'}): al descansar se recuperan 0 PV.</p>}
      </Panel>

      <Panel t="Efectos y estados" pill={mod ? `Mod. ${signo(mod)} a toda acción` : undefined}>
        {s.efectos.length ? s.efectos.map((e, i) => (
          <div class="juego-fila" key={i}>
            <div><strong>{e.n}{e.m ? <span class="juego-mod"> {signo(e.m)}</span> : null}</strong>{e.nota && <span class="muted small"> {e.nota}</span>}</div>
            <span class="juego-asaltos">{e.a === null ? '∞' : `${e.a} as.`}</span>
            <button type="button" class="icon-btn plain" aria-label={`Quitar ${e.n}`} onClick={() => guardar((x) => { x.efectos.splice(i, 1); })}>✕</button>
          </div>
        )) : <div class="juego-vacio">Sin efectos activos.</div>}
        <form class="juego-nuevo-ef" onSubmit={(e) => {
          e.preventDefault();
          if (!ef.n.trim()) return;
          guardar((x) => { x.efectos.push({ n: ef.n.trim(), a: ef.a === '' ? null : Number(ef.a) || 0, m: Number(ef.m) || 0, nota: ef.nota }); });
          setEf({ n: '', a: '', m: '', nota: '' });
        }}>
          <input aria-label="Efecto" placeholder="Efecto (p. ej. Aturdido)" value={ef.n} onInput={(e) => setEf({ ...ef, n: e.currentTarget.value })} />
          <input aria-label="Asaltos (vacío: sin fin)" type="number" inputMode="numeric" placeholder="Asal." value={ef.a} onInput={(e) => setEf({ ...ef, a: e.currentTarget.value })} />
          <input aria-label="Modificador a toda acción" type="number" inputMode="numeric" placeholder="Mod." value={ef.m} onInput={(e) => setEf({ ...ef, m: e.currentTarget.value })} />
          <input aria-label="Nota del efecto" placeholder="Nota (opcional)" class="juego-ancho" value={ef.nota} onInput={(e) => setEf({ ...ef, nota: e.currentTarget.value })} />
          <button class="btn juego-ancho">Añadir efecto</button>
        </form>
      </Panel>

      <Panel t="Contadores" pill="munición, cargas…" open={s.conts.length > 0}>
        {s.conts.length ? s.conts.map((c, i) => (
          <div class="juego-fila" key={i}>
            <input aria-label="Nombre del contador" value={c.n} onChange={(e) => guardar((x) => { x.conts[i].n = e.currentTarget.value; })} />
            <div class="row">
              <button type="button" class="icon-btn" aria-label={`Restar 1 a ${c.n}`} onClick={() => guardar((x) => { x.conts[i].v -= 1; })}>−</button>
              <strong class="juego-cont-v">{c.v}</strong>
              <button type="button" class="icon-btn" aria-label={`Sumar 1 a ${c.n}`} onClick={() => guardar((x) => { x.conts[i].v += 1; })}>+</button>
            </div>
            <button type="button" class="icon-btn plain" aria-label={`Quitar ${c.n}`} onClick={() => guardar((x) => { x.conts.splice(i, 1); })}>✕</button>
          </div>
        )) : <div class="juego-vacio">Sin contadores.</div>}
        <button type="button" class="btn" onClick={() => guardar((x) => { x.conts.push({ n: `Contador ${x.conts.length + 1}`, v: 0 }); })}>Añadir contador</button>
      </Panel>

      <Panel t="Notas rápidas">
        <label class="sr-only" for="juego-notas">Notas rápidas de la sesión</label>
        <textarea id="juego-notas" rows={4} placeholder="PNJ, pistas, iniciativa de los enemigos…" value={s.notas}
          onInput={(e) => guardar((x) => { x.notas = e.currentTarget.value; })} />
      </Panel>
    </>
  );
}

// Hoja Combate: ranuras de arma (igual que la sección Combate). 1-6 cuerpo a cuerpo, 7-10 proyectiles.
const c = (col: string, fila: number) => `Combate!${col}${fila}`;
const RANURAS = [28, 35, 42, 49, 58].flatMap((r, i) => (['I', 'D'] as const).map((lado) => ({ r, lado, proyectil: i >= 3 })));
const LADO = {
  I: { arma: 'E', sal: ['H', 'I', 'J', 'K', 'L'], crit: ['C', 'D', 'E', 'F', 'G'], nombre: 'D' },
  D: { arma: 'P', sal: ['S', 'T', 'U', 'V', 'W'], crit: ['N', 'O', 'P', 'Q', 'R'], nombre: 'O' },
} as const;
const TA = ['I', 'J', 'K', 'L', 'M', 'N', 'O'];
const TIPOS_TA = ['FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE'];

function Criticos({ fila, cols }: { fila: number; cols: readonly string[] }) {
  const [c1, c2, ent, rot, pres] = cols.map((k) => txt(c(k, fila)));
  if ([c1, ent].every((x) => !x || x === '-' || x === '#N/A')) return null;
  return <p class="small muted">Crítico <strong class="juego-txt">{c1}</strong>{c2 && c2 !== '-' ? <> / <strong class="juego-txt">{c2}</strong></> : null} · Entereza {ent} · Rotura {rot} · Presencia {pres}</p>;
}

function Arma({ titulo, chip, sal, crit, cls = '' }: { titulo: string; chip?: string; sal: [string, string][]; crit?: ComponentChildren; cls?: string }) {
  return (
    <article class={'arma ' + cls}>
      <div class="row between wrap"><h3 class="arma-titulo">{titulo}</h3>{chip && <span class="chip">{chip}</span>}</div>
      <div class="salidas">{sal.map(([l, v]) => <Stat key={l} v={v} l={l} />)}</div>
      {crit}
    </article>
  );
}

function Combate({ conZeon }: { conZeon: boolean }) {
  const desarrollada = txt('Principal!F31');
  const armas = RANURAS.filter((s) => txt(c(LADO[s.lado].arma, s.r)));
  const piezas = [12, 13, 14, 15].map((r) => txt(c('C', r))).filter(Boolean);
  return (
    <>
      <Panel t="Combate">
        <div class="salidas">
          <Stat v={txt('Principal!D31')} l="Turno" />
          <Stat v={txt('Principal!H24')} l="H. Ataque" />
          <Stat v={txt('Principal!H26')} l={txt('Principal!F26').replace(/:$/, '') || 'H. Defensa'} />
          <Stat v={txt('Principal!H28')} l="Ll. armadura" />
          <Stat v={txt('Principal!J32')} l="Acciones" />
        </div>
        <div class="juego-duo">
          <Arma titulo={txt(c('C', 20)) || 'Desarmado'} chip={desarrollada === 'Desarmado' ? 'Arma desarrollada' : undefined}
            sal={[['Turno', txt(c('H', 21))], ['Ataque', txt(c('I', 21))], [`Defensa ${txt(c('K', 21))}`.trim(), txt(c('J', 21))], ['Daño', txt(c('L', 21))]]}
            crit={<Criticos fila={23} cols={['C', 'D', 'E', 'F', 'G']} />} />
          {armas.map((s) => {
            const L = LADO[s.lado];
            const nombre = txt(c(L.nombre, s.r - 1)) || txt(c(L.arma, s.r));
            const v = L.sal.map((k) => txt(c(k, s.r + 1)));
            return (
              <Arma key={`${s.r}${s.lado}`} titulo={nombre} chip={desarrollada && nombre.includes(desarrollada) ? 'Arma desarrollada' : undefined}
                sal={[['Turno', v[0]], ['Ataque', v[1]], [`Defensa ${v[3]}`.trim(), v[2]], ['Daño', v[4]]]}
                crit={<Criticos fila={s.proyectil ? s.r + 4 : s.r + 3} cols={L.crit} />} />
            );
          })}
          {conZeon && (
            <Arma titulo="Proyección mágica" cls="juego-magia"
              sal={[['Turno', txt('Místicos!O12')], ['Ataque', txt('Místicos!P12')], ['Defensa', txt('Místicos!Q12')], ['ACT', txt('Místicos!L12')]]} />
          )}
          {n('Psíquicos!H11') > 0 && (
            <Arma titulo="Proyección psíquica" cls="juego-psi"
              sal={[['Turno', txt('Psíquicos!O12')], ['Ataque', txt('Psíquicos!P12')], ['Defensa', txt('Psíquicos!Q12')], ['Potencial', txt('Psíquicos!H11')]]} />
          )}
        </div>
      </Panel>

      <Panel t="Armadura" pill={piezas.join(' · ') || 'sin armadura'}>
        <table class="tabla">
          <thead><tr>{TIPOS_TA.map((t) => <th scope="col" key={t}>{t}</th>)}</tr></thead>
          <tbody><tr>{TA.map((k) => <td class="total" key={k}>{txt(c(k, 16)) || 0}</td>)}</tr></tbody>
        </table>
        <p class="muted small">Requisito {txt(c('H', 16)) || 0} · Restricción de movimiento {txt(c('E', 16)) || 0} · Pen. a acción física {txt(c('S', 16)) || 0}</p>
      </Panel>

      <Panel t="Resistencias y presencia">
        <div class="juego-res">
          {[57, 58, 59, 60, 61, 62].map((r) => <Stat key={r} v={txt(`Principal!J${r}`)} l={r === 57 ? 'Pres.' : txt(`Principal!D${r}`)} />)}
        </div>
        <p class="muted small">
          Movimiento {txt('Principal!J16')} ({txt('Principal!K17')}) · Regeneración {txt('Principal!J11')} ({txt('Principal!K11')}) · Cansancio {txt('Principal!N16')}
        </p>
      </Panel>
    </>
  );
}

const GRUPO: Record<string, string> = { Perc: 'Perceptivas' };

/** Habilidades secundarias con su total (Principal L/M/N/Q 22-72, como la sección Principal). */
function secundarias() {
  const out: { g: string; n: string; v: string }[] = [];
  let g = 'Atléticas';
  for (let r = 22; r <= 72; r++) {
    const t = txt(`Principal!L${r}`);
    if (t) g = GRUPO[t] ?? t;
    const nombre = txt(`Principal!M${r}`) || txt(`Principal!N${r}`);
    if (nombre && nombre !== '-') out.push({ g, n: nombre, v: txt(`Principal!Q${r}`) });
  }
  return out;
}
const negativa = (v: string) => v === '-' || v === '' || Number(v) < 0;

function Habilidades({ ctx }: { ctx: Ctx }) {
  const { s, guardar } = ctx;
  const habs = secundarias();
  const grupos = [...new Set(habs.map((h) => h.g))];
  const [filtro, setFiltro] = useState(s.favH.length ? '★' : 'Todas');
  const [q, setQ] = useState('');
  const [ocultar, setOcultar] = useState(true);
  const busca = q.trim().toLowerCase();
  const lista = habs.filter((h) => {
    if (busca) return h.n.toLowerCase().includes(busca); // al buscar se ignoran los filtros
    if (filtro === '★') return s.favH.includes(h.n);
    if (ocultar && negativa(h.v)) return false;
    return filtro === 'Todas' || h.g === filtro;
  });
  const fav = (nombre: string) => guardar((x) => { x.favH = x.favH.includes(nombre) ? x.favH.filter((h) => h !== nombre) : [...x.favH, nombre]; });
  return (
    <>
      <Panel t="Habilidades" pill={`${s.favH.length} favoritas`}>
        <input type="search" aria-label="Buscar habilidad" placeholder="Buscar habilidad…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <div class="juego-filtros" role="group" aria-label="Filtrar habilidades">
          {['★', 'Todas', ...grupos].map((g) => (
            <button type="button" class="chip" key={g} aria-pressed={g === filtro} onClick={() => setFiltro(g)}>{g === '★' ? '★ Favoritas' : g}</button>
          ))}
        </div>
        <div>
          {lista.map((h) => (
            <div class="juego-hab" key={h.n}>
              <button type="button" class="juego-estrella" aria-pressed={s.favH.includes(h.n)} aria-label={`Favorita ${h.n}`} onClick={() => fav(h.n)}>★</button>
              <span class="juego-nombre">{h.n}{(filtro === '★' || filtro === 'Todas' || busca) && <span class="juego-grp">{h.g}</span>}</span>
              <span class={'juego-v' + (negativa(h.v) ? ' neg' : '')}>{h.v || '—'}</span>
            </div>
          ))}
          {!lista.length && <div class="juego-vacio">{filtro === '★' && !busca ? 'Sin favoritas: márcalas con ★ en «Todas».' : 'Nada coincide.'}</div>}
        </div>
        <label class="check small"><input type="checkbox" checked={ocultar} onChange={(e) => setOcultar(e.currentTarget.checked)} /> Ocultar las no desarrolladas (negativas o «-»)</label>
      </Panel>
      <Panel t="Características" open={false}>
        <div class="juego-caracts">
          {rango(11, 18).map((r) => <Stat key={r} v={txt(`Principal!G${r}`)} l={txt(`Principal!D${r}`)} />)}
        </div>
      </Panel>
    </>
  );
}

// Conjuros: datos de los grimorios (como GrimoriosInfo), cargados aparte la primera vez.
type Conjuro = { n: string; v: string; l: number; d: string; t: string; a: string | null; g: [number, number, number | string | null, string][]; e: string };
let grimorios: Conjuro[] | null = null;
function useConjuros() {
  const [datos, setDatos] = useState(grimorios);
  useEffect(() => {
    if (!grimorios) void import('../data/grimorios.json').then((m) => { grimorios = (m.default as unknown as { conjuros: Conjuro[] }).conjuros; setDatos(grimorios); });
  }, []);
  return datos;
}
const GRADOS = ['Base', 'Intermedio', 'Avanzado', 'Arcano'];
const mantDe = (m: number | string | null) => (typeof m === 'number' && m > 0 ? m : 0);

/** Conjuros que tiene el personaje: los de sus vías hasta el nivel aprendido y los seleccionados en Místicos. */
function conjurosDe(todos: Conjuro[]) {
  const out = new Map<string, Conjuro & { sel?: boolean }>();
  for (const r of rango(15, 25)) {
    const vias = [txt(`Místicos!C${r}`), txt(`Místicos!E${r}`)].filter(Boolean);
    const nivel = n(`Místicos!H${r}`);
    for (const c of todos) if (vias.includes(c.v) && c.l <= nivel) out.set(c.n, c);
  }
  for (const r of rango(12, 50)) {
    const nombre = txt(`Místicos!Y${r}`);
    const c = nombre && todos.find((x) => x.n === nombre);
    if (c) out.set(c.n, { ...c, sel: true });
  }
  return [...out.values()].sort((a, b) => a.v.localeCompare(b.v) || a.l - b.l);
}

function Magia({ ctx }: { ctx: Ctx }) {
  const { s, cur, guardar, avisar } = ctx;
  const todos = useConjuros();
  const [filtro, setFiltro] = useState(s.favC.length ? '★' : 'Todos');
  const [q, setQ] = useState('');
  const INT = n('Principal!G15');
  const ACT = n('Místicos!L12');
  const conjuros = todos ? conjurosDe(todos) : [];
  const vias = [...new Set(conjuros.map((c) => c.v))];
  const busca = q.trim().toLowerCase();
  const lista = conjuros.filter((c) => (busca ? c.n.toLowerCase().includes(busca)
    : filtro === 'Todos' || (filtro === '★' ? s.favC.includes(c.n) : filtro === 'Seleccionados' ? c.sel : c.v === filtro)));
  const libres = rango(12, 50).map((r) => [txt(`Místicos!AG${r}`), txt(`Místicos!AK${r}`)]).filter(([c]) => c);
  const mantTotal = s.mant.reduce((t, m) => t + m.m, 0);

  const lanzar = (c: Conjuro, i: number) => {
    const [req, zeon, m] = c.g[i];
    const x = guardar((x) => {
      x.r.zeon = cur.zeon - zeon;
      if (mantDe(m)) x.mant.push({ n: `${c.n} (${GRADOS[i]})`, m: mantDe(m) });
    });
    const problemas = [req > INT && `requiere INT ${req} (tienes ${INT})`, x.r.zeon! < 0 && 'zeón insuficiente'].filter(Boolean);
    avisar(`${c.n} · ${GRADOS[i]}`, `−${zeon} zeón` + (ACT > 0 ? ` (${Math.ceil(zeon / ACT)} asaltos de ACT)` : '')
      + (mantDe(m) ? ` · mantenido ${mantDe(m)}/asalto` : '') + (problemas.length ? ` · ⚠ ${problemas.join(', ')}` : ''), s);
  };
  const favC = (nombre: string) => guardar((x) => { x.favC = x.favC.includes(nombre) ? x.favC.filter((h) => h !== nombre) : [...x.favC, nombre]; });

  return (
    <>
      <Panel t="Magia" color="var(--magia)" pill={`Nivel ${txt('Místicos!E12') || 0}/${txt('Místicos!C12') || 0} · ACT ${ACT}`}>
        <RecursoFila ctx={ctx} k="zeon" />
        <div class="salidas">
          <Stat v={String(ACT)} l="ACT" />
          <Stat v={txt('Místicos!J12')} l="Reg. zeónica" />
          <Stat v={txt('Místicos!P12')} l="Proyección" />
          <Stat v={String(INT)} l="INT" />
        </div>
        {cur.zeon < 0 && <p class="aviso" role="status">Zeón por debajo de 0 ({cur.zeon}).</p>}
      </Panel>

      <Panel t="Mantenidos" pill={s.mant.length ? `${mantTotal} zeón/asalto` : undefined}>
        {s.mant.length ? (
          <>
            {s.mant.map((m, i) => (
              <div class="juego-mant" key={i}>
                <span>{m.n}</span>
                <button type="button" class="btn" aria-label={`Pagar ${m.m} de zeón por ${m.n}`} onClick={() => ctx.gastar('zeon', m.m, `Mantener ${m.n}`)}>−{m.m}</button>
                <button type="button" class="icon-btn plain" aria-label={`Dejar de mantener ${m.n}`} onClick={() => guardar((x) => { x.mant.splice(i, 1); })}>✕</button>
              </div>
            ))}
            <button type="button" class="btn" onClick={() => ctx.gastar('zeon', mantTotal, 'Mantener todos')}>Pagar todos (−{mantTotal})</button>
          </>
        ) : <div class="juego-vacio">Ningún conjuro mantenido.</div>}
      </Panel>

      <Panel t="Conjuros" pill="toca un grado para lanzarlo">
        <input type="search" aria-label="Buscar conjuro" placeholder="Buscar conjuro…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <div class="juego-filtros" role="group" aria-label="Filtrar conjuros">
          {['Todos', '★', 'Seleccionados', ...vias].map((g) => (
            <button type="button" class="chip" key={g} aria-pressed={g === filtro} onClick={() => setFiltro(g)}>{g === '★' ? '★ Favoritos' : g}</button>
          ))}
        </div>
        {!todos && <p class="muted">Cargando conjuros…</p>}
        {lista.map((c) => (
          <article class="juego-conjuro" key={c.n}>
            <div class="row">
              <button type="button" class="juego-estrella" aria-pressed={s.favC.includes(c.n)} aria-label={`Favorito ${c.n}`} onClick={() => favC(c.n)}>★</button>
              <div class="grow">
                <h3>{c.n}</h3>
                <span class="juego-via">{c.v} {c.l}</span> <span class="muted small">· {[c.t?.trim(), c.a].filter(Boolean).join(' · ')}{c.sel ? ' · seleccionado' : ''}</span>
              </div>
            </div>
            <p class="muted small">{c.g[0][3]}</p>
            <div class="juego-grados">
              {c.g.map(([req, zeon, m], i) => (
                <button type="button" key={i} class={'juego-grado' + (req > INT ? ' req' : '')}
                  aria-label={`Lanzar ${c.n}, grado ${GRADOS[i]}: ${zeon} zeón${mantDe(m) ? `, mantenimiento ${mantDe(m)}` : ''}, INT ${req}${req > INT ? ' (no llegas)' : ''}`}
                  title={`${GRADOS[i]}: INT ${req}, ${zeon} zeón${mantDe(m) ? `, mant. ${mantDe(m)}` : ''}`}
                  onClick={() => lanzar(c, i)}>
                  <b>{zeon}</b><span>{GRADOS[i].slice(0, 6)}{mantDe(m) ? ` · m${mantDe(m)}` : ''}</span>
                </button>
              ))}
            </div>
          </article>
        ))}
        {todos && !lista.length && <div class="juego-vacio">{conjuros.length ? 'Nada coincide.' : 'Sin conjuros: elige vías o conjuros en la sección Magia.'}</div>}
        <p class="muted small">Borde rojo discontinuo: tu INT ({INT}) no llega al requisito del grado. Avisa, no bloquea.</p>
      </Panel>

      <Panel t="Libre acceso" pill={`${libres.length} conjuros`} open={false}>
        {libres.length ? <p class="small">{libres.map(([c, l]) => (l ? `${c} ${l}` : c)).join(' · ')}</p> : <div class="juego-vacio">Sin conjuros de libre acceso.</div>}
        <p class="nota">Coste pendiente: el zeón de los conjuros de libre acceso no está en los grimorios.</p>
      </Panel>
    </>
  );
}

// Técnicas de Ki: bloques de "Creación de Técnicas" (como la sección Técnicas de Ki)
const BASES = [12, 46, 80, 114, 148, 183, 217, 251, 285, 319];
const t = (col: string, fila: number) => `Creación de Técnicas!${col}${fila}`;

function Ki({ ctx }: { ctx: Ctx }) {
  const tecnicas = BASES.map((b) => ({ b, nombre: txt(t('D', b)) })).filter((x) => x.nombre && x.nombre !== 'Nombre de la técnica');
  return (
    <>
      <Panel t="Ki" color="var(--ki)" pill={`${txt('Ki!I10') === 'Sí' ? 'unificado · ' : ''}acumula ${txt('Ki!D24') || 0}/asalto`}>
        <RecursoFila ctx={ctx} k="ki" />
        {ctx.cur.ki < 0 && <p class="aviso" role="status">Ki por debajo de 0 ({ctx.cur.ki}).</p>}
        <p class="nota">Pendiente de los libros: la acumulación de ki por asalto no se lleva aquí.</p>
      </Panel>
      <Panel t="Técnicas">
        {tecnicas.length ? tecnicas.map(({ b, nombre }) => {
          const coste = txt(t('X', b));
          const total = (coste.match(/\d+/g) ?? []).reduce((s, x) => s + Number(x), 0);
          const efectos = [0, 1, 2, 3, 4].map((i) => txt(t(['D', 'J', 'P', 'V', 'AB'][i], b + 13))).filter(Boolean);
          const mant = rango(b + 4, b + 8).map((r) => txt(t('P', r))).filter((x) => /[1-9]/.test(x)); // "0 / 0" = sin mantenimiento
          const desc = txt(t('D', b + 25));
          return (
            <article class="juego-tecnica" key={b}>
              <div class="row between"><h3>{nombre}</h3><span class="chip">Nivel {txt(t('P', b))}</span></div>
              {efectos.length > 0 && <p class="small">{efectos.join(' · ')}</p>}
              {desc && <p class="muted small">{desc}</p>}
              <p class="muted small">Coste {coste || '—'} = <strong class="juego-txt">{total} ki</strong>{mant.length ? ` · mantener ${mant.join(', ')}` : ''}</p>
              <button type="button" class="btn" onClick={() => ctx.gastar('ki', total, nombre)}>Usar (−{total} ki)</button>
            </article>
          );
        }) : <div class="juego-vacio">Sin técnicas de ki.</div>}
      </Panel>
    </>
  );
}

const p = (col: string, fila: number) => `Psíquicos!${col}${fila}`;

function Psi({ ctx }: { ctx: Ctx }) {
  const poderes = rango(11, 63, 2).map((r) => ({ r, n: txt(p('V', r)) })).filter((x) => x.n);
  return (
    <Panel t="Psíquica" color="var(--psi)" pill={`potencial ${txt(p('H', 11)) || 0}`}>
      <RecursoFila ctx={ctx} k="cv" />
      {ctx.cur.cv < 0 && <p class="aviso" role="status">CVs por debajo de 0 ({ctx.cur.cv}).</p>}
      <div class="salidas">
        <Stat v={txt(p('H', 11))} l="Potencial" />
        <Stat v={txt(p('P', 12))} l="Proyección" />
        <Stat v={txt(p('O', 12))} l="Turno" />
      </div>
      {poderes.length ? poderes.map(({ r, n: nombre }) => (
        <article class="juego-tecnica juego-poder-psi" key={r}>
          <div class="row between"><h3>{nombre}</h3><span class="chip">Nivel {txt(p('Z', r + 1)) || '—'}</span></div>
          <p class="muted small">{txt(p('V', r + 1))}{txt(p('AA', r)) ? ` · ${txt(p('AA', r))} CVs potenciados` : ''}{txt(p('AB', r)) ? ` · bono ${txt(p('AB', r))}` : ''}</p>
        </article>
      )) : <div class="juego-vacio">Sin poderes psíquicos.</div>}
    </Panel>
  );
}
