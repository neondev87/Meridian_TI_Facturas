# Rutas públicas de catálogo: categorías con sus subservicios y precios, y empresas de Misión y visión.
from flask import Blueprint, jsonify

from db import conexion
from utilidades import de_centavos, dinero

bp = Blueprint('servicios', __name__)


@bp.get('/categorias')
def categorias():
    with conexion() as cur:
        cur.execute('SELECT id, clave, nombre, resumen, imagen FROM categorias_servicio ORDER BY orden, id')
        cats = cur.fetchall()
        cur.execute('SELECT categoria_id, clave, nombre, descripcion, precio_centavos, imagen '
                    'FROM servicios WHERE activo = 1 ORDER BY orden, id')
        servicios = cur.fetchall()
    resultado = []
    for c in cats:
        resultado.append({
            'clave': c['clave'], 'nombre': c['nombre'], 'resumen': c['resumen'], 'imagen': c['imagen'],
            'servicios': [{'clave': s['clave'], 'nombre': s['nombre'], 'descripcion': s['descripcion'],
                           'precio': dinero(de_centavos(s['precio_centavos'])), 'imagen': s['imagen']}
                          for s in servicios if s['categoria_id'] == c['id']]
        })
    return jsonify(categorias=resultado)


@bp.get('/empresas')
def empresas():
    with conexion() as cur:
        cur.execute('SELECT nombre, sector FROM empresas_clientes ORDER BY orden, id')
        return jsonify(empresas=cur.fetchall())
