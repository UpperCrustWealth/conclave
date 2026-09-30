// ?client=1                 → existing-client RSVP
// &name=<PMS name>          → recorded as the PMS name; skips the name questions
// &hi=<greeting name>       → how we greet them on the page (falls back to a tidied &name)
// The html.mode-client class is set by an inline script in <head> (no flash).
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);

// "Akash Patel-70846" → "Akash Patel"; "PATEL PALAK" → "Patel Palak"
export function tidyName(raw) {
  let n = clean(raw).replace(/[-\s]*\d{3,}$/, '').trim();
  if (n === n.toUpperCase() || n === n.toLowerCase()) {
    n = n.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  }
  return n;
}

export function getMode() {
  const p = new URLSearchParams(location.search);
  const name = clean(p.get('name'));
  return {
    isClient: p.get('client') === '1',
    name,
    greet: clean(p.get('hi')) || tidyName(name),
  };
}

export function applyGreeting(mode) {
  if (!mode.isClient || !mode.greet) return;
  const hero = document.querySelector('[data-greeting]');
  if (hero) {
    hero.querySelector('[data-greet-name]').textContent = mode.greet;
    hero.hidden = false;
  }
  document.querySelectorAll('[data-greet-inline]').forEach((el) => { el.textContent = mode.greet + ', '; });
  document.title = mode.greet + ", you're invited | Wealth Conclave ’26";
}
