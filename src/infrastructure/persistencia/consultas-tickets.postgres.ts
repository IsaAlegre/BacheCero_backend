import type { DataSource } from 'typeorm';
import type { FiltrosValidados, Orden, PuertoConsultaTickets, TicketListado } from '../../application/listar-tickets';

// Las cláusulas de orden salen de esta lista fija, nunca del texto que manda el cliente.
const ORDEN_SQL: Record<Orden, string> = {
  prioridad: 't.prioridad DESC, t.creado_en ASC, t.id ASC',
  recientes: 't.creado_en DESC, t.id DESC',
  actualizados: 't.actualizado_en DESC, t.id DESC',
};

export class ConsultasTicketsPostgres implements PuertoConsultaTickets {
  constructor(private readonly db: DataSource) {}

  async listar(
    pagina: number,
    tamanio: number,
    filtros: FiltrosValidados,
  ): Promise<{ items: TicketListado[]; total: number }> {
    const parametros: unknown[] = filtros.estado ? [filtros.estado] : [];
    const condicion = filtros.estado ? 'e.codigo = $1' : 'e.abierto = true';
    const n = parametros.length;

    const filas: Array<{
      id: string; tipo: string | null; gravedad: string | null; estado: string; prioridad: string;
      calle_nombre: string | null; barrio: string | null; lat: number; lng: number; reportes: string;
      necesita_revision: boolean; creado_en: Date; actualizado_en: Date;
    }> = await this.db.query(
      `SELECT t.id, td.codigo AS tipo, g.codigo AS gravedad, e.codigo AS estado, t.prioridad,
              t.calle_nombre, b.nombre AS barrio,
              ST_Y(t.ubicacion::geometry) AS lat, ST_X(t.ubicacion::geometry) AS lng,
              (SELECT count(*) FROM reportes r WHERE r.ticket_id = t.id) AS reportes,
              t.necesita_revision, t.creado_en, t.actualizado_en
         FROM tickets t
         JOIN estados e ON e.id = t.estado_id
         LEFT JOIN tipos_dano td ON td.id = t.tipo_dano_id
         LEFT JOIN gravedades g ON g.id = t.gravedad_id
         LEFT JOIN barrios b ON b.id = t.barrio_id
        WHERE ${condicion}
        ORDER BY ${ORDEN_SQL[filtros.orden]}
        LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...parametros, tamanio, (pagina - 1) * tamanio],
    );

    const [{ total }] = await this.db.query(
      `SELECT count(*) AS total FROM tickets t JOIN estados e ON e.id = t.estado_id WHERE ${condicion}`,
      parametros,
    );

    return {
      total: Number(total),
      items: filas.map((f) => ({
        id: Number(f.id),
        tipo: f.tipo,
        gravedad: f.gravedad,
        estado: f.estado,
        prioridad: Number(f.prioridad),
        calle: f.calle_nombre,
        barrio: f.barrio,
        lat: Number(f.lat),
        lng: Number(f.lng),
        reportes: Number(f.reportes),
        necesitaRevision: f.necesita_revision,
        creadoEn: f.creado_en,
        actualizadoEn: f.actualizado_en,
      })),
    };
  }
}
