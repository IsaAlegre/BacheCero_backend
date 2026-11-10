import type { DataSource } from 'typeorm';
import type { PuertoGestionTickets, TicketDetalle } from '../../application/gestion-tickets';

export class GestionTicketsPostgres implements PuertoGestionTickets {
  constructor(private readonly db: DataSource) {}

  async obtenerEstado(id: number): Promise<{ estado: string; necesitaRevision: boolean } | null> {
    const filas: Array<{ estado: string; necesita_revision: boolean }> = await this.db.query(
      `SELECT e.codigo AS estado, t.necesita_revision
         FROM tickets t JOIN estados e ON e.id = t.estado_id
        WHERE t.id = $1`,
      [id],
    );
    const f = filas[0];
    return f ? { estado: f.estado, necesitaRevision: f.necesita_revision } : null;
  }

  async obtenerDetalle(id: number): Promise<TicketDetalle | null> {
    const tickets: Array<Record<string, any>> = await this.db.query(
      `SELECT t.id, td.codigo AS tipo, g.codigo AS gravedad, e.codigo AS estado, t.prioridad,
              t.calle_nombre, t.barrio_nombre AS barrio,
              ST_Y(t.ubicacion::geometry) AS lat, ST_X(t.ubicacion::geometry) AS lng,
              t.necesita_revision, t.revision_decision, t.creado_en
         FROM tickets t
         JOIN estados e ON e.id = t.estado_id
         LEFT JOIN tipos_dano td ON td.id = t.tipo_dano_id
         LEFT JOIN gravedades g ON g.id = t.gravedad_id
        WHERE t.id = $1`,
      [id],
    );
    const t = tickets[0];
    if (!t) return null;

    const reportes: Array<Record<string, any>> = await this.db.query(
      `SELECT id, imagen_url, descripcion, creado_en FROM reportes WHERE ticket_id = $1 ORDER BY creado_en ASC`,
      [id],
    );
    const detecciones: Array<Record<string, any>> = reportes.length
      ? await this.db.query(
          `SELECT d.reporte_id, td.codigo AS tipo, d.clase_modelo, d.confianza, d.x1, d.y1, d.x2, d.y2, d.area_pct
             FROM detecciones d JOIN tipos_dano td ON td.id = d.tipo_dano_id
            WHERE d.reporte_id = ANY($1::bigint[])`,
          [reportes.map((r) => r.id)],
        )
      : [];

    const historial: Array<Record<string, any>> = await this.db.query(
      `SELECT ea.codigo AS anterior, en.codigo AS nuevo, u.nombre AS usuario, h.creado_en
         FROM historial_estados h
         LEFT JOIN estados ea ON ea.id = h.estado_anterior_id
         JOIN estados en ON en.id = h.estado_nuevo_id
         JOIN usuarios u ON u.id = h.usuario_id
        WHERE h.ticket_id = $1
        ORDER BY h.creado_en ASC`,
      [id],
    );

    return {
      id: Number(t.id),
      tipo: t.tipo,
      gravedad: t.gravedad,
      estado: t.estado,
      prioridad: Number(t.prioridad),
      calle: t.calle_nombre,
      barrio: t.barrio,
      lat: Number(t.lat),
      lng: Number(t.lng),
      necesitaRevision: t.necesita_revision,
      revisionDecision: t.revision_decision,
      creadoEn: t.creado_en,
      reportes: reportes.map((r) => ({
        id: Number(r.id),
        imagenUrl: r.imagen_url,
        descripcion: r.descripcion,
        creadoEn: r.creado_en,
        detecciones: detecciones
          .filter((d) => Number(d.reporte_id) === Number(r.id))
          .map((d) => ({
            tipo: d.tipo,
            claseModelo: d.clase_modelo,
            confianza: Number(d.confianza),
            areaPct: Number(d.area_pct),
            bbox: [d.x1, d.y1, d.x2, d.y2] as [number, number, number, number],
          })),
      })),
      historial: historial.map((h) => ({
        estadoAnterior: h.anterior,
        estadoNuevo: h.nuevo,
        usuario: h.usuario,
        creadoEn: h.creado_en,
      })),
    };
  }

  cambiarEstado(ticketId: number, estadoAnterior: string, estadoNuevo: string, usuarioId: number): Promise<boolean> {
    return this.db.transaction(async (m) => {
      const [filas] = await m.query(
        `UPDATE tickets SET estado_id = (SELECT id FROM estados WHERE codigo = $2), actualizado_en = now()
          WHERE id = $1 AND estado_id = (SELECT id FROM estados WHERE codigo = $3)
          RETURNING id`,
        [ticketId, estadoNuevo, estadoAnterior],
      );
      if (filas.length === 0) return false;

      await m.query(
        `INSERT INTO historial_estados (ticket_id, estado_anterior_id, estado_nuevo_id, usuario_id)
         VALUES ($1,
                 (SELECT id FROM estados WHERE codigo = $2),
                 (SELECT id FROM estados WHERE codigo = $3),
                 $4)`,
        [ticketId, estadoAnterior, estadoNuevo, usuarioId],
      );
      return true;
    });
  }

  async registrarRevision(ticketId: number, decision: string, usuarioId: number): Promise<boolean> {
    const [filas] = await this.db.query(
      `UPDATE tickets
          SET necesita_revision = false, revision_decision = $2, revisado_por_id = $3,
              revisado_en = now(), actualizado_en = now()
        WHERE id = $1 AND necesita_revision = true
        RETURNING id`,
      [ticketId, decision, usuarioId],
    );
    return filas.length > 0;
  }
}
