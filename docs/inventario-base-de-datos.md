<!-- Inventario de los datos que vivían en el navegador (localStorage, sessionStorage y js/datos/) y su destino en la base de datos (SQLite). -->
# Inventario de datos antes de migrar a la base de datos

Fotografía del sitio **antes** de esta fase: todo vivía en el navegador o fijo en archivos JS/HTML.

## Dónde estaba cada dato

| Origen | Clave / archivo | Contenido | Escrito por |
|---|---|---|---|
| localStorage | `meridian_usuarios` | Arreglo de usuarios: `usuario`, `rol`, `correo`, `whatsapp`, `sal`, `hash` (SHA-256), `pregunta` (texto), `salResp`, `hashResp`, `fecha` | `sesion.js` |
| localStorage | `meridian_bloqueo` | `{ fallos, hasta }`: intentos fallidos y bloqueo de 1 min (por navegador) | `sesion.js` |
| localStorage | `meridian_carrito` | `[{ id, cant }]`: un carrito por navegador, se vaciaba al cerrar sesión | `carrito.js` |
| localStorage | `folio` | Número consecutivo del folio (distinto en cada navegador) | `utilidades.js` |
| sessionStorage | `meridian_sesion` | `{ usuario, rol }`: sesión activa | `sesion.js` |
| `js/datos/servicios.js` | `SERVICIOS` | 4 categorías (`id`, `nombre`, `resumen`, `img`) con 16 subservicios (`id`, `nombre`, `descripcion`, `precio`, `img` opcional) | a mano |
| `js/datos/empresa.js` | `IVA`, `EMPRESA` | IVA 0.16; emisor: nombre, RFC y eslogan | a mano |
| `js/modulos/sesion.js` | `PREGUNTAS` | 5 preguntas de recuperación | a mano |
| `index.html` | `.empresas` | 7 empresas ficticias de Monterrey (nombre y sector) | a mano |
| Memoria (`facturador.js`) | `ultimo` | Factura generada: **no se guardaba** en ningún lado | — |

## Entidades y relaciones

- **Rol** 1 — N **Usuario**. Solo puede existir un usuario con rol admin.
- **Pregunta de recuperación** 1 — N **Usuario**.
- **Usuario** 1 — 1 **Carrito** 1 — N **Ítem de carrito** N — 1 **Servicio**.
- **Categoría** 1 — N **Servicio** (subservicio).
- **Usuario** 1 — N **Factura** 1 — N **Concepto de factura** N — 1 **Servicio**. El concepto guarda una copia del nombre y del precio.
- **Intento de login**: registro suelto por IP y usuario, sin llave foránea, porque también registra usuarios inexistentes.
- **Folio**: contador por serie (`A`).
- **Empresa cliente** y **Configuración**: catálogos independientes.

## Qué pasa al servidor y qué se queda en el navegador

| Dato | Destino |
|---|---|
| Usuarios, hashes y respuestas | Tabla `usuarios`. El hash ahora es PBKDF2-SHA256 y lo calcula el servidor. |
| Bloqueo por intentos | Tabla `intentos_login`, validado en el servidor |
| Sesión | Cookie de sesión de Flask (HttpOnly, SameSite=Lax); ya no usa sessionStorage |
| Carrito | Tablas `carritos` y `carrito_items`. Persiste entre recargas y entre sesiones. |
| Folio | Tabla `folios`, con incremento en transacción |
| Facturas | Tablas `facturas` y `factura_conceptos` (antes no se guardaban) |
| Catálogo de servicios | Tablas `categorias_servicio` y `servicios`. Se borra `js/datos/servicios.js`. |
| IVA y emisor | IVA: constante del servidor (`backend/config.py`). Emisor y referencia del IVA: tabla `configuracion`. Se borra `js/datos/empresa.js`. |
| Preguntas de recuperación | Tabla `preguntas_recuperacion` |
| Empresas ficticias | Tabla `empresas_clientes` |
| Factura de ejemplo del hero | **Se queda** en el HTML: es una ilustración, no un dato |
| Pestaña del modal, panel abierto | **Se quedan** en memoria: es estado de la interfaz |
