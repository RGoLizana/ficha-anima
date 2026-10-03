import { signal } from '@preact/signals';
import { fichas, crear, duplicar, borrar, importar, importarExcel, exportar } from '../store';
import { ir } from '../router';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { nombreDe } from '../model/ficha';

const filtro = signal('');
const error = signal('');
const avisos = signal<string[]>([]);

async function onImport(e: Event) {
  const input = e.currentTarget as HTMLInputElement;
  error.value = '';
  avisos.value = [];
  for (const file of Array.from(input.files ?? [])) {
    try {
      if (/\.xls[xm]$/i.test(file.name)) {
        const r = await importarExcel(new Uint8Array(await file.arrayBuffer()), file.name);
        avisos.value = [...avisos.value, ...r.avisos.map((a) => `${file.name}: ${a}`)];
      } else importar(await file.text());
    } catch (err) {
      error.value = `No se pudo importar ${file.name}: ${(err as Error).message}`;
    }
  }
  input.value = '';
}

export function Lista() {
  const q = filtro.value.trim().toLowerCase();
  const lista = fichas.value.filter((f) => `${nombreDe(f)} ${f.resumen?.categoria ?? ''}`.toLowerCase().includes(q));
  const n = fichas.value.length;

  return (
    <div class="page">
      <header class="topbar">
        <div class="brand">ANIMA <span>· Fichas</span></div>
        <div class="row">
          <a class="btn" href="#/compendio">Compendio</a>
          <label class="btn">
            Importar .json / .xlsm
            <input type="file" accept=".json,application/json,.xlsm,.xlsx" multiple hidden onChange={onImport} />
          </label>
          <button class="btn primary" onClick={() => ir(`#/nueva/${crear().id}`)}>+ Nueva ficha</button>
        </div>
      </header>

      <main class="container stack">
        <div class="row between wrap end">
          <div>
            <h1 class="title">Tus personajes</h1>
            <p class="muted">{n === 1 ? '1 ficha guardada' : `${n} fichas guardadas`} en este navegador</p>
          </div>
          <label class="field">Buscar
            <input type="search" placeholder="Nombre o categoría" value={filtro.value}
              onInput={(e) => (filtro.value = e.currentTarget.value)} />
          </label>
        </div>

        {error.value && <p class="error" role="alert">{error.value}</p>}
        {avisos.value.map((a) => <p class="aviso" role="status" key={a}>{a}</p>)}

        <div class="cards">
          {lista.map((f) => (
            <article class="card stack" key={f.id}>
              <div class="row">
                <Avatar f={f} />
                <div class="grow">
                  <h2 class="card-title">{nombreDe(f) || 'Sin nombre'}</h2>
                  <div class="muted small">
                    {[f.resumen?.raza, f.resumen?.nivel && `Nivel ${f.resumen.nivel}`].filter(Boolean).join(' · ') || 'Sin abrir todavía'}
                  </div>
                </div>
                {f.resumen?.categoria && <span class="chip">{f.resumen.categoria}</span>}
              </div>
              {f.resumen?.stats && (
                <div class="stats">
                  {f.resumen.stats.map((s) => (
                    <div class="stat" key={s.k}><div class="stat-v">{s.v || '—'}</div><div class="muted small">{s.k}</div></div>
                  ))}
                </div>
              )}
              <div class="row">
                <a class="btn grow center" href={`#/ficha/${f.id}`}>Abrir</a>
                <button class="icon-btn" aria-label="Duplicar" title="Duplicar" onClick={() => duplicar(f.id)}><Icon name="copy" /></button>
                <button class="icon-btn" aria-label="Exportar .json" title="Exportar .json" onClick={() => exportar(f)}><Icon name="download" /></button>
                <button class="icon-btn danger" aria-label="Borrar" title="Borrar"
                  onClick={() => confirm(`¿Borrar "${nombreDe(f)}"? No se puede deshacer.`) && borrar(f.id)}><Icon name="trash" /></button>
              </div>
            </article>
          ))}
          <button class="card add" onClick={() => ir(`#/nueva/${crear().id}`)}>
            <span class="plus">+</span>Crear personaje
          </button>
        </div>

        <p class="muted small">Las fichas solo se guardan en este navegador. Exporta un <strong>.json</strong> para hacer copia de seguridad o pasarla a otro equipo.</p>
      </main>
    </div>
  );
}
