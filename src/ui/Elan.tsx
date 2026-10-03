import type { Ficha } from '../model/ficha';
import { Avisos, Campo, Panel, txt } from './campos';

// Hoja Elan: dos entidades (columnas C/G y U/Y), 13 dones cada una
const e = (col: string, fila: number) => `Elan!${col}${fila}`;
const DONES = Array.from({ length: 13 }, (_, i) => 13 + i);

function visibles(f: Ficha, col: string) {
  const ultima = DONES.reduce((x, r, i) => (f.entradas[e(col, r)] ? i : x), -1);
  return DONES.slice(0, Math.min(DONES.length, ultima + 2));
}

function Entidad({ f, n, c, nivel }: { f: Ficha; n: number; c: string; nivel: string }) {
  return (
    <Panel title={`Elan ${n}`}>
      <div class="grid-fields">
        <Campo f={f} clave={e(c, 11)} label="Entidad" />
        <Campo f={f} clave={e(nivel, 11)} label="Elan" tipo="numero" />
      </div>
      {visibles(f, c).map((r) => <Campo key={r} f={f} clave={e(c, r)} label="Don" />)}
      <Avisos claves={[e(c, 26)]} />
    </Panel>
  );
}

export function Elan({ f }: { f: Ficha }) {
  return (
    <>
      <Panel title="Elan" extra={<span class="muted small">{txt(e('L', 4))} · nivel {txt(e('P', 5))}</span>}>
        <p class="muted small">Elige la entidad y sus dones. Los límites de Elán solo avisan.</p>
      </Panel>
      <div class="cols-2">
        <Entidad f={f} n={1} c="C" nivel="G" />
        <Entidad f={f} n={2} c="U" nivel="Y" />
      </div>
    </>
  );
}
