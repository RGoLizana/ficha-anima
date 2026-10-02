import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt } from './campos';

// Hoja Combate del Excel. Diez ranuras de arma en parejas (izquierda/derecha): 1-6 cuerpo a cuerpo, 7-10 proyectiles.
const CABECERAS = [28, 35, 42, 49, 58]; // fila de la primera línea de cada pareja
interface Ranura { n: number; r: number; lado: 'I' | 'D'; proyectil: boolean }
const RANURAS: Ranura[] = CABECERAS.flatMap((r, i) => (['I', 'D'] as const).map((lado, j) => ({ n: 2 * i + j + 1, r, lado, proyectil: i >= 3 })));

// columnas de cada lado: manos, arma, tamaño, calidad, salidas (turno, ataque, defensa, tipo, daño), críticos (5), nombre, extra
const LADO = {
  I: { manos: 'C', arma: 'E', tam: 'F', cal: 'J', sal: ['H', 'I', 'J', 'K', 'L'], crit: ['C', 'D', 'E', 'F', 'G'], nombre: 'D', info: 'K', conocida: 'C' },
  D: { manos: 'N', arma: 'P', tam: 'Q', cal: 'U', sal: ['S', 'T', 'U', 'V', 'W'], crit: ['N', 'O', 'P', 'Q', 'R'], nombre: 'O', info: 'V', conocida: 'N' },
} as const;

const c = (col: string, fila: number) => `Combate!${col}${fila}`;

export function Combate({ f }: { f: Ficha }) {
  const llena = (s: Ranura) => Boolean(f.entradas[c(LADO[s.lado].arma, s.r)]);
  const visibles = (proy: boolean) => {
    const grupo = RANURAS.filter((s) => s.proyectil === proy);
    const ultima = grupo.reduce((m, s, i) => (llena(s) ? i : m), -1);
    return grupo.slice(0, Math.max(2, ultima + 2)); // siempre queda una ranura libre: nunca se bloquea
  };

  return (
    <>
      <Avisos claves={['PDs!T194', 'PDs!Z29+PDs!AA29']} />

      <Panel title="Arma desarrollada">
        <div class="grid-fields">
          <Campo f={f} clave="Principal!F31" label="Arma desarrollada (la que el personaje ha entrenado a fondo)" />
        </div>
      </Panel>

      <Panel title="Armas cuerpo a cuerpo">
        <div class="armas">{visibles(false).map((s) => <ArmaCard key={s.n} f={f} s={s} />)}</div>
      </Panel>
      <Panel title="Armas de proyectiles">
        <div class="armas">{visibles(true).map((s) => <ArmaCard key={s.n} f={f} s={s} />)}</div>
      </Panel>

      <Panel title="Desarmado">
        <div class="grid-fields">
          <Campo f={f} clave={c('E', 20)} label="Equipo" />
          {txt(c('H', 23)) && <Campo f={f} clave={c('I', 23)} label="Calidad" />}
        </div>
        <Salidas valores={['H', 'I', 'J', 'L'].map((k) => [k, txt(c(k, 21))])} tipo={txt(c('K', 21))} conocida={txt(c('C', 21))} />
        <Criticos fila={23} cols={['C', 'D', 'E', 'F', 'G']} />
        <p class="muted small">
          Bonos: turno {txt(c('D', 24))} · ataque {txt(c('F', 24))} · parada {txt(c('H', 24))} · esquiva {txt(c('J', 24))} · daño {txt(c('L', 24))}
        </p>
      </Panel>

      <Armaduras f={f} />

      <Panel title="Combate con armas adicionales" extra={<span class="muted small">Combina armas en mano hábil y torpe</span>}>
        {[22, 23, 24, 25].filter((r, i) => i === 0 || f.entradas[c('R', r - 1)] || f.entradas[c('U', r - 1)]).map((r) => (
          <div class="grid-fields" key={r}>
            <Campo f={f} clave={c('R', r)} label="Arma en mano hábil" />
            <Campo f={f} clave={c('U', r)} label="Arma en mano torpe" />
          </div>
        ))}
      </Panel>

      <div class="cols-2">
        <Panel title="Modificadores">
          <div class="grid-fields">
            <div class="stack-sm">
              <Campo f={f} clave={c('AD', 14)} label="A toda acción (cansancio, dolor…)" tipo="numero" />
              <p class="muted small">Total: <strong>{txt(c('AD', 15)) || 0}</strong></p>
            </div>
            <div class="stack-sm">
              <Campo f={f} clave={c('AF', 14)} label="A acciones físicas (armadura, presa…)" tipo="numero" />
              <p class="muted small">Total: <strong>{txt(c('AF', 15)) || 0}</strong></p>
            </div>
          </div>
        </Panel>
        <Panel title="Calculadora de daño">
          {[12, 14, 16].map((r) => (
            <div class="calc" key={r}>
              <Campo f={f} clave={c('U', r)} label="Daño" tipo="numero" class="mini" />
              <Campo f={f} clave={c('V', r)} label="%" tipo="numero" class="mini" />
              <div class="calc-final"><span class="muted small">Final</span><strong>{txt(c('W', r)) || 0}</strong></div>
            </div>
          ))}
        </Panel>
      </div>

      <Descripciones />

      <Panel title="Notas de combate">
        <Campo f={f} clave={c('C', 67)} label="Notas del equipo de combate" tipo="area" />
        <Campo f={f} clave={c('AB', 67)} label="Notas de capacidades de combate" tipo="area" />
      </Panel>
    </>
  );
}

function ArmaCard({ f, s }: { f: Ficha; s: Ranura }) {
  const L = LADO[s.lado];
  const r = s.r;
  const salida = r + 1;
  const filaCrit = s.proyectil ? r + 4 : r + 3;
  const nombre = txt(c(L.nombre, r - 1));
  const arma = f.entradas[c(L.arma, r)];
  const info = s.proyectil ? [txt(c(L.info, r + 5)), txt(c(L.info, r + 6))] : [txt(c(L.info, r + 3)), txt(c(L.info, r + 4))];
  return (
    <article class="arma">
      <h3 class="arma-titulo">{s.n}. {arma ? nombre || String(arma) : <span class="muted">Arma {s.n}</span>}</h3>
      <div class="grid-fields">
        <Campo f={f} clave={c(L.manos, r)} label="Manos" />
        <Campo f={f} clave={c(L.arma, r)} label="Arma" />
        {s.proyectil && <Campo f={f} clave={c(L.arma, r + 1)} label="Munición" />}
        <Campo f={f} clave={c(L.tam, s.proyectil ? r + 2 : r + 1)} label="Tamaño" />
        <Campo f={f} clave={c(L.cal, r + 3)} label="Calidad del arma" />
        {s.proyectil && <Campo f={f} clave={c(L.cal, r + 4)} label="Calidad de la munición" />}
      </div>
      {arma ? (
        <>
          <Salidas valores={L.sal.filter((_, i) => i !== 3).map((k) => [k, txt(c(k, salida))])} tipo={txt(c(L.sal[3], salida))}
            conocida={txt(c(L.conocida, r + 1))} />
          <Criticos fila={filaCrit} cols={[...L.crit]} />
          {s.proyectil && <p class="muted small">Rango {txt(c(L.crit[0], r + 6))} · Recarga {txt(c(L.crit[1], r + 6))}</p>}
          <p class="muted small">{info.filter(Boolean).join(' · ')}</p>
        </>
      ) : <p class="muted small">Elige un arma para ver turno, ataque, defensa y daño.</p>}
    </article>
  );
}

const ETIQUETA: Record<string, string> = { H: 'Turno', I: 'Ataque', J: 'Defensa', L: 'Daño', S: 'Turno', T: 'Ataque', U: 'Defensa', W: 'Daño' };

function Salidas({ valores, tipo, conocida }: { valores: string[][]; tipo: string; conocida: string }) {
  return (
    <div class="salidas">
      {valores.map(([k, v]) => (
        <div class="stat" key={k}>
          <div class="stat-v">{v || '—'}{k === 'J' || k === 'U' ? <small class="muted"> {tipo}</small> : null}</div>
          <div class="muted small">{ETIQUETA[k]}</div>
        </div>
      ))}
      {conocida && <div class="stat"><div class="stat-v small">{conocida}</div><div class="muted small">Tipo</div></div>}
    </div>
  );
}

function Criticos({ fila, cols }: { fila: number; cols: string[] }) {
  const v = cols.map((k) => txt(c(k, fila)));
  if (v.every((x) => !x || x === '-' || x === '#N/A')) return null;
  const [c1, c2, ent, rot, pres] = v;
  return <p class="small">Crít. <strong>{c1}</strong>{c2 && c2 !== '-' ? <> / <strong>{c2}</strong></> : null} · Ent. <strong>{ent}</strong> · Rotura <strong>{rot}</strong> · Pres. <strong>{pres}</strong></p>;
}

const TA = ['I', 'J', 'K', 'L', 'M', 'N', 'O'];
const TIPOS_TA = ['FIL', 'CON', 'PEN', 'CAL', 'ELE', 'FRI', 'ENE'];

function Armaduras({ f }: { f: Ficha }) {
  const filas = [12, 13, 14, 15];
  const visibles = filas.filter((r, i) => i === 0 || r === 15 || f.entradas[c('C', r - 1)]);
  return (
    <Panel title="Armadura" extra={<span class="muted small">{txt(c('H', 18))}</span>}>
      <div class="table-wrap">
        <table class="tabla armadura">
          <thead>
            <tr>
              <th scope="col" class="left">Pieza</th><th scope="col">Calidad</th>
              {TIPOS_TA.map((t) => <th scope="col" key={t}>{t}</th>)}
              <th scope="col">Ent.</th><th scope="col">Pres.</th><th scope="col">Mov.</th><th scope="col">Enc.</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={r}>
                <th scope="row" class="left">
                  <Campo f={f} clave={c('C', r)} label={r === 15 ? 'Yelmo' : `Armadura ${r - 11}`} />
                  <span class="muted small">{txt(c('F', r))}</span>
                </th>
                <td><Campo f={f} clave={c('H', r)} label={<span class="sr-only">Calidad</span>} class="mini" /></td>
                {TA.map((k) => <td key={k}>{txt(c(k, r))}</td>)}
                <td>{txt(c('P', r))}</td><td>{txt(c('Q', r))}</td><td>{txt(c('R', r))}</td>
                <td><Campo f={f} clave={c('S', r)} label={<span class="sr-only">Enc.</span>} class="mini" /></td>
              </tr>
            ))}
            <tr class="total-fila">
              <th scope="row" class="left">TA total</th><td></td>
              {TA.map((k) => <td key={k} class="total">{txt(c(k, 16))}</td>)}
              <td></td><td></td><td></td><td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted small">
        Restricción de movimiento <strong>{txt(c('E', 16)) || 0}</strong> · Requisito <strong>{txt(c('H', 16)) || 0}</strong> ·
        Pen. acción física <strong>{txt(c('S', 16)) || 0}</strong> · Pen. natural <strong>{txt(c('H', 17)) || 0}</strong> (final <strong>{txt(c('S', 17)) || 0}</strong>)
      </p>
    </Panel>
  );
}

/** Tablas, estilos, artes marciales y Ars Magnus que el personaje ha comprado con PD (solo lectura). */
function Descripciones() {
  const bloque = (titulo: string, filas: number[], nombre: string, desc: string) => {
    const items = filas.map((r) => [txt(c(nombre, r)), txt(c(desc, r))]).filter(([n]) => n && n !== '0');
    return items.length ? (
      <div key={titulo}>
        <h3 class="sub">{titulo}</h3>
        {items.map(([n, d]) => <p class="small" key={n}><strong>{n}</strong>{d ? ` — ${d}` : ''}</p>)}
      </div>
    ) : null;
  };
  const partes = [
    bloque('Tablas de armas', [11, 12, 13, 14, 15, 16], 'AH', 'AL'),
    bloque('Tablas de estilos', Array.from({ length: 10 }, (_, i) => 19 + i), 'AB', 'AH'),
    bloque('Artes marciales', Array.from({ length: 22 }, (_, i) => 31 + i), 'AB', 'AF'),
    bloque('Ars Magnus', Array.from({ length: 10 }, (_, i) => 55 + i), 'AB', 'AH'),
  ].filter(Boolean);
  if (!partes.length) return null;
  return <Panel title="Capacidades de combate (compradas en Desarrollo)"><div class="stack">{partes}</div></Panel>;
}
