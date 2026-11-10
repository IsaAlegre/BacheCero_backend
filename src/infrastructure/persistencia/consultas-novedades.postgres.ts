import type { DataSource } from 'typeorm';
import type { EstadoNovedad } from '../../domain/novedades';
import type { NovedadGestion, NovedadPublica, PuertoConsultaNovedades } from '../../application/listar-novedades';

export class ConsultasNovedadesPostgres implements PuertoConsultaNovedades {
  constructor(private readonly db: DataSource) {}

  async listarPublicadas(pagina: number, tamanio: number): Promise<{ items: NovedadPublica[]; total: number }> {
    const filas: Array<Record<string, any>> = await this.db.query(
      `SELECT id, titulo, contenido, publicado_en
         FROM novedades
        WHERE estado = 'publicado'
        ORDER BY publicado_en DESC, id DESC
        LIMIT $1 OFFSET $2`,
      [tamanio, (pagina - 1) * tamanio],
    );
    const [{ total }] = await this.db.query(`SELECT count(*) AS total FROM novedades WHERE estado = 'publicado'`);
    return {
      total: Number(total),
      items: filas.map((f) => ({
        id: Number(f.id),
        titulo: f.titulo,
        contenido: f.contenido,
        publicadoEn: f.publicado_en,
      })),
    };
  }

  async listarGestion(
    pagina: number,
    tamanio: number,
    estado: EstadoNovedad | null,
  ): Promise<{ items: NovedadGestion[]; total: number }> {
    const parametros: unknown[] = estado ? [estado] : [];
    const condicion = estado ? 'n.estado = $1' : 'true';
    const n = parametros.length;

    const filas: Array<Record<string, any>> = await this.db.query(
      `SELECT n.id, n.titulo, n.contenido, n.estado, n.origen, n.creado_en, n.actualizado_en, n.publicado_en,
              a.nombre AS autor, ap.nombre AS aprobado_por
         FROM novedades n
         JOIN usuarios a ON a.id = n.autor_id
         LEFT JOIN usuarios ap ON ap.id = n.aprobado_por_id
        WHERE ${condicion}
        ORDER BY n.creado_en DESC, n.id DESC
        LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...parametros, tamanio, (pagina - 1) * tamanio],
    );
    const [{ total }] = await this.db.query(`SELECT count(*) AS total FROM novedades n WHERE ${condicion}`, parametros);

    return {
      total: Number(total),
      items: filas.map((f) => ({
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
      })),
    };
  }
}
