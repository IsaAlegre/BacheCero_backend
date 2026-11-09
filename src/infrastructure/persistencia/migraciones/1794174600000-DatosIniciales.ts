import { MigrationInterface, QueryRunner } from 'typeorm';

// Catálogos y parámetros iniciales. ON CONFLICT: volver a correrla no duplica nada.
export class DatosIniciales1794174600000 implements MigrationInterface {
  name = 'DatosIniciales1794174600000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`INSERT INTO roles (codigo, nombre) VALUES
      ('ciudadano', 'Ciudadano'), ('operador', 'Operador'), ('administrador', 'Administrador')
      ON CONFLICT (codigo) DO NOTHING`);

    await q.query(`INSERT INTO estados (codigo, nombre, orden, abierto) VALUES
      ('pendiente', 'Pendiente', 1, true),
      ('programado', 'Programado', 2, true),
      ('en_reparacion', 'En reparación', 3, true),
      ('resuelto', 'Resuelto', 4, false)
      ON CONFLICT (codigo) DO NOTHING`);

    await q.query(`INSERT INTO tipos_dano (codigo, nombre_es) VALUES
      ('pothole', 'Bache'), ('crack', 'Grieta')
      ON CONFLICT (codigo) DO NOTHING`);

    await q.query(`INSERT INTO gravedades (codigo, nombre, peso) VALUES
      ('leve', 'Leve', 0.30), ('moderada', 'Moderada', 0.60), ('grave', 'Grave', 1.00)
      ON CONFLICT (codigo) DO NOTHING`);

    await q.query(`INSERT INTO jerarquias_calle (osm_highway, nombre, peso) VALUES
      ('trunk', 'Avenida principal', 1.00),
      ('primary', 'Avenida principal', 1.00),
      ('secondary', 'Avenida secundaria', 0.70),
      ('tertiary', 'Calle colectora', 0.50),
      ('residential', 'Calle residencial', 0.30),
      ('unclassified', 'Calle residencial', 0.30),
      ('service', 'Pasaje o acceso', 0.10),
      ('track', 'Camino de tierra', 0.10),
      ('path', 'Sendero', 0.10)
      ON CONFLICT (osm_highway) DO NOTHING`);

    await q.query(`INSERT INTO parametros (clave, valor, descripcion) VALUES
      ('umbral_confianza', 0.50, 'Confianza mínima para aceptar una detección sin revisión humana'),
      ('radio_duplicado_metros', 15, 'Distancia máxima para agrupar reportes del mismo bache'),
      ('reportes_para_maximo', 5, 'Cantidad de reportes que da el peso máximo por reportes'),
      ('peso_gravedad', 0.40, 'Peso de la gravedad en la prioridad'),
      ('peso_jerarquia', 0.25, 'Peso de la jerarquía de la calle en la prioridad'),
      ('peso_reportes', 0.15, 'Peso de la cantidad de reportes en la prioridad'),
      ('peso_vulnerabilidad', 0.20, 'Peso del índice de vulnerabilidad del barrio en la prioridad')
      ON CONFLICT (clave) DO NOTHING`);
  }

  // Los catálogos no se borran automáticamente: pueden tener tickets que los referencian.
  public async down(): Promise<void> {}
}
