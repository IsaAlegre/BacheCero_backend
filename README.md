# Bache Cero: backend

Backend de Bache Cero. Recibe reportes de baches con foto, los analiza con el microservicio de IA, los agrupa en tickets, calcula su prioridad y permite al personal municipal gestionarlos.

Este README sirve para tres cosas: levantar el proyecto, probarlo y seguir desarrollándolo.

---

## Índice

1. [Estructura del proyecto](#estructura-del-proyecto)
2. [Cómo funciona](#cómo-funciona)
3. [Puesta en marcha](#puesta-en-marcha)
4. [Variables de entorno](#variables-de-entorno)
5. [Endpoints](#endpoints)
6. [Pruebas](#pruebas)
7. [Base de datos y migraciones](#base-de-datos-y-migraciones)
8. [Cómo agregar una funcionalidad](#cómo-agregar-una-funcionalidad)
9. [Decisiones por defecto](#decisiones-por-defecto)
10. [Problemas conocidos](#problemas-conocidos)
11. [Pendiente](#pendiente)

---

## Estructura del proyecto

```
src/
  domain/                  reglas puras: gravedad, daño principal, revisión, prioridad, transiciones
  application/             casos de uso y puertos (interfaces que implementan los adaptadores)
    registrar-reporte.ts   alta de un reporte: IA, imagen, ubicación, ticket
    usuarios.ts            registro, login, asignación de roles
    listar-tickets.ts      lista de tickets con filtros y orden
    gestion-tickets.ts     detalle, cambio de estado y revisión de tickets
    mis-reportes.ts        reportes del ciudadano logueado
    errores.ts             errores de aplicación (se traducen a HTTP en el filtro de errores)
  infrastructure/          adaptadores: todo lo que conoce NestJS, TypeORM, HTTP, etc.
    http/                  controladores, guards, DTOs y filtro de errores (NestJS)
    persistencia/          entidades, migraciones y repositorios (TypeORM + PostgreSQL/PostGIS)
    ia/                    cliente del microservicio de IA (HTTP) y una IA falsa para desarrollo
    almacen/               Cloudinary (producción) y almacenamiento local (desarrollo)
    geo/                   Nominatim (OpenStreetMap) y una ubicación falsa para desarrollo
    seguridad/             bcrypt y JWT
  composicion.ts           único lugar donde se eligen los adaptadores concretos
  app.module.ts            módulo raíz de NestJS
  main.ts                  arranque del servidor
  test/                    tests del dominio y de los casos de uso (sin base ni red)
```

El dominio y la aplicación no importan NestJS ni TypeORM. Solo los adaptadores de `infrastructure/` conocen esas librerías. Si agregás código de dominio o de aplicación que importe algo de NestJS o TypeORM, está mal ubicado.

---

## Cómo funciona

Flujo principal de un reporte:

1. El vecino o un operador sube una foto con `lat` y `lng` a `POST /reportes`.
2. La IA (microservicio aparte) difumina rostros y patentes, detecta daños y devuelve el tipo, la confianza y el área de cada detección.
3. El backend guarda solo la imagen difuminada (Cloudinary o carpeta local).
4. El backend consulta OpenStreetMap (Nominatim) para obtener calle, jerarquía de la calle y barrio.
5. Si la foto tiene un daño y ya existe un ticket abierto del mismo tipo a menos de 15 m, el reporte se agrega a ese ticket. Si no, se crea un ticket nuevo.
6. Se calcula la gravedad (a partir del área de la detección) y la prioridad.
7. El personal ve los tickets, cambia su estado y confirma o rechaza las detecciones marcadas para revisión.
8. El vecino ve el estado actual de sus reportes en `GET /reportes/mios`.

Roles:

| Rol | Puede |
|---|---|
| `ciudadano` | Registrarse, reportar, ver sus propios reportes |
| `operador` | Lo del ciudadano, más: ver todos los tickets y su detalle, cambiar estados, revisar detecciones |
| `administrador` | Lo del operador, más: asignar roles |

Los roles nuevos no se pueden crear desde el registro público. Los asigna un administrador con `PATCH /usuarios/:id/rol`.

---

## Puesta en marcha

Hacen falta Node.js (versión LTS), npm, Docker (para la base) y, si querés la IA real, Python 3.12.

### 1. Clonar y dependencias

```
git clone https://github.com/IsaAlegre/BacheCero_backend.git
cd BacheCero_backend
npm install
```

### 2. Variables de entorno

```
cp .env.example .env
```

En Windows (PowerShell): `Copy-Item .env.example .env`.

Completar `.env`. La aplicación lo carga sola al arrancar. Las variables están en la tabla de [Variables de entorno](#variables-de-entorno).

### 3. Base de datos

Con Docker:

```
docker compose up -d db
```

Esto levanta PostgreSQL 16 con PostGIS en el puerto **5432** (usuario `bachecero`, clave `bachecero`, base `bachecero`). Si ya tenés PostgreSQL instalado y ocupa ese puerto, cambiá el mapeo en `docker-compose.yml` a `"5433:5432"` y usá el puerto 5433 en `DATABASE_URL`.

Después aplicar las migraciones:

```
npm run db:migrar
```

### 4. Primer administrador

No hay endpoint para crearlo. Con la base migrada:

**a)** Generar el hash de la contraseña (reemplazar `CLAVE_AQUI`):

```
node -e "console.log(require('bcrypt').hashSync('CLAVE_AQUI', 10))"
```

**b)** Crear un archivo `admin.sql` con este contenido, reemplazando `HASH_GENERADO`:

```sql
INSERT INTO usuarios (nombre, dni, password_hash, rol_id)
VALUES ('Administrador', '20000001', 'HASH_GENERADO', (SELECT id FROM roles WHERE codigo = 'administrador'));
```

**c)** Ejecutarlo. Conviene desde pgAdmin o un cliente SQL. Si lo hacés desde la línea de comandos, no pegues el hash directo: tiene caracteres `$` que el shell interpreta.

Si ya tenés un usuario ciudadano creado y querés que sea administrador, alcanza con:

```sql
UPDATE usuarios SET rol_id = (SELECT id FROM roles WHERE codigo = 'administrador') WHERE dni = 'DNI_DEL_USUARIO';
```

Después hay que volver a iniciar sesión, porque el rol viaja en el token.

### 5. Microservicio de IA (opcional)

Sin IA se puede seguir con `MODO_DESARROLLO=1` (ver [Modo sin IA](#modo-sin-ia)).

Con la IA real, clonar `bache-cero-ia` al lado de esta carpeta:

```
cd ../bache-cero-ia
python3.12 -m venv .venv
```

En Windows (PowerShell): `.venv\Scripts\Activate.ps1`. En Linux o macOS: `. .venv/bin/activate`.

```
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

La primera vez descarga los modelos desde Hugging Face (unos 80 MB). Si `pip` falla por timeout con torch, reintentar con `pip install --timeout 300 --retries 5 -r requirements.txt`.

Verificar con `curl localhost:8000/health`: tiene que responder `"models_loaded": true`.

### 6. Backend

```
npm run build
node dist/main.js
```

Tiene que aparecer `Bache Cero escuchando en el puerto 3000`. Si al arrancar aparece `Mapped {/reportes/mios, GET}` y las demás rutas en el log, la versión compilada es la correcta.

Si cambiás código, siempre hace falta `npm run build` y reiniciar el servidor. El servidor no se recompila solo.

### Modo sin IA

Con `MODO_DESARROLLO=1` y sin `IA_URL`, el backend usa una IA falsa que siempre devuelve un bache con 6 % del área. Sirve para probar el flujo completo sin correr el microservicio.

---

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a PostgreSQL con PostGIS. Ej.: `postgres://bachecero:bachecero@localhost:5432/bachecero` |
| `JWT_SECRET` | Sí | Firma de los tokens. Usar una clave larga |
| `PORT` | No (3000) | Puerto del servidor |
| `IA_URL` | Sí, salvo `MODO_DESARROLLO=1` | URL del microservicio de IA, por ejemplo `http://localhost:8000` |
| `MODO_DESARROLLO` | No | `1` usa una IA falsa si no hay `IA_URL` |
| `ALMACEN_IMAGENES` | No | `local` guarda las fotos en `./uploads` (no se ven desde el navegador). Por defecto usa Cloudinary |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Sí, si no es `local` | Almacenamiento de imágenes. Son los datos del panel de Cloudinary, no inventados |
| `UBICACION` | No | `falsa` evita consultar OpenStreetMap: calle y barrio quedan vacíos. Por defecto usa Nominatim |
| `NOMINATIM_USER_AGENT` | Sí, si `UBICACION` no es `falsa` | Identificación ante OpenStreetMap. Ej.: `bache-cero-local/0.1 (contacto)` |

Para desarrollo sin IA, sin Cloudinary y sin OpenStreetMap, alcanza con:

```
DATABASE_URL=postgres://bachecero:bachecero@localhost:5432/bachecero
JWT_SECRET=una-clave-larga-de-prueba
MODO_DESARROLLO=1
ALMACEN_IMAGENES=local
UBICACION=falsa
```

---

## Endpoints

Todas las rutas que dicen "logueado" necesitan el header `Authorization: Bearer <accessToken>`.

| Método | Ruta | Acceso | Qué hace |
|---|---|---|---|
| POST | `/auth/registro` | Público | Registra un ciudadano con `nombre`, `dni` (7 u 8 dígitos) y `password` (mínimo 8) |
| POST | `/auth/login` | Público | Devuelve `accessToken` (JWT, 8 horas) |
| POST | `/reportes` | Logueado | Sube una foto (`multipart/form-data`: `foto`, `lat`, `lng`, `descripcion` opcional). Devuelve ticket, prioridad, imagen y detecciones |
| GET | `/reportes/mios?pagina=1` | Logueado | Reportes del usuario que pide, del más nuevo al más viejo, con el estado actual de su ticket |
| GET | `/tickets?pagina=1&estado=&orden=&barrio=` | Operador o administrador | Lista de tickets de 20 en 20. Por defecto: abiertos, de mayor a menor prioridad |
| GET | `/tickets/:id` | Operador o administrador | Detalle: reportes con foto, descripción y detecciones; historial de estados |
| PATCH | `/tickets/:id/estado` | Operador o administrador | Cambia el estado y lo registra en el historial |
| POST | `/tickets/:id/revision` | Operador o administrador | Confirma (`confirmada`) o rechaza (`rechazada`) una detección marcada para revisión |
| PATCH | `/usuarios/:id/rol` | Solo administrador | Asigna `ciudadano`, `operador` o `administrador` |

### Parámetros de `GET /tickets`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `pagina` | Número entero desde 1 | 1 |
| `estado` | `pendiente`, `programado`, `en_reparacion`, `resuelto` | Solo tickets abiertos (todos menos `resuelto`) |
| `orden` | `prioridad`, `recientes`, `actualizados` | `prioridad` |
| `barrio` | Nombre del barrio, sin distinguir mayúsculas. Coincidencia exacta | Sin filtro |

Ejemplo: `GET /tickets?estado=resuelto&orden=recientes`

La respuesta incluye `filtros` con los valores aplicados.

### Estados y transiciones

```
pendiente  → programado, en_reparacion, resuelto
programado → en_reparacion, resuelto
en_reparacion → resuelto
resuelto   → (ninguna: es final)
```

Los estados se definen en `src/domain/reglas.ts` (`TRANSICIONES`). Si cambian, cambian ahí y en las migraciones de datos iniciales.

### Errores

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos (DNI, estado, orden, coordenadas) |
| 401 | Sin token, token vencido o credenciales incorrectas |
| 403 | El rol no tiene permiso para la ruta |
| 404 | El recurso no existe |
| 409 | DNI repetido, transición de estado no permitida, revisión ya resuelta, o intento de quitarse el rol de administrador |
| 413 | Foto mayor a 10 MB |
| 415 | Formato no aceptado (solo JPEG, PNG o WebP) |
| 422 | Imagen corrupta |

---

## Pruebas

### Pruebas automáticas

```
npm test
```

Corre las pruebas de Jest en `src/test/`. No necesitan base de datos ni red: usan fakes en memoria. Cubren las reglas de dominio, el registro de reportes, la gestión de tickets, los filtros de la lista y los reportes del ciudadano.

```
npm run typecheck
```

Verifica los tipos sin generar archivos.

### Pruebas manuales

Con el servidor levantado, desde Postman (importar `postman-bache-cero.json`) o con curl:

```
# 1. Registrar un ciudadano
curl -X POST http://localhost:3000/auth/registro -H "Content-Type: application/json" \
  -d '{"nombre":"Vecina prueba","dni":"30111333","password":"clave-prueba-1"}'

# 2. Iniciar sesión (copiar accessToken)
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"dni":"30111333","password":"clave-prueba-1"}'

# 3. Subir un reporte con foto
curl -X POST http://localhost:3000/reportes -H "Authorization: Bearer TOKEN" \
  -F "foto=@ruta/a/foto.jpg" -F "lat=-27.3671" -F "lng=-55.8960" -F "descripcion=Bache en la esquina"

# 4. Ver mis reportes
curl http://localhost:3000/reportes/mios -H "Authorization: Bearer TOKEN"
```

Para probar las rutas de personal, usar el token de un operador o administrador.

En PowerShell, `curl` es un alias de otra herramienta: usar `curl.exe` o Postman.

---

## Base de datos y migraciones

Fuente de verdad: las **entidades** de TypeORM (`src/infrastructure/persistencia/entidades/`), con sus `@Check` e `@Index`. Las migraciones se generan a partir de ellas.

Tablas principales: `usuarios`, `roles`, `tickets`, `reportes`, `detecciones`, `estados`, `historial_estados`, `tipos_dano`, `gravedades`, `jerarquias_calle`, `barrios`, `parametros`.

### Cambiar una tabla

1. Editar la entidad correspondiente.
2. Generar la migración:
   ```
   npm run db:generar -- src/infrastructure/persistencia/migraciones/NombreDelCambio
   ```
3. Revisar el SQL generado en el archivo.
4. Aplicarla:
   ```
   npm run db:migrar
   ```

Reglas:

- `synchronize` está apagado a propósito. No activarlo.
- Nunca editar una migración que ya se aplicó en alguna base. Para corregir, crear una migración nueva.
- Después de migrar, `npx typeorm schema:log -d dist/infrastructure/persistencia/data-source.js` tiene que responder que el esquema está al día.

Migraciones existentes:

| Migración | Tipo | Qué hace |
|---|---|---|
| `ExtensionPostgis` | A mano | Activa PostGIS |
| `EsquemaBase` | Generada | Tablas iniciales |
| `DatosIniciales` | A mano | Roles, estados, tipos de daño, gravedades, jerarquías de calle, parámetros |
| `UsuarioPorDni` | Generada | Cambia `email` por `dni` |
| `TicketsRevisionYRoles` | Generada | Decisión de revisión: `revision_decision`, `revisado_por_id`, `revisado_en` |
| `TicketBarrioNombre` | Generada | Nombre del barrio en el ticket: `barrio_nombre` |

---

## Cómo agregar una funcionalidad

Ejemplo: un endpoint nuevo que lista tickets de una calle.

1. **Dominio** (`src/domain/`): si hay una regla de negocio nueva, va acá, sin imports de NestJS ni TypeORM.
2. **Aplicación** (`src/application/`): crear un caso de uso con su puerto. El caso de uso recibe el puerto por constructor y no conoce la base:
   ```ts
   export interface PuertoConsultaTickets { listarPorCalle(calle: string): Promise<Ticket[]>; }
   export class ListarTicketsPorCalle {
     constructor(private readonly tickets: PuertoConsultaTickets) {}
     ejecutar(calle: string) { return this.tickets.listarPorCalle(calle); }
   }
   ```
3. **Infraestructura de persistencia** (`src/infrastructure/persistencia/`): implementar el puerto con una consulta SQL nativa. Si cambia el esquema, primero la entidad y después la migración.
4. **Composición** (`src/composicion.ts`): agregar el caso de uso al tipo `Casos` y construirlo en `construirCasos`.
5. **HTTP** (`src/infrastructure/http/`): agregar la ruta en el controlador. Si necesita rol, usar `@Roles(...)` con `@UseGuards(JwtGuard, RolesGuard)`.
6. **Tests** (`src/test/`): probar el caso de uso con un fake del puerto. No hace falta base para eso.
7. Compilar, correr `npm test`, y probar la ruta con curl o Postman.

Convenciones del proyecto:

- Inyección por constructor con `private readonly`.
- Tipos de datos con `interface` o `record`, no clases mutables cuando no hace falta.
- Errores de aplicación: `ErrorEntradaInvalida` (400), `ErrorNoEncontrado` (404), `ErrorOperacionInvalida` (409), `ErrorCredenciales` (401), `ErrorDniYaRegistrado` (409), `ErrorImagenInvalida` (422). Se mapean a HTTP en `infrastructure/http/errores.filter.ts`.
- Las consultas SQL nativas usan parámetros (`$1`, `$2`). Las cláusulas de orden o nombres de columna que vienen del cliente se validan contra listas cerradas antes de armar el SQL.

---

## Decisiones por defecto

Estas se tomaron sin confirmación. Revisarlas antes de la demo:

- **Solo se registran ciudadanos.** Operadores y administradores los asigna un administrador.
- **Un ticket por bache.** El tipo del ticket es el daño de mayor gravedad de la foto.
- **Duplicado:** mismo tipo de daño, ticket abierto y a menos de 15 m (`radio_duplicado_metros`). No se comparan imágenes.
- **Reportes sin daño detectado:** siempre crean un ticket nuevo marcado para revisión. No se agrupan.
- **Gravedad de baches:** leve si ocupa menos de 2 % de la foto, moderada desde 2 %, grave desde 5 %. Provisorios: calibrarlos con fotos de Posadas.
- **Gravedad de grietas:** moderada si es de tipo cocodrilo (`alligator_crack`), leve en el resto.
- **Prioridad:** 0,40 gravedad + 0,25 jerarquía de calle + 0,15 cantidad de reportes (máximo con 5) + 0,20 vulnerabilidad del barrio. Los pesos están en la tabla `parametros`, pero hoy el código usa sus valores por defecto.
- **Vulnerabilidad desconocida:** si el barrio no está en la tabla `barrios`, se usa 0,5. Hoy esa tabla está vacía, así que todos los tickets pesan igual en ese factor.
- **Revisión humana:** si la IA no detecta daño o la confianza máxima es menor a 0,5.
- **Rechazar una revisión no cierra el ticket.** Solo quita la marca. No hay estado "descartado" todavía.
- **Transiciones de estado:** se puede saltar estados (pendiente → resuelto). `resuelto` es final. Cada cambio queda en `historial_estados` con el usuario que lo hizo.
- **Roles en el token:** el rol viaja en el JWT (8 horas). Un cambio de rol se aplica en el próximo inicio de sesión de esa persona.
- **Lista de tickets:** solo para operador y administrador. El ciudadano ve sus reportes con `/reportes/mios`.
- **Barrio:** el nombre viene de OpenStreetMap al crear el ticket (`neighbourhood` y, si no hay, `suburb`). Filtrar por barrio no requiere cargar la tabla `barrios`. Los tickets creados antes de la migración `TicketBarrioNombre` no tienen barrio.
- **Calle, jerarquía y barrio:** Nominatim (OpenStreetMap). Respeta el límite de 1 pedido por segundo.
- **Imágenes:** Cloudinary, con la foto ya difuminada por la IA. Se guarda la URL pública; la firmada queda como mejora.
- **Paginación:** 20 elementos por página, fijo.

---

## Problemas conocidos

- **Barrio desde `suburb`:** en algunos puntos de Posadas, OpenStreetMap devuelve como `suburb` un Centro de Integración Territorial (una unidad administrativa, no un barrio). Por ahora se guarda tal cual. Opciones: limpiar el nombre, usar solo `neighbourhood`, o asignar barrios con polígonos más adelante.
- **Tipos de daño:** el modelo solo tiene bache (`pothole`) y grieta (`crack`). La ficha del proyecto también menciona hundimientos, que no están modelados.
- **Cambio de rol:** requiere volver a iniciar sesión para que surta efecto.
- **Tickets antiguos sin barrio:** los que se crearon antes de `TicketBarrioNombre` quedan con barrio vacío.
- **Gravedad:** los umbrales de área son provisorios.
- **Docker:** la base se probó con `docker compose up -d db` en Windows. El backend en contenedor no está probado.
- **IA real:** probada en Windows con el microservicio real. Antes de la demo conviene repetir la prueba con fotos de Posadas.

---

## Pendiente

- **Estadísticas:** cantidad de baches pendientes y resueltos, tiempo promedio de resolución, zonas con más casos. Se pueden calcular con consultas sobre `tickets` e `historial_estados`.
- **Novedades:** publicaciones del municipio sobre reparaciones. Necesita una tabla nueva y una migración.
- **Informes generados con IA:** borradores para aprobación del responsable. Es una funcionalidad complementaria.
- **Filtro por calle** en `GET /tickets`.
- **Historial general de reportes y cambios de estado** para el personal.
- **Gestión de usuarios:** crear, modificar y dar de baja cuentas (hoy solo se asigna el rol).
- **Reportes del personal municipal:** identificarlos como tales en la respuesta.
- **Índice de vulnerabilidad por barrio:** polígonos y datos del Censo 2022 (INDEC). Hoy la tabla `barrios` está vacía.
- **Similitud de imágenes** para agrupar duplicados (hoy solo se usa distancia y tipo).
- **Tests de integración HTTP automatizados** (hoy se prueba con curl o Postman).
- **Swagger** o documentación de la API.
- **Frontend:** PWA con mapa (Leaflet). Está en otro repositorio.
- **Despliegue:** la ficha menciona Vercel y Neon. No está hecho.