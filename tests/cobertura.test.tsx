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
const HUECOS: Record<string, (c: string) => boolean> = {
  General: (c) => c === 'General!M5', // retrato (paso 9)
  // celdas desbloqueadas sin uso: ninguna fórmula del libro las lee (fila 77 tras el 5.º efecto de Ki, filas 129 y 132 bajo el Elan)
  'Personalización': (c) => /^Personalización![A-Q](77|129|132)$/.test(c),
};

const SECCIONES: [string, string[]][] = [
  ['Principal', ['principal', 'trasfondo', 'desarrollo', 'ventajas', 'combate']],
  ['General', ['principal', 'trasfondo', 'equipo']],
  ['PDs', ['principal', 'desarrollo', 'ventajas']],
  ['Combate', ['combate']],
  ['Ki', ['ki']],
  ['Creación de Técnicas', ['tecnicas']],
  ['Místicos', ['magia']],
  ['Metamagia', ['metamagia']],
  ['Grimorio Magia', ['grimorios']],
  ['Grimorio de Vía', ['grimorios']],
  ['Psíquicos', ['psiquica']],
  ['Grimorio Psíquica', ['psiquica']],
  ['Sheele', ['sheele']],
  ['Elan', ['elan']],
  ['Personalización', ['personalizacion']],
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
