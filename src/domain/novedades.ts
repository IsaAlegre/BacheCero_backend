// Reglas puras de Novedades: sin NestJS, sin TypeORM, sin I/O.

export type EstadoNovedad = 'borrador' | 'publicado';
export type OrigenNovedad = 'manual' | 'ia';

export const ESTADOS_NOVEDAD: readonly EstadoNovedad[] = ['borrador', 'publicado'];

export const LIMITES_NOVEDAD = {
  tituloMin: 3,
  tituloMax: 150,
  contenidoMin: 10,
  contenidoMax: 10000,
} as const;

// Ciclo de vida: borrador → publicado. Publicar es la aprobación del responsable del área.
// Una novedad publicada no se edita: editarla evitaría la aprobación. Se elimina y se redacta de nuevo.
export function puedeEditarse(estado: EstadoNovedad): boolean {
  return estado === 'borrador';
}

export function puedePublicarse(estado: EstadoNovedad): boolean {
  return estado === 'borrador';
}

// Primer año aceptado para generar informes mensuales (el sistema no existía antes).
export const ANIO_MINIMO_INFORME = 2024;

export function periodoValido(anio: number, mes: number, ahora: Date): boolean {
  if (!Number.isInteger(anio) || !Number.isInteger(mes)) return false;
  if (anio < ANIO_MINIMO_INFORME || mes < 1 || mes > 12) return false;
  const anioActual = ahora.getUTCFullYear();
  const mesActual = ahora.getUTCMonth() + 1;
  return anio < anioActual || (anio === anioActual && mes <= mesActual);
}

// Límites de un mes calendario en hora de Argentina (UTC-3 fijo, sin horario de verano).
// desde es inclusivo y hasta es exclusivo.
export function limitesDelMes(anio: number, mes: number): { desde: Date; hasta: Date } {
  return {
    desde: new Date(Date.UTC(anio, mes - 1, 1, 3)),
    hasta: new Date(Date.UTC(anio, mes, 1, 3)),
  };
}
