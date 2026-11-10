import type { DataSource } from 'typeorm';
import type { NovedadGuardada, NuevaNovedad, PuertoGestionNovedades } from '../../application/novedades';

// En TypeORM, un UPDATE/DELETE con RETURNING devuelve [filas, cantidad], no solo las filas.
function seAplico(resultado: unknown): boolean {
  const [filas] = resultado as [unknown[], number];
  return filas.length > 0;
}

export class GestionNovedadesPostgres implements PuertoGestionNovedades {
  constructor(private readonly db: DataSource) {}

  async crear(novedad: NuevaNovedad): Promise<number> {
    const filas: Array<{ id: string }> = await this.db.query(
      `INSERT INTO novedades (titulo, contenido, origen, autor_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [novedad.titulo, novedad.contenido, novedad.origen, novedad.autorId],
    );
    return Number(filas[0].id);
  }

  async obtener(id: number): Promise<NovedadGuardada | null> {
    const filas: Array<Record<string, any>> = await this.db.query(
      `SELECT n.id, n.titulo, n.contenido, n.estado, n.origen, n.creado_en, n.actualizado_en, n.publicado_en,
              a.nombre AS autor, ap.nombre AS aprobado_por
         FROM novedades n
         JOIN usuarios a ON a.id = n.autor_id
         LEFT JOIN usuarios ap ON ap.id = n.aprobado_por_id
        WHERE n.id = $1`,
      [id],
    );
    const f = filas[0];
    if (!f) return null;
    return {
      id: Number(f.id),
      titulo: f.titulo,
      contenido: f.contenido,
      estado: f.estado,
      origen: f.origen,
      autor: f.autor,
      aprobadoPor: f.aprobado_por,
      creadoEn: f.creado_en,
      actualizadoEn: f.actualizado_en,
      publicadoEn: f.publicado_en,
    };
  }

  async editarBorrador(id: number, cambios: { titulo: string; contenido: string }): Promise<boolean> {
    return seAplico(
      await this.db.query(
        `UPDATE novedades SET titulo = $2, contenido = $3, actualizado_en = now()
          WHERE id = $1 AND estado = 'borrador'
          RETURNING id`,
        [id, cambios.titulo, cambios.contenido],
      ),
    );
  }

  async publicar(id: number, aprobadorId: number): Promise<boolean> {
    return seAplico(
      await this.db.query(
        `UPDATE novedades
            SET estado = 'publicado', publicado_en = now(), aprobado_por_id = $2, actualizado_en = now()
          WHERE id = $1 AND estado = 'borrador'
          RETURNING id`,
        [id, aprobadorId],
      ),
    );
  }

  async eliminar(id: number): Promise<boolean> {
    return seAplico(await this.db.query(`DELETE FROM novedades WHERE id = $1 RETURNING id`, [id]));
  }
}
