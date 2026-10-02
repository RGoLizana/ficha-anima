import { useEffect, useState } from 'preact/hooks';
import { buscar, guardado } from '../store';
import { abrir, abierta, errorMotor, motor, valores } from '../engine';
import { nombreDe } from '../model/ficha';
import { Icon } from './Icon';
import { Avisos, Campo, Dato, Panel, txt } from './campos';
import { Caracteristicas } from './Principal';
import { Bloque, PRIM, ResumenCategoria, SEC } from './Desarrollo';
import { Lista as Filas } from './Ventajas';

// Asistente de nueva ficha: escribe en las mismas celdas que las secciones; cada cambio se guarda al momento,
// así que se puede saltar cualquier paso o terminar cuando se quiera. Los límites solo avisan.
const PASOS = ['Origen', 'Características', 'Desarrollo (PD)', 'Ventajas y poderes', 'Equipo y resumen'];
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function Asistente({ id }: { id: string }) {
  const f = buscar(id);
  const [paso, setPaso] = useState(0);
  useEffect(() => { if (f) void abrir(id, f.entradas); }, [id]);
  const listo = abierta.value === id && Object.keys(valores.value).length > 0;

  if (!f) {
    return (
      <main class="container stack">
        <h1 class="title">Ficha no encontrada</h1>
        <a href="#/">Volver a la lista</a>
      </main>
    );
  }
  const ultimo = paso === PASOS.length - 1;
  const cats = [7, 9, 11, 13, 15].map((r) => txt(`PDs!O${r}`)).filter(Boolean);
  const n = Math.max(1, cats.length);

  return (
    <div class="page">
      <header class="topbar">
        <a class="icon-btn plain" href="#/" aria-label="Volver a la lista"><Icon name="back" /></a>
        <div class="grow">
          <div class="char-name">Nueva ficha · {nombreDe(f) || 'Sin nombre'}</div>
          <div class="muted small">Todo se guarda al momento: puedes saltar pasos o terminar cuando quieras</div>
        </div>
        <span class={guardado.value ? 'saved' : 'error'} role="status">
          {guardado.value ? '● Guardado' : '● No se pudo guardar'}
        </span>
        <a class="btn primary" href={`#/ficha/${id}`}>Terminar</a>
      </header>

      {motor.value === 'error' && <p class="banner error" role="alert">No se pudo cargar el motor de cálculo: {errorMotor.value}</p>}
      {motor.value !== 'error' && !listo && <p class="banner" role="status">Preparando los cálculos de la ficha…</p>}

      <main class="container stack">
        <nav aria-label="Pasos del asistente">
          <ol class="pasos">
            {PASOS.map((t, i) => (
              <li key={t}>
                <button class={'btn' + (i === paso ? ' active' : '')} aria-current={i === paso ? 'step' : undefined}
                  onClick={() => setPaso(i)}>{i + 1}. {t}</button>
              </li>
            ))}
          </ol>
        </nav>
        <div role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={PASOS.length} aria-valuenow={paso + 1}
          aria-valuetext={`Paso ${paso + 1} de ${PASOS.length}: ${PASOS[paso]}`} class="barra">
          <div style={{ width: `${(100 * (paso + 1)) / PASOS.length}%` }} />
        </div>

        {!listo && <Panel title={PASOS[paso]}><p class="muted">Preparando los cálculos de la ficha…</p></Panel>}

        {listo && paso === 0 && (
          <Panel title="Origen">
            <div class="grid-fields">
              <Campo f={f} clave="General!F22" label="Nombre" />
              <Campo f={f} clave="General!F23" label="Raza" />
              <Campo f={f} clave="PDs!O7" label="Categoría" />
              <Campo f={f} clave="PDs!S7" label="Nivel" tipo="numero" />
              <Campo f={f} clave="General!F24" label="Sexo" />
              <Campo f={f} clave="General!F26" label="Edad" />
              <Campo f={f} clave="General!Q23" label="Etnia (humanos)" />
              <Campo f={f} clave="General!I26" label="Región" />
              <Campo f={f} clave="General!N26" label="Clase social" />
              <Campo f={f} clave="Principal!D68" label="Lengua base" />
            </div>
            <p class="muted small">
              Clase: <strong>{txt('Principal!K7') || '—'}</strong> · Tamaño: <strong>{txt('Principal!K6')} {txt('Principal!L6')}</strong>
            </p>
          </Panel>
        )}

        {listo && paso === 1 && (
          <>
            <Avisos claves={['Principal!C19', 'Principal!N14']} />
            <Caracteristicas f={f} />
          </>
        )}

        {listo && paso === 2 && (
          <>
            <Avisos claves={['PDs!T194', 'PDs!V86', 'PDs!V104', 'PDs!V120', 'PDs!Z29+PDs!AA29']} />
            <Panel title="Puntos de desarrollo" extra={<span class="muted small">Nivel total {txt('PDs!R17')} · {txt('PDs!T17')} PD</span>}>
              <div class="pd-cats">
                {Array.from({ length: n }, (_, i) => <ResumenCategoria key={i} i={i} nombre={cats[i] || 'Sin categoría'} />)}
              </div>
              <p class="muted small">Secundarias, Ki, tablas y artes marciales: en la sección <a href={`#/ficha/${id}/desarrollo`}>Desarrollo</a>.</p>
            </Panel>
            <Bloque f={f} n={n} cats={cats} titulo="Combate" filas={rango(25, 28)} cols={PRIM} />
            <Bloque f={f} n={n} cats={cats} titulo="Sobrenatural (místicas)" filas={rango(93, 101)} cols={PRIM} grupo />
            <Bloque f={f} n={n} cats={cats} titulo="Psíquico" filas={[111, 112]} cols={PRIM} />
            <Bloque f={f} n={n} cats={cats} titulo="Puntos de vida" filas={[188]} cols={SEC} total="Z" esp={null} />
          </>
        )}

        {listo && paso === 3 && (
          <>
            <Panel title="Ventajas" extra={<span class="muted small">Puntos de creación: <strong>{txt('Principal!J34')}</strong></span>}>
              <div class="cols-2">
                <div class="stack">
                  <h3 class="sub">Comunes</h3>
                  <Filas f={f} celdas={rango(35, 42).map((r) => `Principal!C${r}`)} label="Ventaja" />
                </div>
                <div class="stack">
                  <h3 class="sub">De trasfondo</h3>
                  <Filas f={f} celdas={rango(35, 40).map((r) => `Principal!G${r}`)} label="Trasfondo" />
                </div>
              </div>
            </Panel>
            <Panel title="Desventajas">
              <Filas f={f} celdas={rango(51, 53).map((r) => `Principal!C${r}`)} label="Desventaja" />
            </Panel>
            <p class="muted small">Legados, ventajas del Don, habilidades esenciales y poderes de criatura: en <a href={`#/ficha/${id}/ventajas`}>Ventajas y poderes</a>.</p>
          </>
        )}

        {listo && paso === 4 && (
          <>
            <Panel title="Equipo">
              <div class="grid-fields">
                {rango(16, 19).map((r, i) => <Campo key={r} f={f} clave={`General!X${r}`} label={`Equipo de combate ${i + 1}`} />)}
                <Campo f={f} clave="General!Y59" label="Oro" tipo="numero" />
                <Campo f={f} clave="General!Y61" label="Plata" tipo="numero" />
                <Campo f={f} clave="General!Y63" label="Cobre" tipo="numero" />
              </div>
            </Panel>
            <Panel title="Resumen">
              <p class="muted small">{[txt('Principal!K5'), txt('Principal!O6') && `Nivel ${txt('Principal!O6')}`, txt('General!F23')].filter(Boolean).join(' · ')}</p>
              <div class="tiles">
                <Dato clave="Principal!N11" label="Puntos de vida" />
                <Dato clave="Principal!D31" label="Turno" />
                <Dato clave="Principal!H24" label="H. Ataque" />
                <Dato clave="Principal!H26" label="H. Defensa" />
              </div>
              <a class="btn primary center" href={`#/ficha/${id}`}>Abrir la ficha completa</a>
            </Panel>
          </>
        )}

        <div class="row between wrap">
          <button class="btn" disabled={paso === 0} onClick={() => setPaso(paso - 1)}>Anterior</button>
          <div class="row">
            {!ultimo && <button class="btn" onClick={() => setPaso(paso + 1)}>Saltar</button>}
            {!ultimo && <button class="btn primary" onClick={() => setPaso(paso + 1)}>Siguiente</button>}
            <a class="btn" href={`#/ficha/${id}`}>Terminar</a>
          </div>
        </div>
      </main>
    </div>
  );
}
