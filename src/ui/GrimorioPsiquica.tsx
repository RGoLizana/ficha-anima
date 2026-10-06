import type { Ficha } from '../model/ficha';
import { Campo, Panel, txt } from './campos';

// Hoja "Grimorio Psíquica": 4 disciplinas (columnas S, AT, BU, CV), 5 bandas de 14 filas, 3 poderes por banda
const H = 'Grimorio Psíquica';
const col = (base: string, mas: number) => {
  let n = [...base].reduce((x, ch) => x * 26 + ch.charCodeAt(0) - 64, 0) + mas;
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const valido = (t: string) => t !== '' && t !== '0' && !t.startsWith('#');
const DISCIPLINAS = [['S', 0], ['AT', 27], ['BU', 54], ['CV', 81]] as const;
const BANDAS = [10, 24, 38, 52, 66];

function Poder({ b, mas }: { b: number; mas: number }) {
  const c = (base: string, fila: number) => txt(`${H}!${col(base, mas)}${fila}`);
  return (
    <article class="arma conjuro">
      <h3 class="arma-titulo">{c('C', b)}</h3>
      <p class="small muted">Nivel <strong>{c('J', b)}</strong> · {c('G', b + 1)} · {c('C', b + 1)}</p>
      <table class="tabla grados">
        <thead><tr><th scope="col" class="left">Dificultad</th><th scope="col" class="left">Efecto</th></tr></thead>
        <tbody>
          {Array.from({ length: 10 }, (_, i) => (
            <tr key={i}><th scope="row" class="left">{c('C', b + 2 + i)} {c('D', b + 2 + i)}</th><td class="left small">{c('F', b + 2 + i)}</td></tr>
          ))}
        </tbody>
      </table>
      <p class="small">Mantenido: {c('E', b + 12)} · Acción: {c('H', b + 12)}</p>
    </article>
  );
}

/** Las 4 disciplinas del grimorio en PDF; la vista previa de cada una va plegada (son decenas de tarjetas). */
export function GrimorioPsiquica({ f, oculto }: { f: Ficha; oculto?: boolean }) {
  return (
    <Panel title="Grimorio de psíquica" area="construccion" oculto={oculto} extra={<span class="muted small">Elige hasta 4 disciplinas para el grimorio (PDF)</span>}>
      <div class="grid-fields">
        {DISCIPLINAS.map(([c], i) => <Campo key={c} f={f} clave={`${H}!${c}6`} label={`Disciplina ${i + 1}`} />)}
      </div>
      {DISCIPLINAS.map(([c, mas]) => {
        if (!valido(txt(`${H}!${c}6`))) return null;
        const poderes = BANDAS.flatMap((b) => [0, 8, 16].map((m) => ({ b, mas: mas + m }))).filter(({ b, mas: m }) => valido(txt(`${H}!${col('C', m)}${b}`)));
        return (
          <details key={c} class="psi-resto">
            <summary>Vista previa del PDF: {txt(`${H}!${c}6`)} ({poderes.length} poderes)</summary>
            <div class="armas">{poderes.map(({ b, mas: m }) => <Poder key={`${b}-${m}`} b={b} mas={m} />)}</div>
          </details>
        );
      })}
    </Panel>
  );
}
