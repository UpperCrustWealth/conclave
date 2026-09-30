// Public "Request an invitation" wizard.
// Order: three choice questions first, then name, mobile and email.
// Payload keys match apps-script/Code.gs (it already writes data.email), so no redeploy.
import { CONFIG } from '../config.js';
import { submit } from './api.js';
import { createStepper, selectOption, clearOptions } from './stepper.js';
import { celebrate } from './celebrate.js';
import { markDone, getDone, clearDone } from './done-state.js';

const PERSON = ['UpperCrust Wealth employee', 'Your friend'];
const FIRST = 'priority';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function initProspectForm() {
  const form = document.getElementById('prospectForm');
  const done = document.querySelector('[data-done="prospect"]');
  if (!form || !done) return;

  const $ = (s) => form.querySelector(s);
  const nextBtn = $('[data-next]');
  const nextLabel = nextBtn.querySelector('.lbl');
  const errorEl = $('[data-error]');
  const formError = $('[data-form-error]');
  const personBlock = $('[data-follow="person"]');
  const noneBlock = $('[data-follow="none"]');
  const refName = $('#referrerName');
  const fullName = $('#fullName');
  const phone = $('#phone');
  const email = $('#email');
  let data = {};
  let slowTimer = null;

  const stepper = createStepper(form, { total: 4, onShow: syncActions });

  function syncActions(name) {
    errorEl.textContent = '';
    nextBtn.hidden = !(name === 'contact' || (name === 'referral' && PERSON.includes(data.referredBy)));
    nextLabel.textContent = name === 'contact' ? 'Request invitation' : 'Continue';
  }
  function fail(msg, input) {
    errorEl.textContent = msg;
    if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
  }
  const advance = (name) => setTimeout(() => stepper.show(name), 260);

  form.addEventListener('click', (e) => {
    const opt = e.target.closest('.opt');
    if (!opt || !form.contains(opt)) return;
    const { field, value } = selectOption(opt);
    data[field] = value;
    errorEl.textContent = '';
    if (field === 'capitalPriority') advance('intent');
    else if (field === 'eveningIntent') advance('referral');
    else if (field === 'socialMedia') advance('contact');
    else if (field === 'referredBy') {
      const person = PERSON.includes(value);
      personBlock.hidden = !person;
      noneBlock.hidden = value !== 'None';
      if (value !== 'None') { data.socialMedia = ''; clearOptions(noneBlock); }
      nextBtn.hidden = !person;
      if (person) setTimeout(() => refName.focus(), 60);
    }
  });

  form.addEventListener('input', (e) => {
    if (e.target.matches('.input')) { e.target.removeAttribute('aria-invalid'); errorEl.textContent = ''; }
  });

  // keep only the 10 useful digits (+91, spaces, a leading 0 from autofill)
  phone.addEventListener('input', () => {
    let d = phone.value.replace(/\D/g, '');
    if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
    d = d.replace(/^0+/, '');
    phone.value = d.slice(0, 10);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = stepper.current;
    if (s === 'referral') {
      if (!PERSON.includes(data.referredBy)) return;
      const v = refName.value.trim();
      if (!v) return fail('Please tell us who referred you.', refName);
      data.referrerName = v;
      stepper.show('contact');
    } else if (s === 'contact') {
      const n = fullName.value.trim();
      const m = email.value.trim();
      if (n.length < 2) return fail('Please enter your name.', fullName);
      if (!/^\d{10}$/.test(phone.value)) return fail('Please enter a 10-digit mobile number.', phone);
      if (!EMAIL_RE.test(m)) return fail('Please enter a valid email address.', email);
      data.fullName = n;
      data.phone = phone.value;
      data.email = m.toLowerCase();
      send();
    }
  });

  function setBusy(on) {
    nextBtn.disabled = on;
    clearTimeout(slowTimer);
    if (on) {
      nextLabel.textContent = 'Sending…';
      slowTimer = setTimeout(() => { nextLabel.textContent = 'Still sending…'; }, 8000);
    } else {
      nextLabel.textContent = 'Request invitation';
    }
  }

  async function send() {
    formError.hidden = true;
    if (form.website.value) { finish(data.fullName); return; } // honeypot: quietly "succeed"
    const payload = {
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      capitalPriority: data.capitalPriority,
      eveningIntent: data.eveningIntent,
      referredBy: data.referredBy,
      referrerName: PERSON.includes(data.referredBy) ? data.referrerName || '' : '',
      socialMedia: data.referredBy === 'None' ? data.socialMedia || '' : '',
      source: 'conclave-site',
      submittedAt: new Date().toISOString(),
    };
    setBusy(true);
    try {
      await submit(CONFIG.endpoints.prospect, payload, { optimisticMs: CONFIG.optimisticMs });
      markDone('prospect', { name: data.fullName });
      finish(data.fullName);
    } catch (err) {
      console.error('Submit failed:', err);
      formError.hidden = false;
      formError.querySelector('[data-ref]').textContent =
        'Ref: ' + ((err && (err.name + ': ' + err.message)) || 'unknown').slice(0, 80);
    } finally {
      setBusy(false);
    }
  }

  function finish(name) {
    celebrate({ title: 'Thank you', text: 'Await your confirmation. Our team will reach out to you.' });
    setTimeout(() => showDone(name), 1300); // swap under the opaque overlay
  }

  function showDone(name) {
    const first = (name || '').split(' ')[0];
    done.querySelector('[data-done-title]').textContent = first ? 'Thank you, ' + first : 'Thank you';
    form.hidden = true;
    done.hidden = false;
  }

  done.querySelector('[data-done-reset]').addEventListener('click', () => {
    clearDone('prospect');
    data = {};
    form.reset();
    clearOptions(form);
    personBlock.hidden = true;
    noneBlock.hidden = true;
    done.hidden = true;
    form.hidden = false;
    stepper.reset(FIRST);
    stepper.step(FIRST).querySelector('.q').focus();
  });

  stepper.reset(FIRST);
  const prev = getDone('prospect');
  if (prev) showDone(prev.name);
}
