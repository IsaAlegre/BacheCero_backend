import type { DataSource } from 'typeorm';
import type {
  NuevoReporte,
  NuevoTicket,
  PuertoTickets,
  TicketAbierto,
} from '../../application/puertos';
import type { Gravedad, TipoDano } from '../../domain/reglas';

// Consultas nativas (SQL + PostGIS) ejecutadas con la conexión de TypeORM.
export class TicketsPostgres implements PuertoTickets {
  constructor(private readonly db: DataSource) {}

  async buscarAbiertoCercano(
    tipo: TipoDano,
    lat: number,
    lng: number,
    radioMetros: number,
  ): Promise<TicketAbierto | null> {
    const filas: Array<{
      id: string;
      gravedad: Gravedad | null;
      peso_jerarquia: string | null;
      vulnerabilidad: string | null;
      necesita_revision: boolean;
    }> = await this.db.query(
      `SELECT t.id,
              g.codigo          AS gravedad,
              j.peso            AS peso_jerarquia,
              b.indice_vulnerabilidad AS vulnerabilidad,
              t.necesita_revision
         FROM tickets t
         JOIN tipos_dano td ON td.id = t.tipo_dano_id
         JOIN estados e     ON e.id = t.estado_id
         LEFT JOIN gravedades g        ON g.id = t.gravedad_id
         LEFT JOIN jerarquias_calle j  ON j.id = t.jerarquia_id
         LEFT JOIN barrios b           ON b.id = t.barrio_id
        WHERE td.codigo = $1
          AND e.abierto = true
          AND ST_DWithin(t.ubicacion, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4)
        ORDER BY t.creado_en ASC
        LIMIT 1`,
      [tipo, lat, lng, radioMetros],
    );

    const fila = filas[0];
    if (!fila) return null;
    return {
      id: Number(fila.id),
      gravedad: fila.gravedad,
      pesoJerarquia: fila.peso_jerarquia === null ? null : Number(fila.peso_jerarquia),
      vulnerabilidad: fila.vulnerabilidad === null ? null : Number(fila.vulnerabilidad),
      necesitaRevision: fila.necesita_revision,
    };
  }

  async crear(t: NuevoTicket): Promise<number> {
    const filas: Array<{ id: string }> = await this.db.query(
      `INSERT INTO tickets
         (ubicacion, tipo_dano_id, gravedad_id, estado_id, jerarquia_id, barrio_id,
          barrio_nombre, calle_nombre, prioridad, necesita_revision)
       VALUES (
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
         (SELECT id FROM tipos_dano WHERE codigo = $3),
         (SELECT id FROM gravedades WHERE codigo = $4),
         (SELECT id FROM estados WHERE codigo = 'pendiente'),
         (SELECT id FROM jerarquias_calle WHERE osm_highway = $5),
         (SELECT id FROM barrios WHERE nombre = $6),
         $7, $8, $9)
       RETURNING id`,
      [
        t.lat,
        t.lng,
        t.tipo,
        t.gravedad,
        t.osmHighway,
        t.barrio,
        t.calle,
        t.prioridad,
        t.necesitaRevision,
      ],
    );
    return Number(filas[0]!.id);
  }

  agregarReporte(r: NuevoReporte): Promise<number> {
    return this.db.transaction(async (manager) => {
      const filas: Array<{ id: string }> = await manager.query(
        `INSERT INTO reportes
           (ticket_id, usuario_id, imagen_url, ubicacion, descripcion, respuesta_ia)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6, $7::jsonb)
         RETURNING id`,
        [
          r.ticketId,
          r.usuarioId,
          r.imagenUrl,
          r.lat,
          r.lng,
          r.descripcion,
          JSON.stringify(r.respuestaIa),
        ],
      );
      const reporteId = Number(filas[0]!.id);

      for (const d of r.detecciones) {
        await manager.query(
          `INSERT INTO detecciones
             (reporte_id, tipo_dano_id, clase_modelo, confianza, x1, y1, x2, y2, area_pct)
           VALUES ($1, (SELECT id FROM tipos_dano WHERE codigo = $2), $3, $4, $5, $6, $7, $8, $9)`,
          [
            reporteId,
            d.tipo,
            d.claseModelo,
            d.confianza,
            d.bbox[0],
            d.bbox[1],
            d.bbox[2],
            d.bbox[3],
            d.areaPct,
          ],
        );
      }
      return reporteId;
    });
  }

  async contarReportes(ticketId: number): Promise<number> {
    const filas: Array<{ cantidad: string }> = await this.db.query(
      'SELECT COUNT(*) AS cantidad FROM reportes WHERE ticket_id = $1',
      [ticketId],
    );
    return Number(filas[0]!.cantidad);
  }

  async actualizarAnalisis(
    ticketId: number,
    cambios: { gravedad: Gravedad | null; prioridad: number; necesitaRevision: boolean },
  ): Promise<void> {
    await this.db.query(
      `UPDATE tickets
          SET gravedad_id = (SELECT id FROM gravedades WHERE codigo = $2),
              prioridad = $3,
              necesita_revision = $4,
              actualizado_en = now()
        WHERE id = $1`,
      [ticketId, cambios.gravedad, cambios.prioridad, cambios.necesitaRevision],
    );
  }
}
