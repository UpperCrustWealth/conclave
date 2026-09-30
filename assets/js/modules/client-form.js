// Existing-client RSVP (?client=1, optionally &name=…). Posts to the separate
// client sheet with the same payload as before (apps-script-client/Code.gs).
import { CONFIG } from '../config.js';
import { submit } from './api.js';
import { createStepper, selectOption, clearOptions } from './stepper.js';
import { celebrate } from './celebrate.js';
import { attachAutocomplete } from './autocomplete.js';
import { markDone, getDone, clearDone } from './done-state.js';

export function initClientForm(mode) {
  const form = document.getElementById('clientForm');
  const done = document.querySelector('[data-done="client"]');
  if (!form || !done) return;

  const $ = (s) => form.querySelector(s);
  const nextBtn = $('[data-next]');
  const nextLabel = nextBtn.querySelector('.lbl');
  const errorEl = $('[data-error]');
  const formError = $('[data-form-error]');
  const pmsInput = $('#pmsName');
  const yourName = $('#yourName');
  const skipNames = !!mode.name; // personalised link already knows who this is
  const first = skipNames ? 'attend' : 'pms';
  let data = {};
  let pmsMatched = false;

  const stepper = createStepper(form, {
    total: () => (skipNames ? 1 : 3) + (data.attending === 'Yes' ? 1 : 0),
    onShow: syncActions,
  });

  function syncActions(name) {
    errorEl.textContent = '';
    nextBtn.hidden = name === 'attend' || (name === 'guests' && !data.guests);
    nextLabel.textContent = name === 'guests' ? 'Confirm attendance' : 'Continue';
  }
  function fail(msg, input) {
    errorEl.textContent = msg;
    if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
  }

  attachAutocomplete(pmsInput, $('#pmsAc'), {
    load: () => import('../data/client-names.js').then((m) => m.default),
    onPick: () => { pmsMatched = true; errorEl.textContent = ''; },
  });
  pmsInput.addEventListener('input', () => { pmsMatched = false; });
  form.addEventListener('input', (e) => {
    if (e.target.matches('.input')) { e.target.removeAttribute('aria-invalid'); errorEl.textContent = ''; }
  });

  form.addEventListener('click', (e) => {
    const opt = e.target.closest('.opt');
    if (!opt || !form.contains(opt)) return;
    const { field, value } = selectOption(opt);
    if (field === 'attending') {
      data.attending = value;
      data.guests = null;
      if (value === 'Yes') { clearOptions(stepper.step('guests')); setTimeout(() => stepper.show('guests'), 260); }
      else send();
    } else if (field === 'guests') {
      data.guests = Number(value);
      nextBtn.hidden = false;
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = stepper.current;
    if (s === 'pms') {
      if (!pmsInput.value.trim()) return fail('Please enter the name your PMS is registered under.', pmsInput);
      stepper.show('yourname');
    } else if (s === 'yourname') {
      if (!yourName.value.trim()) return fail('Please enter your name.', yourName);
      stepper.show('attend');
    } else if (s === 'guests') {
      if (!data.guests) return fail('Please choose how many people will attend.');
      send();
    }
  });

  function setBusy(on) {
    nextBtn.disabled = on;
    form.querySelectorAll('.opt').forEach((o) => { o.disabled = on; });
    if (on) nextLabel.textContent = 'Sending…';
    else syncActions(stepper.current);
  }

  async function send() {
    formError.hidden = true;
    const payload = {
      pmsName: skipNames ? mode.name : pmsInput.value.trim(),
      pmsMatched: skipNames ? true : pmsMatched,
      yourName: skipNames ? '' : yourName.value.trim(),
      attending: data.attending,
      guests: data.attending === 'Yes' ? data.guests : '',
      source: 'conclave-client-link',
      submittedAt: new Date().toISOString(),
    };
    if (form.website.value) { finish(payload); return; }
    setBusy(true);
    try {
      await submit(CONFIG.endpoints.client, payload, { optimisticMs: CONFIG.optimisticMs });
      markDone('client', { attending: payload.attending, guests: payload.guests });
      finish(payload);
    } catch (err) {
      console.error('Client RSVP submit failed:', err);
      formError.hidden = false;
      formError.querySelector('[data-ref]').textContent =
        'Ref: ' + ((err && (err.name + ': ' + err.message)) || 'unknown').slice(0, 80);
    } finally {
      setBusy(false);
    }
  }

  function doneCopy(info) {
    if (info.attending === 'Yes') {
      const n = Number(info.guests) || 1;
      return {
        title: 'We look forward to seeing you',
        text: 'We have noted ' + n + (n === 1 ? ' seat' : ' seats') + ' for Saturday, 10 October. Our team will reach out to confirm.',
      };
    }
    return { title: 'Thank you for letting us know', text: 'We will miss you this time, and hope to see you at the next one.' };
  }

  function finish(info) {
    const copy = doneCopy(info);
    celebrate({ title: 'Thank you', text: copy.text });
    setTimeout(() => showDone(info), 1300);
  }

  function showDone(info) {
    const copy = doneCopy(info);
    done.querySelector('[data-done-title]').textContent = copy.title;
    done.querySelector('[data-done-text]').textContent = copy.text;
    form.hidden = true;
    done.hidden = false;
  }

  done.querySelector('[data-done-reset]').addEventListener('click', () => {
    clearDone('client');
    data = {};
    pmsMatched = false;
    form.reset();
    clearOptions(form);
    done.hidden = true;
    form.hidden = false;
    stepper.reset(first);
  });

  stepper.reset(first);
  const prev = getDone('client');
  if (prev) showDone(prev);
}
