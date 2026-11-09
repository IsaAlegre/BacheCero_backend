import type { DataSource } from 'typeorm';
import type { PuertoMisReportes, ReporteDeUsuario } from '../../application/mis-reportes';

export class ConsultasReportesPostgres implements PuertoMisReportes {
  constructor(private readonly db: DataSource) {}

  async listarDeUsuario(
    usuarioId: number,
    pagina: number,
    tamanio: number,
  ): Promise<{ items: ReporteDeUsuario[]; total: number }> {
    const filas: Array<Record<string, any>> = await this.db.query(
      `SELECT r.id, r.imagen_url, r.descripcion, r.creado_en,
              t.id AS ticket_id, e.codigo AS estado, td.codigo AS tipo, g.codigo AS gravedad,
              t.calle_nombre, t.barrio_nombre, t.prioridad
         FROM reportes r
         JOIN tickets t ON t.id = r.ticket_id
         JOIN estados e ON e.id = t.estado_id
         LEFT JOIN tipos_dano td ON td.id = t.tipo_dano_id
         LEFT JOIN gravedades g ON g.id = t.gravedad_id
        WHERE r.usuario_id = $1
        ORDER BY r.creado_en DESC, r.id DESC
        LIMIT $2 OFFSET $3`,
      [usuarioId, tamanio, (pagina - 1) * tamanio],
    );

    const [{ total }] = await this.db.query(
      `SELECT count(*) AS total FROM reportes WHERE usuario_id = $1`,
      [usuarioId],
    );

    return {
      total: Number(total),
      items: filas.map((f) => ({
        id: Number(f.id),
        imagenUrl: f.imagen_url,
        descripcion: f.descripcion,
        creadoEn: f.creado_en,
        ticket: {
          id: Number(f.ticket_id),
          estado: f.estado,
          tipo: f.tipo,
          gravedad: f.gravedad,
          calle: f.calle_nombre,
          barrio: f.barrio_nombre,
          prioridad: Number(f.prioridad),
        },
      })),
    };
  }
}