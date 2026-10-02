import type { Valor } from '../engine/libro';
import type { Tramo } from './Pagina';

// Texto de la página de notas tal como lo compone la macro FillPDFNotes del Excel (títulos en negrita a 12 pt).
// Celdas de cada nota según los nombres definidos NotasXxx / NotasXxxTitulo.
const NOTAS: [string, string, string][] = [
  ['Principal', 'Principal!G67', 'Principal!G68'],
  ['Poderes', 'Principal!V74', 'Principal!W74'],
  ['PDs', 'PDs!C197', 'PDs!D197'],
  ['EquipoCombate', 'Combate!C66', 'Combate!C67'],
  ['CapacidadesCombate', 'Combate!AB66', 'Combate!AB67'],
  ['Ki', 'Ki!C66', 'Ki!C67'],
  ['Misticos', 'Místicos!C63', 'Místicos!C64'],
  ['Sheele', 'Sheele!C91', 'Sheele!C92'],
  ['Psiquicos', 'Psíquicos!C52', 'Psíquicos!C53'],
  ['Personalizacion', 'Personalización!C133', 'Personalización!C134'],
];
const hay = (v: Valor | undefined) => v !== undefined && v !== null && v !== '' && v !== false;
export type Opciones = { idiomas: boolean; notas: boolean };

export function tramosNotas(valores: Record<string, Valor>, o: Opciones): Tramo[] {
  const tramos: Tramo[] = [];
  if (o.idiomas && hay(valores['Principal!E78'])) {
    tramos.push({ t: String(valores['Principal!C67'] ?? ''), b: true, pt: 12 }, { t: `: ${valores['Principal!E78']}\n\n`, b: false, pt: 10 });
  }
  if (o.notas) {
    for (const [, titulo, texto] of NOTAS) {
      if (hay(valores[texto])) tramos.push({ t: String(valores[titulo] ?? ''), b: true, pt: 12 }, { t: `\n${valores[texto]}\n\n`, b: false, pt: 10 });
    }
  }
  return tramos;
}
