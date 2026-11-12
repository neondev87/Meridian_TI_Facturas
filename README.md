<!-- Documentación del proyecto: qué es, requisitos, cómo arrancarlo con iniciar-pagina.bat, estructura, base de datos y API. -->
# Meridian TI: sitio web con backend y SQLite

> ⚠️ **Proyecto escolar.** Es una demostración: las empresas de "Misión y visión" son ficticias y el documento que genera el sitio **no es una factura fiscal timbrada**. Corre solo en tu equipo (`localhost`).

Sitio de servicios de TI con catálogo, carrito, facturación, registro e inicio de sesión. El **frontend** es HTML, CSS y JavaScript puro (módulos ES). El **backend** es Python con Flask y guarda todo en **SQLite**, un archivo local (`db/meridian.db`) que se crea solo: no hay que instalar ningún servidor de base de datos ni escribir contraseñas. La factura se imprime o se guarda como PDF desde el navegador.

## Tecnologías

- **Frontend:** HTML5, CSS3 y JavaScript (módulos ES, sin frameworks ni compilación).
- **Backend:** Python 3 con Flask 3 y Werkzeug (sesiones firmadas y hash de contraseñas).
- **Base de datos:** SQLite (módulo `sqlite3` incluido en Python).
- **Arranque:** `iniciar-pagina.bat` (Windows).

## Requisitos

- **Windows** con **Python 3.9 o más reciente** (probado con 3.15). Al instalar Python, marca *"Add python.exe to PATH"*.
- Internet solo la primera vez, para instalar las dependencias de Python (Flask).
- Nada más: **no** se necesita instalar un servidor de base de datos, ni usuario, ni contraseñas, ni archivo `.env`.

## Arrancar la página

1. Doble clic en **`iniciar-pagina.bat`**.
2. La primera vez (no pide nada):
   - Crea `venv\` e instala `requirements.txt`.
   - Crea `db\meridian.db` aplicando `db\esquema.sql` y `db\semillas.sql`.
   - Genera una `SECRET_KEY` aleatoria para la sesión y la guarda en `.secret_key` (ignorado por git).
3. Las siguientes veces reutiliza todo y arranca en segundos.
4. Se abre el navegador en `http://localhost:8000`. Si el 8000 está ocupado, usa el siguiente puerto libre y lo avisa.
5. Para detenerla, cierra la ventana negra o usa **`detener-pagina.bat`**.

Si falta Python, el `.bat` explica cómo instalarlo.

### Empezar desde cero

Detén la página, borra `db\meridian.db` (y, si existen, `db\meridian.db-wal` y `db\meridian.db-shm`) y vuelve a ejecutar `iniciar-pagina.bat`: la base se crea de nuevo con el catálogo inicial, sin usuarios ni facturas.

## Estructura

```
index.html                  Página única: vistas, modal de sesión y guardia de arranque
iniciar-pagina.bat          Arranque con doble clic (Python, venv, dependencias, servidor y navegador)
detener-pagina.bat          Detiene el servidor (usa .servidor.pid)
requirements.txt            Dependencias de Python con versiones fijas
LICENSE                     Licencia MIT
.env.example                Plantilla de .env OPCIONAL (puerto o SECRET_KEY propios)
backend/
  app.py                    Flask: API bajo /api y frontend (solo css/, js/, assets/ e index.html)
  config.py                 Rutas de la base, SECRET_KEY (.secret_key), constantes: IVA 16 %, bloqueo, folio, hash
  db.py                     Crea db/meridian.db la primera vez; conexiones SQLite con FK activas y transacciones
  utilidades.py             Errores de API, validaciones, sesión requerida, centavos <-> Decimal y totales
  rutas/
    autenticacion.py        /registro, /login, /logout, /sesion, /preguntas, /recuperar
    servicios.py            /categorias (con subservicios y precios) y /empresas
    carrito.py              /carrito (leer, agregar, cambiar cantidad, quitar, vaciar)
    facturas.py             /facturas (crear desde el carrito, listar, ver por folio)
    admin.py                /admin/usuarios (solo admin, sin hashes)
db/
  esquema.sql               Solo estructura, dialecto SQLite (CREATE … IF NOT EXISTS)
  semillas.sql              Solo catálogo inicial, idempotente (INSERT OR IGNORE)
  meridian.db               La base con datos reales: se crea sola y NUNCA se sube al repo
css/                        Estilos (base/, componentes/, secciones/; main.css los importa)
js/
  main.js                   Punto de entrada: inicia los módulos en orden
  modulos/
    api.js                  fetch a /api con la cookie de sesión y errores en español
    sesion.js               Modal de registro, login y recuperación contra la API
    catalogo.js             Tarjetas, vista de cada servicio y empresas (desde la API)
    carrito.js              Carrito guardado en la base; los totales vienen del servidor
    facturador.js           Formulario unificado, factura del servidor, historial e impresión
    admin.js                Tabla de usuarios para el admin
    vistas.js               Vistas por hash (#inicio, #servicio/<id>, #mision, #cotizador, #admin)
    menu.js, utilidades.js  Menú móvil; moneda, fechas, escape de HTML y avisos
assets/                     Ilustraciones SVG e ícono
docs/
  base-de-datos.md          Diagrama ER, tablas y cómo recrear la base
  inventario-base-de-datos.md  Qué vivía en el navegador y a qué tabla pasó
  pendientes.md             Cosas por revisar o limpiar
  presentacion/             Presentación del PIA (.pptx y .pdf) y capturas del sitio
```

## Cómo funciona

- **Mismo origen.** Flask sirve la página y la API en `http://localhost:PUERTO`, así que no hace falta CORS. Solo publica `index.html`, `css/`, `js/` y `assets/`: nunca `.env`, `.secret_key`, `db/` ni `backend/`. Envía `Cache-Control: no-cache`, de modo que el navegador no se queda con JS viejo.
- **Sesión.** Se guarda en una cookie firmada de Flask (`HttpOnly`, `SameSite=Lax`). Las peticiones que cambian datos deben ser JSON, lo que bloquea formularios de otros sitios.
- **Contraseñas y respuestas de recuperación.** Se hashean en el servidor con **PBKDF2-SHA256 con sal** (`werkzeug.security`). Nunca se guardan en texto plano ni aparecen en los logs. El admin ve su hash **una sola vez** al registrarse.
- **Solo un administrador.** Lo valida el servidor y además lo garantiza un índice único parcial en la base.
- **Bloqueo.** 5 intentos fallidos seguidos (de login o de recuperación) bloquean 1 minuto. Se registra en la tabla `intentos_login`.
- **Precios e IVA.** El navegador nunca manda precios ni IVA. La base guarda el dinero como **enteros en centavos** (nunca decimales flotantes); el servidor calcula subtotal, IVA (16 %, constante en `backend/config.py`) y total con `Decimal` y redondeo a medio centavo hacia arriba.
- **Folios.** `A-0001`, `A-0002`… se generan dentro de la transacción de la factura, abierta con `BEGIN IMMEDIATE` (candado de escritura de SQLite), sin duplicados.
- **Facturas.** Guardan una copia de los datos del cliente y del nombre y precio de cada concepto, para que cambios del catálogo no alteren facturas viejas. Al facturar, el carrito se vacía. El carrito persiste entre recargas y entre sesiones.
- **Si la API o la base no responden,** aparece un aviso en español en la parte inferior; la página nunca queda en blanco.
- **Consultas.** Todas van parametrizadas (`?`); nunca se concatena SQL con datos del usuario. Las llaves foráneas se activan en cada conexión (`PRAGMA foreign_keys = ON`).

## Base de datos (SQLite)

Toda la información vive en un solo archivo, `db/meridian.db`. La primera vez que arranca el servidor, `backend/db.py` aplica `db/esquema.sql` (estructura) y `db/semillas.sql` (catálogo inicial) en un archivo temporal y, si todo sale bien, lo renombra; si la base ya existe no la toca. En el repositorio solo están los dos `.sql`: **la base real nunca se sube**.

Esquema (13 tablas):

| Tabla | Contenido |
|---|---|
| `roles` | `admin` (id 1) y `usuario` (id 2) |
| `preguntas_recuperacion` | Las 5 preguntas secretas |
| `usuarios` | Cuentas con `clave_hash` y `respuesta_hash` (PBKDF2-SHA256 con sal); un solo admin |
| `intentos_login` | Bitácora para el bloqueo por intentos fallidos |
| `categorias_servicio` | Las 4 categorías: soporte, redes, ciberseguridad y sitios web |
| `servicios` | Subservicios con `precio_centavos` antes de IVA |
| `carritos` / `carrito_items` | Un carrito por usuario y sus servicios |
| `facturas` / `factura_conceptos` | Facturas (o solicitudes) y sus renglones, con copia de nombres y precios |
| `folios` | Consecutivo por serie (`A`) |
| `empresas_clientes` | Empresas ficticias de "Misión y visión" |
| `configuracion` | Datos del emisor e IVA de referencia |

Diagrama entidad-relación y detalle de cada tabla: [`docs/base-de-datos.md`](docs/base-de-datos.md).

## API (JSON, prefijo `/api`)

| Método | Ruta | Requiere |
|---|---|---|
| GET | `/sesion`, `/preguntas`, `/categorias`, `/empresas` | — |
| POST | `/registro`, `/login`, `/logout`, `/recuperar/pregunta`, `/recuperar` | — |
| GET · POST · PATCH · DELETE | `/carrito`, `/carrito/items`, `/carrito/items/<clave>` | sesión |
| GET · POST | `/facturas`, `/facturas/<folio>` | sesión |
| GET | `/admin/usuarios` | admin |

Los errores siempre llegan como `{"error": "mensaje en español"}`, sin detalles internos.

## Cambiar datos

- **Servicios, precios, empresas, emisor:** `db/semillas.sql` (precios en centavos). Las semillas solo se aplican al crear la base: para verlas, borra `db/meridian.db` (se pierden usuarios y facturas) o edita la base con una herramienta como *DB Browser for SQLite*.
- **IVA, intentos, tiempo de bloqueo:** `backend/config.py`.
- **Colores:** `css/base/variables.css`.

## Licencia

[MIT](LICENSE) © 2026 Flores Gutierrez Erick Alejandro. Proyecto escolar sin fines comerciales.
