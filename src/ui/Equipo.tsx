import type { Ficha } from '../model/ficha';
import { Campo, Panel, txt } from './campos';

// Zona de equipo de la hoja General (columnas W..AM)
const g = (col: string, fila: number) => `General!${col}${fila}`;
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Filas ocupadas más una libre: nunca se bloquea añadir otra. */
function visibles(f: Ficha, filas: number[], cols: string[]) {
  const llena = (r: number) => cols.some((c) => f.entradas[g(c, r)]);
  const ultima = filas.reduce((x, r, i) => (llena(r) ? i : x), -1);
  return filas.slice(0, Math.min(filas.length, ultima + 2));
}

export function Equipo({ f }: { f: Ficha }) {
  return (
    <>
      <Panel title="Experiencia" extra={<span class="muted small">Siguiente nivel {txt(g('AA', 12))} · total {txt(g('AC', 12))}</span>}>
        <div class="grid-fields">
          <Campo f={f} clave={g('X', 12)} label="Experiencia actual" tipo="numero" />
          <Campo f={f} clave={g('AD', 10)} label="Incremental" />
        </div>
      </Panel>

      <Panel title="Peso" extra={<span class="muted small">{txt(g('AF', 32))} {txt(g('AG', 32))} {txt(g('AH', 32))} · {txt(g('AJ', 32))} {txt(g('AK', 32))}</span>}>
        <div class="salidas">
          <div class="stat"><div class="stat-v">{txt(g('AI', 31)) || '—'}</div><div class="muted small">Índice de peso</div></div>
          <div class="stat"><div class="stat-v">{txt(g('AL', 31)) || 0}</div><div class="muted small">Peso total</div></div>
        </div>
      </Panel>

      <Panel title="Equipo variado">
        {visibles(f, rango(11, 30), ['AF', 'AJ', 'AL']).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={g('AF', r)} label="Objeto" class="grow" />
            <Campo f={f} clave={g('AJ', r)} label="Localización" />
            <Campo f={f} clave={g('AL', r)} label="Peso" tipo="numero" class="mini" />
          </div>
        ))}
      </Panel>

      <div class="cols-2">
        <Panel title="Equipo de combate">
          {visibles(f, rango(16, 23), ['X', 'AB', 'AD']).map((r) => (
            <div class="compra" key={r}>
              <Campo f={f} clave={g('X', r)} label="Objeto" class="grow" />
              <Campo f={f} clave={g('AB', r)} label="Localización" />
              <Campo f={f} clave={g('AD', r)} label="Peso" tipo="numero" class="mini" />
            </div>
          ))}
        </Panel>
        <Panel title="Vestimenta / complementos">
          {visibles(f, rango(26, 32), ['X', 'AD']).map((r) => (
            <div class="compra" key={r}>
              <Campo f={f} clave={g('X', r)} label="Prenda" class="grow" />
              <Campo f={f} clave={g('AD', r)} label="Peso" tipo="numero" class="mini" />
            </div>
          ))}
        </Panel>
      </div>

      <Panel title="Artefactos">
        {visibles(f, [35, 37, 39, 41, 43], ['X', 'AA']).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={g('X', r)} label="Artefacto" class="grow" />
            <Campo f={f} clave={g('AA', r)} label="Detalle" class="grow" />
          </div>
        ))}
      </Panel>

      <div class="cols-2">
        <Panel title="Títulos y posesiones">
          {visibles(f, rango(47, 55), ['X']).map((r) => <Campo key={r} f={f} clave={g('X', r)} label="Título o posesión" />)}
        </Panel>
        <Panel title="Contactos">
          {visibles(f, rango(47, 55), ['AF']).map((r) => <Campo key={r} f={f} clave={g('AF', r)} label="Contacto" />)}
        </Panel>
      </div>

      <div class="cols-2">
        <Panel title="Dinero">
          <div class="grid-fields">
            <Campo f={f} clave={g('Y', 59)} label="Oro" tipo="numero" />
            <Campo f={f} clave={g('Y', 61)} label="Plata" tipo="numero" />
            <Campo f={f} clave={g('Y', 63)} label="Cobre" tipo="numero" />
            <Campo f={f} clave={g('AB', 59)} label="Joyas y otros" />
          </div>
        </Panel>
        <Panel title="Fama y reconocimiento" extra={<span class="muted small">Total {txt(g('AF', 58)) || 0} · {txt(g('AK', 57))}</span>}>
          <div class="grid-fields">
            <Campo f={f} clave={g('AI', 58)} label="Audacia" tipo="numero" />
            <Campo f={f} clave={g('AL', 58)} label="Cobardía" tipo="numero" />
            <Campo f={f} clave={g('AI', 59)} label="Honorabilidad" tipo="numero" />
            <Campo f={f} clave={g('AL', 59)} label="Infamia" tipo="numero" />
            <Campo f={f} clave={g('AI', 60)} label="Habilidad" tipo="numero" />
          </div>
          <p class="muted small">Dificultad {txt(g('AL', 60)) || '—'}</p>
        </Panel>
      </div>

      <Panel title="Salud mental" extra={<span class="muted small">Umbral de locura {txt(g('AI', 63))} / {txt(g('AJ', 63))}</span>}>
        <div class="grid-fields">
          <Campo f={f} clave={g('AK', 63)} label="Salud mental actual" tipo="numero" />
          <Campo f={f} clave={g('AF', 64)} label="Trastornos" />
        </div>
      </Panel>
    </>
  );
}
