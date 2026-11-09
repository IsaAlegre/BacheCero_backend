import { RegistrarReporte } from '../application/registrar-reporte';
import { ErrorImagenInvalida, ErrorEntradaInvalida } from '../application/errores';
import type {
  NuevoReporte,
  NuevoTicket,
  PuertoAlmacenImagenes,
  PuertoBarrios,
  PuertoCatalogos,
  PuertoIa,
  PuertoTickets,
  PuertoUbicacion,
  ResultadoIa,
  TicketAbierto,
} from '../application/puertos';
import type { Gravedad, TipoDano } from '../domain/reglas';

// ---------- Fakes en memoria ----------

class TicketsEnMemoria implements PuertoTickets {
  readonly tickets: Array<NuevoTicket & { id: number; gravedad: Gravedad | null; necesitaRevision: boolean; prioridad: number }> = [];
  readonly reportes: NuevoReporte[] = [];
  private siguiente = 1;

  async buscarAbiertoCercano(tipo: TipoDano, lat: number, lng: number): Promise<TicketAbierto | null> {
    // Aproximación sin PostGIS: ~11 m de tolerancia. El SQL real usa ST_DWithin.
    const t = this.tickets.find(
      (x) => x.tipo === tipo && Math.abs(x.lat - lat) < 0.0001 && Math.abs(x.lng - lng) < 0.0001,
    );
    if (!t) return null;
    return {
      id: t.id,
      gravedad: t.gravedad,
      pesoJerarquia: t.osmHighway === 'primary' ? 1 : null,
      vulnerabilidad: 0.8,
      necesitaRevision: t.necesitaRevision,
    };
  }

  async crear(t: NuevoTicket): Promise<number> {
    const id = this.siguiente++;
    this.tickets.push({ ...t, id, gravedad: t.gravedad, necesitaRevision: t.necesitaRevision, prioridad: t.prioridad });
    return id;
  }

  async agregarReporte(r: NuevoReporte): Promise<number> {
    this.reportes.push(r);
    return this.reportes.length;
  }

  async contarReportes(ticketId: number): Promise<number> {
    return this.reportes.filter((r) => r.ticketId === ticketId).length;
  }

  async actualizarAnalisis(
    ticketId: number,
    cambios: { gravedad: Gravedad | null; prioridad: number; necesitaRevision: boolean },
  ): Promise<void> {
    const t = this.tickets.find((x) => x.id === ticketId)!;
    Object.assign(t, cambios);
  }
}

class IaScript implements PuertoIa {
  constructor(private readonly resultado: ResultadoIa | Error) {}
  async analizar(): Promise<ResultadoIa> {
    if (this.resultado instanceof Error) throw this.resultado;
    return this.resultado;
  }
}

class AlmacenEnMemoria implements PuertoAlmacenImagenes {
  readonly guardadas: Buffer[] = [];
  async guardar(imagen: Buffer): Promise<string> {
    this.guardadas.push(imagen);
    return `https://cdn.test/${this.guardadas.length}.jpg`;
  }
}

const ubicacionFija: PuertoUbicacion = {
  async resolver() {
    return { calle: 'Av. Uruguay', osmHighway: 'primary', barrio: 'Miguel Lanús' };
  },
};
const catalogosFijos: PuertoCatalogos = {
  async pesoJerarquia(osm) {
    return osm === 'primary' ? 1 : null;
  },
};
const barriosFijos: PuertoBarrios = {
  async indiceVulnerabilidad() {
    return 0.8;
  },
};

const pothole = (areaPct: number) => ({
  tipo: 'pothole' as const,
  claseModelo: 'pothole',
  confianza: 0.85,
  areaPct,
  bbox: [0, 0, 10, 10] as const,
});

const imagenDifuminada = Buffer.from('imagen-difuminada');
const analisisConDano: ResultadoIa = {
  hayDano: true,
  detecciones: [pothole(6)],
  imagenDifuminada,
  respuestaCruda: { summary: { damage_found: true } },
};

const entrada = (lat = -27.3671, lng = -55.8960) => ({
  usuarioId: 1,
  imagen: Buffer.from('foto-original'),
  nombreArchivo: 'foto.jpg',
  lat,
  lng,
});

function construir(ia: PuertoIa) {
  const tickets = new TicketsEnMemoria();
  const imagenes = new AlmacenEnMemoria();
  const caso = new RegistrarReporte({
    ia,
    imagenes,
    ubicaciones: ubicacionFija,
    catalogos: catalogosFijos,
    barrios: barriosFijos,
    tickets,
  });
  return { caso, tickets, imagenes };
}

// ---------- Pruebas ----------

describe('RegistrarReporte', () => {
  it('crea un ticket nuevo con gravedad y prioridad calculadas', async () => {
    const { caso, tickets } = construir(new IaScript(analisisConDano));
    const r = await caso.ejecutar(entrada());

    expect(r.nuevoTicket).toBe(true);
    expect(tickets.tickets[0]!.tipo).toBe('pothole');
    expect(tickets.tickets[0]!.gravedad).toBe('grave');
    // 0.4*1 + 0.25*1 + 0.15*(1/5) + 0.2*0.8 = 0.84
    expect(r.prioridad).toBeCloseTo(0.84, 3);
    expect(r.necesitaRevision).toBe(false);
  });

  it('agrupa un segundo reporte cercano del mismo tipo en el mismo ticket', async () => {
    const { caso, tickets } = construir(new IaScript(analisisConDano));
    const primero = await caso.ejecutar(entrada());
    const segundo = await caso.ejecutar(entrada(-27.3671, -55.896));

    expect(segundo.nuevoTicket).toBe(false);
    expect(segundo.ticketId).toBe(primero.ticketId);
    expect(tickets.tickets).toHaveLength(1);
    // Dos reportes: 0.4*1 + 0.25*1 + 0.15*(2/5) + 0.2*0.8 = 0.87
    expect(segundo.prioridad).toBeCloseTo(0.87, 3);
  });

  it('una foto sin daño queda sin tipo y marcada para revisión humana', async () => {
    const sinDano: ResultadoIa = { ...analisisConDano, hayDano: false, detecciones: [] };
    const { caso, tickets } = construir(new IaScript(sinDano));
    const r = await caso.ejecutar(entrada());

    expect(r.necesitaRevision).toBe(true);
    expect(tickets.tickets[0]!.tipo).toBeNull();
    expect(tickets.tickets[0]!.gravedad).toBeNull();
  });

  it('guarda solo la imagen difuminada, nunca la original', async () => {
    const { caso, imagenes } = construir(new IaScript(analisisConDano));
    await caso.ejecutar(entrada());

    expect(imagenes.guardadas).toHaveLength(1);
    expect(imagenes.guardadas[0]!.equals(imagenDifuminada)).toBe(true);
  });

  it('si la IA rechaza la imagen, no guarda nada', async () => {
    const { caso, tickets, imagenes } = construir(
      new IaScript(new ErrorImagenInvalida('La IA rechazó la imagen (HTTP 415)')),
    );
    await expect(caso.ejecutar(entrada())).rejects.toBeInstanceOf(ErrorImagenInvalida);
    expect(imagenes.guardadas).toHaveLength(0);
    expect(tickets.tickets).toHaveLength(0);
  });

  it('rechaza coordenadas fuera de rango', async () => {
    const { caso } = construir(new IaScript(analisisConDano));
    await expect(caso.ejecutar(entrada(91, 0))).rejects.toBeInstanceOf(ErrorEntradaInvalida);
  });
});
