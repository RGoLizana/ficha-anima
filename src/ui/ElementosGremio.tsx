// Elementos del gremio (biblioteca de la sección Gremio) elegidos desde la hoja que les corresponde: vías en Magia, disciplinas en Psíquica
// y Ars Magnus en Ki. Se eligen como lo demás y solo consumen (nivel de vía, CV, CM, PD): no se escribe nada en las tablas del Excel.
import type { Ficha } from '../model/ficha';
import { guardarPropio } from '../store';
import { biblioteca } from '../gremio/almacen';
import type { Elegido, TipoElegido } from '../gremio/modelo';

type Consumo = 'nivel' | 'cv' | 'cm' | 'pd';
const AJUSTES: Record<TipoElegido, { titulo: string; singular: string; consumos: [Consumo, string][]; nota: string }> = {
  via: { titulo: 'Vías de gremio', singular: 'vía de gremio', consumos: [['nivel', 'Nivel usado']], nota: 'Gastan nivel de vía como las demás; sus conjuros se ven en el compendio.' },
  disciplina: { titulo: 'Disciplinas de gremio', singular: 'disciplina de gremio', consumos: [['cv', 'CV usados']], nota: 'Gastan CV como las demás; sus poderes se ven en el compendio.' },
  ars: { titulo: 'Ars Magnus de gremio', singular: 'Ars Magnus de gremio', consumos: [['cm', 'CM usados'], ['pd', 'PD']], nota: 'Gastan CM y PD como los demás; se suman a los totales sin escribirse en el Excel.' },
};

export function ElementosGremio({ f, tipo }: { f: Ficha; tipo: TipoElegido }) {
  const a = AJUSTES[tipo], b = biblioteca.value;
  const todas = f.propio ?? [];
  const mias = todas.filter((e) => e.tipo === tipo);
  const lib = tipo === 'via' ? b.vias.map((v) => ({ n: v.n, sub: v.tipo, cm: 0, pd: 0 })) : tipo === 'disciplina' ? b.disciplinas.map((d) => ({ n: d.n, sub: d.mod, cm: 0, pd: 0 }))
    : b.arsMagnus.map((x) => ({ n: x.n, sub: `${x.pd} PD · ${x.cm} CM`, cm: x.cm, pd: x.pd }));
  if (!mias.length && !lib.length) return null;
  const libres = lib.filter((x) => !mias.some((e) => e.n === x.n));
  const poner = (n: string) => {
    const x = lib.find((y) => y.n === n);
    if (x) guardarPropio(f.id, [...todas, { tipo, n, nivel: 0, cv: tipo === 'disciplina' ? 1 : 0, cm: x.cm, pd: x.pd, cat: 1 }]);
  };
  const cambiar = (e: Elegido, k: Consumo, x: number) => guardarPropio(f.id, todas.map((y) => (y === e ? { ...y, [k]: x } : y)));
  return (
    <div class="stack-sm">
      <h3 class="sub">{a.titulo}</h3>
      {mias.map((e) => (
        <div class="compra" key={e.n}>
          <strong class="grow">{e.n} <span class="muted small">{lib.find((x) => x.n === e.n)?.sub ?? a.singular}</span></strong>
          {a.consumos.map(([k, et]) => (
            <label class="field mini" key={k}>{et}
              <input type="number" inputMode="numeric" min={0} value={e[k] || ''} onChange={(ev) => cambiar(e, k, Math.max(0, Number(ev.currentTarget.value) || 0))} />
            </label>
          ))}
          <button type="button" class="icon-btn" aria-label={`Quitar ${e.n}`} title="Quitar" onClick={() => guardarPropio(f.id, todas.filter((y) => y !== e))}>×</button>
        </div>
      ))}
      {libres.length > 0 && (
        <label class="field">Añadir {a.singular}
          <select value="" onChange={(ev) => poner(ev.currentTarget.value)}>
            <option value="">—</option>
            {libres.map((x) => <option key={x.n} value={x.n}>{x.n} ({x.sub})</option>)}
          </select>
        </label>
      )}
      <p class="muted small">{a.nota}</p>
    </div>
  );
}
