import { ESTADOS_NOVEDAD } from '../domain/novedades';
import type { EstadoNovedad, OrigenNovedad } from '../domain/novedades';
import { ErrorEntradaInvalida, ErrorNoEncontrado } from './errores';
import { TAMANIO_PAGINA } from './listar-tickets';
import type { PuertoGestionNovedades } from './novedades';

// Lo que ve el vecino: sin autor ni datos internos.
export interface NovedadPublica {
  readonly id: number;
  readonly titulo: string;
  readonly contenido: string;
  readonly publicadoEn: Date;
}

// Lo que ve el administrador en el panel.
export interface NovedadGestion {
  readonly id: number;
  readonly titulo: string;
  readonly contenido: string;
  readonly estado: EstadoNovedad;
  readonly origen: OrigenNovedad;
  readonly autor: string;
  readonly aprobadoPor: string | null;
  readonly creadoEn: Date;
  readonly actualizadoEn: Date;
  readonly publicadoEn: Date | null;
}

export interface PuertoConsultaNovedades {
  listarPublicadas(pagina: number, tamanio: number): Promise<{ items: NovedadPublica[]; total: number }>;
  // estado null: borradores y publicadas.
  listarGestion(
    pagina: number,
    tamanio: number,
    estado: EstadoNovedad | null,
  ): Promise<{ items: NovedadGestion[]; total: number }>;
}

function paginaValida(solicitada: number): number {
  return Number.isFinite(solicitada) && solicitada >= 1 ? Math.floor(solicitada) : 1;
}

// Novedades publicadas, de la más nueva a la más vieja. Es lo que muestra la app del vecino.
export class ListarNovedades {
  constructor(private readonly consultas: PuertoConsultaNovedades) {}

  async ejecutar(paginaSolicitada: number) {
    const pagina = paginaValida(paginaSolicitada);
    const { items, total } = await this.consultas.listarPublicadas(pagina, TAMANIO_PAGINA);
    return { pagina, tamanio: TAMANIO_PAGINA, total, totalPaginas: Math.ceil(total / TAMANIO_PAGINA), items };
  }
}

// Panel del administrador: borradores y publicadas, con filtro opcional por estado.
export class ListarNovedadesGestion {
  constructor(private readonly consultas: PuertoConsultaNovedades) {}

  async ejecutar(paginaSolicitada: number, estado?: string) {
    const filtro = estado || undefined;
    if (filtro !== undefined && !(ESTADOS_NOVEDAD as readonly string[]).includes(filtro)) {
      throw new ErrorEntradaInvalida(`Estado inválido. Valores: ${ESTADOS_NOVEDAD.join(', ')}`);
    }
    const pagina = paginaValida(paginaSolicitada);
    const { items, total } = await this.consultas.listarGestion(pagina, TAMANIO_PAGINA, (filtro as EstadoNovedad) ?? null);
    return {
      pagina,
      tamanio: TAMANIO_PAGINA,
      total,
      totalPaginas: Math.ceil(total / TAMANIO_PAGINA),
      filtros: { estado: filtro ?? null },
      items,
    };
  }
}

// El vecino solo ve novedades publicadas: un borrador responde 404, no 403, para no revelar que existe.
export class VerNovedad {
  constructor(private readonly novedades: PuertoGestionNovedades) {}

  async ejecutar(id: number, esAdministrador: boolean): Promise<NovedadPublica | NovedadGestion> {
    const n = await this.novedades.obtener(id);
    if (!n || (n.estado !== 'publicado' && !esAdministrador)) throw new ErrorNoEncontrado('No existe la novedad');
    if (esAdministrador) return n;
    return { id: n.id, titulo: n.titulo, contenido: n.contenido, publicadoEn: n.publicadoEn as Date };
  }
}
