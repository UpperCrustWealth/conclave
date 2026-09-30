// Bottom booking bar: visible between the hero and the form, never over either.
export function initDock() {
  const dock = document.querySelector('[data-dock]');
  if (!dock || !('IntersectionObserver' in window)) return;
  const link = dock.querySelector('a');
  const watched = ['[data-hero]', '#register', '.footer'].map((s) => document.querySelector(s)).filter(Boolean);
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    const on = visible.size === 0;
    dock.classList.toggle('is-on', on);
    dock.setAttribute('aria-hidden', String(!on));
    link.tabIndex = on ? 0 : -1;
  });
  watched.forEach((el) => io.observe(el));
}
