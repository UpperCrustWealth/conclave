// Gold coin shower + full-screen thank-you. Resolves when the overlay has cleared.
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function coins(count) {
  const layer = document.createElement('div');
  layer.className = 'coin-shower';
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const c = document.createElement('i');
    c.className = 'shower-coin';
    const size = 12 + Math.random() * 14;
    c.style.cssText =
      'left:' + Math.random() * 100 + 'vw;width:' + size + 'px;height:' + size + 'px;' +
      'animation-duration:' + (2.2 + Math.random() * 1.6) + 's;animation-delay:' + Math.random() * 1.1 + 's;' +
      '--rot:' + (Math.random() > 0.5 ? 1 : -1) * (280 + Math.random() * 260) + 'deg';
    frag.appendChild(c);
  }
  layer.appendChild(frag);
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4300);
}

export function celebrate({ title = 'Thank you', text = '' } = {}) {
  const overlay = document.querySelector('[data-thanks]');
  overlay.querySelector('[data-thanks-title]').textContent = title;
  overlay.querySelector('[data-thanks-text]').textContent = text;
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('is-on'));
  if (!reduced()) {
    coins(window.innerWidth < 600 ? 34 : 46);
    setTimeout(() => coins(window.innerWidth < 600 ? 20 : 30), 400);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      overlay.classList.remove('is-on');
      setTimeout(() => { overlay.hidden = true; resolve(); }, 900);
    }, 4600);
  });
}
