// @vitest-environment happy-dom
// PDF: la página del Resumen que pinta la web con los valores golden de cada ficha.
// También escribe ref/pdf/web/<ficha>.html para compararlo con el PDF del Excel (python tools/pdf_check.py).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/preact';
import { mkdirSync, writeFileSync } from 'node:fs';
import { HOJAS_VISIBLES, motor, read } from './helpers';
import { PaginaPdf, type ValorPdf } from '../src/pdf/Pagina';
import { tramosNotas } from '../src/pdf/notas';
import type { Valor } from '../src/engine/libro';

const FICHAS = ['sesshomaru', 'lock', 'ayane'] as const;
const OP = { idiomas: true, notas: true };

function paginas(n: (typeof FICHAS)[number]) {
  // valores del motor (los golden van recortados de espacios; el Excel rellena con espacios, p. ej. '   130')
  const m = motor();
  m.cargar(read(`ref/fichas/${n}.json`).entradas);
  const valores = m.hojas(HOJAS_VISIBLES) as Record<string, Valor>;
  const datos: Record<string, ValorPdf> = { ...valores, 'Resumen!D112': tramosNotas(valores, OP) };
  const html = (p: 'resumen' | 'notas') => { const r = render(<PaginaPdf pagina={p} valores={datos} logo="../../../public/logo-anima.jpg" />); const h = r.container.innerHTML; r.unmount(); return h; };
  return { valores, resumen: html('resumen'), notas: html('notas') };
}

describe('página del PDF (Resumen)', () => {
  it.each(FICHAS)('%s: pinta cada texto de su celda del Resumen', (n) => {
    const { valores, resumen, notas } = paginas(n);
    const texto = resumen.replace(/<[^>]+>/g, '|');
    expect(texto).toContain('Anima Beyond Fantasy');
    for (const clave of ['Resumen!M3', 'Resumen!F11', 'Resumen!L11']) {
      const v = valores[clave];
      if (v !== undefined && v !== null && v !== '') expect(texto, clave).toContain(String(v).replace(/&/g, '&amp;'));
    }
    expect(resumen).toMatch(/width:\s*595\.32pt/);
    expect(notas).toContain('NOTAS');
    mkdirSync('ref/pdf/web', { recursive: true });
    writeFileSync(`ref/pdf/web/${n}.html`,
      '<!doctype html><meta charset="utf-8"><title>' + n + '</title><style>@page{size:A4;margin:0}body{margin:0;background:#888}' +
      '.page{width:595.32pt;height:841.92pt;margin:0 auto 12px;break-after:page}@media print{body{background:#fff}.page{margin:0}}</style>' +
      `<div class="page">${resumen}</div><div class="page">${notas}</div>`.replace(/src="[^"]*logo-anima\.jpg"/g, 'src=""'));
  }, 120_000);

  it('las notas llevan título en negrita y el texto de cada sección, y se pueden apagar', () => {
    const v = { 'Principal!C67': 'Idiomas', 'Principal!E78': 'Latín, Yamato', 'Principal!G67': 'Notas', 'Principal!G68': 'Hola', 'Ki!C66': 'Ki', 'Ki!C67': 'Técnica' } as Record<string, Valor>;
    const t = tramosNotas(v, OP);
    expect(t.filter((x) => x.b).map((x) => x.t)).toEqual(['Idiomas', 'Notas', 'Ki']);
    expect(t.map((x) => x.t).join('')).toContain('Latín, Yamato');
    expect(tramosNotas(v, { idiomas: false, notas: false })).toEqual([]);
  });
});
