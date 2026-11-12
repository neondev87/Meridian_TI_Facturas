// Menú móvil: abre/cierra la navegación con el botón y la cierra al elegir un enlace.
export function init() {
  const burger = document.querySelector('.burger');
  const menu = document.getElementById('menu');
  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
  });
  menu.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      menu.classList.remove('open');
      burger.setAttribute('aria-expanded', false);
    }
  });
}
