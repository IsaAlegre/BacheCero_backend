import { ErrorEntradaInvalida } from '../application/errores';
import { ListarTickets, PuertoConsultaTickets, FiltrosValidados, validarFiltros } from '../application/listar-tickets';

describe('validarFiltros', () => {
  it('por defecto muestra abiertos ordenados por prioridad', () => {
    expect(validarFiltros({})).toEqual({ estado: null, orden: 'prioridad' });
  });

  it('acepta un estado y un orden válidos; trata el vacío como ausente', () => {
    expect(validarFiltros({ estado: 'resuelto', orden: 'recientes' })).toEqual({ estado: 'resuelto', orden: 'recientes' });
    expect(validarFiltros({ estado: '', orden: '' })).toEqual({ estado: null, orden: 'prioridad' });
  });

  it('rechaza estados y órdenes inexistentes (evita SQL arbitrario)', () => {
    expect(() => validarFiltros({ estado: 'cerrado' })).toThrow(ErrorEntradaInvalida);
    expect(() => validarFiltros({ orden: 'id; DROP TABLE tickets' })).toThrow(ErrorEntradaInvalida);
  });
});

describe('ListarTickets', () => {
  it('pasa los filtros validados a la consulta y los devuelve en la respuesta', async () => {
    let recibido: FiltrosValidados | undefined;
    const consultas: PuertoConsultaTickets = {
      async listar(_p, _t, filtros) {
        recibido = filtros;
        return { items: [], total: 0 };
      },
    };
    const r = await new ListarTickets(consultas).ejecutar(1, { estado: 'programado', orden: 'actualizados' });
    expect(recibido).toEqual({ estado: 'programado', orden: 'actualizados' });
    expect(r.filtros).toEqual({ estado: 'programado', orden: 'actualizados' });
  });
});
