import { useEffect, useState } from 'preact/hooks';
import type { Ficha } from '../model/ficha';
import { nombreDe } from '../model/ficha';
import { borrarBase, descargar, guardarBase, leerBase } from '../export/base';
import { txt } from './campos';

/** Exporta la ficha a un .xlsm escribiéndola sobre la plantilla base (que el usuario aporta una vez). */
export function ExportarExcel({ f }: { f: Ficha }) {
  const [base, setBase] = useState<string | null | undefined>(undefined);   // undefined = comprobando
  const [mensaje, setMensaje] = useState('');
  useEffect(() => { void leerBase().then((b) => setBase(b?.nombre ?? null)); }, []);

  async function exportar(datos?: Uint8Array, nombreBase?: string) {
    setMensaje('');
    try {
      const [{ escribirFicha }, { leerFicha }] = await Promise.all([import('../export/xlsm'), import('../import/xlsm')]);
      const origen = datos ? { nombre: nombreBase!, datos } : await leerBase();
      if (!origen) { setBase(null); return; }
      const libro = escribirFicha(origen.datos, f.entradas);
      if (datos) {
        const v = leerFicha(libro).version;                    // la base debe ser una ficha de Anima 8.7.0
        if (v !== '8.7.0') setMensaje(`La plantilla base es la versión ${v || 'desconocida'}; se espera la 8.7.0 (se exporta igualmente).`);
        await guardarBase(origen.nombre, origen.datos);
        setBase(origen.nombre);
      }
      descargar(`${[nombreDe(f) || 'ficha', txt('Principal!O6')].filter(Boolean).join(' ')}.xlsm`, libro);
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : String(e));
    }
  }

  async function elegir(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (archivo) await exportar(new Uint8Array(await archivo.arrayBuffer()), archivo.name);
  }

  return (
    <span class="row exportar-excel">
      {base ? <button class="btn" onClick={() => exportar()} title={`Plantilla base: ${base}`}>Exportar Excel</button>
        : <label class="btn" title="Elige una vez tu ficha Excel 8.7.0 (vacía o con cualquier personaje): se usa como plantilla base">
            Exportar Excel
            <input type="file" accept=".xlsm,.xlsx" hidden aria-label="Plantilla base de Excel" onChange={elegir} />
          </label>}
      {base && (
        <label class="btn plain" title="Cambiar la plantilla base guardada en este navegador">
          Cambiar base
          <input type="file" accept=".xlsm,.xlsx" hidden aria-label="Cambiar la plantilla base de Excel" onChange={elegir} />
        </label>
      )}
      {base && <button class="icon-btn plain" aria-label="Olvidar la plantilla base" title="Olvidar la plantilla base" onClick={() => { void borrarBase().then(() => setBase(null)); }}>×</button>}
      {mensaje && <span class="aviso" role="alert">{mensaje}</span>}
    </span>
  );
}
