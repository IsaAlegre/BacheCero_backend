import type { DataSource } from 'typeorm';
import type { PuertoResumenMensual, ResumenMensual } from '../../application/generar-borrador-novedad';

const MAX_BARRIOS = 10;

// Cuenta lo ocurrido entre desde (inclusive) y hasta (exclusivo). Solo devuelve datos agregados.
export class ResumenMensualPostgres implements PuertoResumenMensual {
  constructor(private readonly db: DataSource) {}

  async resumir(desde: Date, hasta: Date, anio: number, mes: number): Promise<ResumenMensual> {
    const porBarrio: Array<{ barrio: string | null; cantidad: string }> = await this.db.query(
      `SELECT COALESCE(t.barrio_nombre, b.nombre) AS barrio, count(DISTINCT t.id) AS cantidad
         FROM historial_estados h
         JOIN estados e ON e.id = h.estado_nuevo_id AND e.codigo = 'resuelto'
         JOIN tickets t ON t.id = h.ticket_id
         LEFT JOIN barrios b ON b.id = t.barrio_id
        WHERE h.creado_en >= $1 AND h.creado_en < $2
        GROUP BY 1
        ORDER BY cantidad DESC, barrio ASC NULLS LAST`,
      [desde, hasta],
    );

    const [{ iniciadas }] = await this.db.query(
      `SELECT count(DISTINCT h.ticket_id) AS iniciadas
         FROM historial_estados h
         JOIN estados e ON e.id = h.estado_nuevo_id AND e.codigo = 'en_reparacion'
        WHERE h.creado_en >= $1 AND h.creado_en < $2`,
      [desde, hasta],
    );

    const [{ recibidos }] = await this.db.query(
      `SELECT count(*) AS recibidos FROM reportes WHERE creado_en >= $1 AND creado_en < $2`,
      [desde, hasta],
    );

    return {
      anio,
      mes,
      resueltos: porBarrio.reduce((suma, f) => suma + Number(f.cantidad), 0),
      reparacionesIniciadas: Number(iniciadas),
      reportesRecibidos: Number(recibidos),
      resueltosPorBarrio: porBarrio.slice(0, MAX_BARRIOS).map((f) => ({ barrio: f.barrio, cantidad: Number(f.cantidad) })),
    };
  }
}
