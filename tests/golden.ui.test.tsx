// @vitest-environment happy-dom
// Humo de interfaz con fichas reales de golden/ (importadas con leerFicha): todas las secciones, el modo juego, el compendio
// con «Mi personaje» y la vista de impresión deben pintarse sin excepciones ni textos rotos (#N/A, NaN, undefined…).
// Uso:  FICHA="Katarina" npx vitest run tests/golden.ui.test.tsx      (sin FICHA, todas las que no son las 3 de base)
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, listas, motor } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
vi.mock('../src/engine', () => ({
  motor: signal('listo'), errorMotor: signal(''), valores, abierta,
  formulaLista: (c: string) => LISTAS[c],
  async abrir(id: string, entradas: Record<string, Entrada>) {
    if (abierta.value === id) return;
    abierta.value = id; motor().cargar(entradas); valores.value = motor().hojas(HOJAS_VISIBLES);
  },
  async poner(clave: string, v: Entrada | null) { valores.value = { ...valores.value, ...motor().poner(clave, v) }; },
  async opciones(clave: string, formula = LISTAS[clave]) { return formula ? motor().lista(formula, clave.slice(0, clave.lastIndexOf('!'))) : []; },
}));

const store = await import('../src/store');
const { leerFicha } = await import('../src/import/xlsm');
const { FichaView } = await import('../src/ui/FichaView');
const { Juego } = await import('../src/ui/Juego');
const { Compendio } = await import('../src/ui/Compendio');
const { Imprimir } = await import('../src/ui/Imprimir');

const RAIZ = join(import.meta.dirname, '..');
const BASE = ['ayane.xlsm', 'lock.xlsm', 'sesshomaru.xlsm'];
const filtro = (process.env.FICHA ?? '').toLowerCase();
const archivos = readdirSync(join(RAIZ, 'golden')).filter((f) => f.endsWith('.xlsm') && !f.startsWith('~$') && !BASE.includes(f)).filter((f) => f.toLowerCase().includes(filtro));
const SECCIONES = ['principal', 'trasfondo', 'desarrollo', 'ventajas', 'combate', 'ki', 'tecnicas', 'magia', 'metamagia', 'grimorios', 'psiquica', 'sheele', 'elan', 'equipo', 'notas', 'personalizacion'];
const ROTO = /#(N\/A|VALUE!|REF!|DIV\/0!|NUM!|NAME\?|CICLO!|ERROR!)|\bNaN\b|\bundefined\b|\[object /;

beforeAll(() => { motor(); }, 120_000);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

describe.skipIf(!archivos.length)('interfaz con fichas reales (golden/)', () => {
  it.each(archivos)('%s', async (f) => {
    const { entradas, version, avisos } = leerFicha(new Uint8Array(readFileSync(join(RAIZ, 'golden', f))));
    const ficha = store.importar(JSON.stringify({ version: 2, id: crypto.randomUUID(), entradas, notas: '', actualizada: new Date().toISOString() }));
    const errores: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => { errores.push(a.map(String).join(' ').slice(0, 200)); });
    const problemas: string[] = [];
    const listo = () => waitFor(() => expect(document.querySelector('.banner, .aviso-muestra')).toBeNull(), { timeout: 30_000 });
    const revisar = (donde: string) => {
      const t = document.body.textContent ?? '';
      const m = [...t.matchAll(new RegExp(ROTO, 'g'))].map((x) => x[0]);
      // los avisos del Excel pueden nombrar errores; solo cuenta si aparece en celdas de datos
      if (m.length) problemas.push(`${donde}: texto roto ${[...new Set(m)].join(', ')}`);
    };
    for (const s of SECCIONES) {
      try {
        const r = render(<FichaView id={ficha.id} seccion={s} />);
        await listo();
        revisar(`sección ${s}`);
        r.unmount(); abierta.value = null;
      } catch (e) { problemas.push(`sección ${s}: ${(e as Error).message.slice(0, 160)}`); cleanup(); abierta.value = null; }
    }
    for (const [nombre, el] of [['modo juego', () => <Juego id={ficha.id} />], ['compendio', () => <Compendio id={ficha.id} />], ['impresión', () => <Imprimir id={ficha.id} />]] as const) {
      try {
        const r = render(el());
        await waitFor(() => expect(document.querySelector('.juego, .tabs, .imprimir .pdf-hojas')).toBeTruthy(), { timeout: 30_000 });
        if (nombre === 'compendio') { const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Mi personaje'); if (b) fireEvent.click(b); }
        revisar(nombre);
        r.unmount(); abierta.value = null;
      } catch (e) { problemas.push(`${nombre}: ${(e as Error).message.slice(0, 160)}`); cleanup(); abierta.value = null; }
    }
    const informe = { ficha: f, version, problemas, erroresConsola: [...new Set(errores)].slice(0, 20) };
    if (process.env.INFORME_DIR) { mkdirSync(process.env.INFORME_DIR, { recursive: true }); writeFileSync(join(process.env.INFORME_DIR, `ui-${f.replace(/\W+/g, '_')}.json`), JSON.stringify(informe, null, 1)); }
    process.stdout.write(`[golden-ui] ${f} v${version}: problemas ${problemas.length}${problemas.length ? ' · ' + problemas.slice(0, 6).join(' | ') : ''} · errores de consola ${informe.erroresConsola.length}\n`);
    // una ficha de gremio con otra disposición (filas añadidas) lee sus datos desplazados: solo se informa
    if (avisos.some((a) => a.startsWith('La disposición'))) return;
    expect(problemas, problemas.join('\n')).toEqual([]);
    expect(informe.erroresConsola).toEqual([]);
  }, 600_000);
});
