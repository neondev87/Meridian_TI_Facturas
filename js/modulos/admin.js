// Vista de administrador: tabla de usuarios registrados desde la API (sin hashes ni respuestas de recuperación).
import { api } from './api.js';
import { esAdmin } from './sesion.js';
import { esc, fechaLarga } from './utilidades.js';

async function pintar() {
  const caja = document.getElementById('admin-usuarios');
  caja.innerHTML = '<p class="ph">Cargando usuarios…</p>';
  let lista;
  try {
    lista = (await api('/admin/usuarios')).usuarios;
  } catch (e) {
    caja.innerHTML = `<p class="ph">${esc(e.message)}</p>`;
    return;
  }
  if (!lista.length) { caja.innerHTML = '<p class="ph">Aún no hay usuarios registrados.</p>'; return; }
  caja.innerHTML = `
    <table class="tabla">
      <caption class="sr-only">Usuarios registrados</caption>
      <thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Correo</th><th scope="col">WhatsApp</th><th scope="col">Fecha de registro</th></tr></thead>
      <tbody>
        ${lista.map(u => `<tr>
          <td>${esc(u.usuario)}</td>
          <td>${u.rol === 'admin' ? '<span class="etiqueta-admin">Admin</span>' : 'Usuario'}</td>
          <td>${esc(u.correo || '—')}</td>
          <td>${u.whatsapp ? '+' + esc(u.whatsapp) : '—'}</td>
          <td>${fechaLarga(u.fecha)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

export function init() {
  document.addEventListener('vista:cambio', e => { if (e.detail.vista === 'admin' && esAdmin()) pintar(); });
}
