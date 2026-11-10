import { limitesDelMes, periodoValido } from '../domain/novedades';
import type { EstadoNovedad } from '../domain/novedades';
import { ErrorEntradaInvalida, ErrorOperacionInvalida } from './errores';
import { validarTexto } from './novedades';
import type { PuertoGestionNovedades } from './novedades';

export interface BarrioResuelto {
  readonly barrio: string | null; // null: tickets sin barrio identificado
  readonly cantidad: number;
}

// Solo datos agregados: a la IA generativa nunca le llegan fotos, usuarios ni ubicaciones exactas.
export interface ResumenMensual {
  readonly anio: number;
  readonly mes: number;
  readonly resueltos: number;
  readonly reparacionesIniciadas: number;
  readonly reportesRecibidos: number;
  readonly resueltosPorBarrio: readonly BarrioResuelto[];
}

export interface PuertoResumenMensual {
  resumir(desde: Date, hasta: Date, anio: number, mes: number): Promise<ResumenMensual>;
}

export interface BorradorRedactado {
  readonly titulo: string;
  readonly contenido: string;
}

export interface PuertoRedactorNovedades {
  redactar(resumen: ResumenMensual): Promise<BorradorRedactado>;
}

// Funcionalidad complementaria: el sistema funciona sin ella (redactor null).
// El resultado siempre queda como borrador: lo publica un administrador después de revisarlo.
export class GenerarBorradorNovedad {
  constructor(
    private readonly resumenes: PuertoResumenMensual,
    private readonly redactor: PuertoRedactorNovedades | null,
    private readonly novedades: PuertoGestionNovedades,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async ejecutar(
    anio: number,
    mes: number,
    autorId: number,
  ): Promise<{ id: number; estado: EstadoNovedad; titulo: string; contenido: string }> {
    if (!periodoValido(anio, mes, this.ahora())) {
      throw new ErrorEntradaInvalida('Período inválido: indicá un año y un mes (1 a 12) que no sean futuros');
    }
    if (!this.redactor) throw new ErrorOperacionInvalida('La generación de borradores con IA no está configurada');

    const { desde, hasta } = limitesDelMes(anio, mes);
    const resumen = await this.resumenes.resumir(desde, hasta, anio, mes);
    if (resumen.resueltos === 0 && resumen.reparacionesIniciadas === 0 && resumen.reportesRecibidos === 0) {
      throw new ErrorOperacionInvalida('No hubo actividad en ese mes: no hay datos para redactar un informe');
    }

    const redactado = await this.redactor.redactar(resumen);
    let texto;
    try {
      texto = validarTexto(redactado.titulo, redactado.contenido);
    } catch {
      throw new ErrorOperacionInvalida('La IA devolvió un texto inválido, volvé a intentar');
    }
    const id = await this.novedades.crear({ ...texto, origen: 'ia', autorId });
    return { id, estado: 'borrador', ...texto };
  }
}
