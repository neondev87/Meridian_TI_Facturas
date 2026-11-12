// Sistema de vistas por hash (#inicio, #servicio/<id>, #mision, #cotizador, #admin) sin recargar la página.
import { obtenerSesion, esAdmin } from './sesion.js';
import { mostrarServicio } from './catalogo.js';

const VISTAS = ['inicio', 'servicio', 'mision', 'cotizador', 'admin'];
const TITULOS = {
  inicio: 'Meridian TI | Servicios de TI con factura incluida',
  mision: 'Misión y visión | Meridian TI',
  cotizador: 'Facturación | Meridian TI',
  admin: 'Usuarios | Meridian TI'
};
let actual = null;

function resolver() {
  const hash = decodeURIComponent(location.hash.slice(1));
  let [vista, param] = hash.split('/');
  let ancla = null;

  // Un hash que no es vista (#servicios, #proceso...) es un ancla dentro del inicio
  if (!VISTAS.includes(vista)) {
    const el = hash && document.getElementById(hash);
    ancla = el && el.closest('[data-vista="inicio"]') ? el : null;
    vista = 'inicio';
  }

  // Sin sesión solo se ve el inicio (detrás del modal); #admin es solo para el administrador
  if (vista !== 'inicio' && !obtenerSesion()) vista = 'inicio';
  if (vista === 'admin' && !esAdmin()) vista = 'inicio';
  if (vista === 'servicio' && !mostrarServicio(param)) {
    vista = 'inicio';
    ancla = document.getElementById('servicios');
  }

  const cambio = vista !== actual;
  document.querySelectorAll('[data-vista]').forEach(v => { v.hidden = v.dataset.vista !== vista; });
  if (vista !== 'servicio') document.title = TITULOS[vista];

  // Enlace activo del menú
  document.querySelectorAll('#menu a').forEach(a => {
    if (a.getAttribute('href') === '#' + vista) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  if (ancla) {
    ancla.scrollIntoView({ block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Mover el foco al título de la vista (solo después de la carga inicial)
    if (actual !== null && (cambio || vista === 'servicio')) {
      document.querySelector(`[data-vista="${vista}"] [data-foco]`)?.focus({ preventScroll: true });
    }
  }

  actual = vista;
  document.dispatchEvent(new CustomEvent('vista:cambio', { detail: { vista, param } }));
}

export function init() {
  window.addEventListener('hashchange', resolver);
  document.addEventListener('sesion:cambio', resolver);
  document.addEventListener('catalogo:listo', resolver); // Tras "Reintentar" en el catálogo
  resolver();
}
