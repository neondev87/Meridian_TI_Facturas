# Rutas del carrito (requieren sesión): leer, agregar, cambiar cantidad, quitar y vaciar; los totales los calcula el servidor.
from flask import Blueprint, jsonify, session

import config
from db import conexion
from utilidades import ErrorApi, calcular_totales, datos_json, de_centavos, dinero, requiere_sesion

bp = Blueprint('carrito', __name__)


def id_carrito(cur, usuario_id):
    cur.execute('INSERT OR IGNORE INTO carritos (usuario_id) VALUES (?)', (usuario_id,))
    cur.execute('SELECT id FROM carritos WHERE usuario_id = ?', (usuario_id,))
    return cur.fetchone()['id']


def lineas_carrito(cur, usuario_id):
    """Renglones del carrito con el precio vigente de la base (el cliente nunca manda precios).

    El precio sale de la base en centavos y se entrega como Decimal en pesos.
    """
    cur.execute(
        'SELECT s.id AS servicio_id, s.clave, s.nombre, s.precio_centavos, i.cantidad '
        'FROM carritos c JOIN carrito_items i ON i.carrito_id = c.id '
        'JOIN servicios s ON s.id = i.servicio_id '
        'WHERE c.usuario_id = ? AND s.activo = 1 ORDER BY i.id',
        (usuario_id,))
    lineas = cur.fetchall()
    for l in lineas:
        l['precio'] = de_centavos(l.pop('precio_centavos'))
    return lineas


def vaciar_carrito(cur, usuario_id):
    cur.execute('DELETE FROM carrito_items WHERE carrito_id IN (SELECT id FROM carritos WHERE usuario_id = ?)',
                (usuario_id,))


def carrito_json(lineas):
    subtotal, iva, total = calcular_totales(lineas)
    return {
        'items': [{'clave': l['clave'], 'nombre': l['nombre'], 'precio': dinero(l['precio']),
                   'cantidad': l['cantidad'], 'importe': dinero(l['precio'] * l['cantidad'])} for l in lineas],
        'piezas': sum(l['cantidad'] for l in lineas),
        'subtotal': dinero(subtotal), 'iva': dinero(iva), 'total': dinero(total),
        'iva_tasa': float(config.IVA_TASA),
    }


def servicio_activo(cur, clave):
    cur.execute('SELECT id FROM servicios WHERE clave = ? AND activo = 1', (clave,))
    fila = cur.fetchone()
    if not fila:
        raise ErrorApi(404, 'Ese servicio no existe o ya no está disponible.')
    return fila['id']


@bp.get('/carrito')
@requiere_sesion
def leer():
    with conexion() as cur:
        return jsonify(carrito_json(lineas_carrito(cur, session['usuario_id'])))


@bp.post('/carrito/items')
@requiere_sesion
def agregar():
    clave = str(datos_json().get('servicio') or '')
    with conexion(escribe=True) as cur:
        servicio_id = servicio_activo(cur, clave)
        cur.execute(
            'INSERT INTO carrito_items (carrito_id, servicio_id, cantidad) VALUES (?, ?, 1) '
            'ON CONFLICT (carrito_id, servicio_id) DO UPDATE SET cantidad = MIN(cantidad + 1, ?)',
            (id_carrito(cur, session['usuario_id']), servicio_id, config.MAX_CANTIDAD))
        return jsonify(carrito_json(lineas_carrito(cur, session['usuario_id']))), 201


@bp.patch('/carrito/items/<clave>')
@requiere_sesion
def cambiar(clave):
    try:
        cantidad = int(datos_json().get('cantidad'))
    except (TypeError, ValueError):
        raise ErrorApi(400, 'La cantidad debe ser un número entero.')
    if not 1 <= cantidad <= config.MAX_CANTIDAD:
        raise ErrorApi(400, f'La cantidad debe estar entre 1 y {config.MAX_CANTIDAD}.')
    with conexion(escribe=True) as cur:
        servicio_id = servicio_activo(cur, clave)
        cur.execute('UPDATE carrito_items SET cantidad = ? WHERE carrito_id = ? AND servicio_id = ?',
                    (cantidad, id_carrito(cur, session['usuario_id']), servicio_id))
        return jsonify(carrito_json(lineas_carrito(cur, session['usuario_id'])))


@bp.delete('/carrito/items/<clave>')
@requiere_sesion
def quitar(clave):
    with conexion(escribe=True) as cur:
        cur.execute(
            'DELETE FROM carrito_items '
            'WHERE carrito_id IN (SELECT id FROM carritos WHERE usuario_id = ?) '
            'AND servicio_id IN (SELECT id FROM servicios WHERE clave = ?)',
            (session['usuario_id'], clave))
        return jsonify(carrito_json(lineas_carrito(cur, session['usuario_id'])))


@bp.delete('/carrito')
@requiere_sesion
def vaciar():
    with conexion(escribe=True) as cur:
        vaciar_carrito(cur, session['usuario_id'])
        return jsonify(carrito_json([]))
