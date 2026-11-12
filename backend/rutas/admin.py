# Rutas del administrador: lista de usuarios registrados sin hashes ni respuestas de recuperación.
from flask import Blueprint, jsonify

from db import conexion
from utilidades import fecha_iso, requiere_admin

bp = Blueprint('admin', __name__)


@bp.get('/admin/usuarios')
@requiere_admin
def usuarios():
    with conexion() as cur:
        # Columnas elegidas a mano: clave_hash y respuesta_hash nunca salen de la base
        cur.execute('SELECT u.usuario, r.nombre AS rol, u.correo, u.whatsapp, u.creado_en '
                    'FROM usuarios u JOIN roles r ON r.id = u.rol_id ORDER BY u.id')
        filas = cur.fetchall()
    return jsonify(usuarios=[{'usuario': f['usuario'], 'rol': f['rol'], 'correo': f['correo'] or '',
                              'whatsapp': f['whatsapp'] or '', 'fecha': fecha_iso(f['creado_en'])} for f in filas])
