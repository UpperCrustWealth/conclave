// Accessible type-ahead over a lazily loaded name list.
// Ranking: starts-with > word-starts-with > contains > in-order letters.
function score(name, q) {
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 4;
  if (n.split(/[\s.\-]+/).some((w) => w.startsWith(q))) return 3;
  if (n.includes(q)) return 2;
  let i = 0;
  for (const ch of q) { i = n.indexOf(ch, i); if (i === -1) return 0; i++; }
  return 1;
}

function highlight(el, name, q) {
  const n = name.toLowerCase();
  const at = n.indexOf(q);
  el.textContent = '';
  if (at >= 0) {
    el.append(name.slice(0, at));
    const b = document.createElement('b'); b.textContent = name.slice(at, at + q.length);
    el.append(b, name.slice(at + q.length));
  } else {
    el.textContent = name;
  }
}

export function attachAutocomplete(input, list, { load, onPick }) {
  let names = null;
  let items = [];
  let active = -1;
  const ensure = () => (names ? Promise.resolve(names) : load().then((n) => (names = n)));

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);
  list.setAttribute('role', 'listbox');

  function close() { list.hidden = true; list.textContent = ''; items = []; active = -1; input.setAttribute('aria-expanded', 'false'); }
  function setActive(i) {
    active = i;
    items.forEach((el, k) => el.setAttribute('aria-selected', String(k === i)));
    if (items[i]) { items[i].scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', items[i].id); }
  }
  function pick(name) { input.value = name; close(); onPick(name); }

  async function render() {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) return close();
    const all = await ensure();
    const matches = all.map((n) => [n, score(n, q)]).filter((m) => m[1] > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
    if (!matches.length) return close();
    list.textContent = '';
    items = matches.map(([name], i) => {
      const el = document.createElement('div');
      el.className = 'ac-item'; el.id = list.id + '-' + i; el.setAttribute('role', 'option');
      highlight(el, name, q);
      el.addEventListener('mousedown', (e) => { e.preventDefault(); pick(name); });
      list.appendChild(el);
      return el;
    });
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); active = -1;
  }

  input.addEventListener('focus', ensure, { once: true });
  input.addEventListener('input', render);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); e.stopImmediatePropagation(); pick(items[active].textContent); }
    else if (e.key === 'Escape') close();
  });
  return { preload: ensure };
}
