import { TAMANIO_PAGINA } from './listar-tickets';

export interface ReporteDeUsuario {
  readonly id: number;
  readonly imagenUrl: string;
  readonly descripcion: string | null;
  readonly creadoEn: Date;
  // Estado actual del ticket al que pertenece el reporte.
  readonly ticket: {
    readonly id: number;
    readonly estado: string;
    readonly tipo: string | null;
    readonly gravedad: string | null;
    readonly calle: string | null;
    readonly barrio: string | null;
    readonly prioridad: number;
  };
}

export interface PuertoMisReportes {
  listarDeUsuario(
    usuarioId: number,
    pagina: number,
    tamanio: number,
  ): Promise<{ items: ReporteDeUsuario[]; total: number }>;
}

// Solo devuelve los reportes del usuario que pide, nunca los de otros.
export class ListarMisReportes {
  constructor(private readonly reportes: PuertoMisReportes) {}

  async ejecutar(usuarioId: number, paginaSolicitada: number) {
    const pagina = Number.isFinite(paginaSolicitada) && paginaSolicitada >= 1 ? Math.floor(paginaSolicitada) : 1;
    const { items, total } = await this.reportes.listarDeUsuario(usuarioId, pagina, TAMANIO_PAGINA);
    return {
      pagina,
      tamanio: TAMANIO_PAGINA,
      total,
      totalPaginas: Math.ceil(total / TAMANIO_PAGINA),
      items,
    };
  }
}