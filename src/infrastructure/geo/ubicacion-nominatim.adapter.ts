import type { PuertoUbicacion, UbicacionResuelta } from '../../application/puertos';

interface RespuestaNominatim {
  category?: string;
  type?: string;
  address?: Record<string, string>;
}

// Geocodificación inversa de OpenStreetMap. Política de uso: máximo 1 pedido por segundo
// y un User-Agent que identifique la aplicación. Para más volumen, usar un servidor propio.
export class UbicacionNominatim implements PuertoUbicacion {
  constructor(
    private readonly userAgent: string,
    private readonly baseUrl = 'https://nominatim.openstreetmap.org',
  ) {}

  async resolver(lat: number, lng: number): Promise<UbicacionResuelta> {
    const url = new URL('/reverse', this.baseUrl);
    url.search = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '17',
      addressdetails: '1',
    }).toString();

    const respuesta = await fetch(url, {
      headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!respuesta.ok) {
      return { calle: null, osmHighway: null, barrio: null };
    }

    const datos = (await respuesta.json()) as RespuestaNominatim;
    const dir = datos.address ?? {};
    return {
      calle: dir.road ?? null,
      osmHighway: datos.category === 'highway' ? (datos.type ?? null) : null,
      barrio: dir.neighbourhood ?? dir.suburb ?? null,
    };
  }
}
