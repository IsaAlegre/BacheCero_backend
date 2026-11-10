import type { DataSource } from 'typeorm';
import { GenerarBorradorNovedad } from './application/generar-borrador-novedad';
import type { PuertoRedactorNovedades } from './application/generar-borrador-novedad';
import { ListarNovedades, ListarNovedadesGestion, VerNovedad } from './application/listar-novedades';
import { CrearNovedad, EditarNovedad, EliminarNovedad, PublicarNovedad } from './application/novedades';
import { RedactorNovedadesClaude } from './infrastructure/ia/redactor-novedades-claude.adapter';
import { RedactorNovedadesFalso } from './infrastructure/ia/redactor-novedades-falso.adapter';
import { ConsultasNovedadesPostgres } from './infrastructure/persistencia/consultas-novedades.postgres';
import { GestionNovedadesPostgres } from './infrastructure/persistencia/gestion-novedades.postgres';
import { ResumenMensualPostgres } from './infrastructure/persistencia/resumen-mensual.postgres';

export interface CasosNovedades {
  readonly listar: ListarNovedades;
  readonly listarGestion: ListarNovedadesGestion;
  readonly ver: VerNovedad;
  readonly crear: CrearNovedad;
  readonly editar: EditarNovedad;
  readonly publicar: PublicarNovedad;
  readonly eliminar: EliminarNovedad;
  readonly generarBorrador: GenerarBorradorNovedad;
}

const MODELO_POR_DEFECTO = 'claude-sonnet-5-5';

// Módulo de Novedades. composicion.ts lo llama una sola vez.
// Redactor de borradores: ANTHROPIC_API_KEY usa la IA real (modelo en NOVEDADES_MODELO).
// Sin clave, MODO_DESARROLLO=1 usa un redactor falso. Sin ninguno, la generación queda desactivada
// y el resto de Novedades funciona igual.
export function construirNovedades(db: DataSource, env: NodeJS.ProcessEnv = process.env): CasosNovedades {
  const gestion = new GestionNovedadesPostgres(db);
  const consultas = new ConsultasNovedadesPostgres(db);

  const redactor: PuertoRedactorNovedades | null = env.ANTHROPIC_API_KEY
    ? new RedactorNovedadesClaude({ apiKey: env.ANTHROPIC_API_KEY, modelo: env.NOVEDADES_MODELO || MODELO_POR_DEFECTO })
    : env.MODO_DESARROLLO === '1'
    ? new RedactorNovedadesFalso()
    : null;

  return {
    listar: new ListarNovedades(consultas),
    listarGestion: new ListarNovedadesGestion(consultas),
    ver: new VerNovedad(gestion),
    crear: new CrearNovedad(gestion),
    editar: new EditarNovedad(gestion),
    publicar: new PublicarNovedad(gestion),
    eliminar: new EliminarNovedad(gestion),
    generarBorrador: new GenerarBorradorNovedad(new ResumenMensualPostgres(db), redactor, gestion),
  };
}
