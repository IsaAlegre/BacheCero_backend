import { ErrorEntradaInvalida, ErrorOperacionInvalida } from '../application/errores';
import {
  BorradorRedactado, GenerarBorradorNovedad, PuertoRedactorNovedades, PuertoResumenMensual, ResumenMensual,
} from '../application/generar-borrador-novedad';
import { CrearNovedad, NovedadGuardada, NuevaNovedad, PuertoGestionNovedades } from '../application/novedades';
import { construirPrompt, parsearRespuesta } from '../infrastructure/ia/redactor-novedades-claude.adapter';

const AHORA = () => new Date('2026-11-09T12:00:00Z');

const RESUMEN: ResumenMensual = {
  anio: 2026, mes: 10, resueltos: 12, reparacionesIniciadas: 15, reportesRecibidos: 40,
  resueltosPorBarrio: [{ barrio: 'Miguel Lanús', cantidad: 7 }, { barrio: null, cantidad: 5 }],
};

class Guardado implements PuertoGestionNovedades {
  creadas: NuevaNovedad[] = [];
  async crear(n: NuevaNovedad) { this.creadas.push(n); return this.creadas.length; }
  async obtener(): Promise<NovedadGuardada | null> { return null; }
  async editarBorrador() { return true; }
  async publicar() { return true; }
  async eliminar() { return true; }
}

function armar(opciones: { resumen?: ResumenMensual; redactado?: BorradorRedactado | null } = {}) {
  const pedidos: Array<{ desde: Date; hasta: Date }> = [];
  const resumenes: PuertoResumenMensual = {
    async resumir(desde, hasta) { pedidos.push({ desde, hasta }); return opciones.resumen ?? RESUMEN; },
  };
  const redactor: PuertoRedactorNovedades = {
    async redactar() { return opciones.redactado ?? { titulo: 'Octubre en las calles', contenido: 'Se resolvieron 12 reportes durante el mes.' }; },
  };
  const guardado = new Guardado();
  return { pedidos, guardado, caso: new GenerarBorradorNovedad(resumenes, redactor, guardado, AHORA), resumenes };
}

describe('GenerarBorradorNovedad', () => {
  it('guarda el texto de la IA como borrador de origen "ia" a nombre del administrador', async () => {
    const { caso, guardado } = armar();
    const r = await caso.ejecutar(2026, 10, 3);
    expect(r).toMatchObject({ id: 1, estado: 'borrador', titulo: 'Octubre en las calles' });
    expect(guardado.creadas).toEqual([
      { titulo: 'Octubre en las calles', contenido: 'Se resolvieron 12 reportes durante el mes.', origen: 'ia', autorId: 3 },
    ]);
  });

  it('pide los datos del mes calendario completo', async () => {
    const { caso, pedidos } = armar();
    await caso.ejecutar(2026, 10, 3);
    expect(pedidos).toEqual([{ desde: new Date('2026-10-01T03:00:00Z'), hasta: new Date('2026-11-01T03:00:00Z') }]);
  });

  it('rechaza períodos futuros o inválidos sin consultar nada', async () => {
    const { caso, pedidos } = armar();
    await expect(caso.ejecutar(2026, 12, 3)).rejects.toThrow(ErrorEntradaInvalida);
    await expect(caso.ejecutar(2026, 0, 3)).rejects.toThrow(ErrorEntradaInvalida);
    expect(pedidos).toHaveLength(0);
  });

  it('sin redactor configurado avisa que la IA no está disponible', async () => {
    const { resumenes, guardado } = armar();
    const caso = new GenerarBorradorNovedad(resumenes, null, guardado, AHORA);
    await expect(caso.ejecutar(2026, 10, 3)).rejects.toThrow(ErrorOperacionInvalida);
    expect(guardado.creadas).toHaveLength(0);
  });

  it('si no hubo actividad no le pide un texto a la IA (evita que invente)', async () => {
    const vacio = { ...RESUMEN, resueltos: 0, reparacionesIniciadas: 0, reportesRecibidos: 0, resueltosPorBarrio: [] };
    const { caso, guardado } = armar({ resumen: vacio });
    await expect(caso.ejecutar(2026, 10, 3)).rejects.toThrow(ErrorOperacionInvalida);
    expect(guardado.creadas).toHaveLength(0);
  });

  it('si la IA devuelve un texto inválido no guarda nada', async () => {
    const { caso, guardado } = armar({ redactado: { titulo: '', contenido: 'x' } });
    await expect(caso.ejecutar(2026, 10, 3)).rejects.toThrow(ErrorOperacionInvalida);
    expect(guardado.creadas).toHaveLength(0);
  });

  it('el borrador generado se puede publicar como cualquier otro (no hay atajo de aprobación)', async () => {
    const { caso, guardado } = armar();
    await caso.ejecutar(2026, 10, 3);
    expect(guardado.creadas[0]).not.toHaveProperty('estado');
    await expect(new CrearNovedad(guardado).ejecutar('Otro título', 'Contenido de prueba válido', 1)).resolves.toMatchObject({ estado: 'borrador' });
  });
});

describe('redactor de IA: prompt y respuesta', () => {
  it('el prompt solo lleva datos agregados del resumen', () => {
    const prompt = construirPrompt(RESUMEN);
    expect(prompt).toContain('octubre de 2026');
    expect(prompt).toContain('resueltos en el mes: 12');
    expect(prompt).toContain('- Miguel Lanús: 7');
    expect(prompt).toContain('- Barrio sin identificar: 5');
  });

  it('parsea JSON puro y JSON dentro de un bloque de código', () => {
    expect(parsearRespuesta('{"titulo":"A","contenido":"B"}')).toEqual({ titulo: 'A', contenido: 'B' });
    expect(parsearRespuesta('```json\n{"titulo":"A","contenido":"B"}\n```')).toEqual({ titulo: 'A', contenido: 'B' });
  });

  it('falla si no es JSON o faltan campos', () => {
    expect(() => parsearRespuesta('hola')).toThrow();
    expect(() => parsearRespuesta('{"titulo":"A"}')).toThrow();
    expect(() => parsearRespuesta('null')).toThrow();
  });
});
