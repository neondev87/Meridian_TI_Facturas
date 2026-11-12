-- Esquema de la base de Meridian TI en SQLite (solo estructura, sin datos). backend/db.py lo aplica al crear db/meridian.db.
-- Dinero: INTEGER en centavos (nunca REAL). Fechas: texto 'AAAA-MM-DD HH:MM:SS' en hora local.
-- Las llaves foráneas se activan en cada conexión con PRAGMA foreign_keys = ON (backend/db.py).

-- Roles de cuenta (admin, usuario). Los id se fijan en semillas.sql.
CREATE TABLE IF NOT EXISTS roles (
  id         INTEGER PRIMARY KEY,
  nombre     TEXT    NOT NULL UNIQUE,
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Preguntas para recuperar la contraseña
CREATE TABLE IF NOT EXISTS preguntas_recuperacion (
  id         INTEGER PRIMARY KEY,
  texto      TEXT    NOT NULL UNIQUE,
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Cuentas. COLLATE NOCASE hace que "Ana" y "ana" choquen en el UNIQUE.
CREATE TABLE IF NOT EXISTS usuarios (
  id              INTEGER PRIMARY KEY,
  rol_id          INTEGER NOT NULL REFERENCES roles (id),
  usuario         TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(usuario) BETWEEN 3 AND 20),
  correo          TEXT    NULL UNIQUE COLLATE NOCASE CHECK (correo IS NULL OR length(correo) <= 254),
  whatsapp        TEXT    NULL CHECK (whatsapp IS NULL OR length(whatsapp) <= 15),
  clave_hash      TEXT    NOT NULL,
  pregunta_id     INTEGER NOT NULL REFERENCES preguntas_recuperacion (id),
  respuesta_hash  TEXT    NOT NULL,
  creado_en       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS ix_usuarios_rol ON usuarios (rol_id);
-- Índice único parcial: solo puede existir una fila con rol_id = 1 (admin), aunque lleguen dos registros a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_admin_unico ON usuarios (rol_id) WHERE rol_id = 1;

-- Intentos de inicio de sesión y de recuperación (para el bloqueo de 1 minuto tras 5 fallos)
CREATE TABLE IF NOT EXISTS intentos_login (
  id         INTEGER PRIMARY KEY,
  ip         TEXT    NOT NULL,
  usuario    TEXT    NULL,
  tipo       TEXT    NOT NULL DEFAULT 'login' CHECK (tipo IN ('login', 'recuperacion')),
  exito      INTEGER NOT NULL CHECK (exito IN (0, 1)),
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS ix_intentos_ip ON intentos_login (ip, id);

-- Categorías (las 4 tarjetas del inicio)
CREATE TABLE IF NOT EXISTS categorias_servicio (
  id         INTEGER PRIMARY KEY,
  clave      TEXT    NOT NULL UNIQUE,
  nombre     TEXT    NOT NULL,
  resumen    TEXT    NOT NULL,
  imagen     TEXT    NOT NULL,
  orden      INTEGER NOT NULL DEFAULT 0,
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Subservicios con precio en centavos de MXN antes de IVA (200000 = $2,000.00)
CREATE TABLE IF NOT EXISTS servicios (
  id               INTEGER PRIMARY KEY,
  categoria_id     INTEGER NOT NULL REFERENCES categorias_servicio (id),
  clave            TEXT    NOT NULL UNIQUE,
  nombre           TEXT    NOT NULL,
  descripcion      TEXT    NOT NULL,
  precio_centavos  INTEGER NOT NULL CHECK (typeof(precio_centavos) = 'integer' AND precio_centavos >= 0),
  imagen           TEXT    NULL,
  orden            INTEGER NOT NULL DEFAULT 0,
  activo           INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en        TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS ix_servicios_categoria ON servicios (categoria_id, orden);

-- Un carrito por usuario
CREATE TABLE IF NOT EXISTS carritos (
  id          INTEGER PRIMARY KEY,
  usuario_id  INTEGER NOT NULL UNIQUE REFERENCES usuarios (id) ON DELETE CASCADE,
  creado_en   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS carrito_items (
  id           INTEGER PRIMARY KEY,
  carrito_id   INTEGER NOT NULL REFERENCES carritos (id) ON DELETE CASCADE,
  servicio_id  INTEGER NOT NULL REFERENCES servicios (id),
  cantidad     INTEGER NOT NULL DEFAULT 1 CHECK (cantidad BETWEEN 1 AND 99),
  creado_en    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (carrito_id, servicio_id)
);
CREATE INDEX IF NOT EXISTS ix_carrito_items_servicio ON carrito_items (servicio_id);

-- Contador de folios por serie (A-0001, A-0002...)
CREATE TABLE IF NOT EXISTS folios (
  id           INTEGER PRIMARY KEY,
  serie        TEXT    NOT NULL UNIQUE,
  consecutivo  INTEGER NOT NULL DEFAULT 0 CHECK (consecutivo >= 0),
  creado_en    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Facturas y solicitudes de cotización. Guardan copia de los datos del cliente y del emisor.
-- iva_tasa se guarda como texto decimal exacto ('0.16'); los importes, en centavos.
CREATE TABLE IF NOT EXISTS facturas (
  id                  INTEGER PRIMARY KEY,
  folio               TEXT    NOT NULL UNIQUE,
  tipo                TEXT    NOT NULL CHECK (tipo IN ('factura', 'solicitud')),
  usuario_id          INTEGER NOT NULL REFERENCES usuarios (id),
  cliente_nombre      TEXT    NOT NULL,
  cliente_correo      TEXT    NOT NULL,
  cliente_whatsapp    TEXT    NOT NULL,
  rfc                 TEXT    NULL,
  mensaje             TEXT    NULL,
  emisor_nombre       TEXT    NOT NULL,
  emisor_rfc          TEXT    NOT NULL,
  subtotal_centavos   INTEGER NOT NULL CHECK (typeof(subtotal_centavos) = 'integer'),
  iva_tasa            TEXT    NOT NULL,
  iva_centavos        INTEGER NOT NULL CHECK (typeof(iva_centavos) = 'integer'),
  total_centavos      INTEGER NOT NULL CHECK (typeof(total_centavos) = 'integer'),
  creado_en           TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS ix_facturas_usuario ON facturas (usuario_id, creado_en);

-- Conceptos: nombre y precio se copian al facturar para que cambios del catálogo no alteren facturas viejas
CREATE TABLE IF NOT EXISTS factura_conceptos (
  id                        INTEGER PRIMARY KEY,
  factura_id                INTEGER NOT NULL REFERENCES facturas (id) ON DELETE CASCADE,
  servicio_id               INTEGER NULL REFERENCES servicios (id) ON DELETE SET NULL,
  nombre                    TEXT    NOT NULL,
  precio_unitario_centavos  INTEGER NOT NULL CHECK (typeof(precio_unitario_centavos) = 'integer'),
  cantidad                  INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 99),
  importe_centavos          INTEGER NOT NULL CHECK (typeof(importe_centavos) = 'integer'),
  creado_en                 TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS ix_conceptos_factura ON factura_conceptos (factura_id);
CREATE INDEX IF NOT EXISTS ix_conceptos_servicio ON factura_conceptos (servicio_id);

-- Empresas de la vista Misión y visión (ficticias, proyecto escolar)
CREATE TABLE IF NOT EXISTS empresas_clientes (
  id         INTEGER PRIMARY KEY,
  nombre     TEXT    NOT NULL UNIQUE,
  sector     TEXT    NOT NULL,
  orden      INTEGER NOT NULL DEFAULT 0,
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Ajustes generales (emisor, referencia del IVA)
CREATE TABLE IF NOT EXISTS configuracion (
  id         INTEGER PRIMARY KEY,
  clave      TEXT    NOT NULL UNIQUE,
  valor      TEXT    NOT NULL,
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
