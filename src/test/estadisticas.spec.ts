import { ErrorEntradaInvalida } from '../application/errores';
import {
  LIMITE_ZONAS_MAXIMO,
  LIMITE_ZONAS_POR_DEFECTO,
  ObtenerEstadisticas,
  Periodo,
  PuertoConsultaEstadisticas,
  periodoDe,
  validarFiltros,
} from '../application/estadisticas';

describe('validarFiltros (estadísticas)', () => {
  it('sin parámetros: sin período y con el límite de zonas por defecto', () => {
    expect(validarFiltros({})).toEqual({ desde: null, hasta: null, limiteZonas: LIMITE_ZONAS_POR_DEFECTO });
  });

  it('trata el texto vacío como ausente', () => {
    expect(validarFiltros({ desde: '', hasta: '', limiteZonas: '' })).toEqual({
      desde: null,
      hasta: null,
      limiteZonas: LIMITE_ZONAS_POR_DEFECTO,
    });
  });

  it('acepta fechas y límite válidos', () => {
    expect(validarFiltros({ desde: '2026-11-01', hasta: '2026-11-30', limiteZonas: '5' })).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-30',
      limiteZonas: 5,
    });
  });

  it('acepta desde igual a hasta (un solo día)', () => {
    expect(() => validarFiltros({ desde: '2026-11-09', hasta: '2026-11-09' })).not.toThrow();
  });

  it('rechaza formatos de fecha incorrectos', () => {
    for (const desde of ['01/11/2026', '2026-1-1', 'ayer', '2026-11-01T10:00:00']) {
      expect(() => validarFiltros({ desde })).toThrow(ErrorEntradaInvalida);
    }
  });

  it('rechaza fechas que no existen en el calendario', () => {
    expect(() => validarFiltros({ hasta: '2026-02-30' })).toThrow(ErrorEntradaInvalida);
    expect(() => validarFiltros({ hasta: '2026-13-01' })).toThrow(ErrorEntradaInvalida);
  });

  it('rechaza un período invertido', () => {
    expect(() => validarFiltros({ desde: '2026-12-01', hasta: '2026-11-01' })).toThrow(ErrorEntradaInvalida);
  });

  it('rechaza valores que no son texto (?desde=a&desde=b llega como arreglo)', () => {
    expect(() => validarFiltros({ desde: ['2026-11-01', '2026-11-02'] })).toThrow(ErrorEntradaInvalida);
    expect(() => validarFiltros({ limiteZonas: 5 })).toThrow(ErrorEntradaInvalida);
  });

  it('rechaza límites fuera de rango o no enteros', () => {
    for (const limiteZonas of ['0', '-1', '1.5', 'abc', String(LIMITE_ZONAS_MAXIMO + 1)]) {
      expect(() => validarFiltros({ limiteZonas })).toThrow(ErrorEntradaInvalida);
    }
  });
});

describe('periodoDe', () => {
  it('sin fechas no hay límites', () => {
    expect(periodoDe({ desde: null, hasta: null, limiteZonas: 10 })).toEqual({ desde: null, hastaExclusivo: null });
  });

  it('interpreta los días en hora de Posadas (UTC-3) y hace "hasta" inclusivo', () => {
    const p = periodoDe({ desde: '2026-11-01', hasta: '2026-11-30', limiteZonas: 10 });
    expect(p.desde?.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(p.hastaExclusivo?.toISOString()).toBe('2026-12-01T03:00:00.000Z');
  });
});

describe('ObtenerEstadisticas', () => {
  const resumen = {
    total: 3,
    abiertos: 2,
    resueltos: 1,
    necesitanRevision: 1,
    porEstado: [{ codigo: 'pendiente', nombre: 'Pendiente', cantidad: 2 }],
  };
  const tiempoResolucion = { muestra: 1, promedioHoras: 12.5, medianaHoras: 12.5 };
  const zonas = { items: [{ barrio: 'Centro', total: 3, abiertos: 2, resueltos: 1 }], sinBarrio: 0 };

  function consultasFalsas() {
    const llamadas: { periodo?: Periodo; limite?: number } = {};
    const consultas: PuertoConsultaEstadisticas = {
      async resumen(periodo) {
        llamadas.periodo = periodo;
        return resumen;
      },
      async tiempoResolucion() {
        return tiempoResolucion;
      },
      async zonasConMasCasos(_periodo, limite) {
        llamadas.limite = limite;
        return zonas;
      },
    };
    return { consultas, llamadas };
  }

  it('arma la respuesta con las tres métricas, los filtros aplicados y la hora de generación', async () => {
    const { consultas } = consultasFalsas();
    const ahora = new Date('2026-11-09T12:00:00Z');
    const r = await new ObtenerEstadisticas(consultas, () => ahora).ejecutar({});
    expect(r).toEqual({
      generadoEn: ahora,
      filtros: { desde: null, hasta: null, limiteZonas: LIMITE_ZONAS_POR_DEFECTO },
      resumen,
      tiempoResolucion,
      zonas,
    });
  });

  it('pasa a las consultas el período y el límite ya validados', async () => {
    const { consultas, llamadas } = consultasFalsas();
    await new ObtenerEstadisticas(consultas).ejecutar({ desde: '2026-11-01', limiteZonas: '3' });
    expect(llamadas.periodo?.desde?.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(llamadas.periodo?.hastaExclusivo).toBeNull();
    expect(llamadas.limite).toBe(3);
  });

  it('no consulta nada si los filtros son inválidos', async () => {
    const { consultas, llamadas } = consultasFalsas();
    await expect(new ObtenerEstadisticas(consultas).ejecutar({ desde: 'ayer' })).rejects.toThrow(ErrorEntradaInvalida);
    expect(llamadas.periodo).toBeUndefined();
  });
});
