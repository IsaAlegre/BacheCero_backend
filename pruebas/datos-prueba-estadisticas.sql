-- Datos de prueba para el módulo de estadísticas.
-- Requisito: existir al menos un usuario administrador (se usa como autor del historial).
-- Se puede correr varias veces: primero borra lo que insertó antes (calles que empiezan con "DEMO ").
-- Para limpiar al terminar:  DELETE FROM tickets WHERE calle_nombre LIKE 'DEMO %';

DELETE FROM tickets WHERE calle_nombre LIKE 'DEMO %';

WITH datos (calle, barrio, estado, tipo, gravedad, prioridad, revision, dias_atras, horas_hasta_cierre) AS (
  VALUES
    ('DEMO Av. Uruguay',      'Villa Cabello', 'resuelto',      'pothole', 'grave',    0.850, false, 20, 24),
    ('DEMO Calle Bolívar',    'Villa Cabello', 'resuelto',      'pothole', 'moderada', 0.600, false, 15, 72),
    ('DEMO Calle Sáenz Peña', 'Villa Cabello', 'pendiente',     'crack',   'leve',     0.420, false,  5, NULL),
    ('DEMO Av. Mitre',        'Villa Cabello', 'en_reparacion', 'pothole', 'grave',    0.800, false,  3, NULL),
    ('DEMO Calle Entre Ríos', 'Itaembé Miní',  'pendiente',     'pothole', 'moderada', 0.610, true,   2, NULL),
    ('DEMO Av. Quaranta',     'Itaembé Miní',  'programado',    'pothole', 'grave',    0.780, false,  6, NULL),
    ('DEMO Calle Colón',      'Itaembé Miní',  'resuelto',      'crack',   'leve',     0.300, false, 10, 48),
    ('DEMO Av. Corrientes',   'Centro',        'pendiente',     'pothole', 'leve',     0.350, false,  1, NULL),
    ('DEMO Calle San Martín', 'Centro',        'resuelto',      'pothole', 'moderada', 0.550, false, 25, 96),
    ('DEMO Camino Rural',     NULL,            'pendiente',     'pothole', 'moderada', 0.500, true,   0, NULL)
),
autor AS (
  SELECT u.id
    FROM usuarios u JOIN roles r ON r.id = u.rol_id
   WHERE r.codigo = 'administrador'
   ORDER BY u.id LIMIT 1
),
nuevos AS (
  INSERT INTO tickets
    (ubicacion, tipo_dano_id, gravedad_id, estado_id, barrio_nombre, calle_nombre, prioridad,
     necesita_revision, creado_en, actualizado_en)
  SELECT ST_SetSRID(ST_MakePoint(-55.90 + (row_number() OVER ()) * 0.004, -27.37), 4326)::geography,
         td.id, g.id, e.id, d.barrio, d.calle, d.prioridad, d.revision,
         now() - d.dias_atras * interval '1 day',
         now() - d.dias_atras * interval '1 day'
    FROM datos d
    JOIN tipos_dano td ON td.codigo = d.tipo
    JOIN gravedades g  ON g.codigo  = d.gravedad
    JOIN estados e     ON e.codigo  = d.estado
  RETURNING id, calle_nombre, estado_id, creado_en
)
INSERT INTO historial_estados (ticket_id, estado_anterior_id, estado_nuevo_id, usuario_id, creado_en)
-- Todo ticket nace "pendiente"...
SELECT n.id, NULL, (SELECT id FROM estados WHERE codigo = 'pendiente'), (SELECT id FROM autor), n.creado_en
  FROM nuevos n
UNION ALL
-- ...y los que ya avanzaron tienen su cambio de estado, horas después.
SELECT n.id, (SELECT id FROM estados WHERE codigo = 'pendiente'), n.estado_id, (SELECT id FROM autor),
       n.creado_en + COALESCE(d.horas_hasta_cierre, 1) * interval '1 hour'
  FROM nuevos n
  JOIN datos d ON d.calle = n.calle_nombre
 WHERE n.estado_id <> (SELECT id FROM estados WHERE codigo = 'pendiente');
