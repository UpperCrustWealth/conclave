// Solid nav once the hero title has scrolled past; underline the section in view.
export function initNav() {
  const nav = document.querySelector('[data-nav]');
  const sentinel = document.querySelector('[data-hero-sentinel]');
  if (!nav || !sentinel || !('IntersectionObserver' in window)) { nav && nav.classList.add('is-solid'); return; }

  new IntersectionObserver(([e]) => nav.classList.toggle('is-solid', !e.isIntersecting)).observe(sentinel);

  const links = new Map(Array.from(nav.querySelectorAll('.nav-links a')).map((a) => [a.hash.slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const a = links.get(e.target.id);
      if (a) a.classList.toggle('is-current', e.isIntersecting);
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}
