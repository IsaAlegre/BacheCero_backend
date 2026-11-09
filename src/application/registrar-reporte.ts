import type { Deteccion, TipoDano } from '../domain/reglas';
import {
  calcularPrioridad,
  danoPrincipal,
  maxConfianza,
  maxGravedad,
  PARAMETROS_POR_DEFECTO,
  Parametros,
  requiereRevision,
} from '../domain/reglas';
import { ErrorEntradaInvalida } from './errores';
import type {
  PuertoAlmacenImagenes,
  PuertoBarrios,
  PuertoCatalogos,
  PuertoIa,
  PuertoTickets,
  PuertoUbicacion,
} from './puertos';

export interface EntradaReporte {
  readonly usuarioId: number;
  readonly imagen: Buffer;
  readonly nombreArchivo: string;
  readonly lat: number;
  readonly lng: number;
  readonly descripcion?: string;
}

export interface DeteccionResultado {
  readonly tipo: TipoDano;
  readonly claseModelo: string;
  readonly confianza: number;
  readonly areaPct: number;
  readonly bbox: readonly [number, number, number, number];
}

export interface ResultadoReporte {
  readonly ticketId: number;
  readonly reporteId: number;
  readonly nuevoTicket: boolean;
  readonly prioridad: number;
  readonly necesitaRevision: boolean;
  readonly imagenUrl: string;
  readonly hayDano: boolean;
  readonly detecciones: DeteccionResultado[];
}

export interface DependenciasRegistrarReporte {
  readonly ia: PuertoIa;
  readonly imagenes: PuertoAlmacenImagenes;
  readonly ubicaciones: PuertoUbicacion;
  readonly catalogos: PuertoCatalogos;
  readonly barrios: PuertoBarrios;
  readonly tickets: PuertoTickets;
}

function resumenDetecciones(detecciones: readonly Deteccion[]): DeteccionResultado[] {
  return detecciones.map((d) => ({
    tipo: d.tipo,
    claseModelo: d.claseModelo,
    confianza: d.confianza,
    areaPct: d.areaPct,
    bbox: d.bbox as [number, number, number, number],
  }));
}

export class RegistrarReporte {
  constructor(
    private readonly deps: DependenciasRegistrarReporte,
    private readonly parametros: Parametros = PARAMETROS_POR_DEFECTO,
  ) {}

  async ejecutar(entrada: EntradaReporte): Promise<ResultadoReporte> {
    this.validar(entrada);

    // 1. Análisis: la IA difumina rostros y patentes y devuelve los daños detectados.
    const analisis = await this.deps.ia.analizar(entrada.imagen, entrada.nombreArchivo);

    // 2. Solo se guarda la imagen ya difuminada, nunca la original.
    const imagenUrl = await this.deps.imagenes.guardar(analisis.imagenDifuminada);

    // 3. Contexto geográfico: calle, jerarquía y barrio.
    const lugar = await this.deps.ubicaciones.resolver(entrada.lat, entrada.lng);
    const pesoJerarquia = await this.deps.catalogos.pesoJerarquia(lugar.osmHighway);
    const vulnerabilidad = await this.deps.barrios.indiceVulnerabilidad(lugar.barrio);

    // 4. Reglas de dominio.
    const principal = danoPrincipal(analisis.detecciones);
    const revision = requiereRevision(
      analisis.hayDano,
      maxConfianza(analisis.detecciones),
      this.parametros.umbralConfianza,
    );

    const reporteBase = {
      usuarioId: entrada.usuarioId,
      imagenUrl,
      lat: entrada.lat,
      lng: entrada.lng,
      descripcion: entrada.descripcion ?? null,
      respuestaIa: analisis.respuestaCruda,
      detecciones: analisis.detecciones,
    };

    // 5. Duplicado: mismo tipo de daño, abierto, dentro del radio.
    const abierto = principal
      ? await this.deps.tickets.buscarAbiertoCercano(
          principal.deteccion.tipo,
          entrada.lat,
          entrada.lng,
          this.parametros.radioDuplicadoMetros,
        )
      : null;

    if (abierto) {
      const reporteId = await this.deps.tickets.agregarReporte({ ...reporteBase, ticketId: abierto.id });
      const cantidad = await this.deps.tickets.contarReportes(abierto.id);
      const gravedad = maxGravedad(abierto.gravedad, principal?.gravedad ?? null);
      const necesitaRevision = abierto.necesitaRevision || revision;
      const prioridad = calcularPrioridad(
        {
          gravedad,
          pesoJerarquia: abierto.pesoJerarquia,
          cantidadReportes: cantidad,
          vulnerabilidad: abierto.vulnerabilidad,
        },
        this.parametros,
      );
      await this.deps.tickets.actualizarAnalisis(abierto.id, { gravedad, prioridad, necesitaRevision });
      return { ticketId: abierto.id, reporteId, nuevoTicket: false, prioridad, necesitaRevision, imagenUrl, hayDano: analisis.hayDano, detecciones: resumenDetecciones(analisis.detecciones) };
    }

    // 6. Ticket nuevo.
    const gravedad = principal?.gravedad ?? null;
    const prioridad = calcularPrioridad(
      { gravedad, pesoJerarquia, cantidadReportes: 1, vulnerabilidad },
      this.parametros,
    );
    const ticketId = await this.deps.tickets.crear({
      tipo: principal?.deteccion.tipo ?? null,
      gravedad,
      lat: entrada.lat,
      lng: entrada.lng,
      osmHighway: lugar.osmHighway,
      barrio: lugar.barrio,
      calle: lugar.calle,
      necesitaRevision: revision,
      prioridad,
    });
    const reporteId = await this.deps.tickets.agregarReporte({ ...reporteBase, ticketId });
    return { ticketId, reporteId, nuevoTicket: true, prioridad, necesitaRevision: revision, imagenUrl, hayDano: analisis.hayDano, detecciones: resumenDetecciones(analisis.detecciones) };
  }

  private validar(entrada: EntradaReporte): void {
    const { lat, lng } = entrada;
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new ErrorEntradaInvalida('La latitud debe estar entre -90 y 90');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new ErrorEntradaInvalida('La longitud debe estar entre -180 y 180');
    }
  }
}
