// Navigation stays usable even if the 3D module cannot initialize.
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  nav.classList.remove('menu-open');
}
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('menu-open', open);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('menu-open')) {
    closeMenu(); menu.focus();
  }
});
document.addEventListener('click', (event) => {
  if (!nav.contains(event.target)) closeMenu();
});
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.hash);
    if (!target) return;
    event.preventDefault(); closeMenu();
    history.pushState(null, '', link.hash);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: link.hash === '#top' ? 0 : target.offsetTop, behavior: reduced ? 'instant' : 'smooth' });
  });
});
const loadingFallback = window.setTimeout(() => document.getElementById('loader').classList.add('done'), 5000);
import('./main.js?v=12').catch((error) => {
  console.warn('The 3D experience could not initialize. Showing the accessible page.', error);
  document.body.classList.add('scene-unavailable');
  document.getElementById('loader').classList.add('done');
  document.querySelector('.motion-toggle').hidden = true;
  document.querySelector('.assembly-control').hidden = true;
  document.querySelector('#anatomy .body').textContent = 'Precision-engineered systems, built around a lightweight aluminium structure.';
  document.querySelectorAll('.orbit-option').forEach((button) => {
    button.removeAttribute('aria-pressed');
    button.disabled = true;
  });
}).finally(() => window.clearTimeout(loadingFallback));
