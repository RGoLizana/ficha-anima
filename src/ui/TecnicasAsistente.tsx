// Asistente de técnicas de ki: la hoja «Creación de Técnicas» en pasos, con el coste de cada opción a la vista antes de elegirla,
// contadores en vivo y avisos que dicen cómo arreglarlos (nunca bloquean). Lee y escribe las mismas celdas que el modo experto.
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import { editarVarias } from '../store';
import type { Ficha } from '../model/ficha';
import { v as valor } from './campos';
import {
  BASES, CAR, CM_MAX, CM_MIN, DESVENTAJAS, DURACIONES, EFECTOS, HOJA, MAX_DESV, MAX_EFECTOS, NOM_CAR, acumulacion, ajusteKi, calcular, carAjuste,
  celdas, copia, desventaja, efecto, elementosLegado, leer, normalizar, nuevoEfecto, repartir, vacia, type Calculo, type Car, type Contexto,
  type ModoReparto, type Tecnica,
} from '../tecnicas/calculo';
import { PLANTILLAS_TECNICA, construirPlantilla } from '../tecnicas/plantillas';
import '../tecnicas.css';

const PASOS = ['Empezar', 'Nivel', 'Efecto principal', 'Más efectos', 'Duración', 'Desventajas', 'Reparto de Ki', 'Resumen'];
const ELEMENTOS = ['Aire', 'Agua', 'Fuego', 'Tierra', 'Luz', 'Oscuridad'];
const NOMBRE_NIVEL: Record<number, string> = { 1: 'Básica', 2: 'Mayor', 3: 'Arcana' };
const DURACION_TXT: Record<string, { n: string; d: string }> = {
  '-': { n: 'Instantáneo', d: 'Dura solo esta acción. Es lo normal.' },
  Mantenido: { n: 'Mantenido', d: 'Sigue activo los asaltos siguientes pagando ki cada asalto.' },
  'Sostenimiento Menor': { n: 'Sost. menor', d: 'Sigue activo sin pagar cada asalto. No en técnicas de nivel 1.' },
  'Sostenimiento Mayor': { n: 'Sost. mayor', d: 'Como el menor, más potente. No en técnicas de nivel 1.' },
};
/** Reparto de ki por defecto de lo que no se ha escrito a mano: se elige una vez y vale para todas las técnicas. */
export const modoReparto = signal<ModoReparto>('barato');

const sig = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);
const asaltosTxt = (n: number) => (n <= 0 ? 'sin acumular' : n === 1 ? '1 asalto' : `${n} asaltos`);
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const celda = (c: string, fila: number) => `${HOJA}!${c}${fila}`;
const txtv = (clave: string) => String(valor(clave) ?? '').trim();
const bandera = (b: number, n: number) => valor(celda('AM', b + 21 + n - 33)) === true;   // AM33…AM43 del bloque

interface Aviso { t: string; fix: string; suave?: boolean; go?: number; act?: 'repartir' }

function contexto(): Contexto {
  return { acum: acumulacion(txtv(celda('R', 5))), legado: elementosLegado(txtv('Principal!AF30')) };
}
const usada = (t: Tecnica) => Boolean(t.efectos.length || t.nombre || t.desv.length || t.sinSoporte.length);

/** Los avisos del Excel (AM33…AM43) con su arreglo, más los de la web (Core, tabla 54). */
function avisos(t: Tecnica, r: Calculo, b: number): Aviso[] {
  const a: Aviso[] = [], L = t.nivel;
  if (!t.efectos.length) return [{ suave: true, t: 'La técnica aún no tiene efecto principal.', fix: 'Elige uno en el paso «Efecto principal».', go: 2 }];
  if (bandera(b, 33)) a.push({ t: `Te pasas ${r.cmSuma - CM_MAX[L]} CM del máximo de nivel ${L} (${CM_MAX[L]}).`, fix: L < 3 ? `Baja un grado algún efecto, añade una desventaja o sube a nivel ${L + 1} (máx. ${CM_MAX[L + 1]}).` : 'Baja un grado algún efecto o añade una desventaja.', go: 2 });
  else if (r.cmSuma < CM_MIN[L]) a.push({ suave: true, t: `Efectos${r.cmDesv ? ' y desventajas' : ''} suman ${r.cmSuma} CM, pero una técnica de nivel ${L} cuesta como mínimo ${CM_MIN[L]}. Pagarás ${CM_MIN[L]} igualmente.`, fix: `Tienes ${CM_MIN[L] - r.cmSuma} CM «gratis»: puedes subir un grado o añadir un efecto que cueste eso sin pagar más CM.`, go: 3 });
  if (bandera(b, 34)) {
    r.efectos.filter((x) => x.nivel > L).forEach((x) => a.push({ t: `«${x.e.n}» es de nivel ${x.nivel} y la técnica es de nivel ${L}.`, fix: `Baja el grado o sube la técnica a nivel ${x.nivel}.`, go: x.i === 0 ? 2 : 3 }));
    r.desv.filter((x) => x.nivel > L).forEach((x) => a.push({ t: `La desventaja «${x.x.n}» elegida es de nivel ${x.nivel}.`, fix: 'Elige otra opción o sube el nivel.', go: 5 }));
  }
  if (bandera(b, 35)) a.push({ t: 'No puede haber efectos mantenidos y sostenidos en la misma técnica.', fix: 'Deja solo un tipo de duración.', go: 4 });
  if (bandera(b, 36)) a.push({ t: 'Los efectos de nivel 3 y las técnicas de nivel 1 no pueden ser sostenidos.', fix: 'Usa «Mantenido» o «Instantáneo».', go: 4 });
  if (bandera(b, 37)) a.push({ t: 'Algún efecto no es afín al elemento de la Atadura Elemental.', fix: 'Cambia el elemento de la atadura o el efecto.', go: 5 });
  if (bandera(b, 38)) a.push({ t: 'Para reducir el coste de ki la técnica debe depender de 3 o más características.', fix: 'Reparte el ki entre más características o quita la reducción.', go: 6 });
  if (bandera(b, 39)) a.push({ t: 'Una característica baja más de la mitad de su ki con los ajustes.', fix: 'Pon el ajuste en una característica con más ki.', go: 6 });
  if (bandera(b, 40)) a.push({ t: 'Hay más de un efecto primario.', fix: 'Solo el primer efecto es primario; cámbialo en el modo experto.', go: undefined });
  if (bandera(b, 41)) a.push({ t: 'El ajuste de ki de las desventajas no está bien repartido.', fix: 'Pulsa «Repartir por mí».', act: 'repartir' });
  const falta = r.kiNec - r.kiPuesto, faltaM = r.mantNec - r.mantPuesto;
  if (bandera(b, 42) || falta || faltaM) a.push({ t: falta ? (falta > 0 ? `Te quedan ${falta} puntos de ki por repartir.` : `Has puesto ${-falta} puntos de ki de más.`) : 'El ki de mantener no cuadra.', fix: 'Pulsa «Repartir por mí» y la web lo cuadra.', go: 6, act: 'repartir' });
  if (bandera(b, 43)) a.push({ t: 'Las desventajas rebajan más de la mitad del coste en CM.', fix: 'Elige una opción de desventaja más pequeña.', go: 5 });
  if (t.desv.length > L) a.push({ t: `Tienes ${t.desv.length} desventajas y el nivel ${L} admite ${L}.`, fix: 'Quita una o sube el nivel de la técnica (Core, tabla 54).', go: 5 });
  if (L > 1) a.push({ suave: true, t: `Para aprender una técnica de nivel ${L} necesitas conocer antes dos de nivel ${L - 1}.`, fix: 'Es un recordatorio del Core: no impide seguir.' });
  return a;
}

export function TecnicasAsistente({ f }: { f: Ficha }) {
  const [slot, setSlot] = useState<number | null>(null);
  const [paso, setPaso] = useState(7);
  if (slot === null) return <Lista f={f} abrir={(i, p) => { setPaso(p); setSlot(i); }} />;
  return <Editor f={f} slot={slot} paso={paso} setPaso={setPaso} volver={() => setSlot(null)} />;
}

// ---------- lista de las diez técnicas ----------
function Lista({ f, abrir }: { f: Ficha; abrir: (i: number, paso: number) => void }) {
  const ctx = contexto();
  const tecnicas = BASES.map((b) => leer((c) => f.entradas[c], b));
  const libre = () => tecnicas.findIndex((t) => !usada(t));
  const duplicar = (i: number) => {
    const j = libre();
    if (j < 0) return;
    const t = copia(tecnicas[i]); t.nombre = `${t.nombre || 'Técnica'} (copia)`;
    editarVarias(f.id, celdas(t, BASES[j]));
  };
  return (
    <div class="tk">
      <p class="tk-explica">Diez huecos, como en la hoja «Creación de Técnicas». Abre una para editarla paso a paso; el coste en Ki y CM se calcula solo.</p>
      <div class="tk-lista">
        {tecnicas.map((t, i) => {
          if (!usada(t)) {
            return (
              <div class="tk-panel tk-tec tk-vacia" key={i}>
                <div class="tk-tec-cab"><span class="tk-n">{i + 1}</span><span class="muted grow">Hueco libre</span></div>
                <button type="button" class="btn" onClick={() => abrir(i, 0)}>Crear aquí</button>
              </div>
            );
          }
          const r = t.sinSoporte.length ? null : calcular(t, ctx);
          const nAvisos = txtv(celda('D', BASES[i] + 31)) ? 1 : 0;
          return (
            <div class="tk-panel tk-tec" key={i}>
              <div class="tk-tec-cab">
                <span class="tk-n">{i + 1}</span><strong class="tk-nombre grow">{t.nombre || `Técnica ${i + 1}`}</strong>
                {nAvisos > 0 && <span class="tk-chip tk-mal">Aviso</span>}
              </div>
              <p class="small">{r ? `Nivel ${t.nivel} · CM ${r.cm} · Ki ${r.kiNec} · ${asaltosTxt(r.asaltos)} acumulando` : 'Tiene efectos personalizados: edítala en el modo experto.'}</p>
              <div class="tk-linea">
                {r && <span class="tk-chip tk-ki">{CAR.filter((c) => r.porCar[c]).map((c) => `${c} ${r.porCar[c]}`).join(', ') || '—'}</span>}
                {t.efectos.map((e) => <span class="tk-chip" key={e.n}>{e.n}</span>)}
              </div>
              <div class="row wrap">
                <button type="button" class="btn primary" disabled={t.sinSoporte.length > 0} onClick={() => abrir(i, 7)}>Editar</button>
                <button type="button" class="btn" disabled={libre() < 0 || t.sinSoporte.length > 0} onClick={() => duplicar(i)}>Duplicar</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- editor ----------
function Editor({ f, slot, paso, setPaso, volver }: { f: Ficha; slot: number; paso: number; setPaso: (p: number) => void; volver: () => void }) {
  const [catalogo, setCatalogo] = useState<false | 'prin' | 'sec'>(false);
  const [cat, setCat] = useState('Todos');
  const [panel, setPanel] = useState(false);
  const b = BASES[slot], ctx = contexto();
  const t = leer((c) => f.entradas[c], b);
  const modo = modoReparto.value;

  /** Aplica un cambio a la técnica: se recalcula el ki automático y se escriben solo las celdas que cambian. */
  const aplicar = (cambio: (t: Tecnica) => void, defecto: ModoReparto = modoReparto.value) => {   // se lee al llamar: el selector cambia el valor justo antes
    const nuevo = copia(t);
    cambio(nuevo);
    normalizar(t, nuevo, ctx, defecto);
    editarVarias(f.id, celdas(nuevo, b));
  };
  /** Vista previa: cómo quedaría la técnica con ese cambio. */
  const prueba = (cambio: (t: Tecnica) => void) => { const c = copia(t); cambio(c); normalizar(t, c, ctx, modo); return calcular(c, ctx); };
  const ir = (p: number) => { setPaso(Math.max(0, Math.min(PASOS.length - 1, p))); setCatalogo(false); };

  if (t.sinSoporte.length) {
    return (
      <div class="tk">
        <button type="button" class="btn tk-plain" onClick={volver}>← Técnicas</button>
        <p class="aviso" role="status">Esta técnica usa efectos o desventajas personalizados ({t.sinSoporte.join(', ')}): edítala en el modo experto.</p>
      </div>
    );
  }
  const r = calcular(t, ctx);
  const av = avisos(t, r, b);
  const duros = av.filter((a) => !a.suave);
  const repartirTodo = () => aplicar((c) => c.efectos.forEach((e) => { e.ki = {}; e.kiM = {}; }));
  const accion = (a: Aviso) => (a.act === 'repartir' ? repartirTodo() : a.go !== undefined && ir(a.go));

  const contadores = <Contadores t={t} r={r} av={av} paso={paso} accion={accion} ctx={ctx} />;
  return (
    <div class="tk">
      <div class="tk-barra-movil" aria-label="Resumen de contadores">
        <div class={'tk-bm' + (r.cmSuma > CM_MAX[t.nivel] ? ' tk-mal' : '')}><b>{r.cm}</b><span>CM {CM_MIN[t.nivel]}–{CM_MAX[t.nivel]}</span></div>
        <div class={'tk-bm' + (r.kiNec !== r.kiPuesto ? ' tk-mal' : '')}><b>{r.kiNec}</b><span>Ki{r.kiNec !== r.kiPuesto ? ` · faltan ${r.kiNec - r.kiPuesto}` : ''}</span></div>
        <div class="tk-bm"><b>{r.asaltos || '—'}</b><span>asaltos</span></div>
        <button type="button" class={'tk-bm' + (duros.length ? ' tk-mal' : '')} aria-expanded={panel} onClick={() => setPanel(!panel)}><b>{duros.length}</b><span>{panel ? 'ocultar' : 'avisos'}</span></button>
      </div>
      <div class="tk-editor">
        <div class="stack">
          <div class="row wrap">
            <button type="button" class="btn tk-plain" onClick={volver}>← Técnicas</button>
            <span class="grow" /><span class="tk-chip">Técnica {slot + 1}{t.nombre ? ` · ${t.nombre}` : ''}</span>
          </div>
          <nav aria-label="Pasos del asistente">
            <ol class="tk-pasos">
              {PASOS.map((p, i) => (
                <li key={p}><button type="button" class={i < paso ? 'tk-hecho' : ''} aria-current={i === paso ? 'step' : undefined} onClick={() => ir(i)}><span class="tk-num">{i + 1}</span>{p}</button></li>
              ))}
            </ol>
          </nav>
          <div class="tk-progreso" role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={PASOS.length} aria-valuenow={paso + 1}><div style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} /></div>
          <h3 class="tk-paso-tit" tabIndex={-1}>Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}</h3>
          <div class="stack">
            {paso === 0 && <PasoEmpezar t={t} aplicar={aplicar} ir={ir} />}
            {paso === 1 && <PasoNivel t={t} r={r} aplicar={aplicar} />}
            {paso === 2 && <PasoEfectos t={t} r={r} principal aplicar={aplicar} prueba={prueba} catalogo={catalogo === 'prin' || !t.efectos.length} setCatalogo={setCatalogo} cat={cat} setCat={setCat} ctx={ctx} />}
            {paso === 3 && <PasoEfectos t={t} r={r} aplicar={aplicar} prueba={prueba} catalogo={catalogo === 'sec'} setCatalogo={setCatalogo} cat={cat} setCat={setCat} ctx={ctx} />}
            {paso === 4 && <PasoDuracion t={t} r={r} aplicar={aplicar} prueba={prueba} />}
            {paso === 5 && <PasoDesv t={t} r={r} aplicar={aplicar} prueba={prueba} />}
            {paso === 6 && <PasoKi t={t} r={r} aplicar={aplicar} repartirTodo={repartirTodo} ctx={ctx} />}
            {paso === 7 && <PasoResumen t={t} r={r} av={av} aplicar={aplicar} prueba={prueba} accion={accion} ctx={ctx} vaciar={() => { if (confirm('¿Vaciar esta técnica?')) { aplicar((c) => Object.assign(c, vacia())); ir(0); } }} />}
          </div>
          <div class="tk-nav">
            <button type="button" class="btn" disabled={paso === 0} onClick={() => ir(paso - 1)}>← Anterior</button>
            {paso < PASOS.length - 1 && <>
              <button type="button" class="btn tk-plain" onClick={() => ir(PASOS.length - 1)}>Saltar al resumen</button>
              <button type="button" class="btn primary" onClick={() => ir(paso + 1)}>Siguiente: {PASOS[paso + 1]} →</button>
            </>}
          </div>
        </div>
        <aside class={panel ? '' : 'tk-cerrado'} aria-label="Contadores en vivo">{contadores}</aside>
      </div>
    </div>
  );
}

type Aplicar = (c: (t: Tecnica) => void, defecto?: ModoReparto) => void;
type Prueba = (c: (t: Tecnica) => void) => Calculo;

function Consejo({ titulo, children }: { titulo: string; children: ComponentChildren }) {
  return <div class="tk-consejo"><b>{titulo}</b><span>{children}</span></div>;
}

function AvisoHtml({ a, accion, paso }: { a: Aviso; accion: (a: Aviso) => void; paso: number }) {
  return (
    <div class={'tk-aviso' + (a.suave ? ' tk-suave' : '')} role="status">
      <b>{a.t}</b><span>{a.fix}</span>
      {a.act ? <button type="button" class="btn" onClick={() => accion(a)}>Repartir por mí</button>
        : a.go !== undefined && a.go !== paso ? <button type="button" class="btn" onClick={() => accion(a)}>Ir a «{PASOS[a.go]}»</button> : null}
    </div>
  );
}

// ---------- pasos ----------
function PasoEmpezar({ t, aplicar, ir }: { t: Tecnica; aplicar: Aplicar; ir: (p: number) => void }) {
  return (
    <>
      <label class="field" for="tk-nombre">Nombre de la técnica
        <input id="tk-nombre" defaultValue={t.nombre} key={t.nombre} placeholder="Por ejemplo: Baile espectral" autoComplete="off" onChange={(e) => aplicar((c) => { c.nombre = e.currentTarget.value.trim(); })} />
      </label>
      <Consejo titulo="Consejo">Si es tu primera técnica, empieza con una plantilla del libro y cámbiala a tu gusto. Todas las cuentas se hacen solas.</Consejo>
      <h4 class="tk-sub">Plantillas del libro</h4>
      <div class="tk-elige">
        {PLANTILLAS_TECNICA.map((p) => {
          const ctx = contexto(), pl = construirPlantilla(p);
          const r = calcular(normalizar(null, pl, ctx, modoReparto.value), ctx);
          return (
            <button type="button" class="tk-op" key={p.titulo} onClick={() => { aplicar((c) => { const n = c.nombre; Object.assign(c, construirPlantilla(p)); if (n) c.nombre = n; }); ir(1); }}>
              <span class="tk-op-nom">{p.titulo} · {p.nombre}</span><span class="tk-op-nota">{p.sub}</span>
              <span class="small">{p.efectos.map(([n, g]) => (g ? `${n} ${g}` : n)).join(' + ')}</span>
              <span class="tk-op-coste"><span class="tk-cm">Nivel 1 · CM {r.cm} · Ki {r.kiNec} · {asaltosTxt(r.asaltos)}</span></span>
            </button>
          );
        })}
        <button type="button" class="tk-op" onClick={() => { aplicar((c) => { const n = c.nombre; Object.assign(c, vacia()); c.nombre = n; }); ir(1); }}>
          <span class="tk-op-nom">Empezar desde cero</span><span class="tk-op-nota">Técnica vacía de nivel 1.</span>
        </button>
      </div>
    </>
  );
}

function PasoNivel({ t, r, aplicar }: { t: Tecnica; r: Calculo; aplicar: Aplicar }) {
  const L = t.nivel;
  return (
    <>
      <div class="tk-elige">
        {[1, 2, 3].map((n) => (
          <button type="button" class="tk-op" key={n} aria-pressed={L === n} onClick={() => aplicar((c) => { c.nivel = n; })}>
            <span class="tk-op-nom">Nivel {n} · {NOMBRE_NIVEL[n]}</span>
            <span class="tk-op-coste"><span class="tk-cm">{CM_MIN[n]}–{CM_MAX[n]} CM</span><span>{n} desventaja{n > 1 ? 's' : ''} como máximo</span></span>
            <span class="tk-op-nota">{n === 1 ? 'Lo normal al empezar.' : `Necesitas conocer dos técnicas de nivel ${n - 1}.`}</span>
          </button>
        ))}
      </div>
      <Consejo titulo="Para un nivel 1">Lo normal es un efecto principal de 10–25 CM y, si sobra, uno secundario pequeño. Con {r.cm} CM ahora mismo, {r.cmSuma < CM_MIN[L] ? `te quedan ${CM_MIN[L] - r.cmSuma} CM hasta el mínimo` : r.cmSuma > CM_MAX[L] ? 'te has pasado del máximo' : 'estás dentro de los límites'}.</Consejo>
    </>
  );
}

function Catalogo({ principal, t, aplicar, prueba, cat, setCat, cerrar }: { principal: boolean; t: Tecnica; aplicar: Aplicar; prueba: Prueba; cat: string; setCat: (c: string) => void; cerrar: () => void }) {
  const cats = ['Todos', ...new Set(EFECTOS.map((d) => d.c))];
  return (
    <>
      <div class="tk-filtros" role="group" aria-label="Tipo de efecto">
        {cats.map((c) => <button type="button" key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{mayus(c)}</button>)}
      </div>
      <div class="tk-elige">
        {EFECTOS.filter((d) => cat === 'Todos' || d.c === cat).map((d) => {
          const p = prueba((c) => { if (principal) c.efectos[0] = nuevoEfecto(d.n, 'Primario'); else c.efectos.push(nuevoEfecto(d.n)); });
          const g = d.g[0] ?? d.b!, nocabe = p.cmSuma > CM_MAX[t.nivel];
          return (
            <button type="button" class={'tk-op' + (nocabe ? ' tk-nocabe' : '')} key={d.n}
              onClick={() => { aplicar((c) => { if (principal) c.efectos[0] = nuevoEfecto(d.n, 'Primario'); else c.efectos.push(nuevoEfecto(d.n)); }); cerrar(); }}>
              <span class="tk-op-nom">{d.n}</span>
              <span class="tk-op-coste"><span class="tk-cm">{sig(g[3])} CM</span><span class="tk-kiv">{principal ? g[1] : g[2]} Ki {d.p}</span></span>
              <span class="tk-op-nota">{d.g.length ? `desde ${g[0] || 'el básico'} · ` : ''}total con él: {p.cm} CM{nocabe ? ` · no cabe en nivel ${t.nivel}` : ''}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function PasoEfectos({ t, r, principal, aplicar, prueba, catalogo, setCatalogo, cat, setCat }: {
  t: Tecnica; r: Calculo; principal?: boolean; aplicar: Aplicar; prueba: Prueba; catalogo: boolean; setCatalogo: (c: false | 'prin' | 'sec') => void;
  cat: string; setCat: (c: string) => void; ctx: Contexto;
}) {
  if (principal) {
    if (catalogo) return <><Consejo titulo="¿Qué quieres que haga?">El efecto principal define la técnica y cuesta menos ki que si fuera secundario. Cada tarjeta muestra lo que costaría el grado más bajo.</Consejo><Catalogo principal t={t} aplicar={aplicar} prueba={prueba} cat={cat} setCat={setCat} cerrar={() => setCatalogo(false)} /></>;
    return <TarjetaEfecto i={0} t={t} r={r} aplicar={aplicar} prueba={prueba} cambiar={() => setCatalogo('prin')} />;
  }
  const libres = CM_MAX[t.nivel] - r.cmSuma;
  return (
    <>
      <Consejo titulo="Opcional">
        {libres > 0 ? `Te caben ${libres} CM más antes del máximo del nivel ${t.nivel}.` : 'Ya estás en el máximo de CM de este nivel.'}{' '}
        {r.cmSuma < CM_MIN[t.nivel] ? `Además, hasta ${CM_MIN[t.nivel] - r.cmSuma} CM no te cuestan nada: ya pagas el mínimo.` : ''} Los secundarios cuestan más ki que el principal.
      </Consejo>
      {!t.efectos.length && <p class="tk-explica">Primero elige el efecto principal.</p>}
      {t.efectos.slice(1).map((_, k) => <TarjetaEfecto key={k + 1} i={k + 1} t={t} r={r} aplicar={aplicar} prueba={prueba} />)}
      {t.efectos.length >= MAX_EFECTOS ? <p class="muted small">Máximo de {MAX_EFECTOS} efectos por técnica (como en la ficha).</p>
        : catalogo ? <Catalogo principal={false} t={t} aplicar={aplicar} prueba={prueba} cat={cat} setCat={setCat} cerrar={() => setCatalogo(false)} />
          : t.efectos.length > 0 && <button type="button" class="btn" onClick={() => setCatalogo('sec')}>+ Añadir efecto secundario</button>}
    </>
  );
}

function TarjetaEfecto({ i, t, r, aplicar, prueba, cambiar }: { i: number; t: Tecnica; r: Calculo; aplicar: Aplicar; prueba: Prueba; cambiar?: () => void }) {
  const e = t.efectos[i], d = efecto(e.n)!, x = r.efectos[i];
  return (
    <div class="tk-efecto">
      <div class="row wrap">
        <span class="tk-tag">{i === 0 ? 'Principal' : 'Secundario'} · {d.t} · {d.k}</span><span class="grow" />
        {cambiar ? <button type="button" class="btn tk-plain" onClick={cambiar}>Cambiar efecto</button>
          : <button type="button" class="btn tk-plain tk-peligro" onClick={() => aplicar((c) => { c.efectos.splice(i, 1); })}>Quitar</button>}
      </div>
      <h4 class="tk-efecto-tit">{d.n}</h4>
      <p class="small muted">Característica principal: {NOM_CAR[d.p]}. Elementos: {d.e.join(', ')}.</p>
      {d.g.length > 0 && (
        <>
          <span class="small" id={`tk-g-${i}`}>Grado (el coste aparece antes de elegir):</span>
          <div class="tk-grados" role="group" aria-labelledby={`tk-g-${i}`}>
            {d.g.map((g, j) => {
              const p = prueba((c) => { c.efectos[i].g = j; }), dcm = p.cm - r.cm;
              const fuera = p.cmSuma > CM_MAX[t.nivel] || g[7] > t.nivel;
              return (
                <button type="button" key={g[0]} class={'tk-grado' + (fuera ? ' tk-nocabe' : '')} aria-pressed={e.g === j}
                  title={g[7] > t.nivel ? `Requiere nivel ${g[7]}` : fuera ? 'Se pasa del máximo de CM' : ''} onClick={() => aplicar((c) => { c.efectos[i].g = j; })}>
                  <b>{g[0]}</b><span>{g[3]} CM · {g[i === 0 ? 1 : 2]} Ki{g[7] > 1 ? ` · nv${g[7]}` : ''}</span>
                  {e.g !== j && dcm !== 0 && <span>{sig(dcm)} total</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      {d.x.length > 0 && (
        <div class="stack-sm">
          <span class="small">Opciones extra</span>
          {d.x.map((o, j) => (
            <label class="tk-check" key={o[0]}>
              <input type="checkbox" checked={e.x.includes(j)} onChange={() => aplicar((c) => { const ex = c.efectos[i].x; c.efectos[i].x = ex.includes(j) ? ex.filter((y) => y !== j) : [...ex, j]; })} />
              <span>{o[0]} <span class="muted small">{sig(o[3])} CM · {sig(o[i === 0 ? 1 : 2])} Ki</span></span>
            </label>
          ))}
        </div>
      )}
      <p class="small"><b class="tk-cm">{x.cm} CM</b> · <b class="tk-kiv">{x.ki} Ki</b> para este efecto{e.dur === 'Mantenido' ? ` · ${x.mant} Ki por asalto al mantenerlo` : ''}</p>
    </div>
  );
}

function PasoDuracion({ t, r, aplicar, prueba }: { t: Tecnica; r: Calculo; aplicar: Aplicar; prueba: Prueba }) {
  if (!t.efectos.length) return <p class="tk-explica">Primero elige un efecto.</p>;
  return (
    <>
      <p class="tk-explica">Casi todas las técnicas son instantáneas. Si quieres que un efecto siga activo varios asaltos, elige cómo.</p>
      {t.efectos.map((e, i) => (
        <div class="tk-efecto" key={i}>
          <h4 class="tk-efecto-tit">{e.n}</h4>
          <div class="tk-elige">
            {DURACIONES.map((d) => {
              const p = prueba((c) => { c.efectos[i].dur = d; });
              const mal = d.startsWith('Sost') && t.nivel === 1;
              const mant = r.efectos[i] ? p.efectos[i].mant : 0;
              return (
                <button type="button" key={d} class={'tk-op' + (mal ? ' tk-nocabe' : '')} aria-pressed={e.dur === d} onClick={() => aplicar((c) => { c.efectos[i].dur = d; })}>
                  <span class="tk-op-nom">{DURACION_TXT[d].n}</span>
                  <span class="tk-op-coste"><span class="tk-cm">{sig(p.cm - r.cm)} CM</span><span class="tk-kiv">{sig(p.kiNec - r.kiNec)} Ki</span></span>
                  <span class="tk-op-nota">{d === 'Mantenido' ? `${mant} Ki por asalto después` : mal ? 'No vale en nivel 1' : DURACION_TXT[d].d}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function PasoDesv({ t, r, aplicar, prueba }: { t: Tecnica; r: Calculo; aplicar: Aplicar; prueba: Prueba }) {
  const L = t.nivel;
  const comunes = ELEMENTOS.filter((el) => t.efectos.every((e) => efecto(e.n)!.e.includes(el)));
  return (
    <>
      <Consejo titulo={`${t.desv.length} de ${L}`}>
        Las desventajas abaratan el CM a cambio de una limitación. Tu nivel admite {L}.{' '}
        {r.cmSuma <= CM_MIN[L] ? `Ojo: ya pagas el mínimo (${CM_MIN[L]} CM), así que otra desventaja no te ahorra nada.` : `Puedes ahorrar hasta ${r.cmSuma - Math.max(CM_MIN[L], Math.ceil((r.cmSuma - r.cmDesv) / 2))} CM.`}
      </Consejo>
      {t.desv.map((x, k) => {
        const d = desventaja(x.n)!;
        return (
          <div class="tk-efecto" key={k}>
            <div class="row wrap"><h4 class="tk-efecto-tit grow">{d.n}{d.o[x.o][0] ? ` · ${d.o[x.o][0]}` : ''}</h4>
              <button type="button" class="btn tk-plain tk-peligro" onClick={() => aplicar((c) => { c.desv.splice(k, 1); })}>Quitar</button></div>
            <p class="small muted">Solo {d.k === 'Cualquiera' ? 'una limitación' : `técnicas de ${d.k.toLowerCase()}`}.</p>
            {d.o.length > 1 && (
              <div class="tk-grados">
                {d.o.map((o, j) => (
                  <button type="button" key={o[0]} class={'tk-grado' + (o[2] > L ? ' tk-nocabe' : '')} aria-pressed={x.o === j}
                    onClick={() => aplicar((c) => { c.desv[k].o = j; if (d.n === 'Atadura Elemental' && j === 0) c.desv[k].el[1] = ''; })}>
                    <b>{o[0]}</b><span>{o[1]} CM{o[2] > 1 ? ` · nv${o[2]}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            {d.n === 'Atadura Elemental' && (
              <div class="row wrap">
                {[0, 1].slice(0, x.o === 0 ? 1 : 2).map((m) => (
                  <label class="field" key={m} for={`tk-el-${k}-${m}`}>Elemento {m + 1}
                    <select id={`tk-el-${k}-${m}`} value={x.el[m]} onChange={(ev) => aplicar((c) => { c.desv[k].el[m] = ev.currentTarget.value; })}>
                      <option value="">Elige…</option>{ELEMENTOS.map((el) => <option key={el}>{el}</option>)}
                    </select>
                  </label>
                ))}
                <span class="small muted">Afines a tus efectos: {comunes.join(', ') || 'ninguno común'}</span>
              </div>
            )}
          </div>
        );
      })}
      <h4 class="tk-sub">Añadir desventaja</h4>
      <div class="tk-elige">
        {DESVENTAJAS.map((d) => {
          const p = prueba((c) => { if (c.desv.length < MAX_DESV) c.desv.push({ n: d.n, o: 0, el: ['', ''] }); });
          const ahorro = r.cm - p.cm, o = d.o[0], lleno = t.desv.length >= L;
          return (
            <button type="button" class={'tk-op' + (lleno ? ' tk-nocabe' : '')} key={d.n} disabled={t.desv.length >= MAX_DESV}
              onClick={() => aplicar((c) => { c.desv.push({ n: d.n, o: 0, el: ['', ''] }); })}>
              <span class="tk-op-nom">{d.n}</span>
              <span class="tk-op-nota">{d.k !== 'Cualquiera' ? `Solo técnicas de ${d.k.toLowerCase()}.` : 'Cualquier técnica.'}</span>
              <span class="tk-op-coste"><span class="tk-cm">{o[1]} CM{d.o.length > 1 ? ' o más' : ''}</span><span class={ahorro ? 'tk-kiv' : ''}>ahorro real: {ahorro} CM</span></span>
              {lleno && <span class="tk-op-nota">Ya tienes {t.desv.length}: el nivel {L} admite {L}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function PasoKi({ t, r, aplicar, repartirTodo, ctx }: { t: Tecnica; r: Calculo; aplicar: Aplicar; repartirTodo: () => void; ctx: Contexto }) {
  if (!t.efectos.length) return <p class="tk-explica">Primero elige un efecto.</p>;
  const extra = ajusteKi(t), donde = carAjuste(t);
  const ponerKi = (i: number, c: Car, n: number) => aplicar((x) => { x.efectos[i].ki = { ...x.efectos[i].ki, [c]: Math.max(0, n) }; x.efectos[i].ki = Object.fromEntries(Object.entries(x.efectos[i].ki).filter(([, q]) => q)); });
  /** Reparte el ki del efecto i con ese modo y deja los demás como están. */
  const conModo = (i: number, m: ModoReparto, c = copia(t)) => {
    const carga: Partial<Record<Car, number>> = {};
    c.efectos.forEach((e, j) => { if (j === i) e.ki = repartir(e, e.rol, carga, m, ctx); CAR.forEach((k) => { carga[k] = (carga[k] ?? 0) + (e.ki[k] ?? 0); }); });
    return calcular(c, ctx);
  };
  const modo = (i: number, m: ModoReparto) => aplicar((x) => { conModo(i, m, x); });
  return (
    <>
      <p class="tk-explica">Cada efecto se paga con ki de una característica. Puedes mover puntos a otras características permitidas pagando un pequeño recargo la primera vez. Sirve para acumular más rápido con tu acumulación.</p>
      <fieldset class="tk-modo">
        <legend>Reparto por defecto</legend>
        {(['barato', 'rapido'] as const).map((m) => (
          <button type="button" key={m} aria-pressed={modoReparto.value === m} class="btn" onClick={() => { modoReparto.value = m; repartirTodo(); }}>
            {m === 'barato' ? 'Lo más barato' : 'Lo más rápido'}
          </button>
        ))}
        <button type="button" class="btn tk-peligro" title="Borra el ki que hayas puesto a mano y lo reparte todo con el modo elegido" onClick={repartirTodo}>Restablecer reparto</button>
        <span class="small muted">Lo que pongas a mano se conserva al cambiar grados. «Restablecer reparto» lo borra y lo reparte todo con el modo elegido.</span>
      </fieldset>
      {r.efectos.map((x) => {
        const e = x.e, d = efecto(e.n)!, i = x.i, cars = [d.p, ...(Object.keys(d.o) as Car[])];
        const baratoR = conModo(i, 'barato'), rapidoR = conModo(i, 'rapido');
        const cuadra = x.puesto === x.ki;
        return (
          <div class="tk-efecto" key={i}>
            <div class="row wrap"><h4 class="tk-efecto-tit grow">{d.n}</h4>
              <span class={'tk-cuadra ' + (cuadra ? 'tk-ok' : 'tk-no')} aria-live="polite">{x.puesto} de {x.ki} Ki {cuadra ? '· cuadra' : x.puesto < x.ki ? `· faltan ${x.ki - x.puesto}` : `· sobran ${x.puesto - x.ki}`}</span></div>
            <div class="row wrap">
              <button type="button" class="btn" onClick={() => modo(i, 'barato')}>Lo más barato · técnica entera {baratoR.kiNec} Ki, {asaltosTxt(baratoR.asaltos)}</button>
              <button type="button" class="btn" onClick={() => modo(i, 'rapido')}>Lo más rápido · técnica entera {rapidoR.kiNec} Ki, {asaltosTxt(rapidoR.asaltos)}</button>
            </div>
            <div class="tk-reparto">
              {cars.map((c) => (
                <div class={'tk-car' + (c === d.p ? ' tk-prim' : '')} key={c}>
                  <div class="tk-car-cab"><label for={`tk-k-${i}-${c}`}>{c}</label><small>{c === d.p ? 'principal' : `+${d.o[c]} si la usas`}</small></div>
                  <div class="tk-stepper">
                    <button type="button" aria-label={`Quitar 1 de ${NOM_CAR[c]}`} onClick={() => ponerKi(i, c, (e.ki[c] ?? 0) - 1)}>−</button>
                    <input type="number" inputMode="numeric" min={0} id={`tk-k-${i}-${c}`} value={e.ki[c] ?? 0} onChange={(ev) => ponerKi(i, c, Number(ev.currentTarget.value) || 0)} />
                    <button type="button" aria-label={`Añadir 1 a ${NOM_CAR[c]}`} onClick={() => ponerKi(i, c, (e.ki[c] ?? 0) + 1)}>+</button>
                  </div>
                  <span class="small muted">acumulas {ctx.acum[c]}/asalto</span>
                </div>
              ))}
            </div>
            {x.mant > 0 && <p class="small muted">Mantenerlo cuesta {x.mant} Ki por asalto (se paga con {Object.entries(e.kiM).map(([c, n]) => `${c} ${n}`).join(', ') || d.p}).</p>}
          </div>
        );
      })}
      {extra !== 0 && (
        <div class="tk-aviso tk-suave">
          <b>Ajuste de {sig(extra)} Ki</b>
          <span>Viene de la reducción de CM/Ki o de ser combinable. Por defecto cae en la característica principal y, si ahí no cabe (el Excel no deja bajar una característica de la mitad de su ki), pasa a las que más tienen. Puedes elegir otra:</span>
          <select aria-label="Característica del ajuste" value={donde} onChange={(ev) => { const c = ev.currentTarget.value; aplicar((x) => { x.mods = c === 'auto' ? {} : { [c as Car]: ajusteKi(x) }; }); }}>
            <option value="auto">Automático</option>
            {CAR.map((c) => <option key={c} value={c}>{NOM_CAR[c]}</option>)}
          </select>
        </div>
      )}
      <details class="tk-panel">
        <summary>Ajustes avanzados (cambiar Ki por CM, combinable)</summary>
        <div class="stack tk-avanzado">
          <label class="field" for="tk-redki">Reducir Ki (cada punto cuesta +10 CM; exige 3+ características)
            <select id="tk-redki" value={t.redKi} onChange={(ev) => aplicar((c) => { c.redKi = Number(ev.currentTarget.value); })}>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n ? `−${n} Ki · +${10 * n} CM` : 'Sin reducción'}</option>)}
            </select>
          </label>
          <label class="field" for="tk-redcm">Reducir CM (cada 5 CM cuestan +2 Ki)
            <select id="tk-redcm" value={t.redCM} onChange={(ev) => aplicar((c) => { c.redCM = Number(ev.currentTarget.value); })}>
              {[0, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n ? `−${n} CM · +${(n * 2) / 5} Ki` : 'Sin reducción'}</option>)}
            </select>
          </label>
          <label class="tk-check"><input type="checkbox" checked={t.comb} onChange={(ev) => aplicar((c) => { c.comb = ev.currentTarget.checked; })} /><span>Combinable (+{10 * t.nivel} CM, +{3 * t.nivel} Ki)</span></label>
        </div>
      </details>
    </>
  );
}

function TarjetaResumen({ t, r }: { t: Tecnica; r: Calculo }) {
  return (
    <div class="tk-resumen">
      <h4>{t.nombre || 'Sin nombre'}</h4>
      <p class="tk-linea-res">Nivel {t.nivel} · CM {r.cm} · Ki {r.kiNec} · {asaltosTxt(r.asaltos)} acumulando</p>
      <div class="tk-coste-car">{CAR.filter((c) => r.porCar[c]).map((c) => <span key={c}>{c} {r.porCar[c]}</span>)}</div>
      <dl class="tk-datos">
        <dt>Efectos</dt>
        <dd>{r.efectos.map((x) => { const d = efecto(x.e.n)!, g = x.e.g >= 0 ? d.g[x.e.g][0] : ''; return `${d.n}${g ? ` ${g}` : ''}${x.e.x.length ? ` (${x.e.x.map((j) => d.x[j][0]).join(', ')})` : ''}${x.e.dur !== '-' ? ` · ${x.e.dur.toLowerCase()}` : ''}`; }).join(', ') || '—'}</dd>
        <dt>Desventajas</dt>
        <dd>{r.desv.map((x) => `${x.x.n}${x.x.n === 'Atadura Elemental' ? ` (${x.x.el.filter(Boolean).join(', ')})` : desventaja(x.x.n)!.o[x.x.o][0] ? ` (${desventaja(x.x.n)!.o[x.x.o][0]})` : ''}`).join(', ') || 'Ninguna'}</dd>
        {r.mantAsalto > 0 && <><dt>Mantener</dt><dd>{r.mantAsalto} Ki por asalto</dd></>}
        {r.efectos[0] && <><dt>Tipo</dt><dd>{efecto(t.efectos[0].n)!.t} · {efecto(t.efectos[0].n)!.k}</dd></>}
      </dl>
    </div>
  );
}

function PasoResumen({ t, r, av, aplicar, accion, ctx, vaciar }: { t: Tecnica; r: Calculo; av: Aviso[]; aplicar: Aplicar; prueba: Prueba; accion: (a: Aviso) => void; ctx: Contexto; vaciar: () => void }) {
  const rapida = (() => { const c = copia(t); c.efectos.forEach((e) => { e.ki = {}; e.kiM = {}; }); return calcular(normalizar(null, c, ctx, 'rapido'), ctx); })();
  const mejor = r.efectos.length > 0 && rapida.asaltos <= r.asaltos && rapida.kiNec < r.kiNec;
  return (
    <>
      <TarjetaResumen t={t} r={r} />
      {mejor && (
        <div class="tk-consejo"><b>Puedes ahorrar Ki</b>
          <span>Con tu acumulación, repartiendo de otra forma costaría {rapida.kiNec} Ki y tardarías {asaltosTxt(rapida.asaltos)} (ahora {r.kiNec} Ki y {asaltosTxt(r.asaltos)}).</span>
          <button type="button" class="btn" onClick={() => aplicar((c) => { c.efectos.forEach((e) => { e.ki = {}; e.kiM = {}; }); }, 'rapido')}>Aplicar</button></div>
      )}
      <label class="field" for="tk-desc">Descripción (cómo se ve en partida)
        <textarea id="tk-desc" rows={3} defaultValue={t.desc} key={t.desc} onChange={(e) => aplicar((c) => { c.desc = e.currentTarget.value; })} />
      </label>
      {av.length ? <div class="stack-sm">{av.map((a) => <AvisoHtml key={a.t} a={a} accion={accion} paso={7} />)}</div> : <p class="tk-cuadra tk-ok">Todo cuadra con las reglas.</p>}
      <div class="row wrap"><button type="button" class="btn tk-peligro" onClick={vaciar}>Vaciar técnica</button></div>
    </>
  );
}

function Contadores({ t, r, av, paso, accion, ctx }: { t: Tecnica; r: Calculo; av: Aviso[]; paso: number; accion: (a: Aviso) => void; ctx: Contexto }) {
  const L = t.nivel, max = CM_MAX[L], escala = max * 1.2, pct = (n: number) => Math.min(100, (n / escala) * 100);
  const duros = av.filter((a) => !a.suave).length, falta = r.kiNec - r.kiPuesto;
  const cuello = CAR.filter((c) => r.asaltosCar[c] === r.asaltos && r.asaltos > 0);
  return (
    <div class="tk-cont" aria-live="polite" aria-atomic="false">
      <h3 class="tk-cont-tit">Contadores</h3>
      <div class="tk-tile"><span class="tk-sub">Conocimiento Marcial</span>
        <span class="tk-big">{r.cm} <small>CM{r.cmSuma < CM_MIN[L] ? ` (efectos: ${r.cmSuma})` : ''}</small></span>
        <div class="tk-medidor" role="img" aria-label={`CM ${r.cmSuma} de un rango de ${CM_MIN[L]} a ${max}`}>
          <div class={'tk-relleno' + (r.cmSuma > max ? ' tk-fuera' : r.cmSuma < CM_MIN[L] ? ' tk-bajo' : '')} style={{ width: `${pct(Math.max(0, r.cmSuma))}%` }} />
          <div class="tk-marca" style={{ left: `${pct(CM_MIN[L])}%` }}><span>mín {CM_MIN[L]}</span></div>
          <div class="tk-marca" style={{ left: `${pct(max)}%` }}><span>máx {max}</span></div>
        </div>
        <span class="small muted">Efectos {r.cmEfectos}{r.cmDuracion ? ` · duración +${r.cmDuracion}` : ''}{r.cmDesv ? ` · desventajas ${r.cmDesv}` : ''}</span>
      </div>
      <div class="tk-tile"><span class="tk-sub">Ki para lanzarla</span><span class="tk-big">{r.kiNec} <small>Ki</small></span>
        <span class={'small ' + (falta ? 'tk-no' : 'muted')}>{falta ? (falta > 0 ? `Sin repartir: ${falta}` : `Sobran: ${-falta}`) : 'Todo repartido'}</span>
        <div class="tk-cars6">{CAR.map((c) => <div class={'tk-c6' + (cuello.includes(c) ? ' tk-cuello' : '')} key={c}><b>{r.porCar[c]}</b><span>{c} · {r.porCar[c] ? asaltosTxt(r.asaltosCar[c]) : '—'}</span></div>)}</div>
        {r.mantAsalto > 0 && <span class="small">Mantener: {r.mantAsalto} Ki por asalto</span>}
      </div>
      <div class="tk-tile"><span class="tk-sub">Acumulación</span><span class="tk-big">{r.asaltos || '—'} <small>{r.asaltos === 1 ? 'asalto' : 'asaltos'}</small></span>
        <span class="small muted">{cuello.length ? `Te frena ${cuello.join(' y ')}, con la acumulación de este personaje (${CAR.map((c) => ctx.acum[c]).join('/')}).` : 'Elige un efecto para calcularlo.'}</span></div>
      <div class="tk-tile"><span class="tk-sub">Desventajas</span><span class="tk-big">{t.desv.length} <small>de {L}</small></span></div>
      {av.length > 0 && paso !== PASOS.length - 1 && (
        <div class="stack-sm"><span class="tk-sub">{duros ? `${duros} aviso${duros > 1 ? 's' : ''}` : 'Consejos'}</span>
          {av.slice(0, 4).map((a) => <AvisoHtml key={a.t} a={a} accion={accion} paso={paso} />)}</div>
      )}
    </div>
  );
}
