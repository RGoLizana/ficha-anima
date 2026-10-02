// Verificación con fichas reales de la carpeta golden/ (muchas son de gremios, con cosas propias).
// Uso:  FICHA="Katarina" npx vitest run tests/golden.motor.test.ts      (FICHA = parte del nombre; sin FICHA, todas)
// Para cada .xlsm: importa con leerFicha, carga las entradas en el motor y compara con los valores que Excel dejó guardados.
// Solo las fichas 8.7.0 se comparan celda a celda (en las anteriores las direcciones cambiaron); en el resto se comprueba que
// la importación y el motor no dan errores y que las cifras de cabecera coinciden. Escribe el informe en INFORME_DIR si existe.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { escribirFicha } from '../src/export/xlsm';
import { leerFicha, valoresGuardados, versionDe } from '../src/import/xlsm';
import { HOJAS_VISIBLES, iguales, motor, read } from './helpers';
import type { Plantilla } from '../src/engine/libro';

const RAIZ = join(import.meta.dirname, '..');
const BASE = ['ayane.xlsm', 'lock.xlsm', 'sesshomaru.xlsm'];
const filtro = (process.env.FICHA ?? '').toLowerCase();
const archivos = readdirSync(join(RAIZ, 'golden')).filter((f) => f.endsWith('.xlsm') && !f.startsWith('~$') && !BASE.includes(f))
  .filter((f) => f.toLowerCase().includes(filtro));
const informes = process.env.INFORME_DIR;
const ERROR = /^#(N\/A|VALUE!|REF!|DIV\/0!|NUM!|NAME\?|NULL!|CICLO!|ERROR!|SPILL!|LIC!)$/;
const plantilla = read('public/plantilla.json') as Plantilla;
const eq = (a: unknown, b: unknown) => iguales(a, b) || (ERROR.test(String(a)) && ERROR.test(String(b)));

describe.skipIf(!archivos.length)('fichas reales (golden/)', () => {
  it.each(archivos)('%s', (f) => {
    const datos = new Uint8Array(readFileSync(join(RAIZ, 'golden', f)));
    const version = versionDe(datos);
    const { entradas, avisos } = leerFicha(datos);
    const l = motor();
    l.cargar(entradas);
    const motorVals = l.hojas(HOJAS_VISIBLES);
    const excel = valoresGuardados(datos);

    // errores de fórmula en el motor que Excel no tiene (en celdas de las hojas visibles)
    const erroresMotor = Object.entries(motorVals).filter(([k, v]) => ERROR.test(String(v)) && !ERROR.test(String(excel[k] ?? ''))).map(([k, v]) => `${k}=${String(v)}`);

    // 8.7.0: comparación celda a celda de todo lo que Excel calculó
    const diferencias: string[] = [];
    let comparadas = 0;
    if (version === '8.7.0') {
      for (const [k, esperado] of Object.entries(excel)) {
        const hoja = k.slice(0, k.lastIndexOf('!'));
        if (!HOJAS_VISIBLES.includes(hoja)) continue;
        if (!(k.slice(k.lastIndexOf('!') + 1) in (plantilla.sheets[hoja] ?? {}))) continue;   // celdas no ancla de una combinada: openpyxl no las ve
        if (esperado === '#NAME?') continue;                                                   // Excel sin TEXTJOIN guardó el error; el motor da el texto bueno
        comparadas++;
        const obtenido = l.valor(k);
        if (!eq(obtenido, esperado)) diferencias.push(`${k}: excel=${JSON.stringify(esperado)} motor=${JSON.stringify(obtenido)}`);
      }
    }

    // exportar sobre una base y volver a leer: las entradas sobreviven
    let ida_y_vuelta = 'ok';
    try {
      const base = new Uint8Array(readFileSync(join(RAIZ, 'ref/pdf/sesshomaru 8.7.0.xlsm')));
      const vuelta = leerFicha(escribirFicha(base, entradas)).entradas;
      const malas = Object.entries(entradas).filter(([k, v]) => !iguales(vuelta[k], v)).map(([k]) => k);
      if (malas.length) ida_y_vuelta = `${malas.length} entradas cambian: ${malas.slice(0, 10).join(', ')}`;
    } catch (e) { ida_y_vuelta = `error: ${(e as Error).message}`; }

    const base87 = version === '8.7.0' && !avisos.some((a) => a.startsWith('La disposición'));
    const informe = { ficha: f, version, entradas: Object.keys(entradas).length, avisosImportacion: avisos, celdasComparadas: comparadas,
      diferencias: diferencias.length, muestraDiferencias: diferencias.slice(0, 60), erroresMotor: erroresMotor.length, muestraErroresMotor: erroresMotor.slice(0, 30), ida_y_vuelta };
    if (informes) { mkdirSync(informes, { recursive: true }); writeFileSync(join(informes, `motor-${f.replace(/\W+/g, '_')}.json`), JSON.stringify(informe, null, 1)); }
    process.stdout.write(`[golden] ${f} v${version}: entradas ${informe.entradas}, comparadas ${comparadas}, diferencias ${diferencias.length}, errores motor ${erroresMotor.length}, ida y vuelta ${ida_y_vuelta}\n`);
    expect(informe.ida_y_vuelta).toBe('ok');
    // las versiones antiguas (direcciones distintas) y las fichas de gremio con otra disposición solo se informan
    if (base87) {
      expect(diferencias.length, diferencias.slice(0, 5).join('\n')).toBe(0);
      expect(erroresMotor.length, erroresMotor.slice(0, 5).join(', ')).toBe(0);
    }
  }, 180_000);
});
