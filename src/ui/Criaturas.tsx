import { useState } from 'preact/hooks';
import { fichas, atar, borrar, crearCriatura, duplicar, editarVarias, enlazar, exportar, importar, importarExcel, marcarFamiliar } from '../store';
import { ir } from '../router';
import { avisosCriatura, celdasAtada, convocadorDe, criaturasDe, filaAtada, filaLibre, nivelTotal, zeonSugerido } from '../criaturas';
import { nombreDe, type Ficha } from '../model/ficha';
import { Avatar } from './Avatar';
import { Panel, txt } from './campos';

/** Pestaña «Criaturas» del convocador: cada criatura es una ficha completa enlazada. */
export function Criaturas({ f }: { f: Ficha }) {
  const [error, setError] = useState('');
  const hijas = criaturasDe(fichas.value, f.id);

  async function importarCriatura(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    setError('');
    for (const file of Array.from(input.files ?? [])) {
      try {
        const c = /\.xls[xm]$/i.test(file.name) ? (await importarExcel(new Uint8Array(await file.arrayBuffer()), file.name)).ficha : importar(await file.text());
        if (!enlazar(c.id, f.id)) setError(`${file.name} se importó, pero no se pudo enlazar (ya tiene criaturas propias).`);
      } catch (err) { setError(`No se pudo importar ${file.name}: ${(err as Error).message}`); }
    }
    input.value = '';
  }

  return (
    <>
      <Panel title="Convocatoria" extra={<span class="muted small">Convocar <strong>{txt('Místicos!M26') || '—'}</strong> · Atar <strong>{txt('Místicos!M28') || '—'}</strong></span>}>
        <p class="muted small">
          Cada criatura es una ficha completa: empieza con los mismos PD que tú. Un <strong>familiar</strong> gana un nivel por cada nivel que subas tú (Core p. 199);
          una criatura atada no evoluciona y su nivel se cambia a mano. Para estancar a un familiar, desmarca «Familiar»: no recupera lo que se pierda.
        </p>
        {hijas.length === 0 && <p class="muted">Todavía no tienes criaturas atadas.</p>}
        <div class="cards">
          {hijas.map((c) => <Tarjeta key={c.id} c={c} padre={f} />)}
        </div>
        <div class="row wrap">
          <button class="btn primary" onClick={() => { const c = crearCriatura(f.id); if (c) ir(`#/ficha/${c.id}`); }}>+ Nueva criatura</button>
          <label class="btn">
            Importar criatura (.json / .xlsm)
            <input type="file" accept=".json,application/json,.xlsm,.xlsx" hidden aria-label="Importar criatura" onChange={importarCriatura} />
          </label>
        </div>
        {error && <p class="error" role="alert">{error}</p>}
      </Panel>
    </>
  );
}

function Tarjeta({ c, padre }: { c: Ficha; padre: Ficha }) {
  const nombre = nombreDe(c);
  const v = c.criatura!;
  const nivel = nivelTotal(c);
  const sugerido = zeonSugerido(nivel, v.familiar);
  const fila = filaAtada(padre, nombre);
  const libre = filaLibre(padre);
  const avisos = avisosCriatura(c, padre, fichas.value);
  const anotar = () => {
    if (libre === null) return;
    const k = celdasAtada(libre);
    editarVarias(padre.id, { [k.nombre]: nombre, [k.zeon]: sugerido });
  };
  const zeonAnotado = fila !== null ? padre.entradas[celdasAtada(fila).zeon] : undefined;

  return (
    <article class="card stack criatura" data-criatura={c.id}>
      <div class="row">
        <Avatar f={c} />
        <div class="grow">
          <h3 class="card-title">{nombre || 'Sin nombre'}</h3>
          <div class="muted small">{[c.resumen?.categoria, `Nivel ${nivel}`, c.resumen?.raza].filter(Boolean).join(' · ')}</div>
        </div>
        <span class={`chip${v.familiar ? ' familiar' : ''}`}>{v.familiar ? `Sube con ${nombreDe(padre) || 'su amo'}` : 'Nivel fijo'}</span>
      </div>
      {c.resumen?.stats && (
        <div class="stats">
          {c.resumen.stats.slice(0, 2).map((s) => <div class="stat" key={s.k}><div class="stat-v">{s.v || '—'}</div><div class="muted small">{s.k}</div></div>)}
        </div>
      )}
      <div class="row wrap">
        <label class="check">
          <input type="checkbox" checked={v.familiar} onChange={(e) => marcarFamiliar(c.id, e.currentTarget.checked)} />
          <span>Familiar</span>
        </label>
        <button class="btn" title="Pone su nivel igual al tuyo y anota tu nivel actual" onClick={() => atar(c.id)}>Atar / recalcular</button>
      </div>
      <p class="small">
        {fila !== null
          ? <>En tus criaturas atadas: fila {fila} · zeón diario {String(zeonAnotado ?? '—')}{sugerido !== null && String(zeonAnotado ?? '') !== String(sugerido) ? ` (sugerido ${sugerido})` : ''}</>
          : <>Zeón diario sugerido: <strong>{sugerido ?? '—'}</strong>{' '}
              <button class="btn" disabled={libre === null} onClick={anotar}>Anotar en criaturas atadas</button></>}
      </p>
      {avisos.map((a) => <p class="aviso small" role="status" key={a}>{a}</p>)}
      <div class="row wrap">
        <a class="btn grow center" href={`#/ficha/${c.id}`}>Abrir</a>
        <a class="btn" href={`#/juego/${c.id}`}>Modo juego</a>
        <button class="btn" onClick={() => duplicar(c.id)}>Duplicar</button>
        <button class="btn" onClick={() => exportar(c)}>Exportar .json</button>
        <button class="btn danger" onClick={() => confirm(`¿Borrar "${nombre}"? No se puede deshacer.`) && borrar(c.id)}>Borrar</button>
      </div>
    </article>
  );
}

/** Banda de la ficha de una criatura: de quién es, casilla Familiar y vuelta al convocador (o enlazarla si no tiene). */
export function BandaCriatura({ f }: { f: Ficha }) {
  const v = f.criatura;
  if (!v) return null;
  const padre = convocadorDe(fichas.value, f);
  if (padre) {
    return (
      <div class="banner criatura-banda row wrap" role="status">
        <span>Criatura de <strong>{nombreDe(padre) || 'Sin nombre'}</strong></span>
        <label class="check">
          <input type="checkbox" checked={v.familiar} onChange={(e) => marcarFamiliar(f.id, e.currentTarget.checked)} />
          <span>Familiar</span>
        </label>
        <a class="btn" href={`#/ficha/${padre.id}/criaturas`}>← Volver al convocador</a>
      </div>
    );
  }
  const candidatos = fichas.value.filter((x) => x.id !== f.id && !x.criatura);
  return (
    <div class="banner criatura-banda row wrap" role="status">
      <span>Sin convocador</span>
      <label class="field">Enlazar a
        <select value="" onChange={(e) => e.currentTarget.value && enlazar(f.id, e.currentTarget.value)}>
          <option value="">—</option>
          {candidatos.map((x) => <option key={x.id} value={x.id}>{nombreDe(x) || 'Sin nombre'}</option>)}
        </select>
      </label>
      <button class="btn" onClick={() => enlazar(f.id, null)}>Desenlazar</button>
    </div>
  );
}
