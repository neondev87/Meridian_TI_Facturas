// Carrito guardado en la base SQLite vía API: agrega, cambia cantidades y quita; subtotal, IVA 16 % y total los calcula el servidor.
import { api } from './api.js';
import { obtenerSesion } from './sesion.js';
import { money, esc, anunciar } from './utilidades.js';

const MAX_CANT = 99;
const VACIO = { items: [], piezas: 0, subtotal: 0, iva: 0, total: 0 };
const movil = window.matchMedia('(max-width: 1000px)');
const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
let estado = VACIO;
let cola = Promise.resolve();   // Las operaciones van en fila para que las respuestas no lleguen desordenadas

const $ = id => document.getElementById(id);

// ---------- API para otros módulos ----------
export const obtenerCarrito = () => estado;

function aplicar(nuevo) {
  estado = nuevo || VACIO;
  pintar();
  document.dispatchEvent(new CustomEvent('carrito:cambio'));
}

// Encola una operación contra el servidor; los errores se muestran en el panel
function operar(fn) {
  cola = cola.then(async () => {
    $('carrito-error').textContent = '';
    try {
      aplicar(await fn());
      return true;
    } catch (e) {
      $('carrito-error').textContent = e.message;
      anunciar(e.message);
      return false;
    }
  });
  return cola;
}

export const recargar = () => (obtenerSesion() ? operar(() => api('/carrito')) : (aplicar(VACIO), Promise.resolve(true)));

const agregar = clave => operar(() => api('/carrito/items', { metodo: 'POST', datos: { servicio: clave } }));

function cambiar(clave, delta) {
  return operar(() => {
    const item = estado.items.find(i => i.clave === clave);
    if (!item) return api('/carrito');
    const cantidad = Math.min(MAX_CANT, item.cantidad + delta);
    return cantidad < 1
      ? api(`/carrito/items/${encodeURIComponent(clave)}`, { metodo: 'DELETE' })
      : api(`/carrito/items/${encodeURIComponent(clave)}`, { metodo: 'PATCH', datos: { cantidad } });
  });
}

const quitar = clave => operar(() => api(`/carrito/items/${encodeURIComponent(clave)}`, { metodo: 'DELETE' }));

// ---------- Panel ----------
function pintar() {
  // Conservar el foco en el mismo botón después de repintar
  const activo = document.activeElement;
  const attr = activo && ['data-mas', 'data-menos', 'data-quitar'].find(a => activo.hasAttribute && activo.hasAttribute(a));
  const foco = attr ? `[${attr}="${CSS.escape(activo.getAttribute(attr))}"]` : null;

  $('carrito-lista').innerHTML = estado.items.map(l => `
    <li class="carrito-item">
      <div class="carrito-item-info">
        <p class="carrito-item-nombre">${esc(l.nombre)}</p>
        <p class="carrito-item-precio">${money(l.precio)} c/u</p>
      </div>
      <div class="cantidad" role="group" aria-label="Cantidad de ${esc(l.nombre)}">
        <button type="button" data-menos="${esc(l.clave)}" aria-label="Quitar uno">−</button>
        <span>${l.cantidad}</span>
        <button type="button" data-mas="${esc(l.clave)}" aria-label="Agregar uno"${l.cantidad >= MAX_CANT ? ' disabled' : ''}>+</button>
      </div>
      <p class="carrito-item-importe">${money(l.importe)}</p>
      <button type="button" class="carrito-quitar" data-quitar="${esc(l.clave)}" aria-label="Quitar ${esc(l.nombre)} del carrito">Quitar</button>
    </li>`).join('');

  $('carrito-vacio').hidden = estado.items.length > 0;
  $('carrito-subtotal').textContent = money(estado.subtotal);
  $('carrito-iva').textContent = money(estado.iva);
  $('carrito-total').textContent = money(estado.total);
  $('carrito-finalizar').disabled = !estado.items.length;
  document.querySelectorAll('[data-carrito-contador]').forEach(c => { c.textContent = estado.piezas; });
  $('carrito-boton').setAttribute('aria-label', `Carrito: ${estado.piezas} servicio(s)`);

  if (foco) (document.querySelector(foco) || $('carrito-titulo')).focus();
}

function abrirPanel(abrir) {
  const panel = $('carrito-panel');
  const boton = $('carrito-boton');
  if (!movil.matches) {
    // En escritorio el panel siempre está visible: solo se lleva el foco
    panel.classList.remove('abierto');
    $('carrito-fondo').hidden = true;
    if (abrir) $('carrito-titulo').focus();
    return;
  }
  panel.classList.toggle('abierto', abrir);
  $('carrito-fondo').hidden = !abrir;
  boton.setAttribute('aria-expanded', abrir);
  if (abrir) $('carrito-titulo').focus();
  else if (panel.contains(document.activeElement)) boton.focus();
}

function confirmarAgregado(boton, nombre) {
  const texto = boton.querySelector('span');
  texto.textContent = 'Agregado';
  boton.classList.add('agregado');
  setTimeout(() => { texto.textContent = 'Agregar'; boton.classList.remove('agregado'); }, 1200);
  anunciar(`${nombre} agregado al carrito.`);
  const contador = document.querySelector('.carrito-boton .contador');
  if (contador.animate && !sinMovimiento.matches) {
    contador.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300 });
  }
}

export function init() {
  // Botones "Agregar" de la vista de servicio
  $('servicio-detalle').addEventListener('click', async e => {
    const b = e.target.closest('[data-agregar]');
    if (!b || !obtenerSesion()) return;
    const nombre = b.closest('.subservicio')?.querySelector('h2')?.textContent || 'Servicio';
    if (await agregar(b.dataset.agregar)) confirmarAgregado(b, nombre);
  });

  // Controles dentro del panel
  $('carrito-lista').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mas) cambiar(b.dataset.mas, 1);
    else if (b.dataset.menos) cambiar(b.dataset.menos, -1);
    else if (b.dataset.quitar) quitar(b.dataset.quitar);
  });

  $('carrito-finalizar').addEventListener('click', () => { location.hash = '#cotizador'; });
  $('carrito-boton').addEventListener('click', () => abrirPanel(!$('carrito-panel').classList.contains('abierto')));
  $('carrito-cerrar').addEventListener('click', () => abrirPanel(false));
  $('carrito-fondo').addEventListener('click', () => abrirPanel(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('carrito-panel').classList.contains('abierto')) abrirPanel(false);
  });
  document.addEventListener('vista:cambio', () => abrirPanel(false));
  movil.addEventListener('change', () => abrirPanel(false));

  // El carrito vive en la base: al entrar se carga y al salir solo se limpia la pantalla (no se borra)
  document.addEventListener('sesion:cambio', recargar);

  pintar();
  return recargar();
}
