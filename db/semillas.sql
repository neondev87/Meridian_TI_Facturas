-- Catálogo inicial de Meridian TI en SQLite (sin usuarios ni facturas). Idempotente: INSERT OR IGNORE no duplica ni pisa datos.
-- Precios en centavos de MXN antes de IVA (200000 = $2,000.00).

-- Roles: los id son fijos (el índice uq_usuarios_admin_unico depende de que admin sea el 1)
INSERT OR IGNORE INTO roles (id, nombre) VALUES
  (1, 'admin'),
  (2, 'usuario');

INSERT OR IGNORE INTO preguntas_recuperacion (id, texto) VALUES
  (1, '¿Cuál es tu fruta favorita?'),
  (2, '¿Cuál es el nombre de tu primera mascota?'),
  (3, '¿En qué ciudad naciste?'),
  (4, '¿Cuál es tu comida favorita?'),
  (5, '¿Cuál es el nombre de tu escuela primaria?');

INSERT OR IGNORE INTO categorias_servicio (clave, nombre, resumen, imagen, orden) VALUES
  ('soporte',        'Soporte y mantenimiento', 'Diagnóstico, reparación y mantenimiento de equipos, en sitio o de forma remota.', 'assets/img/soporte.svg', 1),
  ('redes',          'Redes',                   'Conexión estable para tu oficina: diagnóstico, Wi‑Fi y cableado estructurado.', 'assets/img/redes.svg', 2),
  ('ciberseguridad', 'Ciberseguridad',          'Protege tu información con revisión de riesgos, firewall y respaldos en la nube.', 'assets/img/ciberseguridad.svg', 3),
  ('web',            'Sitios web y sistemas',   'Presencia profesional en internet, desde una landing hasta sistemas a la medida.', 'assets/img/web.svg', 4);

-- Subservicios. La categoría se busca por su clave.
WITH s (cat, clave, nombre, descripcion, precio_centavos, imagen, orden) AS (VALUES
  ('soporte', 'grafica-diagnostico', 'Diagnóstico y limpieza de tarjeta gráfica', 'Revisión de temperaturas y fallas, limpieza de disipador y ventiladores.', 200000, NULL, 1),
  ('soporte', 'grafica-reparacion', 'Reparación de tarjeta gráfica', 'Reballing, cambio de ventiladores y pasta térmica nueva.', 350000, NULL, 2),
  ('soporte', 'ram-mano-obra', 'Cambio e instalación de RAM (mano de obra)', 'Instalación y prueba de estabilidad. La memoria RAM se cotiza aparte.', 50000, NULL, 3),
  ('soporte', 'ram-ddr4-16', 'RAM DDR4 16 GB instalada', 'Módulo DDR4 de 16 GB con instalación y prueba incluidas.', 190000, NULL, 4),
  ('soporte', 'ram-ddr5-16', 'RAM DDR5 16 GB (2x8) instalada', 'Kit de dos módulos DDR5 de 8 GB con instalación y prueba incluidas.', 480000, NULL, 5),
  ('soporte', 'mantenimiento-preventivo', 'Mantenimiento preventivo completo', 'Limpieza interna, pasta térmica nueva y optimización del sistema.', 90000, NULL, 6),
  ('soporte', 'revision-remota', 'Revisión remota de fallos en tu equipo', 'Conexión remota segura para diagnosticar y corregir fallas de software.', 60000, NULL, 7),
  ('redes', 'red-diagnostico', 'Diagnóstico de conexión y problemas de red', 'Revisión de velocidad, cortes, cobertura y configuración de módem o router.', 120000, NULL, 1),
  ('redes', 'red-wifi-oficina', 'Instalación y configuración de red Wi‑Fi para oficina', 'Diseño de cobertura, equipos de acceso y red segura para tu equipo de trabajo.', 450000, NULL, 2),
  ('redes', 'red-cableado-punto', 'Cableado estructurado por punto de red', 'Cable categoría 6, conectores y etiquetado por cada punto instalado.', 65000, NULL, 3),
  ('ciberseguridad', 'ciber-riesgos', 'Revisión de riesgos con informe', 'Análisis de vulnerabilidades de tu red y equipos, con informe y recomendaciones.', 350000, NULL, 1),
  ('ciberseguridad', 'ciber-combo', 'Combo de ciberseguridad para tu red', 'Firewall, protección contra ataques DDoS, accesos seguros y monitoreo inicial.', 950000, NULL, 2),
  ('ciberseguridad', 'ciber-respaldos', 'Respaldos automáticos en la nube (configuración)', 'Configuración de respaldos automáticos con prueba de restauración.', 250000, NULL, 3),
  ('web', 'web-basico', 'Paquete Básico', 'Página simple de una sola sección o landing, con dominio y correo con tu marca.', 890000, 'assets/img/paquete-basico.svg', 1),
  ('web', 'web-medida', 'Paquete A la medida', 'Página con la estructura y los requerimientos que tú definas: formularios, catálogo o panel.', 1850000, 'assets/img/paquete-medida.svg', 2),
  ('web', 'web-premium', 'Paquete Premium', 'Todo lo anterior más ciberseguridad, base de datos estable y segura con contraseñas hasheadas, respaldos y capacitación.', 3990000, 'assets/img/paquete-premium.svg', 3)
)
INSERT OR IGNORE INTO servicios (categoria_id, clave, nombre, descripcion, precio_centavos, imagen, orden)
SELECT c.id, s.clave, s.nombre, s.descripcion, s.precio_centavos, s.imagen, s.orden
FROM s JOIN categorias_servicio c ON c.clave = s.cat;

-- Empresas ficticias de Monterrey (contenido de ejemplo para la escuela)
INSERT OR IGNORE INTO empresas_clientes (nombre, sector, orden) VALUES
  ('Termium',                    'Siderurgia',            1),
  ('Cervecería Regia del Norte', 'Bebidas',               2),
  ('Aceros Cumbres',             'Acero y metales',       3),
  ('Cementos Sierra Madre',      'Construcción',          4),
  ('Banco Regiomontano',         'Servicios financieros', 5),
  ('Logística Fundidora',        'Logística',             6),
  ('Grupo Valle Oriente',        'Corporativo',           7);

-- Configuración. iva_tasa es de referencia: el cálculo usa la constante IVA_TASA de backend/config.py (16 %).
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES
  ('emisor_nombre', 'Meridian TI'),
  ('emisor_rfc',    'RFC-EMISOR-000'),
  ('iva_tasa',      '0.16');

-- Serie de folios. OR IGNORE: volver a sembrar NO reinicia el consecutivo.
INSERT OR IGNORE INTO folios (serie, consecutivo) VALUES ('A', 0);
