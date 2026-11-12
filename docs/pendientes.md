<!-- Lista de pendientes: contenido ficticio, decisiones tomadas, limitaciones conocidas y cosas por limpiar (solo anotadas). -->
# Pendientes

> ⚠️ **Proyecto escolar.** Corre solo en `localhost`. El documento generado no es una factura fiscal timbrada.

## Lo único que debes llenar

- Nada. La base (`db/meridian.db`) y la `SECRET_KEY` (`.secret_key`) se crean solas la primera vez que se ejecuta `iniciar-pagina.bat`. No hay contraseñas de base de datos.

## Contenido ficticio o de ejemplo

- [ ] **Empresas de "Misión y visión"** (tabla `empresas_clientes`, sembradas desde `db/semillas.sql`): Termium, Cervecería Regia del Norte, Aceros Cumbres, Cementos Sierra Madre, Banco Regiomontano, Logística Fundidora y Grupo Valle Oriente son **inventadas**. La página lo aclara con una nota.
- [ ] **RFC del emisor** `RFC-EMISOR-000` (tabla `configuracion`, clave `emisor_rfc`).
- [ ] **Correo de contacto genérico** `contacto@meridianti.example` en `index.html`. Es un dominio reservado para ejemplos: no existe.
- [ ] **Misión, visión y eslogan:** son una propuesta.
- [ ] **Precios** (`db/semillas.sql`): referencias de mercado para la demostración, antes de IVA.
- [ ] **Factura de ejemplo del hero** (folio `A-0001` y montos): es una ilustración fija en el HTML, no sale de la base.
- [ ] **Ilustraciones** `assets/img/*.svg`: son de prueba.

## Decisiones tomadas en esta fase (por choques o huecos del pedido)

- **IVA en dos lugares.** El pedido pide el IVA como constante del servidor y también en `configuracion`. El cálculo usa **solo** `IVA_TASA` de `backend/config.py`; la fila `configuracion.iva_tasa` queda como referencia. Si cambias uno, cambia el otro (o elimina la fila).
- **El carrito se vacía al generar la factura**, porque sus servicios ya quedaron en ella. Antes no se vaciaba. Al cerrar sesión **no** se vacía: persiste en la base.
- **Solicitud de cotización.** Con el carrito vacío y un mensaje, se guarda en `facturas` con `tipo = 'solicitud'` y también consume folio.
- **El bloqueo es por IP.** En `localhost` todas las pestañas comparten IP, igual que antes compartían navegador. Los intentos de recuperación también cuentan.
- **La búsqueda de puerto libre y la apertura del navegador** las hace `backend/app.py --abrir` (lo llama el `.bat`), porque en Python es más confiable que con `netstat` en cmd.
- **`detener-pagina.bat`** cierra el proceso cuyo PID está en `.servidor.pid`, solo si sigue siendo `python.exe`.
- **Historial "Tus facturas"** en la vista de facturación (usa `GET /api/facturas`). No estaba pedido como pantalla, pero sirve para ver que las facturas quedan guardadas.
- **Admin único:** además de la validación del servidor, el índice único parcial `uq_usuarios_admin_unico` (`WHERE rol_id = 1`) lo garantiza en la base. Depende de que el rol admin tenga `id = 1` (fijo en las semillas).
- **Base de datos SQLite**: el proyecto debe abrir con doble clic en cualquier equipo, sin servidor ni contraseñas. El dinero se guarda en centavos (`INTEGER`). Las semillas se aplican solo al crear `db/meridian.db`; para ver cambios del catálogo hay que borrar la base (se pierden usuarios y facturas de prueba).

## Archivos borrados en esta fase

- `js/modulos/correo.js` y `js/datos/config.js`: el envío externo de la factura, que se eliminó (ahora se imprime o se guarda como PDF).
- `js/datos/servicios.js` y `js/datos/empresa.js` (y la carpeta `js/datos/`): el catálogo, el IVA y el emisor ahora salen de la base y del servidor.
- `servidor.py`: lo reemplaza Flask (`backend/app.py`), que también envía `Cache-Control: no-cache`.

## Limitaciones conocidas (demostración)

- [ ] El servidor de desarrollo de Flask no es para producción. Para publicarlo haría falta un servidor WSGI (por ejemplo `waitress`), HTTPS y `SESSION_COOKIE_SECURE=True`.
- [ ] La recuperación por pregunta secreta es débil: las respuestas suelen ser fáciles de adivinar.
- [ ] `POST /api/recuperar/pregunta` responde "No encontramos ese usuario" y así permite saber qué usuarios existen. Se dejó igual que antes por simplicidad.
- [ ] `intentos_login` crece sin límite. Convendría borrar registros viejos de vez en cuando.
- [ ] El folio también avanza con las solicitudes de cotización. No es un folio fiscal.
- [ ] La sesión dura mientras el navegador esté abierto (cookie de sesión); no hay "recordarme".
- [ ] El admin no puede editar ni borrar usuarios; solo verlos.
- [ ] La página **ya no funciona sin el servidor** (abriendo `index.html` directo). La guardia de arranque lo explica en pantalla.

## Datos y código

- [ ] **Texto legal:** el documento se titula "Factura", pero la nota aclara que no tiene validez fiscal sin timbrar. Valorar llamarlo "Comprobante de venta".
- [ ] Las expresiones regulares de usuario, correo, WhatsApp y RFC están duplicadas en el frontend (`sesion.js`, `facturador.js`) y en el backend (`utilidades.py`). Si cambias una regla, cámbiala en ambos lados.
- [ ] `css/main.css` usa `@import` (más peticiones). Para producción conviene unir los archivos.
- [ ] `.wrap`, `.sec`, `.alt` y `.split` siguen en `css/base/reset.css`. Valorar crear `css/base/layout.css`.
- [ ] Algunos colores siguen fuera de `variables.css`: el fondo translúcido del encabezado, el brillo del hero y el ámbar del medidor de fuerza.
- [ ] `assets/fuentes/` está vacía (con `.gitkeep`): las fuentes vienen de Google Fonts.

## Accesibilidad

- [ ] **Menú móvil:**
  - No se cierra con Escape.
  - `aria-label="Abrir menú"` no cambia a "Cerrar menú".
- [ ] El cajón del carrito en móvil no atrapa el foco.
- [ ] La factura del hero no tiene encabezados de tabla (`<th>`).
- [ ] Faltan metadatos Open Graph.

## Presentación (docs/presentacion/)

- [ ] **Matrícula 21996566** (Axel Manuel Ramos Jabalera) tiene 8 dígitos; las demás tienen 7. Se dejó tal cual en la portada: confirmar si sobra un dígito.
- [ ] **Nombre del maestro:** se dejó como en la original, "SALDAÑA PEREZ" (sin acento en Pérez). Igual que "Flores Gutierrez" en la tabla de alumnos. Corregir si así se escribe.
- [ ] **No se encontró `original-presentacion.pdf`.** Se usó como original `Tecnicas de representación de información.pdf` (misma presentación de 10 diapositivas).
- [ ] **Capturas tomadas con una copia del sitio y base temporal** (puerto 8100), con cuentas de prueba `demo` y `demo-admin` ya borradas. La base real no se tocó, porque solo admite un administrador y ya tiene uno.
- [ ] **En la vista de admin (1440 px de ancho)** la barra superior se aprieta: el nombre de usuario se corta ("demo-a…") y "Misión y visión" y "Cómo trabajamos" se parten en dos líneas.

## Repositorio

- [x] El archivo ajeno al sitio `Tecnicas de representación de información.pdf` (raíz, ~23 MB) está excluido por `.gitignore` (`/*.pdf`): no se sube.
- [x] Repositorio publicado en GitHub (rama `main`). El `.gitignore` excluye `db/meridian.db` (y `-wal`/`-shm`), `.secret_key`, `.env`, `venv/`, `__pycache__/`, `*.pyc`, `*.log`, `*.bak`, `*.dump`, `.vscode/`, `.servidor.pid` y los PDF de la raíz. Antes de cada commit, revisa con `git status` que ninguno aparezca.
