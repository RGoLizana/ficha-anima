import { signal } from '@preact/signals';

// Rutas por hash: #/  ·  #/ficha/<id>/<seccion>
export const ruta = signal(location.hash);
addEventListener('hashchange', () => (ruta.value = location.hash));

export const ir = (hash: string) => (location.hash = hash);
