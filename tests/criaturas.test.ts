// @vitest-environment happy-dom
// Criaturas atadas y familiares: lógica pura y almacén (sin motor).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

const poner = vi.fn(async () => {});
vi.mock('../src/engine', () => ({ abierta: signal<string | null>(null), poner }));

const store = await import('../src/store');
const { nueva, parse, nivelDe, NOMBRE } = await import('../src/model/ficha');
const C = await import('../src/criaturas');

const convocador = (nivel: number, extra: Record<string, string | number> = {}) => {
  const f = store.crear();
  store.editarVarias(f.id, { [NOMBRE]: 'Tel', 'PDs!O7': 'Mentalista', 'PDs!S7': nivel, ...extra });
  return f.id;
};
const nivelCriatura = (id: string) => nivelDe(store.buscar(id)!);

beforeEach(() => { store.fichas.value = []; poner.mockClear(); });

describe('modelo', () => {
  it('conserva el enlace, descarta el que no vale y las fichas viejas no cambian', () => {
    const f = { ...nueva('Ave'), criatura: { padre: 'p1', familiar: true, nivelAmo: 3 } };
    expect(parse(JSON.parse(JSON.stringify(f))).criatura).toEqual(f.criatura);
    expect(parse(JSON.parse(JSON.stringify(nueva('x')))).criatura).toBeUndefined();
    expect(parse({ version: 2, entradas: {}, criatura: { padre: 5, nivelAmo: 1 } }).criatura).toBeUndefined();
    expect(parse({ version: 2, entradas: {}, criatura: { padre: 'a', nivelAmo: 'x' } }).criatura).toBeUndefined();
    expect(parse({ version: 2, id: 'a', entradas: {}, criatura: { padre: 'a', nivelAmo: 1 } }).criatura).toBeUndefined();
  });
});

describe('nivel y PD', () => {
  it('la criatura empieza con el nivel y la categoría de su convocador (mismos PD)', () => {
    const p = convocador(4);
    const c = store.crearCriatura(p)!;
    expect(nivelCriatura(c.id)).toBe(4);
    expect(c.entradas['PDs!O7']).toBe('Mentalista');
    expect(c.criatura).toEqual({ padre: p, familiar: false, nivelAmo: 4 });
  });

  it('el nivel del convocador es la suma de sus categorías', () => {
    const p = convocador(2, { 'PDs!S9': 3, 'PDs!O9': 'Guerrero' });
    expect(nivelDe(store.buscar(p)!)).toBe(5);
    expect(store.crearCriatura(p)!.entradas['PDs!S7']).toBe(5);
  });

  it('un familiar sube con el convocador (y baja si se corrige), en su categoría actual', () => {
    const p = convocador(3);
    const c = store.crearCriatura(p)!;
    store.editar(c.id, 'PDs!O9', 'Guerrero');
    store.editar(c.id, 'PDs!S9', 1);
    store.marcarFamiliar(c.id, true);
    store.editar(p, 'PDs!S7', 6);
    expect(store.buscar(c.id)!.entradas['PDs!S9']).toBe(4);
    expect(store.buscar(c.id)!.entradas['PDs!S7']).toBe(3);
    expect(store.buscar(c.id)!.criatura!.nivelAmo).toBe(6);
    store.editar(p, 'PDs!S7', 5);
    expect(nivelCriatura(c.id)).toBe(6);
    store.editar(p, 'PDs!S7', 0);
    expect(store.buscar(c.id)!.entradas['PDs!S9']).toBe(0);   // mínimo 0
  });

  it('editarVarias también sincroniza y sincronizar es idempotente', () => {
    const p = convocador(3);
    const c = store.crearCriatura(p)!;
    store.marcarFamiliar(c.id, true);
    store.editarVarias(p, { 'PDs!S7': 5 });
    expect(nivelCriatura(c.id)).toBe(5);
    store.sincronizarFamiliares(p);
    store.sincronizarFamiliares(p);
    expect(nivelCriatura(c.id)).toBe(5);
  });

  it('estancar: desmarcado no sube y al volver a marcar no recupera lo perdido', () => {
    const p = convocador(3);
    const c = store.crearCriatura(p)!;
    store.marcarFamiliar(c.id, true);
    store.marcarFamiliar(c.id, false);
    store.editar(p, 'PDs!S7', 7);
    expect(nivelCriatura(c.id)).toBe(3);
    store.marcarFamiliar(c.id, true);
    expect(nivelCriatura(c.id)).toBe(3);
    expect(store.buscar(c.id)!.criatura!.nivelAmo).toBe(7);
    store.editar(p, 'PDs!S7', 8);
    expect(nivelCriatura(c.id)).toBe(4);
  });

  it('una criatura atada nunca cambia de nivel sola', () => {
    const p = convocador(3);
    const c = store.crearCriatura(p)!;
    store.editar(p, 'PDs!S7', 9);
    store.sincronizarFamiliares(p);
    expect(nivelCriatura(c.id)).toBe(3);
  });

  it('«Atar / recalcular» pone su nivel al del convocador y anota el nivel del amo', () => {
    const p = convocador(3);
    const c = store.crearCriatura(p)!;
    store.editar(p, 'PDs!S7', 8);
    store.atar(c.id);
    expect(nivelCriatura(c.id)).toBe(8);
    expect(store.buscar(c.id)!.criatura!.nivelAmo).toBe(8);
  });

  it('la lógica pura da los cambios en la casilla de la categoría actual', () => {
    const c = { ...nueva('x'), entradas: { 'PDs!O7': 'A', 'PDs!S7': 2, 'PDs!O9': 'B', 'PDs!S9': 1 }, criatura: { padre: 'p', familiar: true, nivelAmo: 3 } };
    expect(C.casillaActual(c)).toBe('PDs!S9');
    expect(C.sincronizar(c, 6)).toEqual({ entradas: { 'PDs!S9': 4 }, nivelAmo: 6 });
    expect(C.sincronizar(c, 3)).toBeNull();
    expect(C.sincronizar({ ...c, criatura: { ...c.criatura, familiar: false } }, 6)).toBeNull();
    expect(C.fijarNivel(c, 10)).toEqual({ 'PDs!S9': 8 });
  });
});

describe('zeón diario y avisos', () => {
  it('Tel’Arain: nivel 3 da 30 si está atada y 25 si es familiar (mitad de atar nivel + 2); fuera de la tabla, null', () => {
    expect(C.zeonSugerido(3, false)).toBe(30);
    expect(C.zeonSugerido(3, true)).toBe(25);
    expect(C.zeonSugerido(16, false)).toBeNull();
    expect(C.zeonSugerido(14, true)).toBeNull();
  });

  it('avisa (sin bloquear) de más de un nivel de diferencia, tipo de ser y varios familiares sin la ventaja', () => {
    const p = convocador(3);
    const a = store.crearCriatura(p)!, b = store.crearCriatura(p)!;
    store.marcarFamiliar(a.id, true);
    store.editar(a.id, 'PDs!S7', 7);
    store.editar(a.id, 'Principal!Y11', 'Natural');
    const av = C.avisosCriatura(store.buscar(a.id)!, store.buscar(p), store.fichas.value);
    expect(av.some((t) => /más de un nivel/.test(t))).toBe(true);
    expect(av.some((t) => /entre mundos/.test(t))).toBe(true);
    store.marcarFamiliar(b.id, true);
    expect(C.avisosCriatura(store.buscar(b.id)!, store.buscar(p), store.fichas.value).some((t) => /Sin límite/.test(t))).toBe(true);
    store.editar(p, 'Principal!C35', 'Sin límite de familiares');
    expect(C.avisosCriatura(store.buscar(b.id)!, store.buscar(p), store.fichas.value).some((t) => /Sin límite/.test(t))).toBe(false);
    store.editar(b.id, 'Principal!Y11', 'Entre mundos, Elemental');
    expect(C.avisosCriatura(store.buscar(b.id)!, store.buscar(p), store.fichas.value).some((t) => /entre mundos/.test(t))).toBe(false);
  });

  it('filas de criaturas atadas: nunca pisa una fila escrita por el jugador', () => {
    const p = convocador(3, { 'Místicos!C33': 'Otra', 'Místicos!H34': 10 });
    expect(C.filaLibre(store.buscar(p)!)).toBe(35);
    store.editar(p, 'Místicos!C35', 'Ave');
    expect(C.filaAtada(store.buscar(p)!, 'Ave')).toBe(35);
    expect(C.filaAtada(store.buscar(p)!, 'Lobo')).toBeNull();
  });

  it('la pestaña se muestra con criaturas, con PD de convocatoria o con la ventaja Familiar', () => {
    const p = convocador(3);
    const n0 = () => 0;
    expect(C.mostrarPestaña(store.buscar(p)!, store.fichas.value, n0)).toBe(false);
    expect(C.mostrarPestaña(store.buscar(p)!, store.fichas.value, (k) => (k === 'PDs!V100' ? 20 : 0))).toBe(true);
    store.editar(p, 'Principal!C36', 'Familiar (2)');
    expect(C.mostrarPestaña(store.buscar(p)!, store.fichas.value, n0)).toBe(true);
    store.editar(p, 'Principal!C36', null);
    const c = store.crearCriatura(p)!;
    expect(C.mostrarPestaña(store.buscar(p)!, store.fichas.value, n0)).toBe(true);
    expect(C.mostrarPestaña(store.buscar(c.id)!, store.fichas.value, () => 99)).toBe(false);   // en una criatura nunca
  });
});

describe('borrar, enlazar, exportar e importar', () => {
  it('borrar el convocador deja las criaturas como personajes sueltos', () => {
    const p = convocador(3);
    const c = store.crearCriatura(p)!;
    store.borrar(p);
    expect(store.buscar(c.id)).toBeTruthy();
    expect(store.buscar(c.id)!.criatura).toBeUndefined();
  });

  it('un solo nivel: una criatura no puede ser convocador ni una ficha con criaturas ser criatura', () => {
    const p = convocador(3);
    const c = store.crearCriatura(p)!;
    const otro = store.crear();
    expect(store.crearCriatura(c.id)).toBeUndefined();
    expect(store.enlazar(otro.id, c.id)).toBe(false);
    expect(store.enlazar(p, otro.id)).toBe(false);
    expect(store.enlazar(p, p)).toBe(false);
    expect(store.enlazar(otro.id, p)).toBe(true);
    expect(C.criaturasDe(store.fichas.value, p)).toHaveLength(2);
    expect(store.enlazar(otro.id, null)).toBe(true);
    expect(store.buscar(otro.id)!.criatura).toBeUndefined();
  });

  it('el .json del convocador lleva sus criaturas y al importar con ids que chocan se reapuntan', async () => {
    const p = convocador(3);
    const c = store.crearCriatura(p)!;
    let json = '';
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => { void b.text().then((t) => (json = t)); return 'blob:x'; }, revokeObjectURL: () => {} }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    store.exportar(store.buscar(p)!);
    await vi.waitFor(() => expect(json).not.toBe(''));
    expect(JSON.parse(json).criaturasAtadas).toHaveLength(1);
    const copia = store.importar(json);                       // los ids ya existen: todo entra con ids nuevos
    expect(copia.id).not.toBe(p);
    const hijas = C.criaturasDe(store.fichas.value, copia.id);
    expect(hijas).toHaveLength(1);
    expect(hijas[0].id).not.toBe(c.id);
    expect(C.criaturasDe(store.fichas.value, p)).toHaveLength(1);   // las originales siguen con el original
    vi.unstubAllGlobals(); vi.restoreAllMocks();
  });
});
