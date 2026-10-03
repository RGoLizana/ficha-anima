// Lee una ficha Excel (.xlsm/.xlsx, versiones 8.x) en el navegador y devuelve sus entradas {"Hoja!Celda": valor}.
// Replica tools/extract.py golden() para la 8.7.0 y tools/migrate.py plan() para versiones anteriores
// (mapa de filas por versión en src/data/migracion.json, que genera tools/export_migracion.py).
import { unzipSync, strFromU8 } from 'fflate';
import mapa from '../data/migracion.json';
import type { Entrada, Entradas } from '../engine/libro';

interface Version { filas: Record<string, number[][]>; mover: Record<string, number[][]> }
const M = mapa as unknown as {
  entradas: Record<string, string>; defectos: Entradas;
  versiones: Record<string, Version>; renombres: Record<string, string>; anclas: Record<string, Record<string, string>>;
};
const ACTUAL = '8.7.0';
// Casillas de versiones antiguas que la 8.7.0 ya no tiene y que no cambian ningún cálculo: no se avisa de ellas.
//  Sheele!S23 (8.4.x): «En 'Resumen': Sí/No»; la 8.7.0 ya no tiene ese interruptor.
const OBSOLETAS = new Set(['Sheele!S23']);
const ENTRADAS = new Set(Object.entries(M.entradas).flatMap(([h, cs]) => cs.split(' ').map((c) => `${h}!${c}`)));

export interface Importada { entradas: Entradas; version: string; avisos: string[] }

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const texto = (s: string) => s.replace(/\r\n?/g, '\n') // como un parser XML
  .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m)
  .replace(/_x([0-9A-F]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))); // escape de Excel (_x000D_)
const atributos = (s: string) => Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], texto(m[2])]));
const runs = (xml: string) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => texto(m[1])).join('');

const col = (letras: string) => [...letras].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const letras = (n: number): string => (n > 26 ? letras(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(65 + ((n - 1) % 26));
/** Como clean() de extract.py: quita el ruido de coma flotante de Excel. */
const numero = (v: string) => Number(Number(v).toFixed(9));

interface Celda { fila: number; col: number; valor: Entrada | undefined; formula: boolean; libre: boolean }

function celdas(xml: string, sst: string[], libres: boolean[]): Celda[] {
  const out: Celda[] = [];
  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const a = atributos(m[1]), cuerpo = m[2] ?? '';
    const ref = /^([A-Z]+)(\d+)$/.exec(a.r ?? '');
    if (!ref) continue;
    const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
    let valor: Entrada | undefined;
    if (a.t === 's') valor = v === undefined ? undefined : sst[+v];
    else if (a.t === 'inlineStr') valor = runs(cuerpo);
    else if (a.t === 'str') valor = v === undefined ? undefined : texto(v);
    else if (a.t === 'b') valor = v === '1';
    else if (a.t !== 'e' && v !== undefined) valor = numero(v);
    out.push({ fila: +ref[2], col: col(ref[1]), valor, formula: /<f\b/.test(cuerpo), libre: libres[+(a.s ?? 0)] ?? false });
  }
  return out;
}

/** Hojas del libro: nombre -> XML. Lanza Error si no es un Excel o no es una ficha de Anima. */
function abrir(datos: Uint8Array) {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(datos, { filter: (f) => f.name.startsWith('xl/') && /\.(xml|rels)$/.test(f.name) });
  } catch {
    throw new Error('no es un archivo Excel (.xlsx/.xlsm)');
  }
  const leer = (p: string) => (zip[p] ? strFromU8(zip[p]) : '');
  const wb = leer('xl/workbook.xml');
  if (!wb) throw new Error('no es un archivo Excel (.xlsx/.xlsm)');
  const destinos = Object.fromEntries([...leer('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)>/g)]
    .map((m) => atributos(m[1])).map((a) => [a.Id, a.Target]));
  const hojas: Record<string, string> = {};
  for (const m of wb.matchAll(/<sheet\b([^>]*)>/g)) {
    const a = atributos(m[1]), t = destinos[a['r:id']];
    if (t) hojas[a.name] = leer(t.startsWith('/') ? t.slice(1) : 'xl/' + t);
  }
  if (!hojas.Principal || !hojas.General) throw new Error('no parece una ficha de Anima (faltan las hojas Principal y General)');
  const sst = [...leer('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => runs(m[1]));
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(leer('xl/styles.xml'))?.[1] ?? '';
  const libres = [...xfs.matchAll(/<xf\b[^>]*?(?:\/>|>([\s\S]*?)<\/xf>)/g)].map((m) => /locked="(0|false)"/.test(m[1] ?? ''));
  return { hojas, sst, libres };
}

export function leerFicha(datos: Uint8Array): Importada {
  const { hojas, sst, libres } = abrir(datos);
  const version = sst.map((s) => /Ficha Excel\. Versi[oó]n (\d+\.\d+\.\d+)/.exec(s)?.[1]).find(Boolean) ?? '';
  const mig = M.versiones[version];
  const avisos: string[] = [];
  if (!mig && version !== ACTUAL) avisos.push(`Versión de la ficha ${version || 'desconocida'}: se lee como la ${ACTUAL}.`);
  const entradas: Entradas = mig ? Object.fromEntries(Object.entries(M.defectos).filter(([k]) => ENTRADAS.has(k))) : {};
  const saltadas: string[] = [];
  const muestra = (v: Entrada) => (typeof v === 'string' && v.length > 20 ? JSON.stringify(v.slice(0, 20) + '…') : JSON.stringify(v));

  const desplazadas: string[] = [];
  for (const hoja of Object.keys(M.entradas)) {
    const xml = hojas[hoja];
    if (xml === undefined) continue;
    const cs = celdas(xml, sst, libres);
    if (!mig) { // ficha 8.7.0: ¿las etiquetas fijas siguen en su sitio? (un gremio puede haber añadido filas o columnas)
      const ancla = M.anclas?.[hoja] ?? {};
      const textos = new Map(cs.map((c) => [`${letras(c.col)}${c.fila}`, typeof c.valor === 'string' ? c.valor.split(/\s+/).filter(Boolean).join(' ') : '']));
      const claves = Object.keys(ancla);
      const mal = claves.filter((k) => textos.get(k) !== ancla[k]).length;
      if (claves.length && mal / claves.length >= 0.4) desplazadas.push(hoja);
    }
    for (const c of cs) {
      const v = c.valor;
      if (v === undefined || v === '' || c.formula) continue;
      const origen = `${hoja}!${letras(c.col)}${c.fila}`;
      if (!mig) { // 8.7.0: solo las celdas de entrada de la plantilla
        if (ENTRADAS.has(origen)) entradas[origen] = v;
        continue;
      }
      // versión anterior: como migrate.plan()
      if (!c.libre || (hoja === 'Resumen' && c.col >= 40)) continue;
      const valor = typeof v === 'string' ? M.renombres[v] ?? v : v;
      let destino: string | undefined;
      const mv = (mig.mover[hoja] ?? []).find(([r0, r1, c0, c1]) => c.fila >= r0 && c.fila <= r1 && c.col >= c0 && c.col <= c1);
      if (mv) destino = `${hoja}!${letras(c.col + mv[5])}${c.fila + mv[4]}`;
      else {
        const t = (mig.filas[hoja] ?? []).find(([a, , n]) => c.fila >= a && c.fila < a + n);
        if (!t) {
          if (M.defectos[origen] !== valor && !OBSOLETAS.has(origen)) saltadas.push(`${origen}=${muestra(valor)} (sin fila en la ${ACTUAL})`);
          continue;
        }
        destino = `${hoja}!${letras(c.col)}${c.fila - t[0] + t[1]}`;
      }
      if (ENTRADAS.has(destino)) entradas[destino] = valor;
      else if (M.defectos[destino] !== valor) saltadas.push(`${origen}=${muestra(valor)} (no es una entrada en la ${ACTUAL})`);
    }
  }
  if (desplazadas.length) avisos.push(`La disposición de ${desplazadas.join(', ')} no es la de la ${ACTUAL} base (¿ficha de gremio con filas o columnas añadidas?): los datos de esas hojas pueden haberse leído desplazados.`);
  if (saltadas.length) avisos.push(`${saltadas.length} celdas no se pudieron importar: ${saltadas.join(', ')}`);
  return { entradas, version, avisos };
}

/** Valores calculados que Excel dejó guardados en cada celda de las hojas de la ficha: {"Hoja!A1": valor} (errores como "#N/A"). */
export function valoresGuardados(datos: Uint8Array): Record<string, Entrada> {
  const { hojas, sst } = abrir(datos);
  const out: Record<string, Entrada> = {};
  for (const [hoja, xml] of Object.entries(hojas)) {
    for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = atributos(m[1]), cuerpo = m[2] ?? '';
      if (!/^[A-Z]+\d+$/.test(a.r ?? '')) continue;
      const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
      let valor: Entrada | undefined;
      if (a.t === 's') valor = v === undefined ? undefined : sst[+v];
      else if (a.t === 'inlineStr') valor = runs(cuerpo);
      else if (a.t === 'str' || a.t === 'e') valor = v === undefined ? undefined : texto(v);
      else if (a.t === 'b') valor = v === '1';
      else if (v !== undefined) valor = numero(v);
      if (valor !== undefined && valor !== '') out[`${hoja}!${a.r}`] = valor;
    }
  }
  return out;
}

/** Versión de la plantilla de un libro de ficha ("8.7.0", "" si no se encuentra). */
export function versionDe(datos: Uint8Array): string {
  return abrir(datos).sst.map((s) => /Ficha Excel\. Versi[oó]n (\d+\.\d+\.\d+)/.exec(s)?.[1]).find(Boolean) ?? '';
}
