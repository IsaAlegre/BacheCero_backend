import { ErrorEntradaInvalida, ErrorNoEncontrado, ErrorOperacionInvalida } from './errores';

export const ROLES = ['ciudadano', 'operador', 'administrador'] as const;

export interface UsuarioGuardado {
  readonly id: number;
  readonly nombre: string;
  readonly dni: string;
  readonly rol: string;
  readonly passwordHash: string;
}

export interface PuertoUsuarios {
  crearCiudadano(datos: { nombre: string; dni: string; passwordHash: string }): Promise<number>;
  buscarPorDni(dni: string): Promise<UsuarioGuardado | null>;
  cambiarRol(id: number, rol: string): Promise<boolean>;
}

export interface PuertoHash {
  hashear(texto: string): Promise<string>;
  comparar(texto: string, hash: string): Promise<boolean>;
}

export interface PuertoTokens {
  firmar(sub: number, rol: string): string;
  verificar(token: string): { sub: number; rol: string };
}

export class ErrorDniYaRegistrado extends Error {}
export class ErrorCredenciales extends Error {
  constructor() {
    super('DNI o contraseña incorrectos');
  }
}

export interface DatosRegistro {
  readonly nombre: string;
  readonly dni: string;
  readonly password: string;
}

// Solo se registran ciudadanos. Operadores y administradores los asigna un administrador.
export class RegistrarCiudadano {
  constructor(
    private readonly usuarios: PuertoUsuarios,
    private readonly hash: PuertoHash,
  ) {}

  async ejecutar(datos: DatosRegistro): Promise<{ id: number }> {
    const nombre = datos.nombre.trim();
    if (!nombre) throw new ErrorEntradaInvalida('El nombre es obligatorio');
    if (!/^\d{7,8}$/.test(datos.dni)) throw new ErrorEntradaInvalida('El DNI debe tener 7 u 8 dígitos');
    if (datos.password.length < 8) throw new ErrorEntradaInvalida('La contraseña debe tener al menos 8 caracteres');

    if (await this.usuarios.buscarPorDni(datos.dni)) {
      throw new ErrorDniYaRegistrado('Ya existe un usuario con ese DNI');
    }
    const id = await this.usuarios.crearCiudadano({
      nombre,
      dni: datos.dni,
      passwordHash: await this.hash.hashear(datos.password),
    });
    return { id };
  }
}

export class IniciarSesion {
  constructor(
    private readonly usuarios: PuertoUsuarios,
    private readonly hash: PuertoHash,
    private readonly tokens: PuertoTokens,
  ) {}

  async ejecutar(dni: string, password: string): Promise<{ accessToken: string }> {
    const usuario = await this.usuarios.buscarPorDni(dni);
    // Misma respuesta si el DNI no existe o la contraseña no coincide.
    if (!usuario || !(await this.hash.comparar(password, usuario.passwordHash))) {
      throw new ErrorCredenciales();
    }
    return { accessToken: this.tokens.firmar(usuario.id, usuario.rol) };
  }
}

// Solo el administrador asigna roles. No puede quitarse a sí mismo el rol de administrador,
// para no quedarse sin nadie que pueda administrar.
export class AsignarRol {
  constructor(private readonly usuarios: PuertoUsuarios) {}

  async ejecutar(usuarioId: number, rol: string, quienAsigna: number): Promise<{ id: number; rol: string }> {
    if (!(ROLES as readonly string[]).includes(rol)) throw new ErrorEntradaInvalida('Rol inválido');
    if (usuarioId === quienAsigna && rol !== 'administrador') {
      throw new ErrorOperacionInvalida('No podés quitarte a vos mismo el rol de administrador');
    }
    const ok = await this.usuarios.cambiarRol(usuarioId, rol);
    if (!ok) throw new ErrorNoEncontrado('No existe el usuario');
    return { id: usuarioId, rol };
  }
}
