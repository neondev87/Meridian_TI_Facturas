# Configuración del servidor: rutas de la base SQLite, SECRET_KEY local, .env opcional y constantes de negocio (IVA, bloqueo, folios, hash).
import os
import secrets
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parent.parent
load_dotenv(RAIZ / '.env')  # Opcional: solo si quieres cambiar el puerto o fijar tu propia SECRET_KEY

# Base de datos: un archivo local que se crea solo la primera vez (ver backend/db.py)
CARPETA_DB = RAIZ / 'db'
ARCHIVO_DB = CARPETA_DB / 'meridian.db'
ESQUEMA_SQL = CARPETA_DB / 'esquema.sql'
SEMILLAS_SQL = CARPETA_DB / 'semillas.sql'

ARCHIVO_SECRETO = RAIZ / '.secret_key'
PUERTO = int(os.getenv('PUERTO') or '8000')

# Reglas de negocio (el cliente nunca las manda)
IVA_TASA = Decimal('0.16')
MAX_INTENTOS = 5
BLOQUEO_SEGUNDOS = 60
SERIE_FOLIO = 'A'
MAX_CANTIDAD = 99
METODO_HASH = 'pbkdf2:sha256:600000'  # PBKDF2-SHA256 con sal aleatoria (werkzeug.security)

# Carpetas del frontend que Flask puede servir (nada más: ni db/, ni backend/, ni secretos)
CARPETAS_PUBLICAS = {'css', 'js', 'assets'}


def secret_key():
    """SECRET_KEY de la sesión: la de .env si existe; si no, la de .secret_key (se genera la primera vez)."""
    desde_env = os.getenv('SECRET_KEY', '').strip()
    if desde_env:
        return desde_env
    try:
        guardada = ARCHIVO_SECRETO.read_text(encoding='ascii').strip()
        if len(guardada) >= 32:
            return guardada
    except FileNotFoundError:
        pass
    nueva = secrets.token_hex(32)
    ARCHIVO_SECRETO.write_text(nueva + '\n', encoding='ascii')
    return nueva
