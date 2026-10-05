import { useState } from 'preact/hooks';
import type { Ficha } from '../model/ficha';
import { nombreDe } from '../model/ficha';
import { guardarRetrato } from '../store';
import { reducirImagen } from '../util/imagen';

/** Icono del personaje: su imagen, o la inicial del nombre. Con `editable`, un clic permite añadir, cambiar o quitar la imagen. */
export function Avatar({ f, sm, grande, editable }: { f: Ficha; sm?: boolean; grande?: boolean; editable?: boolean }) {
  const [error, setError] = useState('');
  const inicial = nombreDe(f).trim()[0]?.toUpperCase() ?? '?';
  const contenido = f.retrato ? <img src={f.retrato} alt={`Imagen de ${nombreDe(f) || 'el personaje'}`} /> : grande ? <span class="avatar-vacio">{editable ? 'Añadir imagen' : inicial}</span> : inicial;
  const clase = `avatar${sm ? ' sm' : ''}${grande ? ' xl' : ''}`;
  if (!editable) return <div class={clase}>{contenido}</div>;

  async function elegir(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    setError('');
    try { guardarRetrato(f.id, await reducirImagen(archivo)); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }
  return (
    <span class="avatar-edit row">
      <label class={`${clase} editable`} title={f.retrato ? 'Cambiar la imagen del personaje' : 'Añadir una imagen del personaje'}>
        {contenido}
        <input type="file" accept="image/*" hidden aria-label="Imagen del personaje" onChange={elegir} />
      </label>
      {f.retrato && <button class="icon-btn plain" aria-label="Quitar la imagen del personaje" title="Quitar la imagen" onClick={() => guardarRetrato(f.id, null)}>×</button>}
      {error && <span class="aviso" role="alert">{error}</span>}
    </span>
  );
}
