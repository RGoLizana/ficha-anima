import type { Ficha } from '../model/ficha';
import { Campo, Compra, Panel, txt } from './campos';
import listas from '../data/listas.json';

// Hoja Metamagia: árbol de habilidades. Cada compra es una casilla (su lista tiene una sola opción: el coste) y su
// nombre está en la celda 3 filas por encima y 1 columna a la izquierda; el coste, en la celda de su derecha.
const g = (col: number, fila: number) => `Metamagia!${letra(col)}${fila}`;
function letra(n: number) { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }
const numero = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

interface Compra { clave: string; fila: number; col: number }
const COMPRAS: Compra[] = Object.keys(listas)
  .filter((k) => k.startsWith('Metamagia!') && k !== 'Metamagia!R6')
  .map((k) => { const m = k.slice(10).match(/^([A-Z]+)(\d+)$/)!; return { clave: k, col: numero(m[1]), fila: +m[2] }; })
  .sort((a, b) => a.fila - b.fila || a.col - b.col);

export function Metamagia({ f }: { f: Ficha }) {
  // agrupa por nombre de habilidad; los grados salen en el orden del árbol (de arriba abajo)
  const grupos = new Map<string, Compra[]>();
  for (const c of COMPRAS) {
    const nombre = txt(g(c.col - 1, c.fila - 3)) || `Habilidad en ${letra(c.col)}${c.fila}`;
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), c]);
  }
  return (
    <>
      <Panel title="Metamagia" extra={<span class="muted small">Nivel de magia: <strong>{txt('Metamagia!R37') || 0}</strong> de <strong>{txt('Metamagia!P37') || 0}</strong> · metamagia <strong>{txt('Metamagia!T37') || 0}</strong></span>}>
        <div class="grid-fields">
          <Campo f={f} clave="Metamagia!R6" label="Ocultar habilidades de nivel superior" />
        </div>
        <p class="muted small">Marca las habilidades que has comprado. Cada grado cuesta puntos de nivel de magia.</p>
      </Panel>
      <div class="armas">
        {[...grupos].map(([nombre, items]) => (
          <article class="arma" key={nombre}>
            <h3 class="arma-titulo">{nombre}</h3>
            {items.map((c, i) => (
              <div class="hab" key={c.clave}>
                <Compra f={f} clave={c.clave} label={items.length > 1 ? `Grado ${i + 1}` : 'Comprada'} />
                <span class="muted small">{txt(g(c.col + 1, c.fila))} pts{txt(g(c.col - 1, c.fila)) ? ` · ${txt(g(c.col - 1, c.fila))}` : ''}</span>
              </div>
            ))}
          </article>
        ))}
      </div>
    </>
  );
}
