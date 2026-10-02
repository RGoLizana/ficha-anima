import { useEffect, useState } from 'preact/hooks';
import { buscar } from '../store';
import { abrir, abierta, valores } from '../engine';
import { nombreDe, entradasMotor } from '../model/ficha';
import { PaginaPdf, type ValorPdf } from '../pdf/Pagina';
import { tramosNotas } from '../pdf/notas';
import { txt } from './campos';

// Vista de impresión: las mismas páginas A4 que exporta el Excel. "Imprimir / guardar PDF" usa el diálogo del
// navegador (destino "Guardar como PDF"); el texto queda seleccionable.
export function Imprimir({ id }: { id: string }) {
  const f = buscar(id);
  useEffect(() => { if (f) void abrir(id, entradasMotor(f)); }, [id]);
  const [op, setOp] = useState({ pagNotas: true, idiomas: true, notas: true });
  if (!f) return <main class="container stack"><h1 class="title">Ficha no encontrada</h1><a href="#/">Volver a la lista</a></main>;

  const listo = abierta.value === id && Object.keys(valores.value).length > 0;
  // el navegador propone como nombre del PDF el título de la página: «Nombre nivel»
  const nombre = [nombreDe(f) || 'ficha', txt('Principal!O6')].filter(Boolean).join(' ');
  const logo = `${import.meta.env.BASE_URL}logo-anima.jpg`;
  const datos: Record<string, ValorPdf> = { ...valores.value };
  if (listo) datos['Resumen!D112'] = tramosNotas(valores.value, op);
  const conNotas = listo && (datos['Resumen!D112'] as unknown[]).length > 0 && op.pagNotas;

  return (
    <div class="imprimir">
      <header class="topbar no-print">
        <a class="btn" href={`#/ficha/${id}/principal`}>← Volver a la ficha</a>
        <div class="grow muted small">Hoja A4 igual que la del Excel. En el diálogo elige “Guardar como PDF”, A4, sin márgenes ni encabezados.</div>
        {([['pagNotas', 'Página de notas'], ['idiomas', 'Idiomas en notas'], ['notas', 'Notas de cada sección']] as const).map(([k, t]) => (
          <label class="check" key={k}><input type="checkbox" checked={op[k]} onChange={(e) => setOp({ ...op, [k]: e.currentTarget.checked })} /> {t}</label>
        ))}
        <button class="btn primary" disabled={!listo} onClick={() => { const t = document.title; document.title = nombre; print(); document.title = t; }}>
          Imprimir / guardar PDF
        </button>
      </header>
      {!listo && <p class="muted no-print">Preparando los cálculos de la ficha…</p>}
      {listo && (
        <div class="pdf-hojas">
          <div class="pdf-hoja"><PaginaPdf pagina="resumen" valores={datos} logo={logo} /></div>
          {conNotas && <div class="pdf-hoja"><PaginaPdf pagina="notas" valores={datos} logo={logo} /></div>}
        </div>
      )}
    </div>
  );
}
