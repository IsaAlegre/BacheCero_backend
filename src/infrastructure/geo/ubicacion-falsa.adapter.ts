import type { PuertoUbicacion, UbicacionResuelta } from '../../application/puertos';

// Solo para desarrollo: no consulta Nominatim.
export class UbicacionFalsa implements PuertoUbicacion {
  async resolver(): Promise<UbicacionResuelta> {
    return { calle: 'Calle de prueba', osmHighway: 'primary', barrio: null };
  }
}
