import { ErrorImagenInvalida } from '../../application/errores';
import type { PuertoIa, ResultadoIa } from '../../application/puertos';
import type { Deteccion, TipoDano } from '../../domain/reglas';

interface RespuestaIaApi {
  image: string;
  detections: Array<{
    type: TipoDano;
    model_class: string;
    confidence: number;
    bbox: [number, number, number, number];
    area_pct: number;
  }>;
  summary: { damage_found: boolean; max_confidence: number };
  [clave: string]: unknown;
}

// Adaptador del microservicio de IA (bache-cero-ia): POST /v1/analyze.
export class IaHttpAdapter implements PuertoIa {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async analizar(imagen: Buffer, nombreArchivo: string): Promise<ResultadoIa> {
    const formulario = new FormData();
    formulario.append('file', new Blob([imagen]), nombreArchivo);

    const respuesta = await fetch(new URL('/v1/analyze', this.baseUrl), {
      method: 'POST',
      body: formulario,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if ([413, 415, 422].includes(respuesta.status)) {
      throw new ErrorImagenInvalida(`La IA rechazó la imagen (HTTP ${respuesta.status})`);
    }
    if (!respuesta.ok) {
      throw new Error(`La IA respondió con HTTP ${respuesta.status}`);
    }

    const { image, ...resto } = (await respuesta.json()) as RespuestaIaApi;
    const detecciones: Deteccion[] = resto.detections.map((d) => ({
      tipo: d.type,
      claseModelo: d.model_class,
      confianza: d.confidence,
      areaPct: d.area_pct,
      bbox: d.bbox,
    }));

    return {
      hayDano: resto.summary.damage_found,
      detecciones,
      imagenDifuminada: Buffer.from(image, 'base64'),
      respuestaCruda: resto as Record<string, unknown>,
    };
  }
}
