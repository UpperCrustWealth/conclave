// Quiet, per-minute countdown in words (no ticking seconds).
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

export function initCountdown(el, startIso, endIso) {
  if (!el) return;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  const tick = () => {
    const now = Date.now();
    if (now >= end) { el.hidden = true; return false; }
    if (now >= start) { el.textContent = 'The Conclave is under way'; return true; }
    const mins = Math.ceil((start - now) / 60000);
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    const parts = d > 0 ? [plural(d, 'day'), h ? plural(h, 'hour') : ''] : [h ? plural(h, 'hour') : '', plural(m, 'minute')];
    el.textContent = 'Doors open in ' + parts.filter(Boolean).join(' and ');
    return true;
  };
  if (tick()) setInterval(tick, 60000);
}
