// @vitest-environment happy-dom
// Cobertura: cada casilla de entrada del Excel de una hoja tiene su casilla en la web.
// Antes se rellenan TODAS las casillas de la hoja (con "x") para que se vean las filas condicionales.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, inventario, listas, motor, read } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
vi.mock('../src/engine', () => ({
  motor: signal('listo'), errorMotor: signal(''), valores, abierta, formulaLista: (c: string) => LISTAS[c],
  async abrir(id: string, e: Record<string, Entrada>) { abierta.value = id; motor().cargar(e); valores.value = motor().hojas(HOJAS_VISIBLES); },
  async poner(c: string, v: Entrada | null) { valores.value = { ...valores.value, ...motor().poner(c, v) }; },
  async opciones(c: string, f = LISTAS[c]) { return f ? motor().lista(f, c.slice(0, c.lastIndexOf('!'))) : []; },
}));
const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');

beforeAll(() => { motor(); }, 120_000);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

/** Una ficha con TODAS las casillas de entrada de la hoja rellenas: hace visibles las filas condicionales. */
function llenarTodo(hoja: string): Record<string, Entrada> {
  const e: Record<string, Entrada> = {};
  for (const x of inventario()[hoja]) e[`${hoja}!${x.celda}`] = 'x';
  e['Ki!Q37'] = 10; // "Ataque elemental" comprado: muestra sus selectores
  return e;
}

// Huecos conocidos: celdas de entrada que aún no tienen casilla (se vacía al completar los pasos 8 y 9).
const EQUIPO_GENERAL = /^General!(AD10|A[FJL]1[1-9]|A[FJL]2[0-9]|A[FJL]30|X(1[2-9]|2[0-9]|3[0-2]|35|37|39|41|43|5[2-5])|A[BD](1[6-9]|2[0-9]|3[0-2])|AA(35|37|39|41|43)|AF(5[2-5]|64)|AI(58|59|60)|AL(58|59)|AB59|AK63)$/;
const HUECOS: Record<string, (c: string) => boolean> = {
  General: (c) => c === 'General!M5' || EQUIPO_GENERAL.test(c), // retrato (paso 9) y equipo/artefactos/contactos (paso 8)
};

const SECCIONES: [string, string[]][] = [
  ['Principal', ['principal', 'trasfondo', 'desarrollo', 'ventajas', 'combate']],
  ['General', ['principal', 'trasfondo']],
  ['PDs', ['principal', 'desarrollo', 'ventajas']],
  ['Combate', ['combate']],
  ['Ki', ['ki']],
  ['Creación de Técnicas', ['tecnicas']],
];

describe('cobertura de casillas', () => {
  it.each(SECCIONES)('%s: toda celda de entrada del Excel tiene su casilla', async (hoja, secciones) => {
    const f = store.importar(JSON.stringify(read('ref/fichas/lock.json')));
    for (const [k, v] of Object.entries(llenarTodo(hoja))) store.editar(f.id, k, v);
    const dentro = new Set<string>();
    for (const sec of secciones) {
      const r = render(<FichaView id={f.id} seccion={sec} />);
      await waitFor(() => { if (!document.querySelector('[data-clave]')) throw new Error('aún no'); }, { timeout: 30_000 });
      await new Promise((x) => setTimeout(x, 800));
      // columnas opcionales (especialidad, bonos naturales y novel) detrás de una casilla de verificación
      document.querySelectorAll<HTMLInputElement>('.check input[type=checkbox]').forEach((c) => {
        if (/Especialidad/.test(c.parentElement?.textContent ?? '') && !c.checked) fireEvent.click(c);
      });
      await new Promise((x) => setTimeout(x, 300));
      document.querySelectorAll('[data-clave]').forEach((e) => dentro.add(e.getAttribute('data-clave')!));
      r.unmount();
      abierta.value = null;
    }
    const hueco = HUECOS[hoja] ?? (() => false);
    const faltan = inventario()[hoja].map((x) => `${hoja}!${x.celda}`).filter((c) => !dentro.has(c) && !hueco(c));
    expect(faltan).toEqual([]);
  }, 300_000);
});
