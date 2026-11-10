import { ErrorEntradaInvalida, ErrorNoEncontrado, ErrorOperacionInvalida } from '../application/errores';
import {
  CrearNovedad, EditarNovedad, EliminarNovedad, NovedadGuardada, NuevaNovedad, PublicarNovedad, PuertoGestionNovedades,
} from '../application/novedades';
import { ListarNovedadesGestion, VerNovedad } from '../application/listar-novedades';
import { limitesDelMes, periodoValido, puedeEditarse, puedePublicarse } from '../domain/novedades';

class NovedadesEnMemoria implements PuertoGestionNovedades {
  filas = new Map<number, NovedadGuardada & { aprobadorId?: number }>();
  siguiente = 1;

  async crear(n: NuevaNovedad) {
    const id = this.siguiente++;
    const ahora = new Date();
    this.filas.set(id, {
      id, titulo: n.titulo, contenido: n.contenido, estado: 'borrador', origen: n.origen,
      autor: `usuario ${n.autorId}`, aprobadoPor: null, creadoEn: ahora, actualizadoEn: ahora, publicadoEn: null,
    });
    return id;
  }
  async obtener(id: number) { return this.filas.get(id) ?? null; }
  async editarBorrador(id: number, c: { titulo: string; contenido: string }) {
    const f = this.filas.get(id);
    if (!f || f.estado !== 'borrador') return false;
    this.filas.set(id, { ...f, ...c });
    return true;
  }
  async publicar(id: number, aprobadorId: number) {
    const f = this.filas.get(id);
    if (!f || f.estado !== 'borrador') return false;
    this.filas.set(id, { ...f, estado: 'publicado', publicadoEn: new Date(), aprobadoPor: `usuario ${aprobadorId}`, aprobadorId });
    return true;
  }
  async eliminar(id: number) { return this.filas.delete(id); }
}

const TITULO = 'Obras en el barrio Lanús';
const CONTENIDO = 'Se repararon cuatro baches sobre la calle Mar Argentino.';

describe('dominio de novedades', () => {
  it('solo los borradores se editan y se publican', () => {
    expect(puedeEditarse('borrador')).toBe(true);
    expect(puedeEditarse('publicado')).toBe(false);
    expect(puedePublicarse('borrador')).toBe(true);
    expect(puedePublicarse('publicado')).toBe(false);
  });

  it('acepta el mes actual y los pasados; rechaza futuros, meses fuera de rango y años anteriores al sistema', () => {
    const ahora = new Date('2026-11-09T12:00:00Z');
    expect(periodoValido(2026, 11, ahora)).toBe(true);
    expect(periodoValido(2026, 10, ahora)).toBe(true);
    expect(periodoValido(2025, 12, ahora)).toBe(true);
    expect(periodoValido(2026, 12, ahora)).toBe(false);
    expect(periodoValido(2027, 1, ahora)).toBe(false);
    expect(periodoValido(2026, 0, ahora)).toBe(false);
    expect(periodoValido(2026, 13, ahora)).toBe(false);
    expect(periodoValido(2023, 6, ahora)).toBe(false);
    expect(periodoValido(2026.5, 3, ahora)).toBe(false);
  });

  it('los límites del mes van de las 00:00 de Argentina (UTC-3) al inicio del mes siguiente', () => {
    expect(limitesDelMes(2026, 10)).toEqual({
      desde: new Date('2026-10-01T03:00:00Z'),
      hasta: new Date('2026-11-01T03:00:00Z'),
    });
    expect(limitesDelMes(2026, 12).hasta).toEqual(new Date('2027-01-01T03:00:00Z'));
  });
});

describe('CrearNovedad', () => {
  it('crea siempre un borrador manual a nombre de quien la escribe', async () => {
    const repo = new NovedadesEnMemoria();
    const r = await new CrearNovedad(repo).ejecutar(`  ${TITULO}  `, CONTENIDO, 5);
    expect(r).toEqual({ id: 1, estado: 'borrador' });
    expect(repo.filas.get(1)).toMatchObject({ titulo: TITULO, origen: 'manual', estado: 'borrador', autor: 'usuario 5' });
  });

  it('rechaza títulos y contenidos vacíos, cortos, largos o que no son texto', async () => {
    const caso = new CrearNovedad(new NovedadesEnMemoria());
    await expect(caso.ejecutar('  ', CONTENIDO, 1)).rejects.toThrow(ErrorEntradaInvalida);
    await expect(caso.ejecutar('ab', CONTENIDO, 1)).rejects.toThrow(ErrorEntradaInvalida);
    await expect(caso.ejecutar('x'.repeat(151), CONTENIDO, 1)).rejects.toThrow(ErrorEntradaInvalida);
    await expect(caso.ejecutar(TITULO, 'corto', 1)).rejects.toThrow(ErrorEntradaInvalida);
    await expect(caso.ejecutar(TITULO, 'x'.repeat(10001), 1)).rejects.toThrow(ErrorEntradaInvalida);
    await expect(caso.ejecutar(undefined, CONTENIDO, 1)).rejects.toThrow(ErrorEntradaInvalida);
  });
});

describe('EditarNovedad', () => {
  it('edita solo lo que se manda y conserva el resto', async () => {
    const repo = new NovedadesEnMemoria();
    await new CrearNovedad(repo).ejecutar(TITULO, CONTENIDO, 1);
    await new EditarNovedad(repo).ejecutar(1, { titulo: 'Título nuevo' });
    expect(repo.filas.get(1)).toMatchObject({ titulo: 'Título nuevo', contenido: CONTENIDO });
  });

  it('no permite editar una novedad publicada', async () => {
    const repo = new NovedadesEnMemoria();
    await new CrearNovedad(repo).ejecutar(TITULO, CONTENIDO, 1);
    await new PublicarNovedad(repo).ejecutar(1, 2);
    await expect(new EditarNovedad(repo).ejecutar(1, { titulo: 'Otro título' })).rejects.toThrow(ErrorOperacionInvalida);
    expect(repo.filas.get(1)?.titulo).toBe(TITULO);
  });

  it('falla si no hay cambios, si no existe o si el texto es inválido', async () => {
    const repo = new NovedadesEnMemoria();
    await new CrearNovedad(repo).ejecutar(TITULO, CONTENIDO, 1);
    const caso = new EditarNovedad(repo);
    await expect(caso.ejecutar(1, {})).rejects.toThrow(ErrorEntradaInvalida);
    await expect(caso.ejecutar(99, { titulo: 'Otro título' })).rejects.toThrow(ErrorNoEncontrado);
    await expect(caso.ejecutar(1, { contenido: 'corto' })).rejects.toThrow(ErrorEntradaInvalida);
  });
});

describe('PublicarNovedad', () => {
  it('publica un borrador y registra quién lo aprobó', async () => {
    const repo = new NovedadesEnMemoria();
    await new CrearNovedad(repo).ejecutar(TITULO, CONTENIDO, 1);
    const r = await new PublicarNovedad(repo).ejecutar(1, 9);
    expect(r).toEqual({ id: 1, estado: 'publicado' });
    expect(repo.filas.get(1)).toMatchObject({ estado: 'publicado', aprobadoPor: 'usuario 9' });
    expect(repo.filas.get(1)?.publicadoEn).toBeInstanceOf(Date);
  });

  it('no publica dos veces ni una novedad inexistente', async () => {
    const repo = new NovedadesEnMemoria();
    await new CrearNovedad(repo).ejecutar(TITULO, CONTENIDO, 1);
    const caso = new PublicarNovedad(repo);
    await caso.ejecutar(1, 9);
    await expect(caso.ejecutar(1, 9)).rejects.toThrow(ErrorOperacionInvalida);
    await expect(caso.ejecutar(42, 9)).rejects.toThrow(ErrorNoEncontrado);
  });

  it('si otra persona la publicó entre la lectura y la escritura, avisa en vez de pisarla', async () => {
    const repo = new NovedadesEnMemoria();
    await new CrearNovedad(repo).ejecutar(TITULO, CONTENIDO, 1);
    repo.publicar = async () => false;
    await expect(new PublicarNovedad(repo).ejecutar(1, 9)).rejects.toThrow(ErrorOperacionInvalida);
  });
});

describe('EliminarNovedad', () => {
  it('elimina borradores y publicadas; falla si no existe', async () => {
    const repo = new NovedadesEnMemoria();
    await new CrearNovedad(repo).ejecutar(TITULO, CONTENIDO, 1);
    await new PublicarNovedad(repo).ejecutar(1, 2);
    await new EliminarNovedad(repo).ejecutar(1);
    expect(repo.filas.size).toBe(0);
    await expect(new EliminarNovedad(repo).ejecutar(1)).rejects.toThrow(ErrorNoEncontrado);
  });
});

describe('VerNovedad', () => {
  async function conUnBorradorYUnaPublicada() {
    const repo = new NovedadesEnMemoria();
    await new CrearNovedad(repo).ejecutar(TITULO, CONTENIDO, 1);
    await new CrearNovedad(repo).ejecutar('Segunda novedad', CONTENIDO, 1);
    await new PublicarNovedad(repo).ejecutar(2, 9);
    return repo;
  }

  it('el vecino ve las publicadas, sin autor ni aprobador', async () => {
    const repo = await conUnBorradorYUnaPublicada();
    const r = await new VerNovedad(repo).ejecutar(2, false);
    expect(Object.keys(r).sort()).toEqual(['contenido', 'id', 'publicadoEn', 'titulo']);
  });

  it('el vecino no ve borradores: responde como si no existieran', async () => {
    const repo = await conUnBorradorYUnaPublicada();
    await expect(new VerNovedad(repo).ejecutar(1, false)).rejects.toThrow(ErrorNoEncontrado);
  });

  it('el administrador ve borradores y todos los datos', async () => {
    const repo = await conUnBorradorYUnaPublicada();
    expect(await new VerNovedad(repo).ejecutar(1, true)).toMatchObject({ estado: 'borrador', autor: 'usuario 1' });
  });
});

describe('ListarNovedadesGestion', () => {
  it('valida el estado antes de consultar (evita valores arbitrarios)', async () => {
    let llamado = false;
    const consultas = { listarPublicadas: async () => ({ items: [], total: 0 }), listarGestion: async () => { llamado = true; return { items: [], total: 0 }; } };
    await expect(new ListarNovedadesGestion(consultas).ejecutar(1, 'borrado')).rejects.toThrow(ErrorEntradaInvalida);
    expect(llamado).toBe(false);
  });

  it('trata el estado vacío como ausente y devuelve los filtros aplicados', async () => {
    let recibido: unknown = 'sin llamar';
    const consultas = { listarPublicadas: async () => ({ items: [], total: 0 }), listarGestion: async (_p: number, _t: number, e: unknown) => { recibido = e; return { items: [], total: 0 }; } };
    const r = await new ListarNovedadesGestion(consultas).ejecutar(0, '');
    expect(recibido).toBeNull();
    expect(r).toMatchObject({ pagina: 1, filtros: { estado: null } });
  });
});
