// Cliente de la API: fetch con la cookie de sesión (mismo origen), JSON, errores en español y aviso si el servidor o la base no responden.

export class ErrorApi extends Error {
  constructor(mensaje, estado, datos = {}) {
    super(mensaje);
    this.estado = estado;   // 0 = sin conexión con el servidor
    this.datos = datos;     // Campos extra del servidor (segundos, restantes, admin_existe…)
  }
}

// Banda fija abajo de la página para fallas del servidor o de la base de datos (nunca pantalla en blanco)
export function avisoServidor(mensaje) {
  const caja = document.getElementById('aviso-servidor');
  if (!caja) return;
  caja.querySelector('span').textContent = mensaje;
  caja.hidden = false;
}

export async function api(ruta, { metodo = 'GET', datos } = {}) {
  const opciones = { method: metodo, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (metodo !== 'GET') {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(datos ?? {});
  }

  let resp;
  try {
    resp = await fetch('/api' + ruta, opciones);
  } catch (e) {
    const mensaje = 'No hay conexión con el servidor. Verifica que la página siga corriendo (iniciar-pagina.bat) y recarga.';
    avisoServidor(mensaje);
    throw new ErrorApi(mensaje, 0);
  }

  let cuerpo = null;
  try { cuerpo = await resp.json(); } catch (e) { /* respuesta sin JSON */ }

  if (!resp.ok) {
    const mensaje = cuerpo?.error || `El servidor respondió con un error (${resp.status}). Intenta de nuevo.`;
    if (resp.status === 503 || resp.status >= 500) avisoServidor(mensaje);
    throw new ErrorApi(mensaje, resp.status, cuerpo || {});
  }
  document.getElementById('aviso-servidor')?.setAttribute('hidden', '');
  return cuerpo;
}

export function init() {
  document.querySelector('#aviso-servidor button')?.addEventListener('click', () => {
    document.getElementById('aviso-servidor').hidden = true;
  });
}
