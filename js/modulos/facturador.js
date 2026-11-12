// Facturación: formulario unificado, conceptos del carrito, factura creada y guardada por el servidor, historial e impresión.
import { api } from './api.js';
import { obtenerCarrito, recargar as recargarCarrito } from './carrito.js';
import { usuarioActual, whatsappValido, limpiarWhatsapp } from './sesion.js';
import { money, esc, fechaLarga } from './utilidades.js';

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
const PLACEHOLDER = '<p class="ph">Tu factura aparecerá aquí.</p>';
const TIPOS = { factura: 'Factura', solicitud: 'Solicitud de cotización' };
let mostrada = false; // Hay un documento en pantalla (para imprimir)

const $ = id => document.getElementById(id);
const pct = tasa => Math.round(tasa * 100);

// ---------- Conceptos del carrito (totales del servidor) ----------
function pintarConceptos() {
  const c = obtenerCarrito();

  $('form-resumen').innerHTML = c.items.length
    ? `<p>Facturarás <strong>${c.piezas} servicio(s)</strong> por <strong>${money(c.total)} MXN</strong> con IVA. <a href="#cotizador">Ver detalle</a></p>`
    : `<p>Tu carrito está vacío: se generará una <strong>solicitud de cotización</strong> con tu mensaje. <a href="#servicios">Ver servicios</a></p>`;

  $('factura-conceptos').innerHTML = c.items.length
    ? `<table class="tabla tabla-conceptos">
        <caption class="sr-only">Conceptos del carrito</caption>
        <thead><tr><th scope="col">Concepto</th><th scope="col">Cant.</th><th scope="col">Importe</th></tr></thead>
        <tbody>${c.items.map(l => `<tr><td>${esc(l.nombre)}</td><td>${l.cantidad}</td><td>${money(l.importe)}</td></tr>`).join('')}</tbody>
        <tfoot>
          <tr><td colspan="2">Subtotal</td><td>${money(c.subtotal)}</td></tr>
          <tr><td colspan="2">IVA ${pct(c.iva_tasa ?? 0.16)}%</td><td>${money(c.iva)}</td></tr>
          <tr class="tot"><td colspan="2">Total</td><td>${money(c.total)}</td></tr>
        </tfoot>
      </table>`
    : '<p class="ph">Tu carrito está vacío. <a class="link" href="#servicios">Elige servicios</a> o envía solo tu mensaje como solicitud de cotización.</p>';
}

// ---------- Datos del usuario con sesión ----------
function precargar() {
  const f = $('form-factura');
  const u = usuarioActual();
  if (!u) {
    f.reset();
    $('ferr').textContent = '';
    $('resultado').innerHTML = PLACEHOLDER;
    $('mis-facturas').innerHTML = '';
    mostrada = false;
    return;
  }
  f.nombre.value = u.usuario;
  if (u.correo) f.correo.value = u.correo;
  if (u.whatsapp) f.whatsapp.value = u.whatsapp;
}

// El mismo formulario vive en el inicio o en la vista de facturación según la vista activa
function moverFormulario(vista) {
  const destino = document.querySelector(`[data-ranura="${vista === 'cotizador' ? 'cotizador' : 'inicio'}"]`);
  const bloque = $('bloque-formulario');
  if (bloque.parentElement !== destino) destino.append(bloque);
}

// ---------- Documento (datos tal como los guardó el servidor) ----------
function documentoHTML(d) {
  const tabla = d.conceptos.length
    ? `<table>
        <thead><tr><th scope="col">Concepto</th><th scope="col">Cant.</th><th scope="col">P. unit.</th><th scope="col">Importe</th></tr></thead>
        <tbody>${d.conceptos.map(l => `<tr><td>${esc(l.nombre)}</td><td>${l.cantidad}</td><td>${money(l.precio)}</td><td>${money(l.importe)}</td></tr>`).join('')}</tbody>
        <tfoot>
          <tr><td colspan="3">Subtotal</td><td>${money(d.subtotal)}</td></tr>
          <tr><td colspan="3">IVA ${pct(d.iva_tasa)}%</td><td>${money(d.iva)}</td></tr>
          <tr class="tot"><td colspan="3">Total</td><td>${money(d.total)}</td></tr>
        </tfoot>
      </table>`
    : '<p class="doc-vacio">Sin conceptos: solicitud de cotización. Te responderemos con una propuesta por escrito.</p>';
  return `
  <article class="doc" id="fdoc" aria-labelledby="fdoc-titulo">
    <div class="inv-head">
      <h2 id="fdoc-titulo" tabindex="-1">${TIPOS[d.tipo] || 'Factura'}</h2>
      <span>Folio ${esc(d.folio)}<br>${fechaLarga(d.fecha)}</span>
    </div>
    <div class="meta">
      <p><strong>Emisor</strong><br>${esc(d.emisor.nombre)}<br>${esc(d.emisor.rfc)}</p>
      <p><strong>Cliente</strong><br>${esc(d.cliente.nombre)}<br>${esc(d.cliente.rfc || 'Sin RFC')}<br>${esc(d.cliente.correo)}<br>WhatsApp: +${esc(d.cliente.whatsapp)}</p>
    </div>
    ${tabla}
    ${d.mensaje ? `<p class="doc-mensaje"><strong>Mensaje:</strong> ${esc(d.mensaje)}</p>` : ''}
    <p class="legal">Comprobante de venta generado desde el sitio. Para validez fiscal ante la autoridad, el emisor debe timbrar la factura con su proveedor autorizado.</p>
  </article>
  <div class="doc-actions">
    <button class="btn" type="button" data-accion="imprimir">Imprimir o guardar PDF</button>
  </div>`;
}

function mostrarDocumento(factura) {
  $('resultado').innerHTML = documentoHTML(factura);
  mostrada = true;
  const enfocar = () => {
    $('resultado').scrollIntoView({ block: 'start' });
    $('fdoc-titulo').focus({ preventScroll: true });
  };
  if (location.hash !== '#cotizador') {
    document.addEventListener('vista:cambio', () => requestAnimationFrame(enfocar), { once: true });
    location.hash = '#cotizador';
  } else {
    enfocar();
  }
}

// ---------- Historial ----------
async function cargarHistorial() {
  if (!usuarioActual()) return;
  const caja = $('mis-facturas');
  try {
    const { facturas } = await api('/facturas');
    caja.innerHTML = facturas.length
      ? `<ul class="lista-facturas">${facturas.map(f => `
          <li><button class="link-boton" type="button" data-folio="${esc(f.folio)}">${esc(f.folio)}</button>
          <span>${TIPOS[f.tipo]}</span><span>${fechaLarga(f.fecha)}</span><span>${money(f.total)}</span></li>`).join('')}</ul>`
      : '<p class="ph">Aún no has generado facturas.</p>';
  } catch (e) {
    caja.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

// ---------- Generar ----------
async function generar(e) {
  e.preventDefault();
  const f = e.target, err = $('ferr');
  const d = Object.fromEntries(new FormData(f));
  const rfc = d.rfc.trim().toUpperCase();

  if (!d.nombre.trim()) return (err.textContent = 'Escribe tu nombre o razón social.');
  if (!RE_CORREO.test(d.correo.trim())) return (err.textContent = 'Escribe un correo válido.');
  if (!whatsappValido(d.whatsapp)) return (err.textContent = 'Escribe tu WhatsApp con lada de país, solo números. Ej.: 528112345678.');
  if (rfc && !RE_RFC.test(rfc)) return (err.textContent = 'El RFC no tiene un formato válido (12 o 13 caracteres). Puedes dejarlo vacío.');
  if (!obtenerCarrito().items.length && !d.mensaje.trim()) return (err.textContent = 'Tu carrito está vacío: agrega servicios o escribe un mensaje para pedir tu cotización.');
  err.textContent = '';

  const boton = f.querySelector('button[type=submit]');
  boton.disabled = true;
  boton.textContent = 'Generando…';
  try {
    // El servidor toma los conceptos y precios del carrito guardado y calcula subtotal, IVA y total
    const { factura } = await api('/facturas', {
      metodo: 'POST',
      datos: { nombre: d.nombre.trim(), correo: d.correo.trim(), whatsapp: limpiarWhatsapp(d.whatsapp), rfc, mensaje: d.mensaje.trim() }
    });
    f.mensaje.value = '';
    mostrarDocumento(factura);
    await recargarCarrito();   // El servidor vació el carrito al facturar
    cargarHistorial();
  } catch (e2) {
    err.textContent = e2.message;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Generar factura';
  }
}

async function acciones(e) {
  const imprimir = e.target.closest('[data-accion="imprimir"]');
  if (imprimir && mostrada) window.print();
}

async function abrirFolio(e) {
  const b = e.target.closest('[data-folio]');
  if (!b) return;
  try {
    const { factura } = await api(`/facturas/${encodeURIComponent(b.dataset.folio)}`);
    mostrarDocumento(factura);
  } catch (e2) {
    $('mis-facturas').insertAdjacentHTML('afterbegin', `<p class="err">${esc(e2.message)}</p>`);
  }
}

export function init() {
  $('form-factura').addEventListener('submit', generar);
  $('resultado').addEventListener('click', acciones);
  $('mis-facturas').addEventListener('click', abrirFolio);
  document.addEventListener('sesion:cambio', () => { precargar(); cargarHistorial(); });
  document.addEventListener('carrito:cambio', pintarConceptos);
  document.addEventListener('vista:cambio', e => {
    moverFormulario(e.detail.vista);
    if (e.detail.vista === 'cotizador') cargarHistorial();
  });
  precargar();
  pintarConceptos();
}
