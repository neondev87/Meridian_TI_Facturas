// Catálogo desde la API: pinta las 4 tarjetas del inicio, la vista de cada servicio con sus subservicios y las empresas de Misión y visión.
import { api } from './api.js';
import { money, esc, ICONO_CARRITO } from './utilidades.js';

let categorias = [];

const buscarCategoria = clave => categorias.find(c => c.clave === clave);

function pintarTarjetas() {
  document.getElementById('tarjetas-servicios').innerHTML = categorias.map(c => `
    <a class="card card-servicio" href="#servicio/${encodeURIComponent(c.clave)}">
      <img src="${esc(c.imagen)}" alt="" width="240" height="160" loading="lazy">
      <h3>${esc(c.nombre)}</h3>
      <p>${esc(c.resumen)}</p>
      <span class="card-mas">Ver opciones <span aria-hidden="true">→</span></span>
    </a>`).join('');
}

function errorCarga(contenedor, mensaje) {
  contenedor.innerHTML = `<div class="ph error-carga"><p>${esc(mensaje)}</p><button class="btn btn-line btn-sm" type="button" data-reintentar>Reintentar</button></div>`;
}

async function cargarCategorias() {
  const caja = document.getElementById('tarjetas-servicios');
  caja.innerHTML = '<p class="ph">Cargando servicios…</p>';
  try {
    categorias = (await api('/categorias')).categorias;
    pintarTarjetas();
  } catch (e) {
    categorias = [];
    errorCarga(caja, `No se pudieron cargar los servicios. ${e.message}`);
  }
}

async function cargarEmpresas() {
  const lista = document.getElementById('empresas');
  try {
    const { empresas } = await api('/empresas');
    lista.innerHTML = empresas.map(e => `<li><strong>${esc(e.nombre)}</strong><span>${esc(e.sector)}</span></li>`).join('');
  } catch (e) {
    lista.innerHTML = `<li><span>No se pudo cargar la lista de empresas. ${esc(e.message)}</span></li>`;
  }
}

// Devuelve false si la clave no existe, para que vistas.js regrese al inicio
export function mostrarServicio(clave) {
  const c = buscarCategoria(clave);
  if (!c) return false;
  document.title = `${c.nombre} | Meridian TI`;
  document.getElementById('servicio-detalle').innerHTML = `
    <header class="servicio-cabeza">
      <div>
        <p class="eyebrow">Servicios</p>
        <h1 tabindex="-1" data-foco>${esc(c.nombre)}</h1>
        <p class="lead">${esc(c.resumen)}</p>
      </div>
      <img src="${esc(c.imagen)}" alt="" width="240" height="160">
    </header>
    <ul class="subservicios">
      ${c.servicios.map(s => `
      <li class="subservicio${s.imagen ? ' con-img' : ''}">
        ${s.imagen ? `<img src="${esc(s.imagen)}" alt="" width="240" height="160" loading="lazy">` : ''}
        <div class="subservicio-info">
          <h2>${esc(s.nombre)}</h2>
          <p>${esc(s.descripcion)}</p>
        </div>
        <div class="subservicio-compra">
          <p class="precio">${money(s.precio)} <span>MXN + IVA</span></p>
          <button class="btn btn-agregar" type="button" data-agregar="${esc(s.clave)}" aria-label="Agregar ${esc(s.nombre)} al carrito">${ICONO_CARRITO}<span>Agregar</span></button>
        </div>
      </li>`).join('')}
    </ul>`;
  return true;
}

export async function init() {
  document.getElementById('tarjetas-servicios').addEventListener('click', async e => {
    if (!e.target.closest('[data-reintentar]')) return;
    await cargarCategorias();
    document.dispatchEvent(new CustomEvent('catalogo:listo'));
  });
  await Promise.all([cargarCategorias(), cargarEmpresas()]);
}
