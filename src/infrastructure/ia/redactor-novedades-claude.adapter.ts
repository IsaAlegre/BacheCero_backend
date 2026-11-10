import type { BorradorRedactado, PuertoRedactorNovedades, ResumenMensual } from '../../application/generar-borrador-novedad';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const SISTEMA = [
  'Redactás novedades breves para los vecinos de Posadas (Misiones, Argentina) sobre el mantenimiento de las calles.',
  'Usá únicamente los datos que te pasa el usuario: no inventes cifras, barrios, fechas ni promesas.',
  'Tono claro, cercano y respetuoso, en español rioplatense neutro, sin tecnicismos ni jerga interna.',
  'El contenido tiene entre 2 y 4 párrafos cortos. Si un dato es cero, no lo destaques.',
  'Respondé SOLO con un objeto JSON válido, sin texto antes ni después ni bloques de código: {"titulo": string, "contenido": string}.',
  'El título tiene como máximo 100 caracteres.',
].join(' ');

export function construirPrompt(resumen: ResumenMensual): string {
  const barrios = resumen.resueltosPorBarrio.length
    ? resumen.resueltosPorBarrio.map((b) => `- ${b.barrio ?? 'Barrio sin identificar'}: ${b.cantidad}`).join('\n')
    : '- (sin datos por barrio)';
  return [
    `Redactá la novedad mensual de ${MESES[resumen.mes - 1]} de ${resumen.anio}.`,
    `Baches y daños resueltos en el mes: ${resumen.resueltos}.`,
    `Reparaciones iniciadas en el mes: ${resumen.reparacionesIniciadas}.`,
    `Reportes de vecinos recibidos en el mes: ${resumen.reportesRecibidos}.`,
    'Resueltos por barrio:',
    barrios,
  ].join('\n');
}

// Acepta la respuesta con o sin bloque ```json y exige título y contenido de texto.
export function parsearRespuesta(texto: string): BorradorRedactado {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let datos: unknown;
  try {
    datos = JSON.parse(limpio);
  } catch {
    throw new Error('La IA no devolvió un JSON válido');
  }
  const { titulo, contenido } = (datos ?? {}) as { titulo?: unknown; contenido?: unknown };
  if (typeof titulo !== 'string' || typeof contenido !== 'string') {
    throw new Error('La respuesta de la IA no trae título y contenido');
  }
  return { titulo, contenido };
}

export interface OpcionesRedactorClaude {
  readonly apiKey: string;
  readonly modelo: string;
  readonly url?: string;
  readonly timeoutMs?: number;
}

// Llama a la API de Anthropic con fetch (Node 18+): no hace falta instalar ninguna dependencia.
export class RedactorNovedadesClaude implements PuertoRedactorNovedades {
  constructor(private readonly opciones: OpcionesRedactorClaude) {}

  async redactar(resumen: ResumenMensual): Promise<BorradorRedactado> {
    const respuesta = await fetch(this.opciones.url ?? 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.opciones.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.opciones.modelo,
        max_tokens: 1000,
        system: SISTEMA,
        messages: [{ role: 'user', content: construirPrompt(resumen) }],
      }),
      signal: AbortSignal.timeout(this.opciones.timeoutMs ?? 30_000),
    });
    if (!respuesta.ok) throw new Error(`La API de IA respondió ${respuesta.status}`);

    const cuerpo = (await respuesta.json()) as { content?: Array<{ type: string; text?: string }> };
    const texto = (cuerpo.content ?? [])
      .filter((bloque) => bloque.type === 'text')
      .map((bloque) => bloque.text ?? '')
      .join('');
    return parsearRespuesta(texto);
  }
}
