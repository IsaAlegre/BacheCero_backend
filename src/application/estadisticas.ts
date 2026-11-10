import { ErrorEntradaInvalida } from './errores';

export const LIMITE_ZONAS_POR_DEFECTO = 10;
export const LIMITE_ZONAS_MAXIMO = 50;

// Las fechas del filtro son días calendario de Posadas (UTC-3, sin horario de verano).
const DESFASE_HORARIO = '-03:00';
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// ---------- Resultados ----------

export interface CantidadPorEstado {
  readonly codigo: string;
  readonly nombre: string;
  readonly cantidad: number;
}

export interface ResumenTickets {
  readonly total: number;
  readonly abiertos: number;
  readonly resueltos: number;
  // Tickets que todavía esperan que una persona confirme o rechace la detección de la IA.
  readonly necesitanRevision: number;
  readonly porEstado: readonly CantidadPorEstado[];
}

export interface TiempoResolucion {
  // Cantidad de tickets resueltos sobre los que se calculó. Con muestra 0 los promedios son null.
  readonly muestra: number;
  readonly promedioHoras: number | null;
  readonly medianaHoras: number | null;
}

export interface ZonaConCasos {
  readonly barrio: string;
  readonly total: number;
  readonly abiertos: number;
  readonly resueltos: number;
}

export interface ZonasConMasCasos {
  readonly items: readonly ZonaConCasos[];
  // Tickets sin barrio asignado: no entran en `items`, pero se informan para no esconderlos.
  readonly sinBarrio: number;
}

// ---------- Filtros ----------

export interface FiltrosEstadisticas {
  // Llegan tal cual del query string: se validan acá, no en el controlador.
  readonly desde?: unknown;
  readonly hasta?: unknown;
  readonly limiteZonas?: unknown;
}

export interface FiltrosValidados {
  readonly desde: string | null; // AAAA-MM-DD, inclusive
  readonly hasta: string | null; // AAAA-MM-DD, inclusive
  readonly limiteZonas: number;
}

// Lo que reciben las consultas: un rango de instantes. `hastaExclusivo` es el comienzo del día siguiente.
export interface Periodo {
  readonly desde: Date | null;
  readonly hastaExclusivo: Date | null;
}

function validarFecha(valor: unknown, nombre: string): string | null {
  if (valor === undefined || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new ErrorEntradaInvalida(`"${nombre}" debe tener el formato AAAA-MM-DD`);
  }
  if (!existeEnCalendario(valor)) throw new ErrorEntradaInvalida(`"${nombre}" no es una fecha válida`);
  return valor;
}

// JavaScript "corrige" las fechas que no existen (2026-02-30 pasa a marzo) en lugar de fallar.
function existeEnCalendario(valor: string): boolean {
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

export function validarFiltros(filtros: FiltrosEstadisticas): FiltrosValidados {
  const desde = validarFecha(filtros.desde, 'desde');
  const hasta = validarFecha(filtros.hasta, 'hasta');
  if (desde && hasta && desde > hasta) {
    throw new ErrorEntradaInvalida('"desde" no puede ser posterior a "hasta"');
  }

  let limiteZonas = LIMITE_ZONAS_POR_DEFECTO;
  if (filtros.limiteZonas !== undefined && filtros.limiteZonas !== '') {
    const numero = typeof filtros.limiteZonas === 'string' ? Number(filtros.limiteZonas) : NaN;
    if (!Number.isInteger(numero) || numero < 1 || numero > LIMITE_ZONAS_MAXIMO) {
      throw new ErrorEntradaInvalida(`"limiteZonas" debe ser un entero entre 1 y ${LIMITE_ZONAS_MAXIMO}`);
    }
    limiteZonas = numero;
  }

  return { desde, hasta, limiteZonas };
}

export function periodoDe(filtros: FiltrosValidados): Periodo {
  const desde = filtros.desde ? new Date(`${filtros.desde}T00:00:00${DESFASE_HORARIO}`) : null;
  const hastaExclusivo = filtros.hasta
    ? new Date(new Date(`${filtros.hasta}T00:00:00${DESFASE_HORARIO}`).getTime() + MS_POR_DIA)
    : null;
  return { desde, hastaExclusivo };
}

// ---------- Puerto y caso de uso ----------

// Una métrica nueva = un método acá, su consulta en el adaptador y una línea en `ObtenerEstadisticas`.
// Todas filtran por la fecha de creación del ticket (cuándo se reportó el bache).
export interface PuertoConsultaEstadisticas {
  resumen(periodo: Periodo): Promise<ResumenTickets>;
  tiempoResolucion(periodo: Periodo): Promise<TiempoResolucion>;
  zonasConMasCasos(periodo: Periodo, limite: number): Promise<ZonasConMasCasos>;
}

export class ObtenerEstadisticas {
  constructor(
    private readonly consultas: PuertoConsultaEstadisticas,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async ejecutar(filtros: FiltrosEstadisticas = {}) {
    const validados = validarFiltros(filtros);
    const periodo = periodoDe(validados);

    const [resumen, tiempoResolucion, zonas] = await Promise.all([
      this.consultas.resumen(periodo),
      this.consultas.tiempoResolucion(periodo),
      this.consultas.zonasConMasCasos(periodo, validados.limiteZonas),
    ]);

    return { generadoEn: this.ahora(), filtros: validados, resumen, tiempoResolucion, zonas };
  }
}
