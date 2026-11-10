import type { DataSource } from 'typeorm';
import { ErrorDniYaRegistrado, PuertoUsuarios, UsuarioGuardado } from '../../application/usuarios';

export class UsuariosPostgres implements PuertoUsuarios {
  constructor(private readonly db: DataSource) {}

  async crearCiudadano(datos: { nombre: string; dni: string; passwordHash: string }): Promise<number> {
    try {
      const filas: Array<{ id: string }> = await this.db.query(
        `INSERT INTO usuarios (nombre, dni, password_hash, rol_id)
         VALUES ($1, $2, $3, (SELECT id FROM roles WHERE codigo = 'ciudadano'))
         RETURNING id`,
        [datos.nombre, datos.dni, datos.passwordHash],
      );
      return Number(filas[0]!.id);
    } catch (error) {
      // 23505: violación de unicidad (dos registros simultáneos con el mismo DNI).
      if ((error as { code?: string }).code === '23505') {
        throw new ErrorDniYaRegistrado('Ya existe un usuario con ese DNI');
      }
      throw error;
    }
  }


  async cambiarRol(id: number, rol: string): Promise<boolean> {
    const [filas] = await this.db.query(
      `UPDATE usuarios SET rol_id = (SELECT id FROM roles WHERE codigo = $2) WHERE id = $1 RETURNING id`,
      [id, rol],
    );
    return filas.length > 0;
  }

  async buscarPorDni(dni: string): Promise<UsuarioGuardado | null> {
    const filas: Array<{ id: string; nombre: string; dni: string; rol: string; password_hash: string }> =
      await this.db.query(
        `SELECT u.id, u.nombre, u.dni, r.codigo AS rol, u.password_hash
           FROM usuarios u
           JOIN roles r ON r.id = u.rol_id
          WHERE u.dni = $1`,
        [dni],
      );
    const f = filas[0];
    if (!f) return null;
    return { id: Number(f.id), nombre: f.nombre, dni: f.dni, rol: f.rol, passwordHash: f.password_hash };
  }
}
