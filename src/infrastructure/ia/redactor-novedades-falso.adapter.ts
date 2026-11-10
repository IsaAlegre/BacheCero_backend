import type { BorradorRedactado, PuertoRedactorNovedades, ResumenMensual } from '../../application/generar-borrador-novedad';

// Para desarrollo sin API key (MODO_DESARROLLO=1): arma un texto fijo con los mismos datos.
export class RedactorNovedadesFalso implements PuertoRedactorNovedades {
  async redactar(resumen: ResumenMensual): Promise<BorradorRedactado> {
    const periodo = `${String(resumen.mes).padStart(2, '0')}/${resumen.anio}`;
    const barrios = resumen.resueltosPorBarrio.map((b) => `${b.barrio ?? 'sin identificar'} (${b.cantidad})`).join(', ');
    return {
      titulo: `Informe de mantenimiento vial ${periodo} (borrador de prueba)`,
      contenido:
        `En ${periodo} se resolvieron ${resumen.resueltos} reportes, se iniciaron ${resumen.reparacionesIniciadas} ` +
        `reparaciones y se recibieron ${resumen.reportesRecibidos} reportes de vecinos.` +
        (barrios ? `\n\nResueltos por barrio: ${barrios}.` : ''),
    };
  }
}
