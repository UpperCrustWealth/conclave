// ?client=1&name=<PMS name>  → existing-client RSVP, personalized to that name/family only.
// &hi=<greeting name>        → how we greet them on the page (falls back to a tidied &name)
// client=1 WITHOUT a name is intentionally NOT treated as client mode: there is no
// generic client link that lets a visitor search or type in any name. Every client
// link is personal, pre-filled from the sheet — never an open lookup over the full
// client list, since that would expose every other client's name to whoever has it.
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
    isClient: p.get('client') === '1' && !!name,
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
  document.querySelectorAll('[data-greet-inline]').forEach((el) => { el.textContent = mode.greet; });
  document.title = 'Namaste, ' + mode.greet + ", you're invited | Wealth Conclave ’26";
}
