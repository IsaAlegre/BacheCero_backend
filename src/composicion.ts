import { dataSource } from './infrastructure/persistencia/data-source';
import { RegistrarCiudadano, IniciarSesion } from './application/usuarios';
import { ListarTickets } from './application/listar-tickets';
import { AsignarRol } from './application/usuarios';
import { CambiarEstadoTicket, ResolverRevision, VerDetalleTicket } from './application/gestion-tickets';
import { GestionTicketsPostgres } from './infrastructure/persistencia/gestion-tickets.postgres';
import { RegistrarReporte } from './application/registrar-reporte';
import { UsuariosPostgres } from './infrastructure/persistencia/usuarios.postgres';
import { ConsultasTicketsPostgres } from './infrastructure/persistencia/consultas-tickets.postgres';
import { TicketsPostgres } from './infrastructure/persistencia/tickets.postgres';
import { CatalogosPostgres } from './infrastructure/persistencia/catalogos.postgres';
import { BcryptHash } from './infrastructure/seguridad/bcrypt.adapter';
import { TokensJwt } from './infrastructure/seguridad/tokens-jwt.adapter';
import { IaHttpAdapter } from './infrastructure/ia/ia-http.adapter';
import { IaFalsaAdapter } from './infrastructure/ia/ia-falsa.adapter';
import { AlmacenCloudinary } from './infrastructure/almacen/cloudinary.adapter';
import { AlmacenLocal } from './infrastructure/almacen/almacen-local.adapter';
import { UbicacionNominatim } from './infrastructure/geo/ubicacion-nominatim.adapter';
import { UbicacionFalsa } from './infrastructure/geo/ubicacion-falsa.adapter';
import { ListarMisReportes } from './application/mis-reportes';
import { ConsultasReportesPostgres } from './infrastructure/persistencia/consultas-reportes.postgres';
import { ObtenerEstadisticas } from './application/estadisticas';
import { ConsultasEstadisticasPostgres } from './infrastructure/persistencia/consultas-estadisticas.postgres';
import { CasosNovedades, construirNovedades } from './composicion-novedades';

export const CASOS = Symbol('CASOS');

export interface Casos {
  readonly registrarCiudadano: RegistrarCiudadano;
  readonly iniciarSesion: IniciarSesion;
  readonly registrarReporte: RegistrarReporte;
  readonly listarTickets: ListarTickets;
  readonly verTicket: VerDetalleTicket;
  readonly cambiarEstadoTicket: CambiarEstadoTicket;
  readonly resolverRevision: ResolverRevision;
  readonly asignarRol: AsignarRol;
  readonly tokens: TokensJwt;
  readonly misReportes: ListarMisReportes;
  readonly estadisticas: ObtenerEstadisticas;
  readonly novedades: CasosNovedades;
}

// Único lugar donde se eligen los adaptadores concretos.
// IA: IA_URL usa el microservicio real. Sin IA_URL, MODO_DESARROLLO=1 usa una IA falsa.
// ALMACEN_IMAGENES: 'cloudinary' (por defecto) o 'local' (carpeta ./uploads).
// UBICACION: 'nominatim' (por defecto) o 'falsa' (sin consultar OpenStreetMap).
export function construirCasos(env: NodeJS.ProcessEnv = process.env): Casos {
  const dev = env.MODO_DESARROLLO === '1';
  const requerir = (nombre: string): string => {
    const valor = env[nombre];
    if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
    return valor;
  };

  const tokens = new TokensJwt(requerir('JWT_SECRET'));
  const hash = new BcryptHash();
  const usuarios = new UsuariosPostgres(dataSource);
  const tickets = new TicketsPostgres(dataSource);
  const catalogos = new CatalogosPostgres(dataSource);
  const gestion = new GestionTicketsPostgres(dataSource);

  const ia = env.IA_URL
    ? new IaHttpAdapter(env.IA_URL)
    : dev
    ? new IaFalsaAdapter({
        hayDano: true,
        detecciones: [{ tipo: 'pothole', claseModelo: 'pothole', confianza: 0.85, areaPct: 6, bbox: [0, 0, 10, 10] }],
        imagenDifuminada: Buffer.from('dev'),
        respuestaCruda: { modo: 'desarrollo' },
      })
    : (() => { throw new Error('Falta IA_URL (o MODO_DESARROLLO=1 para usar una IA falsa)'); })();

  const imagenes = env.ALMACEN_IMAGENES === 'local'
    ? new AlmacenLocal()
    : new AlmacenCloudinary({
        cloudName: requerir('CLOUDINARY_CLOUD_NAME'),
        apiKey: requerir('CLOUDINARY_API_KEY'),
        apiSecret: requerir('CLOUDINARY_API_SECRET'),
      });

  const ubicaciones = env.UBICACION === 'falsa'
    ? new UbicacionFalsa()
    : new UbicacionNominatim(requerir('NOMINATIM_USER_AGENT'));

  return {
    registrarCiudadano: new RegistrarCiudadano(usuarios, hash),
    iniciarSesion: new IniciarSesion(usuarios, hash, tokens),
    registrarReporte: new RegistrarReporte({ ia, imagenes, ubicaciones, catalogos, barrios: catalogos, tickets }),
    listarTickets: new ListarTickets(new ConsultasTicketsPostgres(dataSource)),
    misReportes: new ListarMisReportes(new ConsultasReportesPostgres(dataSource)),
    estadisticas: new ObtenerEstadisticas(new ConsultasEstadisticasPostgres(dataSource)),
    verTicket: new VerDetalleTicket(gestion),
    cambiarEstadoTicket: new CambiarEstadoTicket(gestion),
    resolverRevision: new ResolverRevision(gestion),
    asignarRol: new AsignarRol(usuarios),
    novedades: construirNovedades(dataSource, env),
    tokens,
  };
}
