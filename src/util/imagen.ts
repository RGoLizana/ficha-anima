/** Reduce una imagen elegida por el usuario a un cuadrado JPEG pequeño (centrado), para guardarla dentro de la ficha. */
export async function reducirImagen(archivo: File, lado = 256): Promise<string> {
  if (!/^image\//.test(archivo.type)) throw new Error('El archivo no es una imagen.');
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(archivo); } catch { throw new Error('No se pudo leer la imagen (prueba con JPG o PNG).'); }
  const m = Math.min(bmp.width, bmp.height);
  const c = Object.assign(document.createElement('canvas'), { width: lado, height: lado });
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Este navegador no puede reducir imágenes.');
  ctx.drawImage(bmp, (bmp.width - m) / 2, (bmp.height - m) / 2, m, m, 0, 0, lado, lado);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.85);
}
