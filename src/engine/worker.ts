// El motor de fórmulas en segundo plano: construir el libro tarda unos segundos y no debe congelar la página.
import { Libro, type Entrada, type Entradas, type Plantilla, type Valor } from './libro';

// Hojas cuyos valores se envían a la página (las "Tablas*" son internas)
const HOJAS = ['Principal', 'General', 'PDs', 'Combate', 'Ki', 'Creación de Técnicas', 'Místicos', 'Metamagia',
  'Sheele', 'Psíquicos', 'Elan', 'Personalización', 'Grimorio Magia', 'Grimorio de Vía', 'Grimorio Psíquica', 'Resumen'];
const visible = (k: string) => HOJAS.includes(k.slice(0, k.lastIndexOf('!')));

export type Mensaje =
  | { tipo: 'iniciar'; url: string }
  | { tipo: 'cargar'; entradas: Entradas }
  | { tipo: 'poner'; clave: string; valor: Entrada | null }
  | { tipo: 'lista'; formula: string; hoja: string };

let libro: Libro;

self.onmessage = async (e: MessageEvent<Mensaje & { id: number }>) => {
  const { id, ...m } = e.data;
  try {
    let res: unknown;
    if (m.tipo === 'iniciar') {
      const t0 = performance.now();
      const r = await fetch(m.url);
      if (!r.ok) throw new Error(`No se pudo descargar la plantilla (${r.status})`);
      const plantilla = (await r.json()) as Plantilla;
      const t1 = performance.now();
      libro = new Libro(plantilla);
      res = { descarga: Math.round(t1 - t0), construir: Math.round(performance.now() - t1) };
    } else if (m.tipo === 'cargar') {
      const t0 = performance.now();
      libro.cargar(m.entradas);
      const t1 = performance.now();
      res = libro.hojas(HOJAS);
      console.debug(`[motor] cargar ficha ${Math.round(t1 - t0)} ms, leer valores ${Math.round(performance.now() - t1)} ms`);
    } else if (m.tipo === 'poner') {
      const cambios = libro.poner(m.clave, m.valor);
      res = Object.fromEntries(Object.entries(cambios).filter(([k]) => visible(k))) as Record<string, Valor>;
    } else {
      res = libro.lista(m.formula, m.hoja);
    }
    postMessage({ id, res });
  } catch (err) {
    postMessage({ id, error: (err as Error).message });
  }
};
