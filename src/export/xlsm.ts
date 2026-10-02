// Escribe una ficha en una plantilla base de Excel (.xlsm 8.7.0): copia el libro tal cual (macros, estilos, fórmulas,
// imágenes) y solo reescribe las celdas de entrada de las hojas de la ficha. Excel recalcula al abrir (fullCalcOnLoad).
// Es la operación inversa de src/import/xlsm.ts (leerFicha). Las celdas con fórmula nunca se tocan.
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import mapa from '../data/migracion.json';
import type { Entrada, Entradas } from '../engine/libro';

const M = mapa as unknown as { entradas: Record<string, string>; defectos: Entradas };

const col = (letras: string) => [...letras].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const letras = (n: number): string => (n > 26 ? letras(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(65 + ((n - 1) % 26));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attrs = (s: string) => Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

/** XML de una celda con su valor (undefined = vacía, conservando el estilo). */
function celda(ref: string, estilo: string | undefined, v: Entrada | undefined): string {
  const s = estilo ? ` s="${estilo}"` : '';
  if (v === undefined || v === '') return `<c r="${ref}"${s}/>`;
  if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
  if (typeof v === 'boolean') return `<c r="${ref}"${s} t="b"><v>${v ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

/** Reescribe en el XML de una hoja las celdas de `destino` (clave "A1"), sin tocar las que tienen fórmula. */
export function reescribirHoja(xml: string, destino: Map<string, Entrada | undefined>): string {
  const porFila = new Map<number, Map<number, Entrada | undefined>>();
  for (const [ref, v] of destino) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
    const f = +m[2];
    if (!porFila.has(f)) porFila.set(f, new Map());
    porFila.get(f)!.set(col(m[1]), v);
  }
  const abre = xml.indexOf('<sheetData'), cierra = xml.indexOf('</sheetData>');
  if (abre < 0 || cierra < 0) {
    if (/<sheetData\s*\/>/.test(xml)) return reescribirHoja(xml.replace(/<sheetData\s*\/>/, '<sheetData></sheetData>'), destino);
    throw new Error('hoja sin datos');
  }
  const inicio = xml.indexOf('>', abre) + 1;
  const filas: [number, string][] = [];
  for (const m of xml.slice(inicio, cierra).matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    filas.push([+(attrs(m[1]).r ?? 0), m[0]]);
  }
  const resultado = new Map<number, string>(filas);
  for (const [fila, cols] of porFila) {
    const previa = resultado.get(fila);
    const cab = previa ? /<row\b([^>]*?)(?:\/>|>)/.exec(previa)![1].replace(/\s*\/$/, '').replace(/\sspans="[^"]*"/, '') : ` r="${fila}"`;
    const existentes = new Map<number, string>();
    for (const c of (previa ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g)) {
      const r = /^([A-Z]+)\d+$/.exec(attrs(c[1]).r ?? '');
      if (r) existentes.set(col(r[1]), c[0]);
    }
    for (const [c, v] of cols) {
      const actual = existentes.get(c);
      if (actual && /<f\b/.test(actual)) continue;                        // fórmula: no se pisa
      const estilo = actual ? attrs(/<c\b([^>]*?)(?:\/>|>)/.exec(actual)![1]).s : undefined;
      existentes.set(c, celda(`${letras(c)}${fila}`, estilo, v));
    }
    const orden = [...existentes.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('');
    resultado.set(fila, `<row${cab}>${orden}</row>`);
  }
  const cuerpo = [...resultado.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('');
  return xml.slice(0, inicio) + cuerpo + xml.slice(cierra);
}

/** Libro de Excel con la ficha escrita sobre la plantilla base. Lanza Error si la base no es una ficha de Anima. */
export function escribirFicha(base: Uint8Array, entradas: Entradas): Uint8Array {
  let zip: Record<string, Uint8Array>;
  try { zip = unzipSync(base); } catch { throw new Error('la plantilla base no es un archivo Excel (.xlsm/.xlsx)'); }
  const leer = (p: string) => (zip[p] ? strFromU8(zip[p]) : '');
  const wb = leer('xl/workbook.xml');
  if (!wb) throw new Error('la plantilla base no es un archivo Excel (.xlsm/.xlsx)');
  const destinos = Object.fromEntries([...leer('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)>/g)].map((m) => attrs(m[1])).map((a) => [a.Id, a.Target]));
  const rutas: Record<string, string> = {};
  for (const m of wb.matchAll(/<sheet\b([^>]*)>/g)) {
    const a = attrs(m[1]), t = destinos[a['r:id']];
    if (t) rutas[a.name.replace(/&amp;/g, '&')] = t.startsWith('/') ? t.slice(1) : 'xl/' + t;
  }
  if (!rutas.Principal || !rutas.General) throw new Error('la plantilla base no parece una ficha de Anima (faltan las hojas Principal y General)');

  for (const [hoja, celdas] of Object.entries(M.entradas)) {
    const ruta = rutas[hoja];
    if (!ruta || !zip[ruta]) continue;
    const destino = new Map<string, Entrada | undefined>();
    for (const c of celdas.split(' ')) {
      const k = `${hoja}!${c}`;
      destino.set(c, entradas[k] ?? M.defectos[k]);     // lo que la ficha no define vuelve al valor de la plantilla
    }
    zip[ruta] = strToU8(reescribirHoja(strFromU8(zip[ruta]), destino));
  }

  // Excel recalcula al abrir; se quita calcChain (apunta a celdas que han cambiado) para que no pida reparar el libro
  zip['xl/workbook.xml'] = strToU8(/<calcPr\b/.test(wb)
    ? wb.replace(/<calcPr\b([^>]*?)(\/?)>/, (_, a: string, c: string) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"${c}>`)
    : wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>'));
  if (zip['xl/calcChain.xml']) {
    delete zip['xl/calcChain.xml'];
    zip['[Content_Types].xml'] = strToU8(leer('[Content_Types].xml').replace(/<Override\b[^>]*calcChain[^>]*\/>/, ''));
    zip['xl/_rels/workbook.xml.rels'] = strToU8(leer('xl/_rels/workbook.xml.rels').replace(/<Relationship\b[^>]*calcChain[^>]*\/>/, ''));
  }
  return zipSync(zip, { level: 6 });
}
