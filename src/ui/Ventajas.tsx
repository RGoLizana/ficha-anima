import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt } from './campos';

// Ventajas, desventajas, habilidades esenciales y poderes: zona izquierda/derecha de la hoja Principal del Excel
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Muestra las filas ocupadas y una vacía más, para no enseñar 10 desplegables vacíos. */
export function Lista({ f, celdas, label }: { f: Ficha; celdas: string[]; label: string }) {
  const ultima = celdas.reduce((m, c, i) => (f.entradas[c] ? i : m), -1);
  return (
    <div class="stack-sm">
      {celdas.slice(0, Math.min(celdas.length, ultima + 2)).map((c, i) => (
        <Campo key={c} f={f} clave={c} label={`${label} ${i + 1}`} />
      ))}
    </div>
  );
}

const CARACT: [string, string][] = [['H50', 'AGI'], ['H51', 'CON'], ['H52', 'DES'], ['H53', 'FUE'],
  ['J50', 'INT'], ['J51', 'PER'], ['J52', 'POD'], ['J53', 'VOL']];

export function Ventajas({ f }: { f: Ficha }) {
  return (
    <>
      <Panel title="Ventajas" extra={<span class="muted small">Puntos de creación: <strong>{txt('Principal!J34')}</strong></span>}>
        <div class="cols-2">
          <div class="stack">
            <h3 class="sub">Comunes</h3>
            <Lista f={f} celdas={rango(35, 42).map((r) => `Principal!C${r}`)} label="Ventaja" />
            <h3 class="sub">Del Don / psíquicas</h3>
            <Lista f={f} celdas={rango(43, 49).map((r) => `Principal!C${r}`)} label="Ventaja" />
          </div>
          <div class="stack">
            <h3 class="sub">De trasfondo</h3>
            <Lista f={f} celdas={rango(35, 40).map((r) => `Principal!G${r}`)} label="Trasfondo" />
            <h3 class="sub">Legados de sangre</h3>
            <Lista f={f} celdas={rango(41, 47).map((r) => `Principal!G${r}`)} label="Legado" />
          </div>
        </div>
      </Panel>

      <Panel title="Desventajas">
        <Lista f={f} celdas={rango(51, 53).map((r) => `Principal!C${r}`)} label="Desventaja" />
      </Panel>

      <Panel title="Bonos a características" extra={<span class="muted small">PC usados: <strong>{txt('Principal!J54')}</strong></span>}>
        <div class="grid-fields">
          {CARACT.map(([c, k]) => <Campo key={c} f={f} clave={`Principal!${c}`} label={k} tipo="numero" />)}
          <Campo f={f} clave="Principal!J49" label="PC liberalizados" tipo="numero" />
        </div>
      </Panel>

      <Panel title="Habilidades esenciales" extra={<span class="muted small">Gnosis {txt('Principal!AB13')}</span>}>
        {rango(12, 23).filter((r, i) => i === 0 || f.entradas[`Principal!AD${r - 1}`]).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={`Principal!AD${r}`} label="Habilidad" class="grow" />
            {f.entradas[`Principal!AD${r}`] && <Campo f={f} clave={`Principal!AG${r}`} label="Opción" />}
            {f.entradas[`Principal!AD${r}`] && (
              <p class="muted small">Gnosis {txt(`Principal!AI${r}`) || '—'} · {txt(`Principal!AJ${r}`) || 0} PD</p>
            )}
          </div>
        ))}
      </Panel>

      <Panel title="Poderes de criatura" extra={<span class="muted small">PD totales: <strong>{txt('Principal!AJ40')}</strong></span>}>
        <p class="muted small">Pon el mismo nombre a varias líneas para agrupar sus efectos en un único poder.</p>
        {rango(42, 69).filter((r, i) => i === 0 || f.entradas[`Principal!AB${r - 1}`]).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={`Principal!V${r}`} label="Nombre (agrupa)" />
            <Campo f={f} clave={`Principal!AB${r}`} label="Poder" class="grow" />
            {f.entradas[`Principal!AB${r}`] && <Campo f={f} clave={`Principal!AF${r}`} label="Opción" />}
            {f.entradas[`Principal!AB${r}`] && (
              <p class="muted small">Gnosis {txt(`Principal!AI${r}`) || '—'} · {txt(`Principal!AJ${r}`) || 0} PD</p>
            )}
          </div>
        ))}
        <Avisos claves={['Principal!V70']} />
        <div class="grid-fields">
          <Campo f={f} clave="PDs!X20" label="PD en poderes: categoría 2" tipo="numero" />
          <Campo f={f} clave="PDs!Y20" label="PD en poderes: categoría 3" tipo="numero" />
          <Campo f={f} clave="PDs!AA20" label="PD en poderes: categoría 5" tipo="numero" />
        </div>
        <Campo f={f} clave="Principal!W74" label="Notas de los poderes (salen en el PDF)" tipo="area" />
      </Panel>
    </>
  );
}
