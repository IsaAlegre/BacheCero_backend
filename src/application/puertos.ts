// Puertos: lo que la aplicación necesita del mundo exterior. Los adaptadores van en infrastructure/.
import type { Deteccion, Gravedad, TipoDano } from '../domain/reglas';

export interface ResultadoIa {
  readonly hayDano: boolean;
  readonly detecciones: readonly Deteccion[];
  readonly imagenDifuminada: Buffer;
  readonly respuestaCruda: Record<string, unknown>; // respuesta de la IA sin la imagen
}

export interface PuertoIa {
  analizar(imagen: Buffer, nombreArchivo: string): Promise<ResultadoIa>;
}

export interface PuertoAlmacenImagenes {
  guardar(imagenDifuminada: Buffer): Promise<string>; // devuelve la URL
}

export interface UbicacionResuelta {
  readonly calle: string | null;
  readonly osmHighway: string | null;
  readonly barrio: string | null;
}

export interface PuertoUbicacion {
  resolver(lat: number, lng: number): Promise<UbicacionResuelta>;
}

export interface PuertoCatalogos {
  pesoJerarquia(osmHighway: string | null): Promise<number | null>;
}

export interface PuertoBarrios {
  indiceVulnerabilidad(nombre: string | null): Promise<number | null>;
}

export interface TicketAbierto {
  readonly id: number;
  readonly gravedad: Gravedad | null;
  readonly pesoJerarquia: number | null;
  readonly vulnerabilidad: number | null;
  readonly necesitaRevision: boolean;
}

export interface NuevoTicket {
  readonly tipo: TipoDano | null;
  readonly gravedad: Gravedad | null;
  readonly lat: number;
  readonly lng: number;
  readonly osmHighway: string | null;
  readonly barrio: string | null;
  readonly calle: string | null;
  readonly necesitaRevision: boolean;
  readonly prioridad: number;
}

export interface NuevoReporte {
  readonly ticketId: number;
  readonly usuarioId: number;
  readonly imagenUrl: string;
  readonly lat: number;
  readonly lng: number;
  readonly descripcion: string | null;
  readonly respuestaIa: Record<string, unknown>;
  readonly detecciones: readonly Deteccion[];
}

export interface PuertoTickets {
  buscarAbiertoCercano(
    tipo: TipoDano,
    lat: number,
    lng: number,
    radioMetros: number,
  ): Promise<TicketAbierto | null>;
  crear(ticket: NuevoTicket): Promise<number>;
  agregarReporte(reporte: NuevoReporte): Promise<number>;
  contarReportes(ticketId: number): Promise<number>;
  actualizarAnalisis(
    ticketId: number,
    cambios: { gravedad: Gravedad | null; prioridad: number; necesitaRevision: boolean },
  ): Promise<void>;
}
