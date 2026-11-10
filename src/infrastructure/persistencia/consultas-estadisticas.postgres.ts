import type { DataSource } from 'typeorm';
import type {
  Periodo,
  PuertoConsultaEstadisticas,
  ResumenTickets,
  TiempoResolucion,
  ZonasConMasCasos,
} from '../../application/estadisticas';

// Filtro de período compartido. Usa siempre $1 (desde) y $2 (hasta, exclusivo); null = sin límite.
const EN_PERIODO = `($1::timestamptz IS NULL OR t.creado_en >= $1::timestamptz)
                AND ($2::timestamptz IS NULL OR t.creado_en < $2::timestamptz)`;

// El nombre del barrio vive como texto en el ticket (viene de OpenStreetMap). Si el día de mañana
// se carga la tabla `barrios` y se asigna `barrio_id`, ese nombre se usa como respaldo.
const BARRIO_DEL_TICKET = `COALESCE(NULLIF(btrim(t.barrio_nombre), ''), b.nombre)`;

const redondear = (valor: string | number | null, decimales = 1): number | null => {
  if (valor === null || valor === undefined) return null;
  const factor = 10 ** decimales;
  return Math.round(Number(valor) * factor) / factor;
};

export class ConsultasEstadisticasPostgres implements PuertoConsultaEstadisticas {
  constructor(private readonly db: DataSource) {}

  async resumen(periodo: Periodo): Promise<ResumenTickets> {
    const parametros = [periodo.desde, periodo.hastaExclusivo];

    // Parte de `estados` para que aparezcan también los estados sin tickets (cantidad 0).
    const porEstado: Array<{ codigo: string; nombre: string; abierto: boolean; cantidad: string }> =
      await this.db.query(
        `SELECT e.codigo, e.nombre, e.abierto, count(t.id) AS cantidad
           FROM estados e
           LEFT JOIN tickets t ON t.estado_id = e.id AND ${EN_PERIODO}
          GROUP BY e.id
          ORDER BY e.orden`,
        parametros,
      );

    const [{ cantidad: necesitanRevision }]: Array<{ cantidad: string }> = await this.db.query(
      `SELECT count(*) AS cantidad FROM tickets t WHERE t.necesita_revision = true AND ${EN_PERIODO}`,
      parametros,
    );

    const filas = porEstado.map((f) => ({ ...f, cantidad: Number(f.cantidad) }));
    const suma = (condicion: (f: (typeof filas)[number]) => boolean) =>
      filas.filter(condicion).reduce((acc, f) => acc + f.cantidad, 0);

    return {
      total: suma(() => true),
      abiertos: suma((f) => f.abierto),
      resueltos: suma((f) => !f.abierto),
      necesitanRevision: Number(necesitanRevision),
      porEstado: filas.map(({ codigo, nombre, cantidad }) => ({ codigo, nombre, cantidad })),
    };
  }

  // Tiempo entre que se reportó el bache y la primera vez que su ticket pasó a un estado cerrado.
  async tiempoResolucion(periodo: Periodo): Promise<TiempoResolucion> {
    const [fila]: Array<{ muestra: string; promedio_horas: string | null; mediana_horas: string | null }> =
      await this.db.query(
        `SELECT count(*) AS muestra,
                avg(extract(epoch FROM (c.cerrado_en - t.creado_en))) / 3600 AS promedio_horas,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (c.cerrado_en - t.creado_en))) / 3600
                  AS mediana_horas
           FROM tickets t
           JOIN estados e ON e.id = t.estado_id AND e.abierto = false
           JOIN LATERAL (
                  SELECT min(h.creado_en) AS cerrado_en
                    FROM historial_estados h
                    JOIN estados en ON en.id = h.estado_nuevo_id
                   WHERE h.ticket_id = t.id AND en.abierto = false
                ) c ON c.cerrado_en IS NOT NULL
          WHERE ${EN_PERIODO}`,
        [periodo.desde, periodo.hastaExclusivo],
      );

    return {
      muestra: Number(fila.muestra),
      promedioHoras: redondear(fila.promedio_horas),
      medianaHoras: redondear(fila.mediana_horas),
    };
  }

  async zonasConMasCasos(periodo: Periodo, limite: number): Promise<ZonasConMasCasos> {
    const parametros = [periodo.desde, periodo.hastaExclusivo];

    const filas: Array<{ barrio: string; total: string; abiertos: string; resueltos: string }> =
      await this.db.query(
        `SELECT ${BARRIO_DEL_TICKET} AS barrio,
                count(*) AS total,
                count(*) FILTER (WHERE e.abierto) AS abiertos,
                count(*) FILTER (WHERE NOT e.abierto) AS resueltos
           FROM tickets t
           JOIN estados e ON e.id = t.estado_id
           LEFT JOIN barrios b ON b.id = t.barrio_id
          WHERE ${EN_PERIODO} AND ${BARRIO_DEL_TICKET} IS NOT NULL
          GROUP BY ${BARRIO_DEL_TICKET}
          ORDER BY total DESC, abiertos DESC, barrio ASC
          LIMIT $3`,
        [...parametros, limite],
      );

    const [{ cantidad }]: Array<{ cantidad: string }> = await this.db.query(
      `SELECT count(*) AS cantidad
         FROM tickets t
         LEFT JOIN barrios b ON b.id = t.barrio_id
        WHERE ${EN_PERIODO} AND ${BARRIO_DEL_TICKET} IS NULL`,
      parametros,
    );

    return {
      items: filas.map((f) => ({
        barrio: f.barrio,
        total: Number(f.total),
        abiertos: Number(f.abiertos),
        resueltos: Number(f.resueltos),
      })),
      sinBarrio: Number(cantidad),
    };
  }
}
