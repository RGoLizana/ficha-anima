import type { Ficha } from '../model/ficha';
import { Campo, Compra, Panel, txt } from './campos';
import arbol from '../data/metamagia-arbol.json';

// Hoja Metamagia: el árbol tal como está dibujado en la ficha (tools/export_metamagia.py lo saca de los bordes de celda).
// Cada caja ocupa 2 columnas x 4 filas de la hoja; las líneas se pintan con los mismos trazos. Se empieza por una caja sin
// requisito de nivel (raíz) y se avanza por cajas conectadas. Los límites solo avisan: todo se puede marcar.
type Nodo = (typeof arbol.nodos)[number];
const NODOS: Nodo[] = arbol.nodos;
const POR_CLAVE = new Map(NODOS.map((n) => [n.c, n]));
const VECINOS = new Map<string, string[]>(NODOS.map((n) => [n.c, []]));
for (const [a, b] of arbol.aristas) { VECINOS.get(a)!.push(b); VECINOS.get(b)!.push(a); }
const RAICES = new Set(arbol.raices);

const W = 52, H = 26, C0 = 3, F0 = 9;            // px por columna / fila de la hoja; esquina superior izquierda (C9)
const ANCHO = (35 - C0) * W, ALTO = (65 - F0) * H;
const x = (col: number) => (col - C0) * W;
const y = (fila: number) => (fila - F0) * H;
const nombre = (c: string) => POR_CLAVE.get(c)!.n;
const letra = (n: number) => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const o = (xs: string[]) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} o ${xs[xs.length - 1]}`;

export type Estado = 'comprada' | 'disponible' | 'bloqueada';

/** Estado de cada caja y avisos de orden. La rama principal es el grupo conexo de compras más grande que parte de una raíz. */
export function estadoArbol(compradas: Set<string>) {
  const grupos: string[][] = [];
  const visto = new Set<string>();
  for (const n of NODOS) {
    if (!compradas.has(n.c) || visto.has(n.c)) continue;
    const g: string[] = [];
    for (const pila = [n.c]; pila.length;) {
      const c = pila.pop()!;
      if (visto.has(c)) continue;
      visto.add(c); g.push(c);
      pila.push(...VECINOS.get(c)!.filter((v) => compradas.has(v)));
    }
    grupos.push(g);
  }
  const conRaiz = grupos.filter((g) => g.some((c) => RAICES.has(c)));
  const principal = new Set(conRaiz.reduce<string[]>((m, g) => (g.length > m.length ? g : m), []));
  const estado = new Map<string, Estado>();
  const motivo = new Map<string, string>();
  const avisos: string[] = [];
  for (const g of grupos) {
    if (principal.has(g[0])) continue;
    if (g.some((c) => RAICES.has(c))) {
      avisos.push(`Ya has empezado por otra rama: no se puede empezar el árbol por dos sitios (${g.map(nombre).join(', ')}).`);
    } else {
      for (const c of g) {
        const faltan = [...new Set(VECINOS.get(c)!.filter((v) => !g.includes(v)).map(nombre))];
        avisos.push(`Para tomar ${nombre(c)} antes necesitas ${o(faltan)}.`);
      }
    }
  }
  for (const n of NODOS) {
    if (compradas.has(n.c)) { estado.set(n.c, 'comprada'); continue; }
    const vecinos = VECINOS.get(n.c)!;
    const libre = principal.size ? vecinos.some((v) => principal.has(v)) : RAICES.has(n.c);
    estado.set(n.c, libre ? 'disponible' : 'bloqueada');
    if (!libre) motivo.set(n.c, principal.size && RAICES.has(n.c) ? 'Ya has empezado por otra rama'
      : `Necesitas antes ${o([...new Set(vecinos.map(nombre))])}`);
  }
  const fuera = new Set([...compradas].filter((c) => !principal.has(c)));   // compradas fuera de orden
  return { estado, motivo, avisos, fuera };
}

export function Metamagia({ f }: { f: Ficha }) {
  const compradas = new Set(NODOS.filter((n) => f.entradas[n.c] !== undefined && f.entradas[n.c] !== '').map((n) => n.c));
  const { estado, motivo, avisos, fuera } = estadoArbol(compradas);
  const nivel = Number(txt('PDs!R17')) || 0;
  const ocultar = txt('Metamagia!T12') === 'true';   // T12 = R6="Sí"
  for (const n of NODOS) {
    if (compradas.has(n.c) && n.nv && nivel && nivel < n.nv) avisos.push(`${n.n} requiere nivel ${n.nv} (tienes ${nivel}).`);
  }
  return (
    <>
      <Panel title="Metamagia" extra={<span class="muted small">Nivel de magia: <strong>{txt('Metamagia!R37') || 0}</strong> de <strong>{txt('Metamagia!P37') || 0}</strong> · metamagia <strong>{txt('Metamagia!T37') || 0}</strong></span>}>
        <div class="grid-fields">
          <Campo f={f} clave="Metamagia!R6" label="Ocultar habilidades de nivel superior" />
        </div>
        <p class="muted small">Empieza por una habilidad sin requisito de nivel (borde dorado discontinuo) y sigue por las líneas: cada habilidad
          necesita otra conectada ya comprada. Las bloqueadas se pueden marcar igualmente, con aviso.</p>
        {avisos.length > 0 && <div class="stack-sm">{avisos.map((t) => <p key={t} class="aviso" role="status">{t}</p>)}</div>}
      </Panel>
      <div class="mm-scroll" role="region" aria-label="Árbol de metamagia" tabIndex={0}>
        <div class="mm-arbol" style={{ width: `${ANCHO}px`, height: `${ALTO}px` }}>
          <svg class="mm-lineas" width={ANCHO} height={ALTO} aria-hidden="true">
            {arbol.lineas.map((l) => {
              const on = l.cajas.filter((c) => compradas.has(c)).length > 1;
              return <path key={l.cajas.join()} class={on ? 'on' : ''} d={l.s.map(([[f1, c1], [f2, c2]]) => `M${x(c1)} ${y(f1)}L${x(c2)} ${y(f2)}`).join('')} />;
            })}
          </svg>
          {NODOS.map((n) => {
            const est = estado.get(n.c)!;
            const req = txt(`Metamagia!${letra(n.col - 1)}${n.fila}`);   // "Nv X" del Excel (vacío si R6 lo oculta)
            const alto = ocultar && !!req;
            return (
              <div key={n.c} class={`mm-nodo mm-${est}${n.raiz ? ' mm-raiz' : ''}${fuera.has(n.c) ? ' mm-fuera' : ''}${alto ? ' mm-alto' : ''}`}
                style={{ left: `${x(n.col - 1)}px`, top: `${y(n.fila - 3)}px`, width: `${2 * W}px`, height: `${4 * H}px` }}
                title={motivo.get(n.c) ?? (n.raiz ? 'Punto de partida' : undefined)}>
                <Compra f={f} clave={n.c} label={<>
                  <span class="mm-nombre">{n.n}</span>
                  <span class="mm-pie">
                    <span>{n.p} pts</span>
                    {req && <span>{req}</span>}
                    {est === 'bloqueada' && <span class="mm-estado">Bloqueada</span>}
                    {fuera.has(n.c) && <span class="mm-estado">Fuera de orden</span>}
                  </span>
                </>} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
