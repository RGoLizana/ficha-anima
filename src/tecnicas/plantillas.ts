// Plantillas para empezar una técnica: ideas del Core recalculadas con las tablas del Excel (el reparto de ki se calcula, no se copia del libro).
import { copia, desventaja, efecto, nuevoEfecto, vacia, type Tecnica } from './calculo';

export interface PlantillaTecnica {
  titulo: string; sub: string; nombre: string;
  efectos: [nombre: string, grado: string][];
  atadura?: [string, string];   // Atadura Elemental a dos elementos
}

export const PLANTILLAS_TECNICA: PlantillaTecnica[] = [
  { titulo: 'Recuperar el aliento', sub: 'Base de Baile espectral (Lock): una reacción para recuperar la acción', nombre: 'Baile espectral', efectos: [['Recuperar Acción', '']], atadura: ['Luz', 'Fuego'] },
  { titulo: 'Ofensiva a distancia', sub: 'Inspirada en Le Feu (Ignis, Core): un golpe que llega lejos', nombre: 'Bola de fuego', efectos: [['Habilidad de Ataque', '+40'], ['Ataque a Distancia', '20 metros']] },
  { titulo: 'Defensiva', sub: 'Inspirada en Las escamas (El Dragón, Core): defenderte de más ataques', nombre: 'Las escamas', efectos: [['Defensas Adicionales', '+4']] },
  { titulo: 'Velocidad', sub: 'Inspirada en Excisum Aeris (Celéritas, Core): atacar de lejos y actuar antes', nombre: 'Excisum Aeris', efectos: [['Ataque a Distancia', '50 metros'], ['Incrementar Turno', '+50']] },
];

/** Técnica de nivel 1 con los efectos de la plantilla (sin repartir el ki: eso lo hace `normalizar`). */
export function construirPlantilla(p: PlantillaTecnica): Tecnica {
  const t = vacia();
  t.nombre = p.nombre;
  t.efectos = p.efectos.map(([n, g], i) => {
    const e = nuevoEfecto(efecto(n)!.n, i === 0 ? 'Primario' : 'Secundario');
    e.g = efecto(n)!.g.findIndex((x) => x[0] === g);
    return e;
  });
  if (p.atadura) t.desv = [{ n: desventaja('Atadura Elemental')!.n, o: 1, el: p.atadura }];
  return copia(t);
}
