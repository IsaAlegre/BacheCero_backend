import { LIMITES_NOVEDAD, puedeEditarse, puedePublicarse } from '../domain/novedades';
import type { EstadoNovedad, OrigenNovedad } from '../domain/novedades';
import { ErrorEntradaInvalida, ErrorNoEncontrado, ErrorOperacionInvalida } from './errores';

export interface NovedadGuardada {
  readonly id: number;
  readonly titulo: string;
  readonly contenido: string;
  readonly estado: EstadoNovedad;
  readonly origen: OrigenNovedad;
  readonly autor: string;
  readonly aprobadoPor: string | null;
  readonly creadoEn: Date;
  readonly actualizadoEn: Date;
  readonly publicadoEn: Date | null;
}

export interface NuevaNovedad {
  readonly titulo: string;
  readonly contenido: string;
  readonly origen: OrigenNovedad;
  readonly autorId: number;
}

export interface PuertoGestionNovedades {
  crear(novedad: NuevaNovedad): Promise<number>;
  obtener(id: number): Promise<NovedadGuardada | null>;
  // Los tres devuelven false si la novedad cambió o desapareció entre la lectura y la escritura.
  editarBorrador(id: number, cambios: { titulo: string; contenido: string }): Promise<boolean>;
  publicar(id: number, aprobadorId: number): Promise<boolean>;
  eliminar(id: number): Promise<boolean>;
}

export interface TextoNovedad {
  readonly titulo: string;
  readonly contenido: string;
}

// Valida y normaliza (recorta espacios). Lo usan todos los casos de uso que reciben texto.
export function validarTexto(titulo: unknown, contenido: unknown): TextoNovedad {
  if (typeof titulo !== 'string' || typeof contenido !== 'string') {
    throw new ErrorEntradaInvalida('El título y el contenido son obligatorios');
  }
  const t = titulo.trim();
  const c = contenido.trim();
  const { tituloMin, tituloMax, contenidoMin, contenidoMax } = LIMITES_NOVEDAD;
  if (t.length < tituloMin || t.length > tituloMax) {
    throw new ErrorEntradaInvalida(`El título debe tener entre ${tituloMin} y ${tituloMax} caracteres`);
  }
  if (c.length < contenidoMin || c.length > contenidoMax) {
    throw new ErrorEntradaInvalida(`El contenido debe tener entre ${contenidoMin} y ${contenidoMax} caracteres`);
  }
  return { titulo: t, contenido: c };
}

// Toda novedad nace como borrador: nada llega a los vecinos sin aprobación.
export class CrearNovedad {
  constructor(private readonly novedades: PuertoGestionNovedades) {}

  async ejecutar(titulo: unknown, contenido: unknown, autorId: number): Promise<{ id: number; estado: EstadoNovedad }> {
    const texto = validarTexto(titulo, contenido);
    const id = await this.novedades.crear({ ...texto, origen: 'manual', autorId });
    return { id, estado: 'borrador' };
  }
}

export class EditarNovedad {
  constructor(private readonly novedades: PuertoGestionNovedades) {}

  async ejecutar(id: number, cambios: { titulo?: string; contenido?: string }): Promise<{ id: number }> {
    if (cambios.titulo === undefined && cambios.contenido === undefined) {
      throw new ErrorEntradaInvalida('No hay nada para cambiar: mandá título, contenido o ambos');
    }
    const actual = await this.novedades.obtener(id);
    if (!actual) throw new ErrorNoEncontrado('No existe la novedad');
    if (!puedeEditarse(actual.estado)) {
      throw new ErrorOperacionInvalida('Solo se pueden editar borradores. Una novedad publicada se elimina y se vuelve a redactar');
    }
    const texto = validarTexto(cambios.titulo ?? actual.titulo, cambios.contenido ?? actual.contenido);
    const aplicado = await this.novedades.editarBorrador(id, texto);
    if (!aplicado) throw new ErrorOperacionInvalida('La novedad cambió mientras la editabas, recargá y volvé a intentar');
    return { id };
  }
}

// Publicar es la aprobación del responsable del área: queda registrado quién la hizo.
export class PublicarNovedad {
  constructor(private readonly novedades: PuertoGestionNovedades) {}

  async ejecutar(id: number, aprobadorId: number): Promise<{ id: number; estado: EstadoNovedad }> {
    const actual = await this.novedades.obtener(id);
    if (!actual) throw new ErrorNoEncontrado('No existe la novedad');
    if (!puedePublicarse(actual.estado)) throw new ErrorOperacionInvalida('La novedad ya está publicada');
    const aplicado = await this.novedades.publicar(id, aprobadorId);
    if (!aplicado) throw new ErrorOperacionInvalida('La novedad ya fue publicada por otra persona');
    return { id, estado: 'publicado' };
  }
}

export class EliminarNovedad {
  constructor(private readonly novedades: PuertoGestionNovedades) {}

  async ejecutar(id: number): Promise<{ id: number }> {
    const eliminado = await this.novedades.eliminar(id);
    if (!eliminado) throw new ErrorNoEncontrado('No existe la novedad');
    return { id };
  }
}
