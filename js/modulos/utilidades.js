// Utilidades compartidas: formato de moneda y fecha, escape de HTML, avisos accesibles, ícono del carrito y año del pie.

export const money = n => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fechaLarga = d => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

// Mensaje para lectores de pantalla (región #aviso-global)
export function anunciar(texto) {
  const r = document.getElementById('aviso-global');
  if (!r) return;
  r.textContent = '';
  setTimeout(() => { r.textContent = texto; }, 60);
}

export const ICONO_CARRITO = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="20" r="1.3" fill="currentColor"/><circle cx="17" cy="20" r="1.3" fill="currentColor"/></svg>';

// Año del pie de página
export function init() {
  document.getElementById('anio').textContent = new Date().getFullYear();
}
