import { AsignarRol, PuertoUsuarios } from '../application/usuarios';
import { CambiarEstadoTicket, PuertoGestionTickets, ResolverRevision } from '../application/gestion-tickets';
import { ErrorEntradaInvalida, ErrorNoEncontrado, ErrorOperacionInvalida } from '../application/errores';

class GestionEnMemoria implements PuertoGestionTickets {
  estado = 'pendiente';
  necesitaRevision = true;
  cambios: Array<{ de: string; a: string; usuario: number }> = [];
  revisiones: Array<{ decision: string; usuario: number }> = [];

  async obtenerEstado(id: number) {
    return id === 1 ? { estado: this.estado, necesitaRevision: this.necesitaRevision } : null;
  }
  async obtenerDetalle() { return null; }
  async cambiarEstado(_id: number, de: string, a: string, usuario: number) {
    if (de !== this.estado) return false;
    this.cambios.push({ de, a, usuario });
    this.estado = a;
    return true;
  }
  async registrarRevision(_id: number, decision: string, usuario: number) {
    if (!this.necesitaRevision) return false;
    this.revisiones.push({ decision, usuario });
    this.necesitaRevision = false;
    return true;
  }
}

describe('CambiarEstadoTicket', () => {
  it('pasa de pendiente a programado y registra quién lo hizo', async () => {
    const g = new GestionEnMemoria();
    const r = await new CambiarEstadoTicket(g).ejecutar(1, 'programado', 7);
    expect(r).toEqual({ id: 1, estado: 'programado' });
    expect(g.cambios).toEqual([{ de: 'pendiente', a: 'programado', usuario: 7 }]);
  });

  it('permite saltar de pendiente directo a resuelto', async () => {
    const g = new GestionEnMemoria();
    await new CambiarEstadoTicket(g).ejecutar(1, 'resuelto', 7);
    expect(g.estado).toBe('resuelto');
  });

  it('no permite retroceder ni salir de resuelto', async () => {
    const g = new GestionEnMemoria();
    g.estado = 'en_reparacion';
    await expect(new CambiarEstadoTicket(g).ejecutar(1, 'pendiente', 7)).rejects.toThrow(ErrorOperacionInvalida);
    g.estado = 'resuelto';
    await expect(new CambiarEstadoTicket(g).ejecutar(1, 'en_reparacion', 7)).rejects.toThrow(ErrorOperacionInvalida);
    expect(g.cambios).toHaveLength(0);
  });

  it('rechaza el mismo estado, estados desconocidos y tickets inexistentes', async () => {
    const g = new GestionEnMemoria();
    const caso = new CambiarEstadoTicket(g);
    await expect(caso.ejecutar(1, 'pendiente', 7)).rejects.toThrow(ErrorOperacionInvalida);
    await expect(caso.ejecutar(1, 'cerrado', 7)).rejects.toThrow(ErrorEntradaInvalida);
    await expect(caso.ejecutar(99, 'programado', 7)).rejects.toThrow(ErrorNoEncontrado);
  });

  it('avisa si otro usuario cambió el estado mientras tanto', async () => {
    const g = new GestionEnMemoria();
    const original = g.obtenerEstado.bind(g);
    g.obtenerEstado = async (id) => {
      const leido = await original(id);
      g.estado = 'en_reparacion'; // cambia después de la lectura
      return leido;
    };
    await expect(new CambiarEstadoTicket(g).ejecutar(1, 'programado', 7)).rejects.toThrow(ErrorOperacionInvalida);
  });
});

describe('ResolverRevision', () => {
  it('confirma una detección marcada para revisión y deja el estado del ticket igual', async () => {
    const g = new GestionEnMemoria();
    const r = await new ResolverRevision(g).ejecutar(1, 'confirmada', 7);
    expect(r).toEqual({ id: 1, decision: 'confirmada' });
    expect(g.necesitaRevision).toBe(false);
    expect(g.estado).toBe('pendiente');
  });

  it('rechazar no cierra el ticket', async () => {
    const g = new GestionEnMemoria();
    await new ResolverRevision(g).ejecutar(1, 'rechazada', 7);
    expect(g.revisiones).toEqual([{ decision: 'rechazada', usuario: 7 }]);
    expect(g.estado).toBe('pendiente');
  });

  it('no resuelve dos veces ni acepta decisiones inválidas', async () => {
    const g = new GestionEnMemoria();
    const caso = new ResolverRevision(g);
    await caso.ejecutar(1, 'confirmada', 7);
    await expect(caso.ejecutar(1, 'rechazada', 7)).rejects.toThrow(ErrorOperacionInvalida);
    g.necesitaRevision = true;
    await expect(caso.ejecutar(1, 'quizás', 7)).rejects.toThrow(ErrorEntradaInvalida);
  });
});

class UsuariosEnMemoria implements Partial<PuertoUsuarios> {
  roles = new Map<number, string>([[1, 'administrador'], [2, 'ciudadano']]);
  async cambiarRol(id: number, rol: string) {
    if (!this.roles.has(id)) return false;
    this.roles.set(id, rol);
    return true;
  }
}

describe('AsignarRol', () => {
  it('el administrador asigna un rol a otro usuario', async () => {
    const u = new UsuariosEnMemoria();
    const r = await new AsignarRol(u as unknown as PuertoUsuarios).ejecutar(2, 'operador', 1);
    expect(r).toEqual({ id: 2, rol: 'operador' });
    expect(u.roles.get(2)).toBe('operador');
  });

  it('no permite quitarse a uno mismo el rol de administrador', async () => {
    const u = new UsuariosEnMemoria();
    await expect(new AsignarRol(u as unknown as PuertoUsuarios).ejecutar(1, 'ciudadano', 1)).rejects.toThrow(ErrorOperacionInvalida);
    expect(u.roles.get(1)).toBe('administrador');
  });

  it('rechaza roles inexistentes y usuarios inexistentes', async () => {
    const u = new UsuariosEnMemoria();
    const caso = new AsignarRol(u as unknown as PuertoUsuarios);
    await expect(caso.ejecutar(2, 'superuser', 1)).rejects.toThrow(ErrorEntradaInvalida);
    await expect(caso.ejecutar(99, 'operador', 1)).rejects.toThrow(ErrorNoEncontrado);
  });
});
