# Servidor Flask de Meridian TI: API JSON bajo /api y frontend (index.html, css/, js/, assets/) en el mismo origen.
import atexit
import logging
import os
import socket
import sys
import threading
import webbrowser

from flask import Flask, abort, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

import config
import db
from db import BaseNoDisponible
from rutas import admin, autenticacion, carrito, facturas, servicios
from utilidades import ErrorApi

log = logging.getLogger('meridian')
ARCHIVO_PID = config.RAIZ / '.servidor.pid'


def crear_app():
    app = Flask(__name__, static_folder=None)
    app.config.update(
        SECRET_KEY=config.secret_key(),
        SESSION_COOKIE_NAME='meridian_sesion',
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        MAX_CONTENT_LENGTH=64 * 1024,
    )
    app.json.ensure_ascii = False

    for modulo in (autenticacion, servicios, carrito, facturas, admin):
        app.register_blueprint(modulo.bp, url_prefix='/api')

    @app.before_request
    def exigir_json():
        # Las peticiones que cambian datos deben ser JSON: un formulario de otro sitio no puede enviarlas (defensa CSRF)
        if request.path.startswith('/api/') and request.method in ('POST', 'PUT', 'PATCH', 'DELETE') and not request.is_json:
            return jsonify(error='La petición debe enviarse como JSON.'), 415

    @app.after_request
    def cabeceras(resp):
        resp.headers.setdefault('X-Content-Type-Options', 'nosniff')
        if request.path.startswith('/api/'):
            resp.headers['Cache-Control'] = 'no-store'
        else:
            resp.headers['Cache-Control'] = 'no-cache'  # El navegador revalida: nunca usa JS/CSS viejos
        return resp

    # ---------- Frontend ----------
    @app.get('/')
    def inicio():
        return send_from_directory(config.RAIZ, 'index.html')

    @app.get('/<carpeta>/<path:ruta>')
    def archivo(carpeta, ruta):
        if carpeta not in config.CARPETAS_PUBLICAS:
            abort(404)
        return send_from_directory(config.RAIZ / carpeta, ruta)

    # ---------- Errores (siempre en español, sin detalles internos) ----------
    @app.errorhandler(ErrorApi)
    def error_api(e):
        return jsonify(error=e.mensaje, **e.extra), e.codigo

    @app.errorhandler(BaseNoDisponible)
    def base_caida(e):
        log.error('No se pudo usar la base SQLite: %s', e.__cause__)
        return jsonify(error='La base de datos está ocupada o no se pudo abrir. Intenta de nuevo en un momento.'), 503

    @app.errorhandler(HTTPException)
    def error_http(e):
        mensajes = {404: 'No encontramos lo que buscas.', 405: 'Método no permitido.',
                    413: 'La petición es demasiado grande.', 400: 'La petición no es válida.'}
        mensaje = mensajes.get(e.code, 'No se pudo completar la petición.')
        if request.path.startswith('/api/'):
            return jsonify(error=mensaje), e.code
        return mensaje, e.code, {'Content-Type': 'text/plain; charset=utf-8'}

    @app.errorhandler(Exception)
    def error_interno(e):
        log.exception('Error no controlado en %s %s', request.method, request.path)
        return jsonify(error='Ocurrió un error interno. Intenta de nuevo en un momento.'), 500

    return app


def puerto_ocupado(puerto):
    """True si algo ya escucha en ese puerto (IPv4 o IPv6) o si no se puede usar."""
    for familia, host in ((socket.AF_INET, '127.0.0.1'), (socket.AF_INET6, '::1')):
        try:
            with socket.socket(familia, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                if s.connect_ex((host, puerto)) == 0:
                    return True
        except OSError:
            pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', puerto))
    except OSError:
        return True
    return False


def elegir_puerto(preferido):
    for puerto in range(preferido, preferido + 30):
        if not puerto_ocupado(puerto):
            if puerto != preferido:
                print(f'  ! El puerto {preferido} está ocupado; se usará el {puerto}.')
            return puerto
    sys.exit(f'No hay un puerto libre entre {preferido} y {preferido + 29}. Cierra otros servidores e intenta de nuevo.')


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    try:
        if db.inicializar():
            print(f'  [ok] Base de datos creada: {config.ARCHIVO_DB.relative_to(config.RAIZ)} (esquema y catálogo inicial)')
        else:
            print(f'  [ok] Base de datos encontrada: {config.ARCHIVO_DB.relative_to(config.RAIZ)}')
    except Exception as e:
        sys.exit(f'No se pudo crear la base de datos: {e}')
    puerto = elegir_puerto(config.PUERTO)
    url = f'http://localhost:{puerto}'

    # Archivo con el PID para que detener-pagina.bat cierre exactamente este proceso
    ARCHIVO_PID.write_text(str(os.getpid()), encoding='ascii')
    atexit.register(lambda: ARCHIVO_PID.unlink(missing_ok=True))

    print(f'\n  Meridian TI está lista en {url}')
    print('  Cierra esta ventana para detener el servidor.\n')
    if '--abrir' in sys.argv:
        threading.Timer(1.2, webbrowser.open, args=(url,)).start()
    crear_app().run(host='127.0.0.1', port=puerto, debug=False, threaded=True)
