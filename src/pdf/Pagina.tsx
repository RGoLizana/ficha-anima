import type { CSSProperties } from 'preact/compat';
import layout from '../data/pdf-layout.json';
import type { Valor } from '../engine/libro';

// Una página del PDF del Excel pintada con HTML en puntos PDF (A4 595,32 x 841,92). Es el port de render() en
// tools/pdf_layout.py: fondo y cajas copiados del PDF de referencia + cada celda de Resumen en su caja.
export type Tramo = { t: string; b: boolean; pt: number };
export type ValorPdf = Valor | Tramo[];
type Texto = { x: number; y: number; w: number; h: number; max_w: number; size: number; bold: boolean; italic: boolean; color: string;
  h_align: string; v_align: string; wrap: boolean; text?: string; ref?: string };
type Pagina = { fondo: [number, number, number, number, string][]; logo: [number, number, number, number][]; textos: Texto[] };

export const PAGINAS = layout as unknown as Record<'resumen' | 'notas', Pagina>;
export const A4 = [595.32, 841.92];

const pdfSize = (pt: number) => Math.round((Math.round((pt * 0.94) / 0.12) * 0.12) * 100) / 100;
const JUSTIFY = { left: 'flex-start', right: 'flex-end', center: 'center' } as const;
const ALIGN_V = { top: 'flex-start', center: 'center', bottom: 'flex-end' } as Record<string, string>;
const ALIGN_H = { centerContinuous: 'center', justify: 'left', fill: 'left', distributed: 'center' } as Record<string, string>;

function fmt(v: ValorPdf): string {
  if (typeof v === 'boolean') return v ? 'VERDADERO' : 'FALSO';
  return String(v);
}

/** Hueco del retrato en la hoja del Excel («Retrato - Apariencia 7»), en puntos: bajo la barra de título, dentro del marco. */
export const CAJA_RETRATO = { x: 379.1, y: 32.8, w: 183.2, h: 144.4 };

export function PaginaPdf({ pagina, valores, logo, retrato }: { pagina: 'resumen' | 'notas'; valores: Record<string, ValorPdf>; logo: string; retrato?: string }) {
  const p = PAGINAS[pagina];
  return (
    <div class="pdf-pagina" style={{ position: 'relative', width: `${A4[0]}pt`, height: `${A4[1]}pt`, background: '#fff', overflow: 'hidden',
      fontFamily: "Arial, 'Liberation Sans', Helvetica, sans-serif" }}>
      {p.fondo.map(([x, y, w, h, col], i) => (
        <div key={i} style={{ position: 'absolute', left: `${x}pt`, top: `${y}pt`, width: `${w}pt`, height: `${h}pt`, background: col }} />
      ))}
      {p.logo.map(([x, y, w, h], i) => (
        <div key={i} style={{ position: 'absolute', left: `${x}pt`, top: `${y}pt`, width: `${w}pt`, height: `${h}pt` }}>
          <img src={logo} alt="Anima Beyond Fantasy" style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
        </div>
      ))}
      {pagina === 'resumen' && retrato && (
        <img class="pdf-retrato" src={retrato} alt="Imagen del personaje"
          style={{ position: 'absolute', left: `${CAJA_RETRATO.x}pt`, top: `${CAJA_RETRATO.y}pt`, width: `${CAJA_RETRATO.w}pt`, height: `${CAJA_RETRATO.h}pt`, objectFit: 'contain' }} />
      )}
      {p.textos.map((t, i) => {
        const v = t.text !== undefined ? t.text : t.ref ? valores[t.ref] : undefined;
        if (v === null || v === undefined || v === '') return null;
        let ha = t.h_align;
        if (ha === 'general') ha = typeof v === 'number' ? 'right' : 'left';
        ha = ALIGN_H[ha] ?? ha;
        const w = !t.wrap && ha === 'left' ? t.max_w : t.w;
        const tramos = Array.isArray(v);
        const caja: CSSProperties = {
          position: 'absolute', left: `${t.x}pt`, top: `${t.y}pt`, width: `${w}pt`, height: `${t.h}pt`, display: 'flex',
          alignItems: ALIGN_V[t.v_align] ?? 'flex-end', justifyContent: JUSTIFY[ha as keyof typeof JUSTIFY] ?? 'flex-start',
          overflow: t.wrap ? 'hidden' : 'visible', fontSize: `${tramos ? pdfSize(10) : t.size}pt`, lineHeight: 1.28, letterSpacing: '0.0025em',
          fontWeight: t.bold && !tramos ? 700 : 400, fontStyle: t.italic ? 'italic' : 'normal', color: t.color, padding: '0 1.5pt', boxSizing: 'border-box',
        };
        return (
          <div key={i} style={caja}>
            <span style={{ whiteSpace: t.wrap ? 'pre-wrap' : 'pre', textAlign: ha as CSSProperties['textAlign'], width: t.wrap ? '100%' : undefined }}>
              {tramos
                ? (v as Tramo[]).map((r, j) => <span key={j} style={{ fontWeight: r.b ? 700 : 400, fontSize: `${pdfSize(r.pt)}pt` }}>{r.t}</span>)
                : fmt(v as Valor)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
