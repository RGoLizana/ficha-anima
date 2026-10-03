import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { editar } from '../store';
import { formulaLista, opciones, valores, type Valor } from '../engine';
import type { Ficha } from '../model/ficha';

/** Valor calculado de una celda, tal como lo muestra el Excel. */
export const v = (clave: string): Valor => valores.value[clave] ?? null;
export const txt = (clave: string) => {
  const x = v(clave);
  return x === null || x === undefined ? '' : String(x).trim();
};

type Props = {
  f: Ficha;
  clave: string;               // "Hoja!A1"
  label: ComponentChildren;
  tipo?: 'texto' | 'numero' | 'lista' | 'area';
  lista?: string;              // fórmula de las opciones; por defecto, el desplegable de esa celda en el Excel
  fijas?: string[];            // opciones ya conocidas (sustituyen a la lista del Excel)
  excluir?: string[];          // opciones que no se ofrecen (p.ej. ya elegidas en otra casilla)
  sinTab?: boolean;            // fuera del orden del tabulador (se edita con clic)
  class?: string;
};

/** Casilla editable ligada a una celda de entrada del Excel. Vacía = valor por defecto de la plantilla. */
export function Campo({ f, clave, label, tipo, lista, fijas, excluir = [], sinTab, class: cls }: Props) {
  const formula = fijas ? undefined : lista ?? formulaLista(clave);
  tipo ??= formula || fijas ? 'lista' : 'texto';
  const actual = f.entradas[clave] ?? v(clave) ?? '';
  const [ops, setOps] = useState<string[]>(fijas ?? []);
  const cargar = () => { if (fijas) setOps(fijas); else if (formula) opciones(clave, formula).then(setOps).catch(() => setOps([])); };
  // la lista puede depender de otros datos de la ficha (p.ej. PD de un arte marcial según su grado):
  // se recarga en cuanto cambia cualquier valor calculado, no al abrir el desplegable (llegaría tarde)
  useEffect(cargar, [clave, formula, formula ? valores.value : null, fijas?.join('|')]);

  const guardar = (raw: string) => {
    if (tipo === 'numero') {
      const n = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
      editar(f.id, clave, n === null || Number.isNaN(n) ? null : n);
    } else if (tipo === 'lista' && /^-?\d+(\.\d+)?$/.test(raw)) {
      editar(f.id, clave, Number(raw)); // opciones numéricas (p.ej. coste de una tabla): número, no texto
    } else {
      editar(f.id, clave, raw === '' ? null : raw);
    }
  };

  const id = `c-${clave.replace(/[^A-Za-z0-9]/g, '_')}`;
  let control;
  if (tipo === 'lista') {
    const libres = ops.filter((o) => o === String(actual) || !excluir.includes(o));
    const opts = actual !== '' && !libres.includes(String(actual)) ? [String(actual), ...libres] : libres;
    control = (
      <select id={id} value={String(actual)} onChange={(e) => guardar(e.currentTarget.value)}>
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o} disabled={o.startsWith('>') || o.startsWith('--')}>{o}</option>)}
      </select>
    );
  } else if (tipo === 'area') {
    control = <textarea id={id} rows={4} value={String(actual)} onChange={(e) => guardar(e.currentTarget.value)} />;
  } else if (tipo === 'numero') {
    control = <input id={id} type="number" inputMode="numeric" tabIndex={sinTab ? -1 : undefined} value={String(actual)} onChange={(e) => guardar(e.currentTarget.value)} />;
  } else {
    control = <input id={id} type="text" value={String(actual)} onChange={(e) => guardar(e.currentTarget.value)} />;
  }
  return (
    <div class={'field ' + (cls ?? '')} data-clave={clave}>
      <label for={id}>{label}</label>
      {control}
    </div>
  );
}

/** Valor calculado con su etiqueta. */
export function Dato({ clave, label, sub, big }: { clave: string; label: string; sub?: string; big?: boolean }) {
  return (
    <div class={'tile' + (big ? ' tile-big' : '')}>
      <div class="muted small">{label}</div>
      <div class={big ? 'big' : 'mid'}>{txt(clave) || '—'}</div>
      {sub && <div class="muted small">{sub}</div>}
    </div>
  );
}

export function Panel({ title, children, extra }: { title: string; children: ComponentChildren; extra?: ComponentChildren }) {
  return (
    <section class="panel stack">
      <div class="row between wrap">
        <h2 class="panel-title">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

// Texto de aviso calculado por el propio Excel (p.ej. "Exceso de PDs gastados"): se muestra, nunca se bloquea
const ES_AVISO = /exceso|excedido|faltan|insuficiente|no debe superar/i;

/** Avisos y notas que el Excel calcula en unas celdas; solo aparecen si tienen texto.
 *  "A+B" une dos celdas en un mensaje (p.ej. el texto y la cifra). */
export function Avisos({ claves, todos }: { claves: string[]; todos?: boolean }) {
  const textos = claves.map((c) => (txt(c.split('+')[0]) ? c.split('+').map(txt).join(' ') : '')).filter(Boolean);
  if (!textos.length) return null;
  return (
    <div class="stack-sm">
      {textos.map((t) => <p key={t} class={todos || ES_AVISO.test(t) ? 'aviso' : 'nota'} role="status">{t}</p>)}
    </div>
  );
}

/** Compra de una habilidad del Excel: casilla si su lista tiene una sola opción (el coste), desplegable si tiene varias. */
export function Compra({ f, clave, label, class: cls }: { f: Ficha; clave: string; label?: ComponentChildren; class?: string }) {
  const formula = formulaLista(clave);
  const [ops, setOps] = useState<string[] | null>(null);
  useEffect(() => {
    if (formula) opciones(clave, formula).then(setOps).catch(() => setOps([]));
  }, [clave, formula, formula ? valores.value : null]);
  if (!formula) return null;
  if (ops && ops.length > 1) return <Campo f={f} clave={clave} label={label ?? clave} tipo="lista" class={cls} />;
  const marcado = f.entradas[clave] !== undefined && f.entradas[clave] !== '';
  const valor = ops?.[0];
  const num = valor !== undefined && valor !== '' && !Number.isNaN(Number(valor));
  return (
    <label class={'check ' + (cls ?? '')} data-clave={clave}>
      <input type="checkbox" checked={marcado} disabled={!marcado && !valor}
        onChange={(e) => editar(f.id, clave, e.currentTarget.checked && valor ? (num ? Number(valor) : valor) : null)} />
      <span>{label ?? valor}</span>
    </label>
  );
}

/** Marca de lo que aún no está hecho. */
export function Proximamente({ texto }: { texto?: string }) {
  return <span class="proximamente" title={texto ?? 'Todavía no está disponible'}>Próximamente</span>;
}
