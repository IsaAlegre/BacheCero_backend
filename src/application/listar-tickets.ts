import { ErrorEntradaInvalida } from './errores';
import { ESTADOS } from './gestion-tickets';

export const TAMANIO_PAGINA = 20;
export const ORDENES = ['prioridad', 'recientes', 'actualizados'] as const;
export type Orden = (typeof ORDENES)[number];

export interface TicketListado {
  readonly id: number;
  readonly tipo: string | null;
  readonly gravedad: string | null;
  readonly estado: string;
  readonly prioridad: number;
  readonly calle: string | null;
  readonly barrio: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly reportes: number;
  readonly necesitaRevision: boolean;
  readonly creadoEn: Date;
  readonly actualizadoEn: Date;
}

export interface FiltrosListado {
  readonly estado?: string;
  readonly orden?: string;
  readonly barrio?: string;
}

export interface FiltrosValidados {
  // null: solo tickets abiertos. Con un estado, muestra solo ese estado (también "resuelto").
  readonly estado: string | null;
  readonly orden: Orden;
  // Coincidencia exacta del nombre del barrio, sin distinguir mayúsculas.
  readonly barrio: string | null;
}

export function validarFiltros(filtros: FiltrosListado): FiltrosValidados {
  const estado = filtros.estado || undefined;
  if (estado !== undefined && !(ESTADOS as readonly string[]).includes(estado)) {
    throw new ErrorEntradaInvalida(`Estado inválido. Valores: ${ESTADOS.join(', ')}`);
  }
  const orden = filtros.orden || 'prioridad';
  if (!(ORDENES as readonly string[]).includes(orden)) {
    throw new ErrorEntradaInvalida(`Orden inválido. Valores: ${ORDENES.join(', ')}`);
  }
  const barrio = filtros.barrio?.trim() || undefined;
  if (barrio !== undefined && barrio.length > 100) {
    throw new ErrorEntradaInvalida('El nombre del barrio es demasiado largo');
  }
  return { estado: estado ?? null, orden: orden as Orden, barrio: barrio ?? null };
}

export interface PuertoConsultaTickets {
  listar(
    pagina: number,
    tamanio: number,
    filtros: FiltrosValidados,
  ): Promise<{ items: TicketListado[]; total: number }>;
}

// Tickets de a 20 por página. Por defecto: abiertos, de mayor a menor prioridad.
export class ListarTickets {
  constructor(private readonly consultas: PuertoConsultaTickets) {}

  async ejecutar(paginaSolicitada: number, filtros: FiltrosListado = {}) {
    const pagina = Number.isFinite(paginaSolicitada) && paginaSolicitada >= 1 ? Math.floor(paginaSolicitada) : 1;
    const validados = validarFiltros(filtros);
    const { items, total } = await this.consultas.listar(pagina, TAMANIO_PAGINA, validados);
    return {
      pagina,
      tamanio: TAMANIO_PAGINA,
      total,
      totalPaginas: Math.ceil(total / TAMANIO_PAGINA),
      filtros: validados,
      items,
    };
  }
}