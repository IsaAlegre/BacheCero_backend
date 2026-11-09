import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { PuertoAlmacenImagenes } from '../../application/puertos';

// Solo para desarrollo: guarda la imagen en disco en vez de Cloudinary.
export class AlmacenLocal implements PuertoAlmacenImagenes {
  constructor(private readonly carpeta = join(process.cwd(), 'uploads')) {
    mkdirSync(carpeta, { recursive: true });
  }

  async guardar(imagenDifuminada: Buffer): Promise<string> {
    const nombre = `${randomUUID()}.jpg`;
    writeFileSync(join(this.carpeta, nombre), imagenDifuminada);
    return `local://uploads/${nombre}`;
  }
}
