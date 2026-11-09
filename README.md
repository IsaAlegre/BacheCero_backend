# Bache Cero: backend

Backend de Bache Cero. Recibe reportes de baches con foto, los analiza con el microservicio de IA, los agrupa en tickets y calcula su prioridad.

## Estructura

```
src/
  domain/           reglas puras: gravedad, daño principal, revisión, prioridad, transiciones
  application/      casos de uso (RegistrarReporte, RegistrarCiudadano, IniciarSesion, ListarTickets) y puertos
  infrastructure/   adaptadores: IA HTTP, Cloudinary, Nominatim, PostgreSQL con TypeORM, bcrypt, JWT, HTTP (NestJS)
  composicion.ts    único lugar donde se eligen los adaptadores concretos
  test/             tests del dominio y de los casos de uso (sin base ni red)
```

El dominio y la aplicación no importan NestJS ni TypeORM. Los adaptadores son los únicos que conocen esas librerías.

## Endpoints

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| POST | `/auth/registro` | Público | Registra un ciudadano con `nombre`, `dni` y `password` |
| POST | `/auth/login` | Público | Devuelve `accessToken` (JWT, 8 horas) |
| POST | `/reportes` | Cualquier usuario logueado | Sube una foto (`multipart/form-data`: `foto`, `lat`, `lng`, `descripcion` opcional). Devuelve el ticket, la prioridad, la imagen guardada y las detecciones de la IA |
| GET | `/tickets?pagina=1` | Cualquier usuario logueado | Lista los tickets abiertos, de mayor a menor prioridad, de 20 en 20 |
| GET | `/tickets/:id` | Operador o administrador | Detalle del ticket: todos sus reportes (foto, descripción, detecciones) e historial de estados |
| PATCH | `/tickets/:id/estado` | Operador o administrador | Cambia el estado (`pendiente`, `programado`, `en_reparacion`, `resuelto`) y lo registra en el historial |
| POST | `/tickets/:id/revision` | Operador o administrador | Confirma (`confirmada`) o rechaza (`rechazada`) una detección marcada para revisión |
| PATCH | `/usuarios/:id/rol` | Solo administrador | Asigna `ciudadano`, `operador` o `administrador` |

Errores: 400 datos inválidos, 401 sin token o credenciales incorrectas, 403 sin permiso para el rol, 404 no existe, 409 DNI repetido o acción no permitida en el estado actual (transición inválida, revisión ya resuelta, rol propio de administrador), 413 foto mayor a 10 MB, 415 formato no aceptado (solo JPEG, PNG o WebP), 422 imagen corrupta.

## Decisiones por defecto

Estas se tomaron sin confirmación. Revisarlas antes de la demo:

- **Solo se registran ciudadanos.** Operadores y administradores los asigna un administrador.
- **Un ticket por foto.** El tipo del ticket es el daño de mayor gravedad.
- **Duplicado:** mismo tipo de daño, ticket abierto y a menos de 15 m (`radio_duplicado_metros`).
- **Gravedad de baches:** leve si ocupa menos de 2 % de la foto, moderada desde 2 %, grave desde 5 %. Son provisorios: calibrarlos con fotos de Posadas.
- **Prioridad:** 0,40 gravedad + 0,25 jerarquía de calle + 0,15 cantidad de reportes + 0,20 vulnerabilidad del barrio. Los pesos están en la tabla `parametros`, pero hoy el código usa sus valores por defecto.
- **Vulnerabilidad desconocida:** si el barrio no se encuentra en la tabla `barrios`, se usa 0,5. Eso hace que todos los tickets pesen igual en ese factor hasta que se carguen los datos del Censo.
- **Revisión humana:** si la IA no detecta daño o la confianza máxima es menor a 0,5.
- **Rechazar una revisión no cierra el ticket.** Solo quita la marca. No hay estado "descartado" todavía.
- **Transiciones de estado:** se puede saltar estados (pendiente → resuelto). `resuelto` es final. Cada cambio queda en `historial_estados` con el usuario que lo hizo.
- **Roles en el token:** el rol viaja en el JWT (8 horas). Un cambio de rol se aplica en el próximo inicio de sesión de esa persona, no al instante.
- **Calle, jerarquía y barrio:** Nominatim (OpenStreetMap). Respeta el límite de 1 pedido por segundo.
- **Imágenes:** Cloudinary, con la foto ya difuminada por la IA. Se guarda la URL pública; la firmada queda como mejora.
- **Paginación:** 20 tickets por página, fijo.

## Base de datos

Fuente de verdad: las **entidades** de TypeORM (`src/infrastructure/persistencia/entidades/`), con sus `@Check` e `@Index`. Las migraciones (`src/infrastructure/persistencia/migraciones/`) se generan a partir de ellas.

- Cambiar una tabla: editar su entidad, y después `DATABASE_URL=... npm run db:generar -- src/infrastructure/persistencia/migraciones/NombreDelCambio`. Revisar el SQL generado antes de aplicarlo.
- Aplicar migraciones: `DATABASE_URL=... npm run db:migrar`.
- `synchronize` está apagado a propósito. Nunca editar una migración que ya se aplicó.
- Las migraciones son: la extensión PostGIS (a mano), el esquema base (generado), los datos iniciales (a mano), el cambio de `email` a `dni` (generado) y la decisión de revisión con su responsable (generado).

### Primer administrador

No hay endpoint para crearlo. Con la base migrada, generar el hash de la contraseña y cargar el usuario:

```
node -e "console.log(require('bcrypt').hashSync('CLAVE_AQUI', 10))"
```

Después insertar desde un archivo SQL (no pegar el hash directo en la línea de comandos: tiene caracteres `$` que el shell interpreta):

```sql
INSERT INTO usuarios (nombre, dni, password_hash, rol_id)
VALUES ('Administrador', '20000001', 'HASH_GENERADO', (SELECT id FROM roles WHERE codigo = 'administrador'));
```

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a PostgreSQL con PostGIS |
| `JWT_SECRET` | Sí | Firma de los tokens |
| `PORT` | No (3000) | Puerto del servidor |
| `IA_URL` | Sí, salvo `MODO_DESARROLLO=1` | URL del microservicio de IA, por ejemplo `http://localhost:8000` |
| `MODO_DESARROLLO` | No | `1` usa una IA falsa si no hay `IA_URL` |
| `ALMACEN_IMAGENES` | No | `local` guarda las fotos en `./uploads`; por defecto usa Cloudinary |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Sí, si no es `local` | Almacenamiento de imágenes en Cloudinary |
| `UBICACION` | No | `falsa` evita consultar OpenStreetMap; por defecto usa Nominatim |
| `NOMINATIM_USER_AGENT` | Sí, si `UBICACION` no es `falsa` | Identificación ante OpenStreetMap |

## Puesta en marcha local con la IA real

Hacen falta tres terminales: la base, la IA y el backend.

**1. Base de datos** (PostgreSQL 16 con PostGIS, por ejemplo con `docker compose up -d db`)

```
DATABASE_URL=postgres://bachecero:bachecero@localhost:5432/bachecero npm run db:migrar
```

**2. Microservicio de IA** (clonar `bache-cero-ia` al lado de esta carpeta)

```
cd ../bache-cero-ia
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

La primera vez descarga los modelos desde Hugging Face (unos 80 MB). Verificar con `curl localhost:8000/health`, que debe responder `"models_loaded": true`.

**3. Backend**

```
npm install
npm run build
DATABASE_URL=postgres://bachecero:bachecero@localhost:5432/bachecero \
JWT_SECRET=una-clave-larga-de-prueba \
IA_URL=http://localhost:8000 \
ALMACEN_IMAGENES=local \
UBICACION=falsa \
node dist/main.js
```

Con `UBICACION=falsa` no se consulta OpenStreetMap, así que el barrio y la calle quedan sin datos reales. Para usar Nominatim, quitar `UBICACION` y agregar `NOMINATIM_USER_AGENT=bache-cero-local/0.1 (contacto)`.

Después crear el administrador (ver arriba) y probar desde Postman con `postman-bache-cero.json`.

**Modo sin IA:** con `MODO_DESARROLLO=1` y sin `IA_URL`, el backend usa una IA falsa que siempre devuelve un bache con 6 % del área. Sirve para probar el resto del flujo sin correr la IA.

Probado: el backend con el contrato de la IA documentado en su README (usando un servidor de prueba con el mismo formato, porque Hugging Face no es accesible desde el entorno donde lo probé). Falta probar con los modelos reales. Docker no se probó.

## Pendiente

- Novedades y estadísticas.
- Que un cambio de rol surta efecto al instante (hoy requiere volver a iniciar sesión).
- Carga de barrios y polígonos desde el Censo 2022.
- Tests de integración HTTP automatizados (hoy se probó con `curl`).
