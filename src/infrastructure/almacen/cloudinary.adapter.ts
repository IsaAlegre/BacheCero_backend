import { v2 as cloudinary } from 'cloudinary';
import type { PuertoAlmacenImagenes } from '../../application/puertos';

export interface ConfigCloudinary {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

// Sube solo la imagen ya difuminada. Ver README: el acceso restringido requiere URLs firmadas.
export class AlmacenCloudinary implements PuertoAlmacenImagenes {
  constructor(config: ConfigCloudinary) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  guardar(imagenDifuminada: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const subida = cloudinary.uploader.upload_stream(
        { folder: 'bache-cero/reportes', resource_type: 'image' },
        (error, resultado) => {
          if (error || !resultado) {
            reject(error ?? new Error('Cloudinary no devolvió resultado'));
            return;
          }
          resolve(resultado.secure_url);
        },
      );
      subida.end(imagenDifuminada);
    });
  }
}
