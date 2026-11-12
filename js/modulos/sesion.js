// Registro e inicio de sesión contra la API: el servidor hashea (PBKDF2), guarda en SQLite y mantiene la sesión en una cookie HttpOnly.
import { api } from './api.js';
import { esc } from './utilidades.js';

let sesion = null;         // { usuario, rol, correo, whatsapp } o null
let hayAdmin = false;

// ---------- API para otros módulos ----------
export const obtenerSesion = () => sesion;
export const esAdmin = () => sesion?.rol === 'admin';
export const usuarioActual = () => sesion;
export const limpiarWhatsapp = v => String(v).replace(/[\s()+-]/g, '');
export const whatsappValido = v => /^\d{11,15}$/.test(limpiarWhatsapp(v));

// ---------- Validaciones en el navegador (el servidor repite todas) ----------
const RE_USUARIO = /^[\w.-]{3,20}$/;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fuerzaClave(c) {
  let p = 0;
  if (c.length >= 8) p++;
  if (c.length >= 12) p++;
  if (/[a-z]/.test(c) && /[A-Z]/.test(c)) p++;
  if (/\d/.test(c)) p++;
  if (/[^A-Za-z0-9]/.test(c)) p++;
  if (c.length < 8) p = Math.min(p, 1);
  return { nivel: p, texto: ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte', 'Muy fuerte'][p] };
}

// ---------- Interfaz ----------
let $;                       // atajo a elementos por id
let hashPendiente = null;    // { usuario, hash } del admin recién creado (se muestra una sola vez)
let usuarioRecuperando = null;
let rolElegido = null;
let temporizador = null;

const error = (form, texto) => { form.querySelector('.err').textContent = texto; };

function ocupado(form, si) {
  const b = form.querySelector('button[type=submit]');
  if (si) { b.dataset.texto = b.textContent; b.textContent = 'Un momento…'; b.disabled = true; }
  else if (b.dataset.texto) { b.textContent = b.dataset.texto; b.disabled = !!form.dataset.bloqueado; }
}

function pantallaEntrar(nombre) {
  ['form-entrar', 'form-olvido-usuario', 'form-olvido-respuesta'].forEach(id => { $[id].hidden = id !== 'form-' + nombre; });
  $['form-' + nombre].querySelector('input')?.focus();
}

function pantallaRegistro(nombre) {
  ['elegir-rol', 'admin-existe', 'form-registro', 'hash-admin'].forEach(id => { $[id].hidden = id !== nombre; });
}

async function refrescarEstado() {
  try { hayAdmin = (await api('/sesion')).hay_admin; } catch (e) { /* el aviso global ya lo explica */ }
  $['rol-admin-estado'].textContent = hayAdmin
    ? 'Ya hay un administrador registrado.'
    : 'Aún no hay ningún administrador registrado.';
}

function seleccionarTab(cual, enfocar = false) {
  const entrar = cual === 'entrar';
  $['tab-entrar'].setAttribute('aria-selected', entrar);
  $['tab-registro'].setAttribute('aria-selected', !entrar);
  $['tab-entrar'].tabIndex = entrar ? 0 : -1;
  $['tab-registro'].tabIndex = entrar ? -1 : 0;
  $['panel-entrar'].hidden = !entrar;
  $['panel-registro'].hidden = entrar;
  if (entrar) pantallaEntrar('entrar');
  else { pantallaRegistro('elegir-rol'); refrescarEstado(); }
  if (enfocar) $[entrar ? 'tab-entrar' : 'tab-registro'].focus();
}

function configurarRegistro(rol) {
  rolElegido = rol;
  const f = $['form-registro'];
  f.reset();
  error(f, '');
  pintarFuerza(f);
  f.querySelectorAll('[data-solo-usuario]').forEach(l => {
    l.hidden = rol !== 'usuario';
    l.querySelector('input').disabled = rol !== 'usuario';
  });
  $['registro-titulo'].textContent = rol === 'admin' ? 'Registro de administrador' : 'Registro de usuario';
  $['aviso-sin-admin'].hidden = !(rol === 'admin' && !hayAdmin);
  pantallaRegistro('form-registro');
  f.usuario.focus();
}

function pintarFuerza(form) {
  const caja = form.querySelector('[data-fuerza]');
  if (!caja) return;
  const c = form.clave.value;
  const { nivel, texto } = fuerzaClave(c);
  caja.dataset.nivel = c ? nivel : '';
  caja.querySelector('.fuerza-texto').textContent = c ? 'Seguridad: ' + texto : '';
}

// Cuenta regresiva del bloqueo que indicó el servidor
function mostrarBloqueo(form, segundos) {
  const boton = form.querySelector('button[type=submit]');
  const hasta = Date.now() + segundos * 1000;
  clearInterval(temporizador);
  const tic = () => {
    const s = Math.ceil((hasta - Date.now()) / 1000);
    if (s <= 0) {
      clearInterval(temporizador);
      delete form.dataset.bloqueado;
      boton.disabled = false;
      error(form, '');
      return;
    }
    form.dataset.bloqueado = '1';
    boton.disabled = true;
    error(form, `Demasiados intentos fallidos. Espera ${s} s para volver a intentarlo.`);
  };
  tic();
  temporizador = setInterval(tic, 1000);
}

// Muestra el error del servidor (o el bloqueo, si es 429)
function errorServidor(form, e) {
  if (e.estado === 429 && e.datos.segundos) mostrarBloqueo(form, e.datos.segundos);
  else error(form, e.message);
}

// ---------- Acciones ----------
function iniciar(usuario) {
  sesion = usuario;
  actualizar();
}

async function cerrar() {
  try { await api('/logout', { metodo: 'POST' }); } catch (e) { /* se cierra igual en la interfaz */ }
  sesion = null;
  if (location.hash !== '#inicio') history.replaceState(null, '', '#inicio');
  actualizar();
}

async function entrar(e) {
  e.preventDefault();
  const f = e.target;
  $['entrar-ok'].textContent = '';
  const usuario = f.usuario.value.trim(), clave = f.clave.value;
  if (!usuario || !clave) return error(f, 'Escribe tu usuario y tu contraseña.');
  ocupado(f, true);
  try {
    const r = await api('/login', { metodo: 'POST', datos: { usuario, clave } });
    f.reset();
    error(f, '');
    iniciar(r.usuario);
  } catch (err) {
    f.clave.value = '';
    errorServidor(f, err);
  } finally {
    ocupado(f, false);
  }
}

async function registrar(e) {
  e.preventDefault();
  const f = e.target;
  const d = Object.fromEntries(new FormData(f));
  const esAdminNuevo = rolElegido === 'admin';

  if (!RE_USUARIO.test(d.usuario.trim())) return error(f, 'El nombre de usuario debe tener de 3 a 20 caracteres: letras, números, punto, guion o guion bajo.');
  if (!esAdminNuevo) {
    if (!RE_CORREO.test(d.correo.trim())) return error(f, 'Escribe un correo electrónico válido.');
    if (!whatsappValido(d.whatsapp)) return error(f, 'Escribe tu WhatsApp con lada de país, solo números (de 11 a 15 dígitos). Ej.: 528112345678.');
  }
  if (d.clave.length < 8) return error(f, 'La contraseña debe tener al menos 8 caracteres.');
  if (d.clave !== d.confirmar) return error(f, 'Las contraseñas no coinciden.');
  if (d.respuesta.trim().length < 2) return error(f, 'Escribe la respuesta a tu pregunta de recuperación.');

  ocupado(f, true);
  try {
    const r = await api('/registro', {
      metodo: 'POST',
      datos: {
        rol: esAdminNuevo ? 'admin' : 'usuario',
        usuario: d.usuario.trim(),
        correo: esAdminNuevo ? '' : d.correo.trim(),
        whatsapp: esAdminNuevo ? '' : limpiarWhatsapp(d.whatsapp),
        clave: d.clave,
        pregunta_id: Number(d.pregunta),
        respuesta: d.respuesta
      }
    });
    f.reset();
    error(f, '');
    if (esAdminNuevo) {
      // El admin ve su hash una sola vez antes de entrar
      hayAdmin = true;
      hashPendiente = { usuario: r.usuario, hash: r.hash };
      $['hash-valor'].textContent = '•'.repeat(64);
      $['hash-valor'].classList.add('oculto');
      $['hash-ver'].setAttribute('aria-pressed', 'false');
      $['hash-ver'].textContent = 'Ver hash';
      $['hash-copiado'].textContent = '';
      pantallaRegistro('hash-admin');
      $['hash-ver'].focus();
    } else {
      iniciar(r.usuario);
    }
  } catch (err) {
    if (err.datos.admin_existe) { hayAdmin = true; pantallaRegistro('admin-existe'); }
    else error(f, err.message);
  } finally {
    ocupado(f, false);
  }
}

async function olvidoUsuario(e) {
  e.preventDefault();
  const f = e.target;
  if (!f.usuario.value.trim()) return error(f, 'Escribe tu nombre de usuario.');
  ocupado(f, true);
  try {
    const r = await api('/recuperar/pregunta', { metodo: 'POST', datos: { usuario: f.usuario.value.trim() } });
    error(f, '');
    usuarioRecuperando = r.usuario;
    $['olvido-pregunta'].textContent = r.pregunta;
    const f2 = $['form-olvido-respuesta'];
    f2.reset();
    error(f2, '');
    pintarFuerza(f2);
    pantallaEntrar('olvido-respuesta');
  } catch (err) {
    error(f, err.message);
  } finally {
    ocupado(f, false);
  }
}

async function olvidoRespuesta(e) {
  e.preventDefault();
  const f = e.target;
  const d = Object.fromEntries(new FormData(f));
  if (!d.respuesta.trim()) return error(f, 'Escribe tu respuesta.');
  if (d.clave.length < 8) return error(f, 'La contraseña nueva debe tener al menos 8 caracteres.');
  if (d.clave !== d.confirmar) return error(f, 'Las contraseñas no coinciden.');
  ocupado(f, true);
  try {
    const r = await api('/recuperar', { metodo: 'POST', datos: { usuario: usuarioRecuperando, respuesta: d.respuesta, clave: d.clave } });
    f.reset();
    usuarioRecuperando = null;
    pantallaEntrar('entrar');
    $['form-entrar'].usuario.value = r.usuario;
    $['entrar-ok'].textContent = 'Contraseña actualizada. Ya puedes iniciar sesión.';
    $['form-entrar'].clave.focus();
  } catch (err) {
    f.respuesta.value = '';
    errorServidor(f, err);
  } finally {
    ocupado(f, false);
  }
}

// Muestra u oculta el modal y bloquea (inert) el resto de la página
function actualizar() {
  const bloquear = !sesion;
  $['modal-sesion'].hidden = !bloquear;
  document.querySelectorAll('body > :not(#modal-sesion):not(script):not(#aviso-servidor):not(#aviso-carga)')
    .forEach(el => el.toggleAttribute('inert', bloquear));
  document.body.classList.toggle('sin-sesion', bloquear);

  $['usuario-barra'].hidden = !sesion;
  $['usuario-nombre'].textContent = sesion ? sesion.usuario : '';
  $['etiqueta-admin'].hidden = sesion?.rol !== 'admin';
  document.querySelectorAll('[data-solo-admin]').forEach(el => { el.hidden = sesion?.rol !== 'admin'; });

  if (bloquear) seleccionarTab('entrar');
  document.dispatchEvent(new CustomEvent('sesion:cambio', { detail: sesion }));
}

export async function init() {
  $ = new Proxy({}, { get: (_, id) => document.getElementById(id) });

  // Pestañas (clic y flechas)
  $['tab-entrar'].addEventListener('click', () => seleccionarTab('entrar'));
  $['tab-registro'].addEventListener('click', () => seleccionarTab('registro'));
  document.querySelector('.pestanas').addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      seleccionarTab($['tab-entrar'].getAttribute('aria-selected') === 'true' ? 'registro' : 'entrar', true);
    }
  });

  // Navegación interna del modal
  $['modal-sesion'].addEventListener('click', e => {
    const b = e.target.closest('[data-pantalla]');
    if (!b) return;
    const p = b.dataset.pantalla;
    if (p === 'elegir-rol') { pantallaRegistro('elegir-rol'); refrescarEstado(); }
    else if (p === 'entrar') seleccionarTab('entrar', true);
    else pantallaEntrar(p);
  });
  document.querySelectorAll('.rol').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.rol === 'admin' && hayAdmin) pantallaRegistro('admin-existe');
    else configurarRegistro(b.dataset.rol);
  }));

  ['form-registro', 'form-olvido-respuesta'].forEach(id => {
    $[id].clave.addEventListener('input', () => pintarFuerza($[id]));
  });

  $['form-entrar'].addEventListener('submit', entrar);
  $['form-registro'].addEventListener('submit', registrar);
  $['form-olvido-usuario'].addEventListener('submit', olvidoUsuario);
  $['form-olvido-respuesta'].addEventListener('submit', olvidoRespuesta);

  // Hash del admin: ver/ocultar, copiar y continuar
  $['hash-ver'].addEventListener('click', () => {
    if (!hashPendiente) return;
    const ver = $['hash-ver'].getAttribute('aria-pressed') !== 'true';
    $['hash-ver'].setAttribute('aria-pressed', ver);
    $['hash-ver'].textContent = ver ? 'Ocultar hash' : 'Ver hash';
    $['hash-valor'].textContent = ver ? hashPendiente.hash : '•'.repeat(64);
    $['hash-valor'].classList.toggle('oculto', !ver);
  });
  $['hash-copiar'].addEventListener('click', async () => {
    if (!hashPendiente) return;
    try {
      await navigator.clipboard.writeText(hashPendiente.hash);
      $['hash-copiado'].textContent = 'Copiado';
    } catch (e) {
      $['hash-copiado'].textContent = 'No se pudo copiar; usa “Ver hash” y cópialo a mano.';
    }
  });
  $['hash-continuar'].addEventListener('click', () => {
    const u = hashPendiente?.usuario;
    hashPendiente = null;
    $['hash-valor'].textContent = '';
    if (u) iniciar(u);
  });

  $['cerrar-sesion'].addEventListener('click', cerrar);

  // Estado inicial desde el servidor (la cookie de sesión la manda el navegador)
  try {
    const [estado, { preguntas }] = await Promise.all([api('/sesion'), api('/preguntas')]);
    sesion = estado.usuario;
    hayAdmin = estado.hay_admin;
    $['registro-pregunta'].innerHTML = preguntas.map(p => `<option value="${Number(p.id)}">${esc(p.texto)}</option>`).join('');
  } catch (e) {
    sesion = null;
    $['registro-pregunta'].innerHTML = '<option value="">No se pudieron cargar las preguntas</option>';
  }
  actualizar();
}
