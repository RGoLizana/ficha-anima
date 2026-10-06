import type { Ficha } from '../model/ficha';
import { Campo, Panel, txt } from './campos';
import { ViaChip, claseVia, estiloVia } from './GrimoriosInfo';

// Grimorio de Magia (hoja "Grimorio Magia") y Grimorio de Vía (hoja "Grimorio de Vía")
const GRADOS = ['Base', 'Intermedio', 'Avanzado', 'Arcano'];

/** Letras de columna sumando un desplazamiento (C + 19 = V). */
function col(base: string, mas: number) {
  let n = [...base].reduce((x, ch) => x * 26 + ch.charCodeAt(0) - 64, 0) + mas;
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
const valido = (t: string) => t !== '' && !t.startsWith('#');

/** Un conjuro del grimorio: nivel, vía, tipo, acción, diario, los cuatro grados y la descripción. */
function Conjuro({ hoja, b, mas, nombre }: { hoja: string; b: number; mas: number; nombre?: preact.ComponentChildren }) {
  const c = (base: string, fila: number) => txt(`${hoja}!${col(base, mas)}${fila}`);
  const titulo = c('C', b);
  return (
    <article class={'arma conjuro' + claseVia(c('M', b))} style={estiloVia(c('M', b))}>
      {nombre}
      {valido(titulo) && titulo !== 'Libre Acceso' && <h3 class="arma-titulo">{titulo}</h3>}
      <p class="small muted">
        Nivel <strong>{c('I', b)}</strong> · <ViaChip via={c('M', b)} /> · {c('I', b + 1)} · {c('M', b + 1)} · Diario {c('Q', b + 1)}
      </p>
      <table class="tabla grados">
        <thead><tr><th scope="col" class="left">Grado</th><th scope="col">Int. R.</th><th scope="col">Zeón</th><th scope="col">Mant.</th><th scope="col" class="left">Efecto</th></tr></thead>
        <tbody>
          {GRADOS.map((gr, i) => (
            <tr key={gr}>
              <th scope="row" class="left">{gr}</th>
              <td>{c('E', b + 2 + i)}</td><td>{c('F', b + 2 + i)}</td><td>{c('G', b + 2 + i)}</td><td class="left small">{c('H', b + 2 + i)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="small">{c('C', b + 6)}</p>
    </article>
  );
}

const BLOQUES_MAGIA = [11, 22, 33, 44, 55];
const COLUMNAS_MAGIA = [0, 19, 38, 57]; // C, V, AO, BH

export function GrimorioMagia({ f }: { f: Ficha }) {
  const casillas = BLOQUES_MAGIA.flatMap((b) => COLUMNAS_MAGIA.map((mas) => ({ b, mas, clave: `Grimorio Magia!${col('C', mas)}${b}` })));
  const ultima = casillas.reduce((m, x, i) => (f.entradas[x.clave] ? i : m), -1);
  return (
    <Panel title="Grimorio de magia" extra={<span class="muted small">Elige los conjuros que quieres en tu grimorio (PDF)</span>}>
      <div class="armas">
        {casillas.slice(0, Math.min(casillas.length, ultima + 2)).map((x) => (
          <div class="stack" key={x.clave}>
            <Campo f={f} clave={x.clave} label="Conjuro" />
            {f.entradas[x.clave] && <Conjuro hoja="Grimorio Magia" b={x.b} mas={x.mas} />}
          </div>
        ))}
      </div>
    </Panel>
  );
}

const PAGINAS_VIA = [0, 1, 2, 3, 4].map((p) => 11 + 67 * p); // 5 bloques por página, 11 filas cada uno

export function GrimorioVia({ f }: { f: Ficha }) {
  // un bloque tiene conjuro cuando la hoja le pone vía; sin vía elegida solo hay rótulos ("Libre Acceso 1-10") y #N/A
  const conConjuro = (b: number, mas: number) => valido(txt(`Grimorio de Vía!${col('M', mas)}${b}`)) && valido(txt(`Grimorio de Vía!${col('C', mas)}${b}`));
  const hayVia = conConjuro(11, 0);
  return (
    <>
      <Panel title="Grimorio de vía" extra={<span class="muted small">{txt('Grimorio de Vía!O6')} {txt('Grimorio de Vía!P6')}</span>}>
        <div class="grid-fields">
          <Campo f={f} clave="Grimorio de Vía!J6" label="Vía" />
          <Campo f={f} clave="Grimorio de Vía!J7" label="Subvía" />
          <Campo f={f} clave="Grimorio de Vía!P7" label="Colores por vía" />
        </div>
        {(txt('Grimorio de Vía!J6') || txt('Grimorio de Vía!J7')) && <p class="row wrap">{[txt('Grimorio de Vía!J6'), txt('Grimorio de Vía!J7')].filter(Boolean).map((v) => <ViaChip key={v} via={v} />)}</p>}
        <p class="muted small">Muestra todos los conjuros de la vía por niveles (2 a 100), con sus grados.</p>
      </Panel>
      {!hayVia && <p class="muted">Elige una vía (y subvía) para ver sus conjuros.</p>}
      {hayVia && PAGINAS_VIA.map((p) => {
        // la hoja pone los niveles en dos columnas (2-10 a la izquierda, 12-20 a la derecha): en orden de nivel van primero los de una y luego los de la otra
        const casillas = [0, 19].flatMap((mas) => [0, 1, 2, 3, 4].map((i) => ({ b: p + 11 * i, mas }))).filter(({ b, mas }) => conConjuro(b, mas));
        const niveles = casillas.map(({ b, mas }) => Number(txt(`Grimorio de Vía!${col('I', mas)}${b}`))).filter((n) => Number.isFinite(n) && n > 0);
        const rango = niveles.length ? `${Math.min(...niveles)}-${Math.max(...niveles)}` : '';
        return (
          <Panel key={p} title={rango ? `Conjuros de nivel ${rango}` : txt(`Grimorio de Vía!C${p - 1}`) || `Conjuros ${p}`}>
            <div class="armas">
              {casillas.map(({ b, mas }) => <Conjuro key={`${b}-${mas}`} hoja="Grimorio de Vía" b={b} mas={mas} />)}
            </div>
          </Panel>
        );
      })}
    </>
  );
}
