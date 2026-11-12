# Rutas de cuentas: registro (admin único o usuario), login con bloqueo, logout, sesión actual y recuperación de contraseña.
import sqlite3

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

import config
from db import conexion
from utilidades import (ErrorApi, datos_json, limpiar_whatsapp, normalizar_respuesta, texto,
                        validar_clave, validar_correo, validar_usuario, validar_whatsapp)

bp = Blueprint('autenticacion', __name__)

ROL_ADMIN, ROL_USUARIO = 1, 2
# Hash de relleno: si el usuario no existe se verifica contra él, para que la respuesta tarde lo mismo
HASH_RELLENO = generate_password_hash('relleno-sin-uso', method=config.METODO_HASH)


def usuario_publico(fila):
    """Datos que puede ver el navegador (nunca hashes)."""
    return {'usuario': fila['usuario'], 'rol': fila['rol'],
            'correo': fila['correo'] or '', 'whatsapp': fila['whatsapp'] or ''}


def buscar_usuario(cur, nombre):
    cur.execute(
        'SELECT u.id, u.usuario, u.correo, u.whatsapp, u.clave_hash, u.respuesta_hash, '
        'r.nombre AS rol, p.texto AS pregunta '
        'FROM usuarios u JOIN roles r ON r.id = u.rol_id '
        'JOIN preguntas_recuperacion p ON p.id = u.pregunta_id WHERE u.usuario = ?',
        (nombre,))
    return cur.fetchone()


def hay_admin(cur):
    cur.execute('SELECT 1 FROM usuarios WHERE rol_id = ? LIMIT 1', (ROL_ADMIN,))
    return cur.fetchone() is not None


def iniciar_sesion(fila_id, nombre, rol):
    session.clear()
    session['usuario_id'], session['usuario'], session['rol'] = fila_id, nombre, rol


# ---------- Bloqueo por intentos (por IP, en la base) ----------
def estado_bloqueo(cur, ip):
    """Devuelve (segundos_de_bloqueo, fallos_seguidos). 5 fallos seguidos bloquean 1 minuto."""
    cur.execute(
        "SELECT exito, CAST(strftime('%s', 'now', 'localtime') - strftime('%s', creado_en) AS INTEGER) AS hace "
        'FROM intentos_login WHERE ip = ? ORDER BY id DESC LIMIT 100', (ip,))
    filas = cur.fetchall()
    fallos = 0
    for f in filas:
        if f['exito']:
            break
        fallos += 1
    if fallos and fallos % config.MAX_INTENTOS == 0:
        restante = config.BLOQUEO_SEGUNDOS - filas[0]['hace']
        if restante > 0:
            return restante, fallos
    return 0, fallos


def registrar_intento(cur, ip, usuario, tipo, exito):
    cur.execute('INSERT INTO intentos_login (ip, usuario, tipo, exito) VALUES (?, ?, ?, ?)',
                (ip, (usuario or '')[:20] or None, tipo, 1 if exito else 0))


def verificar_bloqueo(cur, ip):
    segundos, _ = estado_bloqueo(cur, ip)
    if segundos:
        raise ErrorApi(429, f'Demasiados intentos fallidos. Espera {segundos} s para volver a intentarlo.', segundos=segundos)


def fallo(cur, ip, usuario, tipo, mensaje):
    registrar_intento(cur, ip, usuario, tipo, False)
    segundos, fallos = estado_bloqueo(cur, ip)
    if segundos:
        return ErrorApi(429, f'Demasiados intentos fallidos. Espera {segundos} s para volver a intentarlo.', segundos=segundos)
    restantes = config.MAX_INTENTOS - fallos % config.MAX_INTENTOS
    return ErrorApi(401, f'{mensaje} Te quedan {restantes} intento(s).', restantes=restantes)


# ---------- Rutas ----------
@bp.get('/sesion')
def sesion_actual():
    with conexion() as cur:
        fila = buscar_usuario(cur, session['usuario']) if session.get('usuario') else None
        if session.get('usuario') and (not fila or fila['id'] != session.get('usuario_id')):
            session.clear()
            fila = None
        return jsonify(usuario=usuario_publico(fila) if fila else None, hay_admin=hay_admin(cur))


@bp.get('/preguntas')
def preguntas():
    with conexion() as cur:
        cur.execute('SELECT id, texto FROM preguntas_recuperacion ORDER BY id')
        return jsonify(preguntas=cur.fetchall())


@bp.post('/registro')
def registro():
    d = datos_json()
    rol = d.get('rol')
    if rol not in ('admin', 'usuario'):
        raise ErrorApi(400, 'Elige el tipo de cuenta: Administrador o Usuario.')
    nombre = texto(d, 'usuario', 40)
    clave = str(d.get('clave') or '')
    respuesta = normalizar_respuesta(d.get('respuesta') or '')
    try:
        pregunta_id = int(d.get('pregunta_id'))
    except (TypeError, ValueError):
        raise ErrorApi(400, 'Elige una pregunta de recuperación.')

    validar_usuario(nombre)
    correo = whatsapp = None
    if rol == 'usuario':
        correo = texto(d, 'correo', 254)
        whatsapp = limpiar_whatsapp(d.get('whatsapp'))
        validar_correo(correo)
        validar_whatsapp(whatsapp)
    validar_clave(clave)
    if len(respuesta) < 2:
        raise ErrorApi(400, 'Escribe la respuesta a tu pregunta de recuperación.')

    # Los hashes (lentos a propósito) se calculan antes de tomar el candado de escritura de SQLite
    clave_hash = generate_password_hash(clave, method=config.METODO_HASH)
    respuesta_hash = generate_password_hash(respuesta, method=config.METODO_HASH)
    with conexion(escribe=True) as cur:
        cur.execute('SELECT id FROM preguntas_recuperacion WHERE id = ?', (pregunta_id,))
        if not cur.fetchone():
            raise ErrorApi(400, 'Elige una pregunta de recuperación válida.')
        if rol == 'admin' and hay_admin(cur):
            raise ErrorApi(409, 'Ya hay un administrador registrado. Solo se permite uno, así que únicamente puede iniciar sesión.', admin_existe=True)
        if buscar_usuario(cur, nombre):
            raise ErrorApi(409, 'Ese nombre de usuario ya está registrado.')
        if correo:
            cur.execute('SELECT 1 FROM usuarios WHERE correo = ?', (correo,))
            if cur.fetchone():
                raise ErrorApi(409, 'Ese correo ya está registrado.')

        try:
            cur.execute(
                'INSERT INTO usuarios (rol_id, usuario, correo, whatsapp, clave_hash, pregunta_id, respuesta_hash) '
                'VALUES (?, ?, ?, ?, ?, ?, ?)',
                (ROL_ADMIN if rol == 'admin' else ROL_USUARIO, nombre, correo, whatsapp, clave_hash,
                 pregunta_id, respuesta_hash))
        except sqlite3.IntegrityError as e:
            # Respaldo ante registros simultáneos: los UNIQUE de la base deciden
            if 'usuarios.rol_id' in str(e):
                raise ErrorApi(409, 'Ya hay un administrador registrado.', admin_existe=True)
            raise ErrorApi(409, 'Ese nombre de usuario o correo ya está registrado.')
        nuevo_id = cur.lastrowid

    iniciar_sesion(nuevo_id, nombre, rol)
    respuesta_json = {'usuario': {'usuario': nombre, 'rol': rol, 'correo': correo or '', 'whatsapp': whatsapp or ''}}
    if rol == 'admin':
        respuesta_json['hash'] = clave_hash  # Se muestra una sola vez; no hay otra ruta que lo devuelva
    return jsonify(respuesta_json), 201


@bp.post('/login')
def login():
    d = datos_json()
    nombre, clave = texto(d, 'usuario', 40), str(d.get('clave') or '')
    if not nombre or not clave:
        raise ErrorApi(400, 'Escribe tu usuario y tu contraseña.')
    ip = request.remote_addr or 'desconocida'
    with conexion(escribe=True) as cur:
        verificar_bloqueo(cur, ip)
        fila = buscar_usuario(cur, nombre)
        ok = check_password_hash(fila['clave_hash'] if fila else HASH_RELLENO, clave) and fila is not None
        if not ok:
            error = fallo(cur, ip, nombre, 'login', 'Usuario o contraseña incorrectos.')
        else:
            registrar_intento(cur, ip, fila['usuario'], 'login', True)
    if not ok:
        raise error
    iniciar_sesion(fila['id'], fila['usuario'], fila['rol'])
    return jsonify(usuario=usuario_publico(fila))


@bp.post('/logout')
def logout():
    session.clear()
    return jsonify(ok=True)


@bp.post('/recuperar/pregunta')
def recuperar_pregunta():
    nombre = texto(datos_json(), 'usuario', 40)
    if not nombre:
        raise ErrorApi(400, 'Escribe tu nombre de usuario.')
    with conexion() as cur:
        fila = buscar_usuario(cur, nombre)
    if not fila:
        raise ErrorApi(404, 'No encontramos ese usuario.')
    return jsonify(usuario=fila['usuario'], pregunta=fila['pregunta'])


@bp.post('/recuperar')
def recuperar():
    d = datos_json()
    nombre = texto(d, 'usuario', 40)
    respuesta = normalizar_respuesta(d.get('respuesta') or '')
    clave = str(d.get('clave') or '')
    if not respuesta:
        raise ErrorApi(400, 'Escribe tu respuesta.')
    validar_clave(clave)
    ip = request.remote_addr or 'desconocida'
    with conexion(escribe=True) as cur:
        verificar_bloqueo(cur, ip)
        fila = buscar_usuario(cur, nombre)
        if not fila:
            raise ErrorApi(404, 'No encontramos ese usuario.')
        ok = check_password_hash(fila['respuesta_hash'], respuesta)
        if ok:
            cur.execute('UPDATE usuarios SET clave_hash = ? WHERE id = ?',
                        (generate_password_hash(clave, method=config.METODO_HASH), fila['id']))
            registrar_intento(cur, ip, fila['usuario'], 'recuperacion', True)
        else:
            error = fallo(cur, ip, nombre, 'recuperacion', 'La respuesta no es correcta.')
    if not ok:
        raise error
    return jsonify(ok=True, usuario=fila['usuario'])
