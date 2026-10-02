// Desplegables: los 2.144 del Excel se resuelven, y los valores elegidos en las fichas están en su lista.
import { describe, expect, it } from 'vitest';
import { FICHAS, golden, inventario, listas, motor } from './helpers';

const T = 300_000;

// Valores de las fichas de referencia que no están en el desplegable de la 8.7.0 (vienen de versiones anteriores)
const EXCEPCIONES: Record<string, string[]> = {
  lock: ['Principal!D68', 'Creación de Técnicas!V234'], // idioma propio "Yamato-shu", técnica "Sin Armadura"
  sesshomaru: [],
  // ventaja que en la 8.7.0 ya no está en la lista de comunes; crítico de un arma personalizada que no tiene arma elegida
  ayane: ['Principal!C36', 'Personalización!AD102'],
};

describe('desplegables del Excel', () => {
  it.each(FICHAS)('ficha %s: todas las listas se resuelven sin error', (n) => {
    const l = motor();
    l.cargar(golden(n).entradas);
    const fallan: string[] = [];
    for (const [clave, formula] of Object.entries(listas())) {
      try { l.lista(formula, clave.slice(0, clave.lastIndexOf('!'))); } catch (e) { fallan.push(`${clave}: ${(e as Error).message}`); }
    }
    expect(fallan).toEqual([]);
  }, T);

  it.each(FICHAS)('ficha %s: cada valor elegido está en su desplegable', (n) => {
    const l = motor();
    const g = golden(n);
    l.cargar(g.entradas);
    const ls = listas();
    // los valores por defecto de la plantilla (p.ej. clase social "Media / Baja" sin región) no los eligió el jugador
    const defecto = new Map(Object.entries(inventario()).flatMap(([h, xs]) => xs.map((x) => [`${h}!${x.celda}`, x.defecto])));
    const fuera = Object.entries(g.entradas)
      .filter(([k, v]) => ls[k] && !EXCEPCIONES[n].includes(k) && defecto.get(k) !== v)
      .filter(([k, v]) => !l.lista(ls[k], k.slice(0, k.lastIndexOf('!'))).includes(String(v).trim()))
      .map(([k, v]) => `${k}=${v}`);
    expect(fuera).toEqual([]);
  }, T);

  it('ninguna lista de opciones tiene duplicados ni vacíos ni errores', () => {
    const l = motor();
    l.cargar(golden('lock').entradas);
    for (const [clave, formula] of Object.entries(listas())) {
      const ops = l.lista(formula, clave.slice(0, clave.lastIndexOf('!')));
      expect(new Set(ops).size, clave).toBe(ops.length);
      expect(ops.filter((o) => o === '' || o.startsWith('#')), clave).toEqual([]);
    }
  }, T);
});

describe('listas concretas', () => {
  const op = (clave: string) => motor().lista(listas()[clave], clave.slice(0, clave.lastIndexOf('!')));

  it('identidad: razas, nephilim, tipo de criatura, categorías, sexo', () => {
    motor().cargar(golden('sesshomaru').entradas);
    expect(op('General!F23')).toEqual(expect.arrayContaining(['Humano', 'Sylvain', 'Jayán', 'Tuan Dalyr', 'Criatura']));
    expect(op('General!J23')).toContain('Nephilim Sylvain');
    expect(op('Principal!Y11')).toEqual(expect.arrayContaining(['Natural', 'Entre mundos', 'Ánima', 'No muerto']));
    expect(op('PDs!O7')).toEqual(expect.arrayContaining(['Guerrero', 'Guerrero Acróbata', 'Hechicero', 'Mentalista', 'Novel']));
    expect(op('PDs!O7')).toHaveLength(22);
  }, T);

  it('ventajas: comunes (INDIRECT→rango), del Don solo con Don, desventajas, trasfondo y legados', () => {
    motor().cargar(golden('lock').entradas); // Lock tiene el Don
    expect(op('Principal!C35')).toContain('Don');
    expect(op('Principal!C43')).toContain('Con. natural de Vía: Fuego');
    expect(op('Principal!C51').length).toBeGreaterThan(20);
    expect(op('Principal!G35').length).toBeGreaterThan(0);
    expect(op('Principal!G41').length).toBeGreaterThan(0);
  }, T);

  it('compras de PD: tablas de armas + arma, estilos, artes marciales + grado, Ars Magnus, tablas místicas/psíquicas, patrones', () => {
    motor().cargar({ ...golden('sesshomaru').entradas, 'PDs!E49': 'Tabla de Ataque inusual', 'PDs!E59': 'Tae Kwon Do' });
    expect(op('PDs!E43')).toContain('Arma distinta / Desarmado');
    expect(op('PDs!Y43')).toContain('Armas naturales');
    expect(op('PDs!M43')).toEqual(['20']);
    expect(op('PDs!M49')).toEqual(['20']);                       // INDIRECT dentro de IF
    expect(op('PDs!E59').length).toBeGreaterThan(30);
    expect(op('PDs!J59')).toEqual(['Base', 'Avanzado', 'Supremo']);
    motor().poner('PDs!J59', 'Base');
    expect(op('PDs!M59')).toEqual(['20']);                       // COLUMN(INDEX()) reescrito
    expect(op('PDs!E81').length).toBeGreaterThan(10);
    expect(op('PDs!E102').length).toBeGreaterThan(0);
    expect(op('PDs!E113').length).toBeGreaterThan(0);
    expect(op('PDs!E114').length).toBeGreaterThan(5);
  }, T);

  it('lenguas, habilidades esenciales (+opción según habilidad) y poderes de criatura (+opción)', () => {
    motor().cargar(golden('sesshomaru').entradas);
    expect(op('Principal!D68').length).toBeGreaterThan(30);
    expect(op('Principal!AD12').length).toBeGreaterThan(5);
    expect(op('Principal!AB42').length).toBeGreaterThan(10);
    // la opción depende de la habilidad/poder elegido en la misma fila (INDIRECT($AK<fila>))
    expect(op('Principal!AF42')).toContain('TA 2');              // Armadura física
  }, T);

  it('listas literales "Sí,No" y rangos de la propia hoja', () => {
    motor().cargar(golden('sesshomaru').entradas);
    const literal = Object.entries(listas()).find(([, f]) => f.startsWith('"'))!;
    expect(op(literal[0]).length).toBeGreaterThan(1);
    expect(op('PDs!D181').length).toBeGreaterThan(0);            // $AH$180:$AH$187 de PDs
  }, T);
});
