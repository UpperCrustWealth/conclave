// One-question-at-a-time wizard with history-aware Back and a progress bar.
export function createStepper(form, { total, onShow }) {
  const steps = Array.from(form.querySelectorAll('[data-step]'));
  const byName = Object.fromEntries(steps.map((s) => [s.dataset.step, s]));
  const fill = form.querySelector('.progress-bar i');
  const text = form.querySelector('.progress-text');
  const backBtn = form.querySelector('[data-back]');
  const history = [];
  let current = null;

  function render() {
    const t = typeof total === 'function' ? total(current) : total;
    const i = Math.min(history.length + 1, t);
    if (fill) fill.style.width = (i / t) * 100 + '%';
    if (text) text.textContent = 'Step ' + i + ' of ' + t;
    if (backBtn) backBtn.hidden = history.length === 0;
  }

  // keep the card's top in view when a step changes height
  function keepInView() {
    const card = form.closest('.rsvp-card') || form;
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 70;
    const top = card.getBoundingClientRect().top;
    if (top < navH) window.scrollBy({ top: top - navH - 12, behavior: 'smooth' });
  }

  function focusStep(step) {
    const target = step.querySelector('input:not([type=hidden]):not([disabled])') || step.querySelector('.q');
    if (target) setTimeout(() => target.focus({ preventScroll: true }), 60);
  }

  function show(name, { push = true, focus = true } = {}) {
    if (!byName[name]) return;
    if (current && push && current !== name) history.push(current);
    current = name;
    steps.forEach((s) => {
      const on = s.dataset.step === name;
      s.hidden = !on;
      s.classList.toggle('is-active', on);
    });
    render();
    if (onShow) onShow(name);
    if (focus) { keepInView(); focusStep(byName[name]); }
  }

  function back() {
    const prev = history.pop();
    if (prev) show(prev, { push: false });
  }
  if (backBtn) backBtn.addEventListener('click', back);

  return {
    show, back, render,
    get current() { return current; },
    reset(first) { history.length = 0; current = null; show(first, { push: false, focus: false }); },
    step: (name) => byName[name],
  };
}

// Pick-one option groups: <div class="opts" data-field="x"><button class="opt" data-value="…">
export function selectOption(btn) {
  const group = btn.closest('[data-field]');
  group.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-pressed', String(o === btn)));
  return { field: group.dataset.field, value: btn.dataset.value };
}
export function clearOptions(scope) {
  scope.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-pressed', 'false'));
}
