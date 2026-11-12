# Conexión a SQLite (db/meridian.db): crea la base la primera vez con esquema y semillas, y da transacciones con commit o rollback.
import logging
import os
import sqlite3
from contextlib import contextmanager

import config

log = logging.getLogger('meridian')


class BaseNoDisponible(Exception):
    """El archivo de la base no se pudo abrir o está bloqueado demasiado tiempo."""


def _fila_dict(cursor, fila):
    """Filas como diccionarios: f['columna']."""
    return {col[0]: valor for col, valor in zip(cursor.description, fila)}


def _abrir(ruta):
    # isolation_level=None: las transacciones se abren a mano con BEGIN (control explícito del commit)
    cn = sqlite3.connect(ruta, timeout=10, isolation_level=None, check_same_thread=False)
    cn.row_factory = _fila_dict
    cn.execute('PRAGMA foreign_keys = ON')
    cn.execute('PRAGMA busy_timeout = 10000')
    return cn


def inicializar():
    """Crea db/meridian.db SOLO si no existe: aplica esquema.sql y semillas.sql en un archivo temporal y luego lo renombra.

    Así, si algo falla a la mitad, no queda una base incompleta.
    """
    if config.ARCHIVO_DB.exists():
        return False
    temporal = config.ARCHIVO_DB.with_name(config.ARCHIVO_DB.name + '.nueva')
    temporal.unlink(missing_ok=True)
    cn = _abrir(temporal)
    try:
        cn.executescript(config.ESQUEMA_SQL.read_text(encoding='utf-8'))
        cn.executescript('BEGIN;\n' + config.SEMILLAS_SQL.read_text(encoding='utf-8') + '\nCOMMIT;')
        problemas = cn.execute('PRAGMA foreign_key_check').fetchall()
        if problemas:
            raise RuntimeError(f'Las semillas rompen llaves foráneas: {problemas}')
    except BaseException:
        cn.close()
        temporal.unlink(missing_ok=True)
        raise
    cn.close()
    os.replace(temporal, config.ARCHIVO_DB)
    # WAL: lectores y escritor no se estorban (se guarda en el archivo, basta con hacerlo una vez)
    cn = _abrir(config.ARCHIVO_DB)
    cn.execute('PRAGMA journal_mode = WAL')
    cn.close()
    return True


@contextmanager
def conexion(escribe=False):
    """Entrega un cursor (filas como diccionarios) dentro de una transacción.

    Uso: with conexion(escribe=True) as cur: cur.execute('... ?', (valor,))
    escribe=True abre BEGIN IMMEDIATE: toma el candado de escritura desde el inicio, así dos facturas
    simultáneas no pueden leer el mismo folio. Todas las consultas van parametrizadas con ?; nunca se concatena SQL.
    """
    try:
        cn = _abrir(config.ARCHIVO_DB)
    except sqlite3.Error as e:
        raise BaseNoDisponible() from e
    cur = cn.cursor()
    try:
        cur.execute('BEGIN IMMEDIATE' if escribe else 'BEGIN')
        yield cur
        cn.commit()
    except sqlite3.OperationalError as e:
        _seguro(cn.rollback)
        if 'locked' in str(e) or 'busy' in str(e) or 'unable to open' in str(e) or 'disk' in str(e):
            raise BaseNoDisponible() from e
        raise
    except BaseException:
        _seguro(cn.rollback)
        raise
    finally:
        _seguro(cur.close)
        _seguro(cn.close)


def _seguro(accion):
    """Ejecuta rollback/cierre sin tapar el error original."""
    try:
        accion()
    except sqlite3.Error:
        pass
