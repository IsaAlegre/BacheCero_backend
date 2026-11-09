// Reglas de negocio puras: sin NestJS, sin TypeORM, sin I/O.

export type Gravedad = 'leve' | 'moderada' | 'grave';
export type TipoDano = 'pothole' | 'crack';
export type CodigoEstado = 'pendiente' | 'programado' | 'en_reparacion' | 'resuelto';

export interface Deteccion {
  readonly tipo: TipoDano;
  readonly claseModelo: string;
  readonly confianza: number;
  readonly areaPct: number;
  readonly bbox: readonly [number, number, number, number];
}

export interface ConfiguracionPrioridad {
  readonly pesos: {
    readonly gravedad: number;
    readonly jerarquia: number;
    readonly reportes: number;
    readonly vulnerabilidad: number;
  };
  readonly reportesParaMaximo: number;
}

export interface Parametros extends ConfiguracionPrioridad {
  readonly umbralConfianza: number;
  readonly radioDuplicadoMetros: number;
}

// Valores por defecto. En producción se leen de la tabla `parametros`.
export const PARAMETROS_POR_DEFECTO: Parametros = {
  umbralConfianza: 0.5,
  radioDuplicadoMetros: 15,
  reportesParaMaximo: 5,
  pesos: { gravedad: 0.4, jerarquia: 0.25, reportes: 0.15, vulnerabilidad: 0.2 },
};

// Si la calle no está en el catálogo (o no se pudo resolver), se usa este peso.
export const PESO_JERARQUIA_DESCONOCIDA = 0.3;
// Si el barrio no tiene índice cargado, se usa un valor neutro.
export const VULNERABILIDAD_DESCONOCIDA = 0.5;

const ORDEN_GRAVEDAD: readonly Gravedad[] = ['leve', 'moderada', 'grave'];
const PESO_GRAVEDAD: Record<Gravedad, number> = { leve: 0.3, moderada: 0.6, grave: 1 };

export function pesoGravedad(g: Gravedad): number {
  return PESO_GRAVEDAD[g];
}

export function maxGravedad(a: Gravedad | null, b: Gravedad | null): Gravedad | null {
  if (!a) return b;
  if (!b) return a;
  return ORDEN_GRAVEDAD.indexOf(a) >= ORDEN_GRAVEDAD.indexOf(b) ? a : b;
}

// Umbrales provisorios (porcentaje del área de la foto que ocupa la caja).
// Hay que calibrarlos con fotos reales de Posadas antes de la demo.
export function gravedadDeDeteccion(d: Deteccion): Gravedad {
  if (d.tipo === 'pothole') {
    if (d.areaPct >= 5) return 'grave';
    if (d.areaPct >= 2) return 'moderada';
    return 'leve';
  }
  return d.claseModelo === 'alligator_crack' ? 'moderada' : 'leve';
}

export interface DanoPrincipal {
  readonly deteccion: Deteccion;
  readonly gravedad: Gravedad;
}

// Un ticket por foto: el daño principal es el de mayor gravedad y, en empate, el de mayor confianza.
export function danoPrincipal(detecciones: readonly Deteccion[]): DanoPrincipal | null {
  let mejor: DanoPrincipal | null = null;
  for (const deteccion of detecciones) {
    const candidato: DanoPrincipal = { deteccion, gravedad: gravedadDeDeteccion(deteccion) };
    const ganaGravedad =
      !mejor || ORDEN_GRAVEDAD.indexOf(candidato.gravedad) > ORDEN_GRAVEDAD.indexOf(mejor.gravedad);
    const empataGravedad =
      !!mejor && candidato.gravedad === mejor.gravedad && deteccion.confianza > mejor.deteccion.confianza;
    if (ganaGravedad || empataGravedad) mejor = candidato;
  }
  return mejor;
}

export function maxConfianza(detecciones: readonly Deteccion[]): number {
  return detecciones.reduce((max, d) => Math.max(max, d.confianza), 0);
}

// Sin daño detectado, o con confianza por debajo del umbral, la persona revisa el reporte.
export function requiereRevision(hayDano: boolean, confianzaMaxima: number, umbral: number): boolean {
  return !hayDano || confianzaMaxima < umbral;
}

export interface EntradaPrioridad {
  readonly gravedad: Gravedad | null;
  readonly pesoJerarquia: number | null;
  readonly cantidadReportes: number;
  readonly vulnerabilidad: number | null;
}

export function calcularPrioridad(
  entrada: EntradaPrioridad,
  configuracion: ConfiguracionPrioridad = PARAMETROS_POR_DEFECTO,
): number {
  const { pesos, reportesParaMaximo } = configuracion;
  const sumaPesos = pesos.gravedad + pesos.jerarquia + pesos.reportes + pesos.vulnerabilidad;
  if (Math.abs(sumaPesos - 1) > 1e-9) {
    throw new Error(`Los pesos de prioridad deben sumar 1 (suman ${sumaPesos})`);
  }
  if (!Number.isInteger(entrada.cantidadReportes) || entrada.cantidadReportes < 1) {
    throw new Error('cantidadReportes debe ser un entero mayor o igual a 1');
  }

  const componenteGravedad = entrada.gravedad ? pesoGravedad(entrada.gravedad) : 0;
  const componenteJerarquia = entrada.pesoJerarquia ?? PESO_JERARQUIA_DESCONOCIDA;
  const componenteReportes = Math.min(entrada.cantidadReportes / reportesParaMaximo, 1);
  const componenteVulnerabilidad = entrada.vulnerabilidad ?? VULNERABILIDAD_DESCONOCIDA;

  const total =
    pesos.gravedad * componenteGravedad +
    pesos.jerarquia * componenteJerarquia +
    pesos.reportes * componenteReportes +
    pesos.vulnerabilidad * componenteVulnerabilidad;

  return Math.round(total * 1000) / 1000;
}

// Ciclo de vida del ticket. "resuelto" es terminal: reabrir un bache es una decisión aparte.
const TRANSICIONES: Record<CodigoEstado, readonly CodigoEstado[]> = {
  pendiente: ['programado', 'en_reparacion', 'resuelto'],
  programado: ['en_reparacion', 'resuelto'],
  en_reparacion: ['resuelto'],
  resuelto: [],
};

export function puedeTransicionar(de: CodigoEstado, a: CodigoEstado): boolean {
  return TRANSICIONES[de].includes(a);
}
