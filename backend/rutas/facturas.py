# Rutas de facturas: crea la factura desde el carrito (folio consecutivo en transacción, IVA del servidor) y lista las del usuario.
from decimal import Decimal

from flask import Blueprint, jsonify, session

import config
from db import conexion
from rutas.carrito import lineas_carrito, vaciar_carrito
from utilidades import (ErrorApi, a_centavos, calcular_totales, datos_json, de_centavos, dinero, fecha_iso,
                        limpiar_whatsapp, requiere_sesion, texto, validar_correo, validar_rfc, validar_whatsapp)

bp = Blueprint('facturas', __name__)


def factura_json(f, conceptos):
    return {
        'folio': f['folio'], 'tipo': f['tipo'], 'fecha': fecha_iso(f['creado_en']),
        'emisor': {'nombre': f['emisor_nombre'], 'rfc': f['emisor_rfc']},
        'cliente': {'nombre': f['cliente_nombre'], 'correo': f['cliente_correo'],
                    'whatsapp': f['cliente_whatsapp'], 'rfc': f['rfc'] or ''},
        'mensaje': f['mensaje'] or '',
        'conceptos': [{'nombre': c['nombre'], 'precio': dinero(de_centavos(c['precio_unitario_centavos'])),
                       'cantidad': c['cantidad'], 'importe': dinero(de_centavos(c['importe_centavos']))}
                      for c in conceptos],
        'subtotal': dinero(de_centavos(f['subtotal_centavos'])), 'iva_tasa': float(Decimal(f['iva_tasa'])),
        'iva': dinero(de_centavos(f['iva_centavos'])), 'total': dinero(de_centavos(f['total_centavos'])),
    }


def leer_factura(cur, factura_id):
    cur.execute('SELECT * FROM facturas WHERE id = ?', (factura_id,))
    f = cur.fetchone()
    cur.execute('SELECT nombre, precio_unitario_centavos, cantidad, importe_centavos FROM factura_conceptos '
                'WHERE factura_id = ? ORDER BY id', (factura_id,))
    return factura_json(f, cur.fetchall())


@bp.post('/facturas')
@requiere_sesion
def crear():
    d = datos_json()
    nombre = texto(d, 'nombre', 120)
    correo = texto(d, 'correo', 254)
    whatsapp = limpiar_whatsapp(d.get('whatsapp'))
    rfc = texto(d, 'rfc', 13).upper()
    mensaje = texto(d, 'mensaje', 2000)
    if not nombre:
        raise ErrorApi(400, 'Escribe tu nombre o razón social.')
    validar_correo(correo)
    validar_whatsapp(whatsapp)
    validar_rfc(rfc)

    uid = session['usuario_id']
    # escribe=True -> BEGIN IMMEDIATE: nadie más puede escribir hasta el commit, así el folio no se repite
    with conexion(escribe=True) as cur:
        lineas = lineas_carrito(cur, uid)
        if not lineas and not mensaje:
            raise ErrorApi(400, 'Tu carrito está vacío: agrega servicios o escribe un mensaje para pedir tu cotización.')
        subtotal, iva, total = calcular_totales(lineas)

        # Folio consecutivo dentro de la misma transacción
        cur.execute('UPDATE folios SET consecutivo = consecutivo + 1 WHERE serie = ?', (config.SERIE_FOLIO,))
        if cur.rowcount != 1:
            raise ErrorApi(500, 'Falta la serie de folios en la base. Borra db/meridian.db y vuelve a ejecutar iniciar-pagina.bat.')
        cur.execute('SELECT consecutivo FROM folios WHERE serie = ?', (config.SERIE_FOLIO,))
        folio = f"{config.SERIE_FOLIO}-{cur.fetchone()['consecutivo']:04d}"

        cur.execute("SELECT clave, valor FROM configuracion WHERE clave IN ('emisor_nombre', 'emisor_rfc')")
        emisor = {f['clave']: f['valor'] for f in cur.fetchall()}

        cur.execute(
            'INSERT INTO facturas (folio, tipo, usuario_id, cliente_nombre, cliente_correo, cliente_whatsapp, rfc, '
            'mensaje, emisor_nombre, emisor_rfc, subtotal_centavos, iva_tasa, iva_centavos, total_centavos) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (folio, 'factura' if lineas else 'solicitud', uid, nombre, correo, whatsapp, rfc or None,
             mensaje or None, emisor.get('emisor_nombre', 'Meridian TI'), emisor.get('emisor_rfc', ''),
             a_centavos(subtotal), str(config.IVA_TASA), a_centavos(iva), a_centavos(total)))
        factura_id = cur.lastrowid
        for l in lineas:
            cur.execute(
                'INSERT INTO factura_conceptos (factura_id, servicio_id, nombre, precio_unitario_centavos, cantidad, '
                'importe_centavos) VALUES (?, ?, ?, ?, ?, ?)',
                (factura_id, l['servicio_id'], l['nombre'], a_centavos(l['precio']), l['cantidad'],
                 a_centavos(l['precio'] * l['cantidad'])))

        # El carrito se vacía al facturar (sus servicios ya quedaron en la factura)
        vaciar_carrito(cur, uid)
        return jsonify(factura=leer_factura(cur, factura_id)), 201


@bp.get('/facturas')
@requiere_sesion
def listar():
    with conexion() as cur:
        cur.execute('SELECT folio, tipo, creado_en, total_centavos FROM facturas WHERE usuario_id = ? ORDER BY id DESC',
                    (session['usuario_id'],))
        return jsonify(facturas=[{'folio': f['folio'], 'tipo': f['tipo'], 'fecha': fecha_iso(f['creado_en']),
                                  'total': dinero(de_centavos(f['total_centavos']))} for f in cur.fetchall()])


@bp.get('/facturas/<folio>')
@requiere_sesion
def detalle(folio):
    with conexion() as cur:
        cur.execute('SELECT id, usuario_id FROM facturas WHERE folio = ?', (folio,))
        f = cur.fetchone()
        if not f or (f['usuario_id'] != session['usuario_id'] and session.get('rol') != 'admin'):
            raise ErrorApi(404, 'No encontramos esa factura.')
        return jsonify(factura=leer_factura(cur, f['id']))
