// Resumen de las artes marciales que tiene el personaje: qué hace el arte, qué añade su nivel y sus números (daño base, CM y bonos).
import datos from '../data/artes-marciales.json';

interface Nivel { a: string; n: string; t: string; d: string | null; cm: number; b: [string, number][] }
const ARTES = datos.artes as Record<string, string>;
const NIVELES = datos.niveles as unknown as Record<string, Nivel>;

/** `nombre` es «Arte (Nivel)» como sale en PDs!AD59; `efecto` es lo que el Excel dice de ese nivel (Combate!AF31…, puede depender de otras compras). */
export function ArteMarcial({ nombre, efecto }: { nombre: string; efecto: string }) {
  const x = NIVELES[nombre];
  if (!x) return <p class="small"><strong>{nombre}</strong>{efecto ? ` — ${efecto}` : ''}</p>;
  const especial = efecto && efecto !== '-' ? efecto : '';
  return (
    <div class="arte-marcial">
      <div class="row wrap">
        <strong>{x.a}</strong><span class="chip">{x.n}</span><span class="chip">{x.t === 'avanzada' ? 'Avanzada' : 'Básica'}</span>
        <span class="grow" /><span class="muted small">CM {x.cm >= 0 ? '+' : ''}{x.cm}</span>
      </div>
      <p class="small">{ARTES[x.a]}</p>
      <p class="small"><strong>En nivel {x.n}:</strong> {especial || 'sin efecto especial, solo los bonos de abajo.'}</p>
      <p class="small muted">
        {[x.d ? `Daño base ${x.d}` : x.t === 'avanzada' ? 'Usa el daño del estilo básico' : '', ...x.b.map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)].filter(Boolean).join(' · ') || 'Sin bonos numéricos'}
      </p>
    </div>
  );
}
