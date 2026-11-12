# Utilidades del backend: error de API, decoradores de sesión, validaciones, normalización y cálculo de totales con IVA.
import re
import unicodedata
from decimal import ROUND_HALF_UP, Decimal
from functools import wraps

from flask import request, session

import config


class ErrorApi(Exception):
    """Error que se devuelve al cliente como JSON: {"error": mensaje, ...extra}."""

    def __init__(self, codigo, mensaje, **extra):
        super().__init__(mensaje)
        self.codigo, self.mensaje, self.extra = codigo, mensaje, extra


def datos_json():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


def texto(datos, campo, maximo=255):
    valor = datos.get(campo, '')
    return str(valor).strip()[:maximo] if valor is not None else ''


# ---------- Sesión ----------
def requiere_sesion(f):
    @wraps(f)
    def envoltura(*args, **kwargs):
        if not session.get('usuario_id'):
            raise ErrorApi(401, 'Inicia sesión para continuar.')
        return f(*args, **kwargs)
    return envoltura


def requiere_admin(f):
    @wraps(f)
    def envoltura(*args, **kwargs):
        if not session.get('usuario_id'):
            raise ErrorApi(401, 'Inicia sesión para continuar.')
        if session.get('rol') != 'admin':
            raise ErrorApi(403, 'Solo el administrador puede ver esta información.')
        return f(*args, **kwargs)
    return envoltura


# ---------- Validaciones (mismas reglas que el frontend) ----------
RE_USUARIO = re.compile(r'^[\w.-]{3,20}$', re.ASCII)
RE_CORREO = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
RE_RFC = re.compile(r'^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$')


def limpiar_whatsapp(valor):
    return re.sub(r'[\s()+-]', '', str(valor or ''))


def validar_usuario(v):
    if not RE_USUARIO.fullmatch(v):
        raise ErrorApi(400, 'El nombre de usuario debe tener de 3 a 20 caracteres: letras, números, punto, guion o guion bajo.')


def validar_correo(v):
    if len(v) > 254 or not RE_CORREO.fullmatch(v):
        raise ErrorApi(400, 'Escribe un correo electrónico válido.')


def validar_whatsapp(v):
    if not re.fullmatch(r'\d{11,15}', v):
        raise ErrorApi(400, 'Escribe el WhatsApp con lada de país, solo números (de 11 a 15 dígitos). Ej.: 528112345678.')


def validar_rfc(v):
    if v and not RE_RFC.fullmatch(v):
        raise ErrorApi(400, 'El RFC no tiene un formato válido (12 o 13 caracteres). Puedes dejarlo vacío.')


def validar_clave(v):
    if len(v) < 8:
        raise ErrorApi(400, 'La contraseña debe tener al menos 8 caracteres.')
    if len(v) > 128:
        raise ErrorApi(400, 'La contraseña es demasiado larga (máximo 128 caracteres).')


def normalizar_respuesta(s):
    """Las respuestas de recuperación se comparan sin mayúsculas, acentos ni espacios de más."""
    s = unicodedata.normalize('NFD', str(s).strip().lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s)


# ---------- Dinero ----------
# En la base todo importe es INTEGER en centavos; en Python se calcula con Decimal (nunca float).
CENTAVO = Decimal('0.01')


def redondear(valor):
    return Decimal(valor).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def de_centavos(centavos):
    """INTEGER de la base -> Decimal en pesos (200050 -> Decimal('2000.50'))."""
    return redondear(Decimal(int(centavos)) / 100)


def a_centavos(valor):
    """Decimal en pesos -> INTEGER para la base, con redondeo a medio centavo hacia arriba."""
    return int(redondear(valor) * 100)


def calcular_totales(lineas):
    """lineas: [{'precio': Decimal, 'cantidad': int}] -> subtotal, iva y total con IVA fijo del servidor."""
    subtotal = redondear(sum((l['precio'] * l['cantidad'] for l in lineas), Decimal('0')))
    iva = redondear(subtotal * config.IVA_TASA)
    return subtotal, iva, subtotal + iva


def dinero(valor):
    """Decimal -> número JSON con 2 decimales (solo para mostrar; los cálculos se hacen con Decimal)."""
    return float(redondear(valor))


def fecha_iso(texto_fecha):
    """'2026-11-11 16:30:00' (texto de SQLite, hora local) -> '2026-11-11T16:30:00' para el navegador."""
    return str(texto_fecha).replace(' ', 'T', 1)
