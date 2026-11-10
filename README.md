# Bache Cero · Backend

Backend de Bache Cero, el sistema para reportar baches en Posadas y seguir su reparación. Recibe la foto de un bache, la analiza con un microservicio de visión por computadora, agrupa los reportes en tickets, calcula su prioridad y permite al personal municipal gestionarlos. También ofrece estadísticas de gestión y un módulo de novedades para informar a los vecinos.

Stack: NestJS 10, TypeORM 0.3, PostgreSQL 16 con PostGIS 3.4, JWT y bcrypt.

---

## Índice

1. [Inicio rápido](#inicio-rápido)
2. [Cómo funciona](#cómo-funciona)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Puesta en marcha](#puesta-en-marcha)
5. [Variables de entorno](#variables-de-entorno)
6. [Endpoints](#endpoints)
7. [Pruebas](#pruebas)
8. [Base de datos y migraciones](#base-de-datos-y-migraciones)
9. [Cómo agregar una funcionalidad](#cómo-agregar-una-funcionalidad)
10. [Decisiones de diseño](#decisiones-de-diseño)
11. [Problemas conocidos](#problemas-conocidos)
12. [Próximos pasos](#próximos-pasos)

---

## Inicio rápido

Requisitos: Node.js LTS, npm y Docker.

```bash
git clone https://github.com/IsaAlegre/BacheCero_backend.git
cd BacheCero_backend
npm install
cp .env.example .env          # en PowerShell: Copy-Item .env.example .env
docker compose up -d db       # base PostgreSQL + PostGIS en el puerto 5432
npm run db:migrar
npm run build
node dist/main.js             # http://localhost:3000
```

Para probarlo sin el microservicio de IA, en el `.env` poné `MODO_DESARROLLO=1`, `ALMACEN_IMAGENES=local` y `UBICACION=falsa`. Con eso, el flujo completo funciona con una IA de prueba que siempre detecta un bache.

Para crear el primer administrador, mirá [Primer administrador](#primer-administrador).

---

## Cómo funciona

1. El vecino envía una foto con `lat` y `lng` a `POST /reportes`.
2. El microservicio de IA ([bache-cero-ia](https://github.com/sebavlao/bache-cero-ia)) difumina rostros y patentes, y detecta baches y grietas con su tipo, confianza y área.
3. El backend guarda la imagen difuminada (Cloudinary, o carpeta local en desarrollo).
4. Consulta OpenStreetMap (Nominatim) para obtener calle, jerarquía de la calle y barrio.
5. Si hay un ticket abierto del mismo tipo de daño a menos de 15 m, el reporte se suma a ese ticket. Si no, se crea un ticket nuevo.
6. Calcula la gravedad y la prioridad.
7. El personal ve los tickets, cambia su estado y confirma o rechaza las detecciones marcadas para revisión.
8. El vecino sigue sus reportes en `GET /reportes/mios`.

### Roles

| Rol | Puede |
|---|---|
| `ciudadano` | Registrarse, reportar, ver sus reportes, leer las novedades publicadas |
| `operador` | Lo anterior, más: ver todos los tickets, cambiar estados, revisar detecciones, ver estadísticas |
| `administrador` | Lo anterior, más: asignar roles y gestionar novedades |

El registro público solo crea ciudadanos. Los demás roles los asigna un administrador con `PATCH /usuarios/:id/rol`.

---

## Estructura del proyecto

```
src/
  domain/           reglas puras: gravedad, prioridad, transiciones, reglas de novedades
  application/      casos de uso y puertos (interfaces)
  infrastructure/   adaptadores: HTTP (NestJS), persistencia (TypeORM), IA, almacenamiento, geo, seguridad
  composicion.ts    único lugar donde se eligen los adaptadores concretos
  app.module.ts     módulo raíz de NestJS
  main.ts           arranque del servidor
  test/             pruebas de dominio y casos de uso, sin base ni red
```

El dominio y la aplicación no importan NestJS ni TypeORM. Solo `infrastructure/` conoce esas librerías.

---

## Puesta en marcha

### Base de datos

`docker-compose.yml` levanta PostgreSQL 16 con PostGIS en el puerto 5432 (usuario, clave y base: `bachecero`). Si ese puerto está ocupado, cambiá el mapeo a `"5433:5432"` y usá el 5433 en `DATABASE_URL`.

```bash
npm run db:migrar
```

### Primer administrador

No hay endpoint para crearlo. Con la base migrada:

1. Generá el hash de la contraseña (reemplazá `CLAVE_AQUI`):
   ```bash
   node -e "console.log(require('bcrypt').hashSync('CLAVE_AQUI', 10))"
   ```
2. Ejecutá en un cliente SQL (pgAdmin, DBeaver):
   ```sql
   INSERT INTO usuarios (nombre, dni, password_hash, rol_id)
   VALUES ('Administrador', '20000001', 'HASH_GENERADO', (SELECT id FROM roles WHERE codigo = 'administrador'));
   ```

Si ya tenés un ciudadano y querés convertirlo en administrador:

```sql
UPDATE usuarios SET rol_id = (SELECT id FROM roles WHERE codigo = 'administrador') WHERE dni = 'DNI_DEL_USUARIO';
```

Después de cambiar un rol, hay que volver a iniciar sesión.

### Microservicio de IA (opcional)

Clonar `bache-cero-ia` y levantarlo en el puerto 8000:

```bash
python3.12 -m venv .venv
. .venv/bin/activate          # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

La primera vez descarga unos 80 MB de modelos. Verificá con `http://localhost:8000/health`: debe responder `"models_loaded": true`.

### Backend

```bash
npm run build
node dist/main.js
```

Si cambiás código, siempre hay que volver a compilar y reiniciar: el servidor corre desde `dist/`.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a PostgreSQL. Ej.: `postgres://bachecero:bachecero@localhost:5432/bachecero` |
| `JWT_SECRET` | Sí | Clave para firmar los tokens. Generala con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | No (3000) | Puerto del servidor |
| `CORS_ORIGIN` | No | Orígenes permitidos para el front, separados por coma y sin espacios. Por defecto `http://localhost:5173` |
| `IA_URL` | Sí, salvo `MODO_DESARROLLO=1` | URL del microservicio de IA. Ej.: `http://localhost:8000` |
| `MODO_DESARROLLO` | No | `1` usa una IA falsa si no hay `IA_URL`, y un redactor falso para novedades si no hay `ANTHROPIC_API_KEY` |
| `ALMACEN_IMAGENES` | No | `local` guarda las fotos en `./uploads`. Por defecto, Cloudinary |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Si no usás `local` | Datos del panel de Cloudinary |
| `UBICACION` | No | `falsa` evita consultar OpenStreetMap. Por defecto, Nominatim |
| `NOMINATIM_USER_AGENT` | Si `UBICACION` no es `falsa` | Identificación ante OpenStreetMap. Ej.: `bache-cero-local/0.1 (contacto)` |
| `ANTHROPIC_API_KEY` | No | Clave de la API de Anthropic para redactar informes de novedades con IA |
| `NOVEDADES_MODELO` | No (`claude-sonnet-5-5`) | Modelo que redacta los informes |

Nunca subas el `.env` al repositorio: contiene la clave de la base, el secreto del JWT y las claves de APIs.

---

## Endpoints

Las rutas que dicen "logueado" necesitan el header `Authorization: Bearer <accessToken>`.

### Cuentas y reportes

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/registro` | Público | Registra un ciudadano: `nombre`, `dni` (7 u 8 dígitos), `password` (mínimo 8) |
| POST | `/auth/login` | Público | Devuelve `accessToken`, `rol` y `nombre`. El token vence en 8 horas |
| POST | `/reportes` | Logueado | Reporte con foto (`multipart/form-data`: `foto`, `lat`, `lng`, `descripcion` opcional) |
| GET | `/reportes/mios?pagina=1` | Logueado | Reportes del usuario, con el estado actual de cada ticket |
| PATCH | `/usuarios/:id/rol` | Administrador | Asigna `ciudadano`, `operador` o `administrador` |

### Gestión de tickets

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/tickets?pagina=&estado=&orden=&barrio=` | Operador o administrador | Lista de 20 en 20. Por defecto, abiertos ordenados por prioridad |
| GET | `/tickets/:id` | Operador o administrador | Detalle: reportes con foto y detecciones, e historial de estados |
| PATCH | `/tickets/:id/estado` | Operador o administrador | Cambia el estado y lo registra en el historial |
| POST | `/tickets/:id/revision` | Operador o administrador | `confirmada` o `rechazada` para una detección marcada para revisión |
| GET | `/estadisticas?desde=&hasta=&limiteZonas=` | Operador o administrador | Resumen, tiempo de resolución y zonas con más casos |

Parámetros de `GET /tickets`:

| Parámetro | Valores |
|---|---|
| `estado` | `pendiente`, `programado`, `en_reparacion`, `resuelto` |
| `orden` | `prioridad` (por defecto), `recientes`, `actualizados` |
| `barrio` | Nombre del barrio, sin distinguir mayúsculas |

Ejemplo: `GET /tickets?estado=resuelto&orden=recientes`

Parámetros de `GET /estadisticas`: `desde` y `hasta` (fechas `AAAA-MM-DD`, inclusive, en hora de Posadas, filtradas por la fecha de creación del ticket) y `limiteZonas` (de 1 a 50, por defecto 10).

Respuesta de ejemplo:

```json
{
  "generadoEn": "2026-11-09T22:40:00.000Z",
  "filtros": { "desde": null, "hasta": null, "limiteZonas": 10 },
  "resumen": {
    "total": 10,
    "abiertos": 6,
    "resueltos": 4,
    "necesitanRevision": 2,
    "porEstado": [
      { "codigo": "pendiente", "nombre": "Pendiente", "cantidad": 4 },
      { "codigo": "resuelto", "nombre": "Resuelto", "cantidad": 4 }
    ]
  },
  "tiempoResolucion": { "muestra": 4, "promedioHoras": 60, "medianaHoras": 60 },
  "zonas": {
    "items": [
      { "barrio": "Villa Cabello", "total": 4, "abiertos": 2, "resueltos": 2 }
    ],
    "sinBarrio": 1
  }
}
```

Cómo se calcula:

- **Resueltos:** tickets en un estado cerrado (`estados.abierto = false`). Hoy, solo `resuelto`.
- **Tiempo de resolución:** desde que se creó el ticket hasta la primera vez que pasó a un estado cerrado. Solo cuenta tickets que hoy están cerrados. Si no hay ninguno, los promedios son `null`.
- **Zonas:** agrupadas por barrio, ordenadas por total. Los tickets sin barrio se cuentan aparte en `sinBarrio`.

### Novedades

Las novedades nacen siempre como borrador, y se publican solo con aprobación de un administrador:

```
borrador → publicado
```

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/novedades?pagina=1` | Logueado | Novedades publicadas, de la más nueva a la más vieja |
| GET | `/novedades/gestion?pagina=1&estado=` | Administrador | Borradores y publicadas, con autor y aprobador |
| GET | `/novedades/:id` | Logueado | Detalle. Los borradores solo los ve el administrador |
| POST | `/novedades` | Administrador | Crea un borrador: `titulo` (3 a 150) y `contenido` (10 a 10000) |
| POST | `/novedades/generar` | Administrador | Redacta con IA el borrador del informe de un mes: `anio` y `mes` |
| PATCH | `/novedades/:id` | Administrador | Edita un borrador. Las publicadas no se editan: se eliminan y se redactan de nuevo |
| POST | `/novedades/:id/publicar` | Administrador | Publica el borrador y registra quién lo aprobó |
| DELETE | `/novedades/:id` | Administrador | Elimina una novedad, sea borrador o publicada |

El informe con IA toma cifras agregadas del mes (tickets resueltos, reparaciones iniciadas, reportes recibidos y resueltos por barrio). Nunca envía fotos, usuarios ni ubicaciones exactas. No se genera si el mes no tuvo actividad.

### Estados de un ticket

```
pendiente     → programado, en_reparacion, resuelto
programado    → en_reparacion, resuelto
en_reparacion → resuelto
resuelto      → (final)
```

### Errores

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos |
| 401 | Sin token, token vencido o credenciales incorrectas |
| 403 | El rol no tiene permiso para la ruta |
| 404 | El recurso no existe |
| 409 | DNI repetido, transición no permitida, revisión ya resuelta, novedad no editable, o informe sin actividad o sin IA configurada |
| 413 | Foto mayor a 10 MB |
| 415 | Formato no aceptado (JPEG, PNG o WebP) |
| 422 | Imagen corrupta |

Todas las respuestas de error tienen la forma `{ "statusCode": 409, "mensaje": "..." }`.

---

## Pruebas

```bash
npm test          # pruebas de Jest, sin base ni red
npm run typecheck # verificación de tipos
```

Las pruebas usan fakes en memoria y cubren el dominio, el registro de reportes, la gestión de tickets, los filtros, los reportes del ciudadano, las estadísticas y las novedades.

Para probar a mano con curl (en PowerShell usá `curl.exe`):

```bash
# Registrar un ciudadano
curl -X POST http://localhost:3000/auth/registro -H "Content-Type: application/json" \
  -d '{"nombre":"Vecina prueba","dni":"30111333","password":"clave-prueba-1"}'

# Iniciar sesión y copiar accessToken
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"dni":"30111333","password":"clave-prueba-1"}'

# Reportar un bache
curl -X POST http://localhost:3000/reportes -H "Authorization: Bearer TOKEN" \
  -F "foto=@foto.jpg" -F "lat=-27.3671" -F "lng=-55.8960" -F "descripcion=Bache en la esquina"

# Crear, publicar y ver una novedad (token de administrador)
curl -X POST http://localhost:3000/novedades -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"titulo":"Bacheo en Villa Cabello","contenido":"Esta semana se repararon las calles del barrio."}'
curl -X POST http://localhost:3000/novedades/1/publicar -H "Authorization: Bearer TOKEN"
curl http://localhost:3000/novedades -H "Authorization: Bearer TOKEN"
```

Para cargar datos de ejemplo en estadísticas, ejecutá `pruebas/datos-prueba-estadisticas.sql` en un cliente SQL. Crea 10 tickets con calles que empiezan con `DEMO `. Para borrarlos:

```sql
DELETE FROM tickets WHERE calle_nombre LIKE 'DEMO %';
```

---

## Base de datos y migraciones

La fuente de verdad del esquema son las **entidades** de TypeORM (`src/infrastructure/persistencia/entidades/`), con sus `@Check` e `@Index`. Las migraciones se generan a partir de ellas.

Para cambiar una tabla:

1. Editá la entidad.
2. Generá la migración: `npm run db:generar -- src/infrastructure/persistencia/migraciones/NombreDelCambio`
3. Revisá el SQL generado.
4. Aplicala: `npm run db:migrar`

Reglas: `synchronize` está apagado a propósito. Nunca edites una migración que ya se aplicó: para corregir, creá otra. Para confirmar que la base coincide con las entidades: `npx typeorm schema:log -d dist/infrastructure/persistencia/data-source.js`.

| Migración | Tipo | Qué hace |
|---|---|---|
| `ExtensionPostgis` | A mano | Activa PostGIS |
| `EsquemaBase` | Generada | Tablas iniciales |
| `DatosIniciales` | A mano | Roles, estados, tipos de daño, gravedades, jerarquías de calle, parámetros |
| `UsuarioPorDni` | Generada | Login por DNI en lugar de email |
| `TicketsRevisionYRoles` | Generada | Decisión de revisión y datos de quien revisó |
| `TicketBarrioNombre` | Generada | Nombre del barrio en el ticket |
| `NovedadesBorradorYAprobacion` | Generada | Ciclo borrador → publicado. Su `down` borra los borradores |

---

## Cómo agregar una funcionalidad

Ejemplo: un endpoint que lista los tickets de una calle.

1. **Dominio** (`src/domain/`): si hay una regla de negocio nueva, va acá, sin imports de NestJS ni TypeORM.
2. **Aplicación** (`src/application/`): un caso de uso que recibe un puerto por constructor.
3. **Persistencia** (`src/infrastructure/persistencia/`): implementá el puerto con SQL nativo y parámetros (`$1`, `$2`). Si cambia el esquema, primero la entidad y después la migración.
4. **Composición** (`src/composicion.ts`): agregá el caso de uso al tipo `Casos` y construilo en `construirCasos`.
5. **HTTP** (`src/infrastructure/http/`): agregá la ruta. Para limitar por rol, usá `@UseGuards(JwtGuard, RolesGuard)` con `@Roles(...)`.
6. **Pruebas** (`src/test/`): probá el caso de uso con un fake del puerto.

Convenciones:

- Inyección por constructor con `private readonly`.
- Errores de aplicación (`ErrorEntradaInvalida`, `ErrorNoEncontrado`, `ErrorOperacionInvalida`, etc.) se traducen a HTTP en `errores.filter.ts`.
- Los valores que vienen del cliente y forman parte del SQL (orden, nombres de columna) se validan contra listas cerradas.
- Los parámetros de consulta se validan en el caso de uso; los cuerpos JSON, con DTOs (`class-validator`).

---

## Decisiones de diseño

- **Un ticket por bache.** El tipo del ticket es el daño de mayor gravedad de la foto.
- **Duplicados:** mismo tipo de daño, ticket abierto y a menos de 15 m. No se comparan imágenes.
- **Gravedad de baches:** leve bajo el 2 % del área de la foto, moderada desde el 2 %, grave desde el 5 %. Son valores provisorios.
- **Gravedad de grietas:** moderada si es de tipo cocodrilo, leve en el resto.
- **Prioridad:** 0,40 gravedad + 0,25 jerarquía de calle + 0,15 cantidad de reportes (máximo con 5) + 0,20 vulnerabilidad del barrio. Los pesos están en la tabla `parametros`.
- **Vulnerabilidad desconocida:** si el barrio no tiene índice cargado, se usa 0,5.
- **Revisión humana:** se pide si la IA no detecta daño o si la confianza máxima es menor a 0,5.
- **Rechazar una revisión** solo quita la marca; el ticket sigue igual.
- **Barrio:** se toma de OpenStreetMap al crear el ticket, por `neighbourhood` o, si falta, `suburb`. Filtrar por barrio no depende de la tabla `barrios`.
- **Paginación:** 20 elementos por página en todas las listas.
- **Rol en el token:** un cambio de rol se aplica en el próximo inicio de sesión.
- **Novedades:** toda novedad, también la generada con IA, debe aprobarse antes de publicarse.

---

## Problemas conocidos

- **Barrio desde `suburb`:** algunos puntos de Posadas devuelven como `suburb` un Centro de Integración Territorial, que no es un barrio. Por ahora se guarda tal cual.
- **Cambio de rol:** requiere volver a iniciar sesión, porque el rol viaja en el token.
- **Gravedad:** los umbrales de área son provisorios y conviene calibrarlos con fotos reales de Posadas.

---

## Próximos pasos

- Filtro por calle en `GET /tickets`.
- Gestión de usuarios: crear, modificar y dar de baja cuentas.
- Índice de vulnerabilidad por barrio, con datos del Censo 2022.