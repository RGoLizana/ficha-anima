import type { Ficha } from '../model/ficha';
import { useEffect, useState } from 'preact/hooks';
import { opciones } from '../engine';
import { Campo, Panel, txt } from './campos';

// Hoja Sheele: compañera mágica (arma-espíritu) con sus características, mejoras y habilidades
const s = (col: string, fila: number) => `Sheele!${col}${fila}`;
const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const valido = (t: string) => t !== '' && t !== '-' && !t.startsWith('#');

/** Filas ocupadas más una libre: nunca se bloquea añadir otra. */
function visibles(f: Ficha, filas: number[], cols: string[]) {
  const llena = (r: number) => cols.some((c) => f.entradas[s(c, r)]);
  const ultima = filas.reduce((x, r, i) => (llena(r) ? i : x), -1);
  return filas.slice(0, Math.min(filas.length, ultima + 2));
}

const TABLA = "'Tablas Sheele'!$C$";
const GENERALES = `${TABLA}91:$C$108`;
const TODAS = `${TABLA}91:$C$197`;           // genéricas + las de todos los tipos
const TIPOS = `${TABLA}110:$C$197`;          // solo las de cada tipo (Aire, Tierra…)

/** Mejora de Sheele: solo se ofrecen las de su tipo (M5) y las genéricas; una guardada de otro tipo se conserva y se avisa. */
function Mejora({ f, clave, label }: { f: Ficha; clave: string; label: string }) {
  const tipo = txt(s('M', 5));
  const hay = valido(tipo) && tipo !== 'Nada';
  const [tipos, setTipos] = useState<string[]>([]);
  const [propias, setPropias] = useState<string[]>([]);
  useEffect(() => { opciones(clave, TIPOS).then(setTipos).catch(() => setTipos([])); }, [clave]);
  useEffect(() => {
    if (!hay) { opciones(clave, TODAS).then(setPropias).catch(() => setPropias([])); return; }
    Promise.all([opciones(clave, GENERALES), opciones(clave, 'INDIRECT(Sheele!V6)')])
      .then(([g, a]) => setPropias([...g, ...a.filter((x) => !g.includes(x))]))
      .catch(() => setPropias([]));
  }, [clave, tipo]);
  const actual = String(f.entradas[clave] ?? '');
  const ajena = hay && propias.length > 0 && actual !== '' && !propias.includes(actual) && tipos.includes(actual);
  return (
    <div class="grow">
      <Campo f={f} clave={clave} label={label} fijas={propias} />
      {!hay && <p class="muted small">Elige primero el tipo de Sheele</p>}
      {ajena && <p class="muted small">«{actual}» es una mejora de otro tipo (no es de {tipo}): se conserva, pero revísala</p>}
    </div>
  );
}

const GRUPOS: [string, number, number][] = [
  ['Atléticas', 10, 16], ['Sociales', 17, 23], ['Perceptivas', 24, 26], ['Intelectuales', 27, 38],
  ['Vigor', 39, 41], ['Subterfugio', 42, 48], ['Creativas', 49, 65],
];

export function Sheele({ f }: { f: Ficha }) {
  return (
    <>
      <Panel title="Sheele" extra={<span class="muted small">Nivel {txt(s('I', 4))} · zeón diario {txt(s('I', 5))}</span>}>
        <div class="grid-fields">
          <Campo f={f} clave={s('M', 5)} label="Tipo de Sheele" />
          <Campo f={f} clave={s('O', 5)} label="Vinculada" />
          <Campo f={f} clave={s('Q', 5)} label="Limitar conocimiento" />
        </div>
      </Panel>

      <div class="cols-2">
        <Panel title="Características" plegable>
          <table class="tabla">
            <thead><tr><th scope="col" class="left">Car.</th><th scope="col">Base</th><th scope="col">Temp</th><th scope="col">Total</th><th scope="col">Bono</th></tr></thead>
            <tbody>
              {rango(9, 16).map((r) => (
                <tr key={r}>
                  <th scope="row" class="left">{txt(s('D', r))}</th>
                  <td>{txt(s('E', r))}</td>
                  <td><Campo f={f} clave={s('F', r)} label={<span class="sr-only">Temporal {txt(s('D', r))}</span>} tipo="numero" class="mini" sinTab /></td>
                  <td class="total">{txt(s('G', r))}</td>
                  <td>{txt(s('H', r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div class="grid-fields">
            <Campo f={f} clave={s('K', 9)} label="Puntos de vida extra" tipo="numero" />
            <Campo f={f} clave={s('L', 16)} label="Regeneración especial" />
            <Campo f={f} clave={s('L', 25)} label="Movimiento especial" />
          </div>
          <p class="muted small">PV {txt(s('J', 9))} · Regeneración {txt(s('J', 14))} {txt(s('K', 14))} · Movimiento {txt(s('J', 19))} {txt(s('K', 19))} {txt(s('K', 20))}</p>
        </Panel>

        <Panel title="Estadísticas de combate">
          <div class="salidas">
            {[['F', 45, 'Proy. ofensiva'], ['F', 47, 'Proy. defensiva'], ['K', 45, 'Ataque'], ['K', 47, 'Esquiva'], ['K', 49, 'Parada'], ['K', 51, 'Turno'], ['F', 51, 'ACT máx.'], ['K', 53, 'Acciones']]
              .map(([c, r, t]) => <div class="stat" key={t as string}><div class="stat-v">{txt(s(c as string, r as number)) || '—'}</div><div class="muted small">{t}</div></div>)}
          </div>
          <p class="muted small">Nivel de vía {txt(s('F', 49))} {txt(s('F', 50))} · Resistencias {rango(27, 32).map((r) => `${txt(s('K', r))} ${txt(s('L', r))}`).join(' · ')}</p>
        </Panel>
      </div>

      <Panel title="Mejoras de Sheele" plegable extra={<span class="muted small">Mejoras por nivel {txt(s('S', 8))}</span>}>
        {visibles(f, rango(24, 35), ['C', 'F']).map((r) => (
          <div class="compra" key={r}>
            <Mejora f={f} clave={s('C', r)} label="Mejora" />
            <Mejora f={f} clave={s('F', r)} label="Segunda mejora" />
          </div>
        ))}
        <h3>Mejora de atributos</h3>
        {rango(36, 39).map((r) => (
          <div class="compra" key={r}>
            <Campo f={f} clave={s('F', r)} label={txt(s('E', r)) || 'Atributo'} class="mini" />
            <Campo f={f} clave={s('H', r)} label={txt(s('G', r)) || 'Atributo'} class="mini" />
          </div>
        ))}
        <p class="muted small">Potenciación mística: zeón máximo {txt(s('J', 36))} · {txt(s('J', 38))}</p>
      </Panel>

      <Panel title="Habilidades secundarias" plegable extra={<span class="muted small">Cada punto de mejora suma +10; el total no pasa del de su dueño si hay límite</span>}>
        {GRUPOS.map(([titulo, a, b]) => (
          <section key={titulo}>
            <h3>{titulo}</h3>
            <table class="tabla">
              <thead><tr><th scope="col" class="left">Habilidad</th><th scope="col">Base</th><th scope="col">Mejora</th><th scope="col">Total</th></tr></thead>
              <tbody>
                {rango(a, b).filter((r) => valido(txt(s('O', r))) || f.entradas[s('R', r)] !== undefined).map((r) => (
                  <tr key={r}>
                    <th scope="row" class="left">{txt(s('O', r))}</th>
                    <td>{txt(s('Q', r))}</td>
                    <td><Campo f={f} clave={s('R', r)} label={<span class="sr-only">Mejora {txt(s('O', r))}</span>} tipo="numero" class="mini" /></td>
                    <td class="total">{txt(s('S', r))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </Panel>

      <Panel title="Poderes y habilidades">
        {rango(69, 72).filter((r) => valido(txt(s('C', r)))).map((r) => (
          <p class="small" key={r}><strong>{txt(s('C', r))}</strong> · Zeón {txt(s('E', r))} · Proy. {txt(s('F', r))} · Daño {txt(s('G', r))} — {txt(s('H', r))}</p>
        ))}
        {rango(83, 90).filter((r) => valido(txt(s('C', r)))).map((r) => (
          <p class="small" key={r}><strong>{txt(s('C', r))}</strong> — {txt(s('E', r))}</p>
        ))}
      </Panel>

      <Panel title="Notas de Sheele" plegable>
        <Campo f={f} clave={s('C', 92)} label="Notas (salen en la página de notas del PDF)" tipo="area" />
      </Panel>
    </>
  );
}
