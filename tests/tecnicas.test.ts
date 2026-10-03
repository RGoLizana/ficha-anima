// Técnicas de ki: la réplica de las cuentas (src/tecnicas/calculo.ts) da lo mismo que el Excel, y leer/escribir celdas es reversible.
import { describe, expect, it } from 'vitest';
import type { Entradas } from '../src/engine/libro';
import {
  BASES, CAR, DESVENTAJAS, EFECTOS, acumulacion, calcular, celdas, copia, efecto, elementosLegado, leer, normalizar, nuevoEfecto, vacia,
  type Contexto, type Duracion, type Tecnica,
} from '../src/tecnicas/calculo';
import { PLANTILLAS_TECNICA, construirPlantilla } from '../src/tecnicas/plantillas';
import { motor, read } from './helpers';

const T = 300_000;
const H = 'Creación de Técnicas';
const lock = (read('ref/fichas/lock.json') as { entradas: Entradas }).entradas;
const b = BASES[0];
const sinBloque = (e: Entradas) => Object.fromEntries(Object.entries(e).filter(([k]) => {
  const m = /^Creación de Técnicas!([A-Z]+)(\d+)$/.exec(k);
  return !(m && +m[2] >= b && +m[2] < b + 34);
}));

/** Carga Lock con el bloque 1 sustituido por la técnica y devuelve el contexto de la ficha. */
function cargar(t: Tecnica | null) {
  const l = motor();
  const e: Entradas = sinBloque(lock);
  if (t) for (const [k, v] of Object.entries(celdas(t, b))) if (v !== null) e[k] = v;
  l.cargar(e);
  const ctx: Contexto = { acum: acumulacion(String(l.valor(`${H}!R5`))), legado: elementosLegado(String(l.valor('Principal!AF30'))) };
  return { l, ctx };
}
const v = (l: ReturnType<typeof motor>, c: string, fila: number) => l.valor(`${H}!${c}${fila}`);

function comprobar(t: Tecnica, nombre: string) {
  const { l, ctx } = cargar(t);
  const r = calcular(t, ctx);
  expect(v(l, 'U', b), `${nombre}: CM`).toBe(r.cm);
  expect(v(l, 'AL', 29), `${nombre}: ki necesario`).toBe(r.kiNec);
  expect(v(l, 'AL', 30), `${nombre}: ki puesto`).toBe(r.kiPuesto);
  expect(v(l, 'AM', 29), `${nombre}: ki de mantener necesario`).toBe(r.mantNec);
  expect(v(l, 'AM', 30), `${nombre}: ki de mantener puesto`).toBe(r.mantPuesto);
  r.efectos.forEach((x) => {
    expect(v(l, 'N', b + 4 + x.i), `${nombre}: CM del efecto ${x.e.n}`).toBe(x.cm);
    expect(v(l, 'AT', b + 4 + x.i), `${nombre}: ki del efecto ${x.e.n}`).toBe(x.ki);
  });
  r.desv.forEach((x, k) => expect(v(l, 'N', b + 9 + k), `${nombre}: CM de la desventaja`).toBe(x.cm));
  expect(v(l, 'AM', 41), `${nombre}: ajuste bien repartido`).toBe(false);
  expect(v(l, 'AM', 42), `${nombre}: ki cuadra`).toBe(r.kiNec !== r.kiPuesto || r.mantNec !== r.mantPuesto);
}

describe('leer y escribir el bloque', () => {
  it('la técnica 1 de Lock se lee y se vuelve a escribir tal cual', () => {
    const t = leer((c) => lock[c], b);
    expect(t.efectos.map((e) => e.n)).toEqual(['Recuperar Acción']);
    expect(t.efectos[0].ki).toEqual({ AGI: 3, CON: 3, POD: 3, VOL: 3 });
    expect(t.desv[0]).toMatchObject({ n: 'Atadura Elemental', el: ['Luz', 'Fuego'] });
    const c = celdas(t, b);
    for (const [k, valor] of Object.entries(c)) {
      if (k.endsWith('!S12')) continue;                    // «No» es el valor por defecto de Combinable
      if (valor === null) expect([undefined, '-', 'No', 'Primario', 'Secundario', 0], k).toContain(lock[k]);   // vacía = valor por defecto de la plantilla
      else expect(lock[k], k).toBe(valor);
    }
  });

  it('las plantillas usan efectos, grados y desventajas que existen', () => {
    for (const p of PLANTILLAS_TECNICA) {
      const t = construirPlantilla(p);
      expect(t.efectos.length, p.titulo).toBeGreaterThan(0);
      t.efectos.forEach((e) => expect(e.g >= 0 || efecto(e.n)!.g.length === 0, `${p.titulo}: ${e.n}`).toBe(true));
    }
  });
});

describe('la réplica coincide con el Excel', () => {
  it('Lock tal como está', () => {
    const t = leer((c) => lock[c], b);
    const { l, ctx } = cargar(null);
    l.cargar(lock);
    const r = calcular(t, ctx);
    expect(v(l, 'U', b)).toBe(r.cm);
    expect(v(l, 'AL', 29)).toBe(r.kiNec);
    expect(v(l, 'AL', 30)).toBe(r.kiPuesto);
  }, T);

  it('cada efecto, con su primer y su último grado', () => {
    for (const d of EFECTOS) {
      for (const g of d.g.length ? [0, d.g.length - 1] : [-1]) {
        const { ctx } = cargar(null);
        const t = vacia(); t.nivel = 3;
        t.efectos = [{ ...nuevoEfecto(d.n, 'Primario'), g }];
        comprobar(normalizar(null, t, ctx, 'barato'), `${d.n} g${g}`);
      }
    }
  }, T);

  it('extras, secundarios, duraciones, desventajas, reducciones y combinable', () => {
    const { ctx } = cargar(null);
    const dur = (d: Duracion) => d;
    const casos: [string, (t: Tecnica) => void][] = [
      ['dos efectos', (t) => { t.efectos = [nuevoEfecto('Habilidad de Ataque'), nuevoEfecto('Ataque a Distancia'), nuevoEfecto('Incrementar Turno')]; t.efectos[1].g = 2; }],
      ['extras', (t) => { t.efectos = [nuevoEfecto('Aumento de Daño')]; t.efectos[0].g = 3; t.efectos[0].x = [0, 2]; }],
      ['mantenido', (t) => { t.efectos = [nuevoEfecto('Habilidad de Ataque')]; t.efectos[0].g = 4; t.efectos[0].dur = dur('Mantenido'); }],
      ['sostenido menor', (t) => { t.nivel = 2; t.efectos = [nuevoEfecto('Habilidad de Parada')]; t.efectos[0].g = 3; t.efectos[0].dur = dur('Sostenimiento Menor'); }],
      ['sostenido mayor', (t) => { t.nivel = 3; t.efectos = [nuevoEfecto('Habilidad de Esquiva'), nuevoEfecto('Ataque a Distancia')]; t.efectos[0].dur = dur('Sostenimiento Mayor'); }],
      ['desventajas', (t) => { t.nivel = 2; t.efectos = [nuevoEfecto('Habilidad de Ataque')]; t.efectos[0].g = 6; t.desv = [{ n: 'Sin Defensa', o: 0, el: ['', ''] }, { n: 'Usos Limitados', o: 1, el: ['', ''] }]; }],
      ['atadura', (t) => { t.efectos = [nuevoEfecto('Habilidad de Ataque')]; t.desv = [{ n: 'Atadura Elemental', o: 1, el: ['Aire', 'Fuego'] }]; }],
      ['reducción de ki', (t) => { t.nivel = 2; t.efectos = [nuevoEfecto('Habilidad de Ataque'), nuevoEfecto('Ataque a Distancia')]; t.redKi = 2; }],
      ['reducción de cm', (t) => { t.nivel = 2; t.efectos = [nuevoEfecto('Habilidad de Ataque')]; t.redCM = 10; }],
      ['combinable', (t) => { t.efectos = [nuevoEfecto('Habilidad de Ataque')]; t.comb = true; t.nivel = 2; }],
    ];
    for (const [nombre, f] of casos) {
      for (const modo of ['barato', 'rapido'] as const) {
        const t = vacia(); f(t);
        comprobar(normalizar(null, t, ctx, modo), `${nombre} (${modo})`);
      }
    }
  }, T);

  it('todas las desventajas con todas sus opciones', () => {
    const { ctx } = cargar(null);
    for (const d of DESVENTAJAS) {
      d.o.forEach((_, o) => {
        const t = vacia(); t.nivel = 3; t.efectos = [nuevoEfecto('Habilidad de Ataque')]; t.efectos[0].g = 8;
        t.desv = [{ n: d.n, o, el: ['', ''] }];
        const { l } = cargar(normalizar(null, t, ctx, 'barato'));
        expect(v(l, 'N', b + 9), `${d.n} #${o}`).toBe(d.o[o][1]);
      });
    }
  }, T);
});

describe('reparto del ki', () => {
  it('«más rápido» nunca tarda más asaltos que «más barato»', () => {
    const { ctx } = cargar(null);
    for (const d of EFECTOS) {
      const t = vacia(); t.efectos = [nuevoEfecto(d.n, 'Primario')]; t.efectos[0].g = d.g.length ? Math.min(2, d.g.length - 1) : -1;
      const barato = calcular(normalizar(null, copia(t), ctx, 'barato'), ctx), rapido = calcular(normalizar(null, copia(t), ctx, 'rapido'), ctx);
      expect(rapido.asaltos, d.n).toBeLessThanOrEqual(barato.asaltos);
      expect(rapido.kiNec, d.n).toBeGreaterThanOrEqual(barato.kiNec);
    }
  });

  it('el ki escrito a mano se conserva al cambiar de grado; el automático se recalcula', () => {
    const { ctx } = cargar(null);
    const t0 = normalizar(null, Object.assign(vacia(), { efectos: [nuevoEfecto('Habilidad de Ataque', 'Primario')] }), ctx, 'barato');
    const auto = copia(t0); auto.efectos[0].g = 3;
    expect(normalizar(t0, auto, ctx, 'barato').efectos[0].ki).toEqual({ DES: efecto('Habilidad de Ataque')!.g[3][1] });
    const manual = copia(t0); manual.efectos[0].ki = { DES: 1, POD: 1 };
    const cambiado = copia(manual); cambiado.efectos[0].g = 3;
    expect(normalizar(manual, cambiado, ctx, 'barato').efectos[0].ki).toEqual({ DES: 1, POD: 1 });
  });

  it('las cuatro características se leen de la acumulación de la ficha', () => {
    expect(acumulacion('AGI 1 CON 1 DES 1 FUE 1 POD 2 VOL 1')).toEqual({ AGI: 1, CON: 1, DES: 1, FUE: 1, POD: 2, VOL: 1 });
    expect(CAR).toHaveLength(6);
  });
});
