import type { Ficha } from '../model/ficha';
import elan from '../data/elan.json';
import { Avisos, Campo, Panel, txt } from './campos';

// Hoja Elan: dos entidades (columnas C/G y U/Y), 13 dones cada una
const e = (col: string, fila: number) => `Elan!${col}${fila}`;
const DONES = Array.from({ length: 13 }, (_, i) => 13 + i);
type Don = { n: string; e: number; c: number | null; d: string | null };
const DATOS = elan as Record<string, Don[]>;
const ENTIDADES = [{ n: 1, col: 'C', nivel: 'G' }, { n: 2, col: 'U', nivel: 'Y' }];

function visibles(f: Ficha, col: string) {
  const ultima = DONES.reduce((x, r, i) => (f.entradas[e(col, r)] ? i : x), -1);
  return DONES.slice(0, Math.min(DONES.length, ultima + 2));
}
const elegidos = (f: Ficha, col: string) => DONES.map((r) => String(f.entradas[e(col, r)] ?? '').trim()).filter(Boolean);
const entidadDe = (f: Ficha, col: string) => String(f.entradas[e(col, 11)] ?? '').trim();

function Entidad({ f, n, c, nivel }: { f: Ficha; n: number; c: string; nivel: string }) {
  return (
    <Panel title={`Elan ${n}`} plegable>
      <div class="grid-fields">
        <Campo f={f} clave={e(c, 11)} label="Entidad" />
        <Campo f={f} clave={e(nivel, 11)} label="Elan" tipo="numero" />
      </div>
      {visibles(f, c).map((r) => <Campo key={r} f={f} clave={e(c, r)} label="Don" />)}
      <Avisos claves={[e(c, 26)]} />
    </Panel>
  );
}

/** Resumen de los poderes de cada entidad: lo que pide cada don, lo que cuesta y si el Elan que tiene el personaje con esa entidad llega. */
function Resumen({ f }: { f: Ficha }) {
  const activas = ENTIDADES.map((x) => ({ ...x, entidad: entidadDe(f, x.col), total: Number(f.entradas[e(x.nivel, 11)]) || 0, dones: elegidos(f, x.col) }))
    .filter((x) => x.entidad && DATOS[x.entidad]);
  if (!activas.length) return null;
  // la descripción de los dones adquiridos la calcula el Excel (algunas dependen del Elan)
  const calculadas = new Map<string, string>();
  for (let r = 29; r <= 49; r++) { const n = txt(e('F', r)); if (n) calculadas.set(n, txt(e('G', r))); }
  const cuenta = new Map<string, number>();
  for (const x of ENTIDADES) for (const d of elegidos(f, x.col)) cuenta.set(d, (cuenta.get(d) ?? 0) + 1);
  const repetidos = [...cuenta].filter(([, k]) => k > 1).map(([d]) => d);
  const mismaEntidad = activas.length === 2 && activas[0].entidad === activas[1].entidad;
  return (
    <Panel title="Resumen de poderes" extra={<span class="muted small">{txt(e('L', 4))}{txt(e('P', 5)) ? ` · nivel ${txt(e('P', 5))}` : ''}</span>}>
      {mismaEntidad && <p class="aviso elan-aviso" role="status">Tienes a {activas[0].entidad} en Elan 1 y en Elan 2: comprueba que no sea una repetición.</p>}
      {repetidos.length > 0 && <p class="aviso elan-aviso" role="status">Don repetido: {repetidos.join(', ')}. El Excel lo cuenta dos veces.</p>}
      <div class="elan-resumen">
        {activas.map((x) => {
          const dones = DATOS[x.entidad];
          const gastado = dones.filter((d) => x.dones.includes(d.n)).reduce((t, d) => t + (d.c ?? 0), 0);
          const exceso = x.total > 0 && gastado > x.total;
          return (
            <section class="elan-ent" key={x.n} aria-label={`Elan ${x.n}: ${x.entidad}`}>
              <header class="row between wrap">
                <h3>{x.entidad} <span class="muted small">Elan {x.n}</span></h3>
                <span class="chip">Elan {x.total}</span>
                <span class={'chip' + (exceso ? ' elan-mal' : '')} title="Coste de los dones elegidos frente al Elan de la entidad">Gastado {gastado} de {x.total}</span>
              </header>
              <ul class="elan-dones">
                {dones.map((d) => {
                  const mio = x.dones.includes(d.n), llega = x.total >= d.e, dup = (cuenta.get(d.n) ?? 0) > 1;
                  const desc = (mio && calculadas.get(d.n)) || d.d;
                  return (
                    <li key={d.n} class={'elan-don' + (mio ? ' mio' : '') + (!mio && !llega ? ' bloqueado' : '')}>
                      <div class="row between wrap">
                        <strong>{d.n}</strong>
                        <span class="elan-estado">
                          {mio ? (llega ? 'Adquirido' : `Adquirido, pide Elan ${d.e}`) : llega ? 'Disponible' : `Faltan ${d.e - x.total} de Elan`}
                          {dup && <span class="chip elan-mal"> Repetido</span>}
                        </span>
                      </div>
                      <p class="small muted">Pide Elan {d.e} · cuesta {d.c ?? '—'}{mio && llega ? ' · lo tienes' : ''}</p>
                      {desc && <p class="small">{desc}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

export function Elan({ f }: { f: Ficha }) {
  return (
    <>
      <div class="cols-2">
        {ENTIDADES.map((x) => <Entidad key={x.n} f={f} n={x.n} c={x.col} nivel={x.nivel} />)}
      </div>
      <Resumen f={f} />
    </>
  );
}
