// @vitest-environment happy-dom
// Interfaz con el motor real (sin worker): lo que el usuario ve y toca en cada sección.
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { HOJAS_VISIBLES, celdasEntrada, golden, listas, motor, read, type NombreFicha } from './helpers';
import type { Entrada, Valor } from '../src/engine/libro';

// Motor en el mismo hilo: misma API que src/engine/index.ts pero síncrono por dentro
const LISTAS = listas();
const valores = signal<Record<string, Valor>>({});
const abierta = signal<string | null>(null);
vi.mock('../src/engine', () => ({
  motor: signal('listo'),
  errorMotor: signal(''),
  valores,
  abierta,
  formulaLista: (c: string) => LISTAS[c],
  async abrir(id: string, entradas: Record<string, Entrada>) {
    if (abierta.value === id) return;
    abierta.value = id;
    motor().cargar(entradas);
    valores.value = motor().hojas(HOJAS_VISIBLES);
  },
  async poner(clave: string, v: Entrada | null) {
    valores.value = { ...valores.value, ...motor().poner(clave, v) };
  },
  async opciones(clave: string, formula = LISTAS[clave]) {
    return formula ? motor().lista(formula, clave.slice(0, clave.lastIndexOf('!'))) : [];
  },
}));

const store = await import('../src/store');
const { FichaView } = await import('../src/ui/FichaView');
const { modoTecnicas } = await import('../src/ui/Tecnicas');
modoTecnicas.value = 'experto';   // estas pruebas miran todas las casillas de la hoja
const { Lista } = await import('../src/ui/Lista');

const T = 120_000;
beforeAll(() => { motor(); }, T);
afterEach(() => { cleanup(); abierta.value = null; valores.value = {}; store.fichas.value = []; });

const { acentoVia } = await import('../src/ui/GrimoriosInfo');
const COLORES = (await import('../src/data/vias-colores.json')).default as Record<string, { f: string[]; t: string | null }>;
const OFICIALES = ['Luz', 'Oscuridad', 'Fuego', 'Agua', 'Aire', 'Tierra', 'Creación', 'Destrucción', 'Esencia', 'Ilusión', 'Nigromancia', 'Caos', 'Guerra', 'Literae', 'Muerte', 'Musical', 'Nobleza', 'Paz', 'Pecado', 'Conocimiento', 'Sangre', 'Sueños', 'Tiempo', 'Umbral', 'Vacío'];

describe('colores de las vías (datos del Excel)', () => {
  it('están todas las vías oficiales con relleno hex, y Libre acceso queda sin color', () => {
    for (const v of OFICIALES) {
      expect(COLORES[v], v).toBeTruthy();
      expect(COLORES[v].f.length).toBeGreaterThan(0);
      for (const c of [...COLORES[v].f, ...(COLORES[v].t ? [COLORES[v].t!] : [])]) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(COLORES['Libre acceso']).toBeUndefined();
    expect(acentoVia('Libre acceso')).toBeNull();
  });

  it('valores conocidos del Excel y acentos legibles sobre fondo oscuro', () => {
    expect(COLORES['Fuego'].f).toEqual(['#FF0000']);
    expect(COLORES['Agua'].f).toEqual(['#00B0F0']);
    expect(COLORES['Oscuridad'].f).toEqual(['#0D0D0D']);
    expect(acentoVia('Fuego')).toBe('#FF0000');
    expect(acentoVia('Oscuridad')).toBe('#00B0F0');   // el relleno es casi negro: se usa el color de texto del Excel
    const lum = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).reduce((a, x, i) => a + [0.2126, 0.7152, 0.0722][i] * (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4), 0);
    for (const v of OFICIALES) expect(lum(acentoVia(v)!), v).toBeGreaterThanOrEqual(0.14);
  });

  const RAIZ = join(import.meta.dirname, '..');
  const XLSM = join(RAIZ, 'golden/lock.xlsm');
  it.skipIf(!existsSync(XLSM))('vias-colores.json coincide con lo que genera tools/export_vias_colores.py', () => {
    const antes = JSON.stringify(COLORES);
    execFileSync('python', ['tools/export_vias_colores.py'], { cwd: RAIZ });
    expect(JSON.stringify(JSON.parse(readFileSync(join(RAIZ, 'src/data/vias-colores.json'), 'utf8')))).toBe(antes);
  });
});

function abrirFicha(n: NombreFicha, seccion = 'principal') {
  const f = store.importar(JSON.stringify(read(`ref/fichas/${n}.json`)));
  const r = render(<FichaView id={f.id} seccion={seccion} />);
  return { f, ...r };
}
const esperarListo = () => waitFor(() => expect(document.querySelector('.banner')).toBeNull(), { timeout: 20_000 });

describe('Todas mis vías: color y progreso por nivel de vía', () => {
  const barra = () => document.querySelector('.desplegable .nivel-barra') as HTMLElement;
  const sinAprender = () => document.querySelectorAll('.arma.info.sin-aprender').length;

  it('Lock: la vía sale con su color y el progreso sube al subir el nivel de vía, desatenuando conjuros', async () => {
    abrirFicha('lock', 'grimorios');
    await esperarListo();
    await waitFor(() => expect(document.querySelectorAll('.desplegable').length).toBeGreaterThanOrEqual(3), { timeout: 20_000 });
    const fuego = document.querySelector('.desplegable') as HTMLElement;
    expect(fuego.textContent).toContain('Fuego');
    expect(fuego.classList.contains('con-via')).toBe(true);
    expect(fuego.style.getPropertyValue('--via').toUpperCase()).toBe('#FF0000');
    expect(barra().getAttribute('aria-label')).toBe('Nivel de la vía Fuego');
    fireEvent.click(fuego.querySelector('.desp-cab')!);
    await waitFor(() => expect(sinAprender()).toBeGreaterThan(0));
    const nivel0 = Number(barra().getAttribute('aria-valuenow'));
    const bloqueados0 = sinAprender();
    expect(nivel0).toBeGreaterThan(0);
    expect(barra().getAttribute('aria-valuetext')).toBe(`nivel ${nivel0} de 100`);
    expect(fuego.textContent).toContain(`nivel ${nivel0} de 100`);
    expect(document.querySelector('.arma.info.bloqueado')!.textContent).toContain('Bloqueado: requiere nivel de vía');
    const { poner } = await import('../src/engine');
    await poner('Místicos!G15', 400);
    await waitFor(() => expect(Number(barra().getAttribute('aria-valuenow'))).toBeGreaterThan(nivel0));
    expect(sinAprender()).toBeLessThan(bloqueados0);
    expect((document.querySelector('.desplegable .nivel-relleno') as HTMLElement).style.width).toBe(`${barra().getAttribute('aria-valuenow')}%`);
  }, T);
});
