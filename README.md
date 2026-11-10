# Bache Cero: backend

Backend de Bache Cero. Recibe reportes de baches con foto, los analiza con el microservicio de IA, los agrupa en tickets, calcula su prioridad y permite al personal municipal gestionarlos. También ofrece estadísticas de gestión y un módulo de novedades para comunicar las reparaciones a los vecinos.

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
  domain/                        reglas puras: gravedad, daño principal, revisión, prioridad, transiciones, reglas de las novedades
  application/                   casos de uso y puertos (interfaces que implementan los adaptadores)
    registrar-reporte.ts         alta de un reporte: IA, imagen, ubicación, ticket
    usuarios.ts                  registro, login, asignación de roles
    listar-tickets.ts            lista de tickets con filtros y orden
    gestion-tickets.ts           detalle, cambio de estado y revisión de tickets
    mis-reportes.ts              reportes del ciudadano logueado
    estadisticas.ts              estadísticas del panel: resumen de tickets, tiempo de resolución y zonas con más casos
    novedades.ts                 novedades: crear, editar, publicar y eliminar
    listar-novedades.ts          novedades: lista pública, lista de gestión y detalle
    generar-borrador-novedad.ts  borrador de informe mensual redactado con IA
    errores.ts                   errores de aplicación (se traducen a HTTP en el filtro de errores)
  infrastructure/                adaptadores: todo lo que conoce NestJS, TypeORM, HTTP, etc.
    http/                        controladores, guards, DTOs y filtro de errores (NestJS)
    persistencia/                entidades, migraciones y repositorios (TypeORM + PostgreSQL/PostGIS)
    ia/                          cliente del microservicio de IA (HTTP), redactor de novedades (API de Anthropic) y versiones falsas para desarrollo
    almacen/                     Cloudinary (producción) y almacenamiento local (desarrollo)
    geo/                         Nominatim (OpenStreetMap) y una ubicación falsa para desarrollo
    seguridad/                   bcrypt y JWT
  composicion.ts                 único lugar donde se eligen los adaptadores concretos
  composicion-novedades.ts       arma el módulo de novedades (lo llama composicion.ts)
  app.module.ts                  módulo raíz de NestJS
  main.ts                        arranque del servidor
  test/                          tests del dominio y de los casos de uso (sin base ni red)
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
| `ciudadano` | Registrarse, reportar, ver sus propios reportes, leer las novedades publicadas |
| `operador` | Lo del ciudadano, más: ver todos los tickets y su detalle, cambiar estados, revisar detecciones, ver las estadísticas |
| `administrador` | Lo del operador, más: asignar roles y gestionar las novedades (crear, editar, publicar, eliminar y generar borradores con IA) |

Los roles nuevos no se pueden crear desde el registro público. Los asigna un administrador con `PATCH /usuarios/:id/rol`.

### Estadísticas

El panel del personal consulta `GET /estadisticas` y recibe, en una sola respuesta, tres métricas calculadas sobre los tickets:

- **Resumen:** total de tickets, abiertos, resueltos, los que esperan revisión humana y la cantidad por estado (los estados sin tickets aparecen con 0).
- **Tiempo de resolución:** promedio y mediana, en horas, entre que se reportó el bache y la primera vez que su ticket pasó a un estado cerrado.
- **Zonas con más casos:** barrios ordenados por cantidad de tickets, con cuántos están abiertos y cuántos resueltos. Los tickets sin barrio no entran en la lista: se informan aparte en `sinBarrio`.

Todas se pueden acotar con `desde` y `hasta`, que filtran por la fecha de creación del ticket.

| Capa | Archivo | Qué hace |
|---|---|---|
| HTTP | `infrastructure/http/estadisticas.controller.ts` | Ruta `GET /estadisticas`, solo para operador y administrador. Pasa los parámetros sin tocar |
| Aplicación | `application/estadisticas.ts` | Valida los filtros, arma el período y ejecuta las tres consultas en paralelo. Define el puerto `PuertoConsultaEstadisticas` |
| Persistencia | `infrastructure/persistencia/consultas-estadisticas.postgres.ts` | Consultas SQL nativas sobre `tickets`, `estados`, `historial_estados` y `barrios` |

### Novedades

Publicaciones del municipio sobre las reparaciones. Una novedad nunca llega a los vecinos sin la aprobación del responsable del área, así que todas nacen como borrador:

```
borrador → publicado
```

1. El administrador crea un borrador a mano (`POST /novedades`) o le pide a la IA que redacte el informe de un mes (`POST /novedades/generar`).
2. Mientras es borrador se puede editar (`PATCH /novedades/:id`).
3. El administrador la publica con `POST /novedades/:id/publicar`. Publicar es la aprobación: queda registrado quién la hizo y cuándo.
4. Los vecinos y el personal ven las publicadas en `GET /novedades`, de la más nueva a la más vieja.

Una novedad publicada no se edita: se elimina y se redacta de nuevo. Los borradores solo los ve el administrador; para cualquier otro usuario, un borrador responde 404 como si no existiera.

**Informe con IA (complementario).** `POST /novedades/generar` toma los datos del mes (tickets resueltos, reparaciones iniciadas, reportes recibidos y resueltos por barrio) y se los pasa a un modelo de lenguaje, que redacta un título y un texto. A la IA solo llegan cifras agregadas: nunca fotos, usuarios ni ubicaciones exactas. El resultado queda siempre como borrador. Si no hay `ANTHROPIC_API_KEY` ni `MODO_DESARROLLO=1`, la generación queda desactivada y el resto de Novedades funciona igual.

| Capa | Archivo | Qué hace |
|---|---|---|
| Dominio | `domain/novedades.ts` | Estados, límites de texto, qué se puede editar o publicar, validación del período y límites del mes (hora de Argentina) |
| Aplicación | `application/novedades.ts` | Crear, editar, publicar y eliminar. Define el puerto `PuertoGestionNovedades` |
| Aplicación | `application/listar-novedades.ts` | Lista pública, lista de gestión y detalle. Define el puerto `PuertoConsultaNovedades` |
| Aplicación | `application/generar-borrador-novedad.ts` | Genera el borrador con IA. Define los puertos `PuertoResumenMensual` y `PuertoRedactorNovedades` |
| HTTP | `infrastructure/http/novedades.controller.ts`, `novedades.dto.ts` | Rutas de `/novedades` y validación del cuerpo de los pedidos |
| Persistencia | `gestion-novedades.postgres.ts`, `consultas-novedades.postgres.ts`, `resumen-mensual.postgres.ts` | Escritura, listados y conteos del mes, en `infrastructure/persistencia/` |
| IA | `redactor-novedades-claude.adapter.ts`, `redactor-novedades-falso.adapter.ts` | Redactor con la API de Anthropic y uno falso para desarrollo, en `infrastructure/ia/` |
| Composición | `composicion-novedades.ts` | Elige el redactor y arma los casos de uso. `composicion.ts` lo llama una sola vez |

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

Lo mismo pasa con los informes de novedades: con `MODO_DESARROLLO=1` y sin `ANTHROPIC_API_KEY`, `POST /novedades/generar` usa un redactor falso que arma un texto fijo con los datos del mes.

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
| `ANTHROPIC_API_KEY` | No | Clave de la API de Anthropic para redactar los borradores de novedades con IA. Sin clave y sin `MODO_DESARROLLO=1`, la generación queda desactivada y responde 409 |
| `NOVEDADES_MODELO` | No (`claude-sonnet-5-5`) | Modelo que redacta los borradores de novedades |

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
| GET | `/estadisticas?desde=&hasta=&limiteZonas=` | Operador o administrador | Resumen de tickets, tiempo de resolución y zonas con más casos |
| GET | `/novedades?pagina=1` | Logueado | Novedades publicadas, de la más nueva a la más vieja |
| GET | `/novedades/gestion?pagina=1&estado=` | Solo administrador | Panel de gestión: borradores y publicadas, de las más nuevas a las más viejas |
| POST | `/novedades/generar` | Solo administrador | Genera con IA un borrador del informe de un mes (`anio`, `mes`). Devuelve 201 |
| GET | `/novedades/:id` | Logueado | Detalle. El administrador ve cualquier novedad con todos los datos; los demás, solo las publicadas y sin autor |
| POST | `/novedades` | Solo administrador | Crea un borrador (`titulo` de 3 a 150 caracteres, `contenido` de 10 a 10000). Devuelve 201 |
| PATCH | `/novedades/:id` | Solo administrador | Edita el `titulo`, el `contenido` o ambos. Solo funciona con borradores |
| POST | `/novedades/:id/publicar` | Solo administrador | Publica un borrador y registra quién lo aprobó |
| DELETE | `/novedades/:id` | Solo administrador | Elimina una novedad, sea borrador o publicada |
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

### Parámetros y respuesta de `GET /estadisticas`

| Parámetro | Valores | Por defecto |
|---|---|---|
| `desde` | Fecha `AAAA-MM-DD`, inclusive | Sin límite |
| `hasta` | Fecha `AAAA-MM-DD`, inclusive. No puede ser anterior a `desde` | Sin límite |
| `limiteZonas` | Entero de 1 a 50: cuántos barrios devuelve `zonas.items` | 10 |

Las fechas son días calendario de Posadas (UTC-3) y filtran por la fecha de creación del ticket, o sea, cuándo se reportó el bache. Ejemplo: `GET /estadisticas?desde=2026-11-01&hasta=2026-11-30&limiteZonas=5`

Respuesta (ejemplo con los datos de `pruebas/datos-prueba-estadisticas.sql`, en una base sin otros tickets y sin filtros):

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
      { "codigo": "programado", "nombre": "Programado", "cantidad": 1 },
      { "codigo": "en_reparacion", "nombre": "En reparación", "cantidad": 1 },
      { "codigo": "resuelto", "nombre": "Resuelto", "cantidad": 4 }
    ]
  },
  "tiempoResolucion": { "muestra": 4, "promedioHoras": 60, "medianaHoras": 60 },
  "zonas": {
    "items": [
      { "barrio": "Villa Cabello", "total": 4, "abiertos": 2, "resueltos": 2 },
      { "barrio": "Itaembé Miní", "total": 3, "abiertos": 2, "resueltos": 1 },
      { "barrio": "Centro", "total": 2, "abiertos": 1, "resueltos": 1 }
    ],
    "sinBarrio": 1
  }
}
```

Cómo se calcula cada cosa:

- `resueltos` son los tickets en un estado cerrado (`estados.abierto = false`, hoy solo `resuelto`). `abiertos` son todos los demás.
- `tiempoResolucion` solo cuenta tickets que hoy están cerrados. Mide hasta la primera vez que pasaron a un estado cerrado según `historial_estados`. Si no hay ninguno (`muestra` en 0), `promedioHoras` y `medianaHoras` son `null`. Se redondea a 1 decimal.
- `zonas.items` se ordena por `total`, después por `abiertos` y después por nombre.

### Parámetros y respuestas de `/novedades`

| Parámetro | Ruta | Valores | Por defecto |
|---|---|---|---|
| `pagina` | `GET /novedades` y `GET /novedades/gestion` | Número entero desde 1 | 1 |
| `estado` | `GET /novedades/gestion` | `borrador`, `publicado` | Ambos |

Las listas devuelven de 20 en 20, con `pagina`, `tamanio`, `total`, `totalPaginas` e `items`. La de gestión suma `filtros` con el estado aplicado.

Cuerpos de los pedidos:

| Ruta | Cuerpo (JSON) |
|---|---|
| `POST /novedades` | `titulo` (3 a 150 caracteres), `contenido` (10 a 10000) |
| `PATCH /novedades/:id` | `titulo` y/o `contenido`, con los mismos límites. Hace falta mandar al menos uno |
| `POST /novedades/generar` | `anio` (2024 en adelante) y `mes` (1 a 12). No puede ser un mes futuro |

Qué devuelve cada ruta:

| Ruta | Respuesta |
|---|---|
| `GET /novedades` | Cada item: `id`, `titulo`, `contenido`, `publicadoEn` |
| `GET /novedades/gestion` | Cada item: `id`, `titulo`, `contenido`, `estado`, `origen` (`manual` o `ia`), `autor`, `aprobadoPor`, `creadoEn`, `actualizadoEn`, `publicadoEn` |
| `GET /novedades/:id` | Los campos de la lista pública o, para el administrador, los de la lista de gestión |
| `POST /novedades` | `{ id, estado: "borrador" }` |
| `PATCH /novedades/:id` | `{ id }` |
| `POST /novedades/generar` | `{ id, estado: "borrador", titulo, contenido }` |
| `POST /novedades/:id/publicar` | `{ id, estado: "publicado" }` |
| `DELETE /novedades/:id` | `{ id }` |

Ejemplo: `POST /novedades/generar` con `{ "anio": 2026, "mes": 10 }`

El informe cuenta lo ocurrido en el mes calendario completo, en hora de Argentina. No se genera si en ese mes no hubo actividad (ni tickets resueltos, ni reparaciones iniciadas, ni reportes recibidos).

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
| 400 | Datos inválidos (DNI, estado, orden, coordenadas, fechas de las estadísticas, texto de una novedad, mes del informe) |
| 401 | Sin token, token vencido o credenciales incorrectas |
| 403 | El rol no tiene permiso para la ruta |
| 404 | El recurso no existe |
| 409 | DNI repetido, transición de estado no permitida, revisión ya resuelta, intento de quitarse el rol de administrador, editar o publicar una novedad que ya está publicada, o generar un informe sin actividad en el mes o sin IA configurada |
| 413 | Foto mayor a 10 MB |
| 415 | Formato no aceptado (solo JPEG, PNG o WebP) |
| 422 | Imagen corrupta |

---

## Pruebas

### Pruebas automáticas

```
npm test
```

Corre las pruebas de Jest en `src/test/`. No necesitan base de datos ni red: usan fakes en memoria. Cubren las reglas de dominio, el registro de reportes, la gestión de tickets, los filtros de la lista, los reportes del ciudadano, las estadísticas y las novedades (incluida la generación de borradores, con un redactor falso).

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

# 5. Ver las estadísticas (token de operador o administrador)
curl "http://localhost:3000/estadisticas?desde=2026-11-01&hasta=2026-11-30" -H "Authorization: Bearer TOKEN"

# 6. Crear una novedad como borrador (token de administrador)
curl -X POST http://localhost:3000/novedades -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"titulo":"Bacheo en Villa Cabello","contenido":"Esta semana se repararon las calles del barrio."}'

# 7. Publicarla (usar el id que devolvió el paso anterior)
curl -X POST http://localhost:3000/novedades/1/publicar -H "Authorization: Bearer TOKEN"

# 8. Ver las novedades publicadas (cualquier usuario logueado)
curl http://localhost:3000/novedades -H "Authorization: Bearer TOKEN"

# 9. Generar un borrador de informe con IA (token de administrador)
curl -X POST http://localhost:3000/novedades/generar -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"anio":2026,"mes":11}'
```

Para probar las rutas de personal, usar el token de un operador o administrador.

Para probar las estadísticas con datos, `pruebas/datos-prueba-estadisticas.sql` carga 10 tickets de ejemplo (calles que empiezan con `DEMO `) con su historial de estados. Hace falta que exista al menos un administrador, porque queda como autor de los cambios. Conviene ejecutarlo desde pgAdmin o un cliente SQL. Se puede correr varias veces, y para limpiar:

```sql
DELETE FROM tickets WHERE calle_nombre LIKE 'DEMO %';
```

En PowerShell, `curl` es un alias de otra herramienta: usar `curl.exe` o Postman.

---

## Base de datos y migraciones

Fuente de verdad: las **entidades** de TypeORM (`src/infrastructure/persistencia/entidades/`), con sus `@Check` e `@Index`. Las migraciones se generan a partir de ellas.

Tablas principales: `usuarios`, `roles`, `tickets`, `reportes`, `detecciones`, `estados`, `historial_estados`, `tipos_dano`, `gravedades`, `jerarquias_calle`, `barrios`, `parametros`, `novedades`.

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
| `NovedadesBorradorYAprobacion` | Generada | Ciclo borrador → publicado en `novedades`: `estado`, `origen`, `aprobado_por_id`, `creado_en`, `actualizado_en`. Las novedades que ya existían quedan publicadas, aprobadas por su autor |

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
4. **Composición** (`src/composicion.ts`): agregar el caso de uso al tipo `Casos` y construirlo en `construirCasos`. Si el módulo tiene varios casos de uso, como Novedades, conviene un archivo propio (`composicion-novedades.ts`) que `composicion.ts` llame una sola vez.
5. **HTTP** (`src/infrastructure/http/`): agregar la ruta en el controlador. Si necesita rol, usar `@Roles(...)` con `@UseGuards(JwtGuard, RolesGuard)`.
6. **Tests** (`src/test/`): probar el caso de uso con un fake del puerto. No hace falta base para eso.
7. Compilar, correr `npm test`, y probar la ruta con curl o Postman.

Convenciones del proyecto:

- Inyección por constructor con `private readonly`.
- Tipos de datos con `interface` o `record`, no clases mutables cuando no hace falta.
- Errores de aplicación: `ErrorEntradaInvalida` (400), `ErrorNoEncontrado` (404), `ErrorOperacionInvalida` (409), `ErrorCredenciales` (401), `ErrorDniYaRegistrado` (409), `ErrorImagenInvalida` (422). Se mapean a HTTP en `infrastructure/http/errores.filter.ts`.
- Las consultas SQL nativas usan parámetros (`$1`, `$2`). Las cláusulas de orden o nombres de columna que vienen del cliente se validan contra listas cerradas antes de armar el SQL.
- Una métrica nueva en las estadísticas son tres cambios: un método en `PuertoConsultaEstadisticas`, su consulta en `ConsultasEstadisticasPostgres` y una línea en `ObtenerEstadisticas`.
- Los datos que llegan por query string (como los filtros de estadísticas) se validan en el caso de uso, no en el controlador. Los cuerpos JSON se validan con DTOs (`class-validator`).

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
- **Paginación:** 20 elementos por página, fijo. También en las listas de novedades.
- **Estadísticas, período:** las fechas `desde` y `hasta` se interpretan en hora de Posadas (UTC-3) y filtran por la fecha de creación del ticket, no por la de cierre. No hay caché: cada pedido consulta la base.
- **Estadísticas, resueltos:** un ticket cuenta como resuelto si está en un estado cerrado (`estados.abierto = false`). Si se agrega otro estado cerrado, entra solo en esa cuenta.
- **Estadísticas, tiempo de resolución:** se mide desde que se creó el ticket hasta la primera vez que pasó a un estado cerrado, y solo con tickets que hoy siguen cerrados.
- **Estadísticas, zonas:** se agrupan por el nombre de barrio del ticket (`barrio_nombre`) y, si falta, por el de la tabla `barrios`. Los tickets sin barrio se cuentan aparte en `sinBarrio`. Se devuelven 10 zonas, hasta 50 con `limiteZonas`.
- **Novedades, aprobación:** toda novedad nace como borrador, también las generadas con IA. Publicar es la aprobación y la hace solo un administrador. No hay un atajo para publicar directo.
- **Novedades, edición:** solo se editan borradores. Una publicada se elimina y se redacta de nuevo, para que editarla no saltee la aprobación. El administrador puede eliminar borradores y publicadas.
- **Novedades, visibilidad:** cualquier usuario logueado lee las publicadas, sin autor ni aprobador. Un borrador responde 404 a quien no es administrador.
- **Novedades, informe con IA:** cubre un mes calendario completo (hora de Argentina), desde 2024 hasta el mes actual. Solo recibe cifras agregadas y, como máximo, los 10 barrios con más tickets resueltos. Si el mes no tuvo actividad, no se genera. Los textos de la IA pasan por las mismas validaciones de largo que los escritos a mano.
- **Novedades, modelo de IA:** por defecto `claude-sonnet-5-5`, cambiable con `NOVEDADES_MODELO`. La llamada a la API tiene un límite de 30 segundos.

---

## Problemas conocidos

- **Barrio desde `suburb`:** en algunos puntos de Posadas, OpenStreetMap devuelve como `suburb` un Centro de Integración Territorial (una unidad administrativa, no un barrio). Por ahora se guarda tal cual. Opciones: limpiar el nombre, usar solo `neighbourhood`, o asignar barrios con polígonos más adelante.
- **Tipos de daño:** el modelo solo tiene bache (`pothole`) y grieta (`crack`). La ficha del proyecto también menciona hundimientos, que no están modelados.
- **Cambio de rol:** requiere volver a iniciar sesión para que surta efecto.
- **Tickets antiguos sin barrio:** los que se crearon antes de `TicketBarrioNombre` quedan con barrio vacío. Las estadísticas los cuentan aparte, en `zonas.sinBarrio`.
- **Informe con IA y errores de la API:** si la API de IA falla, no responde a tiempo o devuelve algo que no es JSON, `POST /novedades/generar` responde 500 en lugar de un mensaje claro. No se guarda nada.
- **Postman:** `postman-bache-cero.json` todavía no tiene los pedidos de estadísticas ni de novedades. Se prueban con curl (ver [Pruebas](#pruebas)).
- **Gravedad:** los umbrales de área son provisorios.
- **Docker:** la base se probó con `docker compose up -d db` en Windows. El backend en contenedor no está probado.
- **IA real:** probada en Windows con el microservicio real. Antes de la demo conviene repetir la prueba con fotos de Posadas.

---

## Pendiente

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