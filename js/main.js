// Punto de entrada: inicia los módulos en orden (sesión y catálogo desde la API primero, vistas al final) y avisa si alguno falla.
import { init as initApi } from './modulos/api.js';
import { init as initUtilidades } from './modulos/utilidades.js';
import { init as initMenu } from './modulos/menu.js';
import { init as initSesion } from './modulos/sesion.js';
import { init as initCatalogo } from './modulos/catalogo.js';
import { init as initCarrito } from './modulos/carrito.js';
import { init as initFacturador } from './modulos/facturador.js';
import { init as initAdmin } from './modulos/admin.js';
import { init as initVistas } from './modulos/vistas.js';

// Si este archivo se ejecuta, todos los módulos se descargaron bien (la guardia de index.html ya no avisa)
window.meridianListo = true;

async function iniciar(nombre, init) {
  try {
    await init();
  } catch (e) {
    console.error(`Meridian TI: no se pudo iniciar el módulo "${nombre}".`, e);
  }
}

await iniciar('api', initApi);
await iniciar('utilidades', initUtilidades);
await iniciar('menu', initMenu);
// Sesión y catálogo se piden al servidor en paralelo; sus fallas de red ya muestran un aviso amable
await Promise.all([iniciar('sesion', initSesion), iniciar('catalogo', initCatalogo)]);
await iniciar('facturador', initFacturador);
await iniciar('carrito', initCarrito);
await iniciar('admin', initAdmin);
await iniciar('vistas', initVistas);
