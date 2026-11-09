import { puedeTransicionar } from '../domain/reglas';
import { ErrorEntradaInvalida, ErrorNoEncontrado, ErrorOperacionInvalida } from './errores';

export const ESTADOS = ['pendiente', 'programado', 'en_reparacion', 'resuelto'] as const;
export const DECISIONES_REVISION = ['confirmada', 'rechazada'] as const;

export interface DeteccionDetalle {
  readonly tipo: string;
  readonly claseModelo: string;
  readonly confianza: number;
  readonly areaPct: number;
  readonly bbox: readonly [number, number, number, number];
}

export interface ReporteDetalle {
  readonly id: number;
  readonly imagenUrl: string;
  readonly descripcion: string | null;
  readonly creadoEn: Date;
  readonly detecciones: DeteccionDetalle[];
}

export interface CambioEstado {
  readonly estadoAnterior: string | null;
  readonly estadoNuevo: string;
  readonly usuario: string;
  readonly creadoEn: Date;
}

export interface TicketDetalle {
  readonly id: number;
  readonly tipo: string | null;
  readonly gravedad: string | null;
  readonly estado: string;
  readonly prioridad: number;
  readonly calle: string | null;
  readonly barrio: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly necesitaRevision: boolean;
  readonly revisionDecision: string | null;
  readonly creadoEn: Date;
  readonly reportes: ReporteDetalle[];
  readonly historial: CambioEstado[];
}

export interface PuertoGestionTickets {
  obtenerDetalle(id: number): Promise<TicketDetalle | null>;
  obtenerEstado(id: number): Promise<{ estado: string; necesitaRevision: boolean } | null>;
  // Devuelven false si el dato cambió entre la lectura y la escritura (otro usuario actuó antes).
  cambiarEstado(ticketId: number, estadoAnterior: string, estadoNuevo: string, usuarioId: number): Promise<boolean>;
  registrarRevision(ticketId: number, decision: string, usuarioId: number): Promise<boolean>;
}

export class VerDetalleTicket {
  constructor(private readonly gestion: PuertoGestionTickets) {}

  async ejecutar(id: number): Promise<TicketDetalle> {
    const ticket = await this.gestion.obtenerDetalle(id);
    if (!ticket) throw new ErrorNoEncontrado('No existe el ticket');
    return ticket;
  }
}

export class CambiarEstadoTicket {
  constructor(private readonly gestion: PuertoGestionTickets) {}

  async ejecutar(id: number, nuevo: string, usuarioId: number): Promise<{ id: number; estado: string }> {
    if (!(ESTADOS as readonly string[]).includes(nuevo)) throw new ErrorEntradaInvalida('Estado inválido');
    const actual = await this.gestion.obtenerEstado(id);
    if (!actual) throw new ErrorNoEncontrado('No existe el ticket');
    if (actual.estado === nuevo) throw new ErrorOperacionInvalida(`El ticket ya está en estado ${nuevo}`);
    if (!puedeTransicionar(actual.estado as never, nuevo as never)) {
      throw new ErrorOperacionInvalida(`No se puede pasar de ${actual.estado} a ${nuevo}`);
    }
    const aplicado = await this.gestion.cambiarEstado(id, actual.estado, nuevo, usuarioId);
    if (!aplicado) throw new ErrorOperacionInvalida('El ticket cambió de estado mientras lo editabas, recargá y volvé a intentar');
    return { id, estado: nuevo };
  }
}

// Confirmar o rechazar la detección marcada para revisión.
// Rechazar no cambia el estado del ticket: queda abierto hasta que el operador decida.
export class ResolverRevision {
  constructor(private readonly gestion: PuertoGestionTickets) {}

  async ejecutar(id: number, decision: string, usuarioId: number): Promise<{ id: number; decision: string }> {
    if (!(DECISIONES_REVISION as readonly string[]).includes(decision)) {
      throw new ErrorEntradaInvalida('La decisión debe ser "confirmada" o "rechazada"');
    }
    const actual = await this.gestion.obtenerEstado(id);
    if (!actual) throw new ErrorNoEncontrado('No existe el ticket');
    if (!actual.necesitaRevision) throw new ErrorOperacionInvalida('El ticket no está pendiente de revisión');
    const aplicado = await this.gestion.registrarRevision(id, decision, usuarioId);
    if (!aplicado) throw new ErrorOperacionInvalida('La revisión de este ticket ya fue resuelta');
    return { id, decision };
  }
}
