import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt } from './campos';

// Hoja "Creación de Técnicas": diez técnicas en bloques de 34 filas (el 6.º tiene 35). b = fila de la cabecera.
const BASES = [12, 46, 80, 114, 148, 183, 217, 251, 285, 319];
const col = (c: string, fila: number) => `Creación de Técnicas!${c}${fila}`;
const NOMBRE_POR_DEFECTO = 'Nombre de la técnica';

const CARACT = ['AGI', 'CON', 'DES', 'FUE', 'POD', 'VOL'];
const MODS = [['V', 'W'], ['X', 'Y'], ['Z', 'AA'], ['AB', 'AC'], ['AD', 'AE'], ['AF', 'AG']]; // Activar / Mantener
const MODS_DESV = ['V', 'X', 'Z', 'AB', 'AD', 'AF'];                                             // celdas combinadas por pares
// una columna de opciones por efecto: selector, nivel, y dónde está su tipo y clase
const GRUPOS = [
  { sel: 'D', niv: 'I', tipo: 'E', clase: 'I', nom: 'D' }, { sel: 'J', niv: 'O', tipo: 'K', clase: 'O', nom: 'J' },
  { sel: 'P', niv: 'U', tipo: 'Q', clase: 'U', nom: 'P' }, { sel: 'V', niv: 'AA', tipo: 'W', clase: 'AA', nom: 'V' },
  { sel: 'AB', niv: 'AG', tipo: 'AC', clase: 'AG', nom: 'AB' },
];

export function Tecnicas({ f }: { f: Ficha }) {
  return (
    <>
      <Panel title="Técnicas" extra={<span class="muted small">Acumulaciones de Ki: <strong>{txt(col('R', 5)).replace(/\s+/g, ' ')}</strong></span>}>
        <Campo f={f} clave={col('W', 6)} label="Árbol de técnicas" tipo="area" />
        <p class="muted small">Cada técnica combina efectos y desventajas; el coste en Ki y CM se calcula solo.</p>
      </Panel>
      {BASES.map((b, i) => <Tecnica key={b} f={f} b={b} n={i + 1} />)}
    </>
  );
}

function Tecnica({ f, b, n }: { f: Ficha; b: number; n: number }) {
  const nombre = txt(col('D', b));
  const usada = Boolean(f.entradas[col('F', b + 4)] || (nombre && nombre !== NOMBRE_POR_DEFECTO));
  const aviso = txt(col('D', b + 31));
  return (
    <details class="tecnica panel" open={usada}>
      <summary>
        <span class="tecnica-n">{n}</span>
        <strong class="grow">{nombre && nombre !== NOMBRE_POR_DEFECTO ? nombre : `Técnica ${n}`}</strong>
        {usada && <span class="muted small">Nivel {txt(col('P', b))} · CM {txt(col('U', b))} · {txt(col('X', b))}</span>}
        {aviso && <span class="chip aviso-chip">Aviso</span>}
      </summary>
      <div class="stack">
        <Avisos claves={[col('D', b + 31)]} todos />
        <div class="grid-fields">
          <Campo f={f} clave={col('D', b)} label="Nombre" class="span2" />
          <Campo f={f} clave={col('P', b)} label="Nivel" />
          <Campo f={f} clave={col('S', b)} label="Combinable" />
        </div>
        <Efectos f={f} b={b} />
        <Desventajas f={f} b={b} />
        <Opciones f={f} b={b} />
        <Campo f={f} clave={col('D', b + 25)} label="Descripción" tipo="area" />
      </div>
    </details>
  );
}

function Efectos({ f, b }: { f: Ficha; b: number }) {
  const filas = [4, 5, 6, 7, 8].map((o) => b + o);
  const visibles = filas.filter((r, i) => i === 0 || f.entradas[col('F', r - 1)]);
  return (
    <section class="stack-sm">
      <h3 class="sub">Efectos</h3>
      {visibles.map((r) => (
        <div class="efecto" key={r}>
          <div class="grid-fields">
            <Campo f={f} clave={col('D', r)} label="Tipo" />
            <Campo f={f} clave={col('F', r)} label="Efecto" class="span2" />
            <Campo f={f} clave={col('K', r)} label="Mantenido / sostenido" />
          </div>
          {f.entradas[col('F', r)] && (
            <p class="small muted">
              CM <strong>{txt(col('N', r)) || 0}</strong> · Ki <strong>{txt(col('O', r))}</strong> · Ki (mant.) <strong>{txt(col('P', r))}</strong>
              {txt(col('Q', r)) && <> · {txt(col('Q', r))}</>}
            </p>
          )}
          <Modificadores f={f} fila={r} />
        </div>
      ))}
    </section>
  );
}

/** Ki que cada característica pone al activar y al mantener el efecto. */
function Modificadores({ f, fila }: { f: Ficha; fila: number }) {
  return (
    <div class="mods">
      {MODS.map(([a, m], i) => (
        <div class="mod" key={a}>
          <span class="muted small">{CARACT[i]}</span>
          <Campo f={f} clave={col(a, fila)} label={<span class="sr-only">{CARACT[i]} activar</span>} tipo="numero" class="mini" />
          <Campo f={f} clave={col(m, fila)} label={<span class="sr-only">{CARACT[i]} mantener</span>} tipo="numero" class="mini" />
        </div>
      ))}
      <span class="muted small mods-leyenda">Activar · Mantener</span>
    </div>
  );
}

function Desventajas({ f, b }: { f: Ficha; b: number }) {
  const filas = [9, 10, 11].map((o) => b + o);
  const visibles = filas.filter((r, i) => i === 0 || f.entradas[col('F', r - 1)]);
  // Core, tabla 54: una técnica de nivel 1 admite 1 desventaja, una de nivel 2 admite 2 y una arcana (nivel 3) hasta 3. Solo avisa.
  const nivel = Number(txt(col('P', b))) || 1;
  const puestas = filas.filter((r) => f.entradas[col('F', r)]);
  const altas = puestas.filter((r) => Number(/(\d+)/.exec(txt(col('S', r)))?.[1]) > nivel);
  return (
    <section class="stack-sm">
      <h3 class="sub">Desventajas</h3>
      {puestas.length > nivel && (
        <p class="aviso" role="status">Una técnica de nivel {nivel} admite como máximo {nivel} {nivel === 1 ? 'desventaja' : 'desventajas'} (Core, tabla 54) y esta tiene {puestas.length}.</p>
      )}
      {altas.map((r) => (
        <p class="aviso" role="status" key={r}>«{String(f.entradas[col('F', r)])}» es una desventaja de {txt(col('S', r)).toLowerCase()} y la técnica es de nivel {nivel}.</p>
      ))}
      {visibles.map((r) => (
        <div class="efecto" key={r}>
          <div class="grid-fields">
            <Campo f={f} clave={col('F', r)} label="Desventaja" class="span2" />
            <Campo f={f} clave={col('K', r)} label="Opción" />
            <Campo f={f} clave={col('O', r)} label="Elemento 1" />
            <Campo f={f} clave={col('Q', r)} label="Elemento 2" />
          </div>
          {f.entradas[col('F', r)] && <p class="muted small">{txt(col('S', r))} · {txt(col('U', r))}</p>}
        </div>
      ))}
      <div class="grid-fields">
        <Campo f={f} clave={col('Y', b + 9)} label="Reducción de Ki" />
        <Campo f={f} clave={col('AC', b + 9)} label="Reducción de CM" />
      </div>
      <p class="muted small">{txt(col('AD', b + 9))}</p>
      <h4 class="sub">Modificadores de características por desventajas</h4>
      <div class="mods">
        {MODS_DESV.map((c, i) => (
          <div class="mod" key={c}>
            <span class="muted small">{CARACT[i]}</span>
            <Campo f={f} clave={col(c, b + 11)} label={<span class="sr-only">Modificador {CARACT[i]}</span>} tipo="numero" class="mini" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Opciones de cada efecto elegido: siete casillas por efecto, con su nivel. */
function Opciones({ f, b }: { f: Ficha; b: number }) {
  const efectos = GRUPOS.map((g, i) => ({ g, fila: b + 4 + i })).filter(({ fila }) => f.entradas[col('F', fila)]);
  if (!efectos.length) return null;
  return (
    <section class="stack-sm">
      <h3 class="sub">Opciones de los efectos</h3>
      <div class="opciones">
        {efectos.map(({ g, fila }) => (
          <div class="opcion-grupo" key={g.sel}>
            <strong>{txt(col(g.nom, b + 13))}</strong>
            <p class="muted small">Tipo {txt(col(g.tipo, b + 14))} · Clase {txt(col(g.clase, b + 14))}</p>
            {[17, 18, 19, 20, 21, 22, 23].map((o) => b + o).filter((r, i) => i === 0 || f.entradas[col(g.sel, r - 1)]).map((r) => (
              <div class="row" key={r}>
                <Campo f={f} clave={col(g.sel, r)} label={<span class="sr-only">Opción</span>} class="grow" />
                <span class="muted small nivel-op">{txt(col(g.niv, r)) && `Nv ${txt(col(g.niv, r))}`}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
