import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { buscar, actualizar, exportar, fichas, guardado, guardarOcultas, guardarResumen, sincronizarFamiliares } from '../store';
import { mostrarPestaña } from '../criaturas';
import { abrir, abierta, errorMotor, motor, valores } from '../engine';
import { nombreDe, entradasMotor } from '../model/ficha';
import { Icon } from './Icon';
import { ExportarExcel } from './ExportarExcel';
import { Avatar } from './Avatar';
import { Dato, Panel, txt } from './campos';
import { Principal } from './Principal';
import { Trasfondo } from './Trasfondo';
import { Desarrollo } from './Desarrollo';
import { Ventajas } from './Ventajas';
import { Combate } from './Combate';
import { Ki } from './Ki';
import { Tecnicas } from './Tecnicas';
import { Magia } from './Magia';
import { Metamagia } from './Metamagia';
import { GrimorioMagia, GrimorioVia } from './Grimorios';
import { Psiquica } from './Psiquica';
import { GrimorioVias, GrimorioDisciplinas } from './GrimoriosInfo';
import { Sheele } from './Sheele';
import { Elan } from './Elan';
import { Gremio } from './Gremio';
import { Equipo } from './Equipo';
import { GrimorioPsiquica } from './GrimorioPsiquica';
import { Personalizacion } from './Personalizacion';
import { BandaCriatura, Criaturas } from './Criaturas';

// Secciones de la ficha y el paso del plan en que se implementan
const SECCIONES = [
  // orden pensado por lo que más se rellena en las fichas reales: personaje, PD, ventajas, combate y magia/ki; lo raro (Sheele, Elan) al final
  { id: 'principal', t: 'Principal', paso: 2 },
  { id: 'desarrollo', t: 'Desarrollo (PD)', paso: 3 },
  { id: 'combate', t: 'Combate', paso: 4 },
  { id: 'ventajas', t: 'Ventajas y poderes', paso: 3 },
  { id: 'trasfondo', t: 'Trasfondo', paso: 2 },
  { id: 'ki', t: 'Ki', paso: 5 },
  { id: 'tecnicas', t: 'Técnicas de Ki', paso: 5 },
  { id: 'magia', t: 'Magia', paso: 6 },
  { id: 'metamagia', t: 'Metamagia', paso: 6 },
  { id: 'criaturas', t: 'Criaturas', paso: 6 },
  { id: 'psiquica', t: 'Psíquica', paso: 7 },
  { id: 'grimorios', t: 'Grimorios de magia', paso: 6 },
  { id: 'equipo', t: 'Equipo', paso: 8 },
  { id: 'sheele', t: 'Sheele', paso: 8 },
  { id: 'elan', t: 'Elan', paso: 8 },
  { id: 'notas', t: 'Notas', paso: 1 },
  // aparte: contenido extra que no está en las reglas de Anima
  { id: 'personalizacion', t: 'Personalización', paso: 8, extra: true },
  { id: 'gremio', t: 'Gremio', paso: 11, extra: true },
];

export function FichaView({ id, seccion }: { id: string; seccion: string }) {
  const f = buscar(id);

  useEffect(() => {
    if (!f) return;
    sincronizarFamiliares(f.criatura?.padre ?? id); // recupera desfases (fichas importadas o editadas en otra versión)
    void abrir(id, entradasMotor(buscar(id) ?? f));
  }, [id]);

  // copia de unos valores calculados para la lista de fichas
  const listo = abierta.value === id && Object.keys(valores.value).length > 0;
  useEffect(() => {
    if (!listo) return;
    guardarResumen(id, {
      categoria: txt('Principal!K5'), nivel: txt('Principal!O6'), raza: txt('General!F23'),
      stats: [
        { k: 'PV', v: txt('Principal!N11') }, { k: 'Turno', v: txt('Principal!D31') },
        { k: 'H. Ataque', v: txt('Principal!H24') }, { k: 'H. Defensa', v: defensa() },
      ],
    });
  }, [listo, valores.value]);

  if (!f) {
    return (
      <main class="container stack">
        <h1 class="title">Ficha no encontrada</h1>
        <a href="#/">Volver a la lista</a>
      </main>
    );
  }
  const sec = SECCIONES.find((s) => s.id === seccion && (s.id !== 'criaturas' || !f.criatura)) ?? SECCIONES[0];
  const nombre = nombreDe(f);
  const ocultas = f.ocultas ?? [];
  const hayCriaturas = listo && mostrarPestaña(f, fichas.value, (k) => Number(txt(k)) || 0);
  const menu = SECCIONES.filter((s) => s.id === sec.id || (!ocultas.includes(s.id) && (s.id !== 'criaturas' || hayCriaturas))); // la que estás viendo no desaparece

  return (
    <div class="page">
      <header class="topbar">
        <a class="icon-btn plain" href="#/" aria-label="Volver a la lista"><Icon name="back" /></a>
        <Avatar f={f} sm editable />
        <div class="grow">
          <div class="char-name">{nombre || 'Sin nombre'}</div>
          <div class="muted small">{[txt('Principal!K5'), txt('Principal!O6') && `Nivel ${txt('Principal!O6')}`, txt('General!F23')].filter(Boolean).join(' · ')}</div>
        </div>
        <span class={guardado.value ? 'saved' : 'error'} role="status">
          {guardado.value ? '● Guardado' : '● No se pudo guardar'}
        </span>
        <button class="btn" onClick={() => exportar(f)}>Exportar .json</button>
        <ExportarExcel f={f} />
        <a class="btn" href={`#/compendio/${id}`}>Compendio</a>
        <a class="btn" href={`#/juego/${id}`}>Modo juego</a>
        <a class="btn primary" href={`#/imprimir/${id}`}>PDF</a>
      </header>

      {motor.value === 'error' && <p class="banner error" role="alert">No se pudo cargar el motor de cálculo: {errorMotor.value}</p>}
      {motor.value !== 'error' && !listo && <p class="banner" role="status">Preparando los cálculos de la ficha…</p>}

      <BandaCriatura f={f} />

      <div class="sheet">
        <div class="sidebar">
        <nav class="sections" aria-label="Secciones">
          {menu.map((s, i) => (
            <Fragment key={s.id}>
              {s.extra && !menu[i - 1]?.extra && <div class="nav-extra" role="separator">Fuera de las reglas</div>}
              <a href={`#/ficha/${id}/${s.id}`} class={(s.id === sec.id ? 'active ' : '') + (s.extra ? 'extra' : '')}
                aria-current={s.id === sec.id ? 'page' : undefined}>{s.t}</a>
            </Fragment>
          ))}
        </nav>
        <PersonalizarMenu id={id} ocultas={ocultas} activa={sec.id} />
        </div>

        <main class="content stack">
          {/* hasta que el motor tenga esta ficha no se pintan las secciones: los desplegables dependen de sus datos */}
          {!listo && <Panel title={sec.t}><p class="muted">Preparando los cálculos de la ficha…</p></Panel>}
          {listo && sec.id === 'principal' && <Principal f={f} />}
          {listo && sec.id === 'trasfondo' && <Trasfondo f={f} />}
          {listo && sec.id === 'desarrollo' && <Desarrollo f={f} />}
          {listo && sec.id === 'ventajas' && <Ventajas f={f} />}
          {listo && sec.id === 'combate' && <Combate f={f} />}
          {listo && sec.id === 'ki' && <Ki f={f} />}
          {listo && sec.id === 'tecnicas' && <Tecnicas f={f} />}
          {listo && sec.id === 'magia' && <Magia f={f} />}
          {listo && sec.id === 'metamagia' && <Metamagia f={f} />}
          {listo && sec.id === 'criaturas' && <Criaturas f={f} />}
          {listo && sec.id === 'grimorios' && <><GrimorioVias /><GrimorioMagia f={f} /><GrimorioVia f={f} /></>}
          {listo && sec.id === 'psiquica' && <><Psiquica f={f} /><GrimorioDisciplinas /><GrimorioPsiquica f={f} /></>}
          {listo && sec.id === 'sheele' && <Sheele f={f} />}
          {listo && sec.id === 'elan' && <Elan f={f} />}
          {listo && sec.id === 'equipo' && <Equipo f={f} />}
          {listo && sec.id === 'personalizacion' && <Personalizacion f={f} />}
          {listo && sec.id === 'gremio' && <Gremio f={f} />}
          {sec.id === 'notas' && (
            <Panel title="Notas">
              <textarea rows={16} value={f.notas} aria-label="Notas"
                onInput={(e) => actualizar(id, { notas: e.currentTarget.value })} />
            </Panel>
          )}
          {listo && !['principal', 'trasfondo', 'desarrollo', 'ventajas', 'combate', 'ki', 'tecnicas', 'magia', 'metamagia', 'criaturas', 'grimorios', 'psiquica', 'sheele', 'elan', 'equipo', 'notas', 'personalizacion'].includes(sec.id) && (
            <Panel title={sec.t}>
              {sec.extra && <p class="extra-note">Añade aquí ventajas, poderes, armas, armaduras… que no están en las reglas de Anima.</p>}
              <p class="muted">Esta sección se implementa en el paso {sec.paso}.</p>
            </Panel>
          )}
        </main>

        <aside class="side" aria-label="Valores clave">
          <Dato clave="Principal!N11" label="Puntos de vida" big />
          <div class="tiles">
            <Dato clave="Principal!D31" label="Turno" />
            <Dato clave="Principal!H24" label="H. Ataque" />
            <div class="tile"><div class="muted small">H. Defensa</div><div class="mid">{defensa() || '—'}</div></div>
            <Dato clave="Principal!J57" label="Presencia" />
            <Dato clave="Principal!N16" label="Cansancio" />
            <Dato clave="Principal!J16" label="Movimiento" sub={txt('Principal!K17')} />
            <Dato clave="Principal!J11" label="Regeneración" sub={txt('Principal!K11')} />
            <Dato clave="Principal!J32" label="Acciones / turno" />
          </div>
          <div class="tile">
            <div class="muted small">Resistencias</div>
            <div class="res-row">
              {[58, 59, 60, 61, 62].map((r) => (
                <div key={r}><div class="muted small">{txt(`Principal!D${r}`)}</div><strong>{txt(`Principal!J${r}`)}</strong></div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Mejor defensa (H26) y su tipo según la etiqueta del Excel (F26: "H. Parada:" / "H. Esquiva:"). */
function defensa() {
  const d = txt('Principal!H26');
  const tipo = txt('Principal!F26').replace(/^H\.\s*/, '').replace(/:$/, '');
  return d ? `${d} ${tipo}` : '';
}

/** «Personalizar menú»: casillas para ocultar pestañas que no hacen falta en este personaje (la ficha no se toca). */
function PersonalizarMenu({ id, ocultas, activa }: { id: string; ocultas: string[]; activa: string }) {
  const [abierto, setAbierto] = useState(false);
  const alternar = (s: string) => guardarOcultas(id, ocultas.includes(s) ? ocultas.filter((x) => x !== s) : [...ocultas, s]);
  return (
    <div class="menu-personalizar">
      <button type="button" class="menu-personalizar-boton" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>
        Personalizar menú{ocultas.length ? ` (${ocultas.length} ocultas)` : ''}
      </button>
      {abierto && (
        <>
          <p class="muted small">Oculta las pestañas que este personaje no usa. No se borra nada: los datos siguen en la ficha.</p>
          {SECCIONES.filter((s) => s.id !== 'principal').map((s) => (
            <label class="check" key={s.id}>
              <input type="checkbox" checked={!ocultas.includes(s.id)} disabled={s.id === activa} onChange={() => alternar(s.id)} />
              <span>{s.t}</span>
            </label>
          ))}
        </>
      )}
    </div>
  );
}
