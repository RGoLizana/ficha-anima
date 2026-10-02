import type { Ficha } from '../model/ficha';
import { Campo, Panel, txt } from './campos';

// Hoja "General" del Excel: descripción y trasfondo (no afecta a los cálculos salvo raza y clase social)
export function Trasfondo({ f }: { f: Ficha }) {
  return (
    <>
      <Panel title="Descripción">
        <div class="grid-fields">
          <Campo f={f} clave="General!F24" label="Sexo" />
          <Campo f={f} clave="General!F26" label="Edad" />
          <Campo f={f} clave="General!I24" label="Altura" />
          <Campo f={f} clave="General!L24" label="Peso" />
          <Campo f={f} clave="General!P24" label="Apariencia" tipo="numero" />
          <Campo f={f} clave="General!F25" label="Tez" />
          <Campo f={f} clave="General!I25" label="Ojos" />
          <Campo f={f} clave="General!N25" label="Cabello" />
          <Campo f={f} clave="General!Q23" label="Etnia (humanos)" />
          <Campo f={f} clave="General!I26" label="Región" />
          <Campo f={f} clave="General!N26" label="Clase social" />
        </div>
      </Panel>
      <Lenguas f={f} />
      <Panel title="Trasfondo">
        <Campo f={f} clave="General!M31" label="Descripción física" tipo="area" />
        <Campo f={f} clave="General!C31" label="Particularidades. Cosas que aprecia o detesta" tipo="area" />
        <Campo f={f} clave="General!C36" label="Personalidad y motivación" tipo="area" />
        <Campo f={f} clave="General!C46" label="Sueños y objetivos" tipo="area" />
        <Campo f={f} clave="General!C56" label="Resumen de su historia" tipo="area" />
      </Panel>
      <Panel title="Posesiones y contactos">
        <div class="grid-fields">
          <Campo f={f} clave="General!Y59" label="Oro" tipo="numero" />
          <Campo f={f} clave="General!Y61" label="Plata" tipo="numero" />
          <Campo f={f} clave="General!Y63" label="Cobre" tipo="numero" />
        </div>
        <div class="grid-fields">
          {[47, 48, 49, 50, 51].map((r, i) => <Campo key={r} f={f} clave={`General!X${r}`} label={`Título / posesión ${i + 1}`} />)}
          {[47, 48, 49, 50, 51].map((r, i) => <Campo key={'c' + r} f={f} clave={`General!AF${r}`} label={`Contacto ${i + 1}`} />)}
        </div>
      </Panel>
    </>
  );
}

const FILAS_LENGUA = [68, 69, 70, 71, 72, 73, 74, 75, 76, 77]; // Principal!D68 base, D69..D77 adicionales

/** Lenguas: sin repetir y con aviso si hay más adicionales de las que permite la INT (Principal!E67). */
function Lenguas({ f }: { f: Ficha }) {
  const clave = (r: number) => `Principal!D${r}`;
  const elegidas = FILAS_LENGUA.map((r) => String(f.entradas[clave(r)] ?? '')).filter(Boolean);
  const maximo = Number(txt('Principal!E67')) || 0;
  const adicionales = FILAS_LENGUA.slice(1).filter((r) => f.entradas[clave(r)]).length;
  // siempre queda una fila libre: pasarse del límite no se impide, solo se avisa
  const visibles = FILAS_LENGUA.filter((r, i) => i <= 1 || f.entradas[clave(r)] || f.entradas[clave(FILAS_LENGUA[i - 1])]);
  return (
    <Panel title="Lenguas" extra={<span class="muted small">Adicionales: <strong>{adicionales} / {maximo}</strong> (según INT)</span>}>
      {adicionales > maximo && (
        <p class="aviso" role="status">
          Tienes {adicionales} lenguas adicionales y tu INT permite {maximo} ({adicionales - maximo} de más).
        </p>
      )}
      <div class="grid-fields">
        {visibles.map((r, i) => (
          <Campo key={r} f={f} clave={clave(r)} label={i === 0 ? 'Lengua base' : `Lengua ${i}`}
            excluir={elegidas.filter((x) => x !== String(f.entradas[clave(r)] ?? ''))} />
        ))}
      </div>
    </Panel>
  );
}
