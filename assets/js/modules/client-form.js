// Existing-client RSVP. Only reachable via a personalized link (?client=1&name=…) —
// getMode() in mode.js refuses to treat ?client=1 as client mode without a name, so
// this never shows an open name search over the full client list. Posts to the
// separate client sheet with the same payload as before (apps-script-client/Code.gs).
import { CONFIG } from '../config.js';
import { submit } from './api.js';
import { createStepper, selectOption, clearOptions } from './stepper.js';
import { celebrate } from './celebrate.js';
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
  const first = 'attend';
  let data = {};

  const stepper = createStepper(form, {
    total: () => 1 + (data.attending === 'Yes' ? 1 : 0),
    onShow: syncActions,
  });

  function syncActions(name) {
    errorEl.textContent = '';
    nextBtn.hidden = name === 'attend' || (name === 'guests' && !data.guests);
    nextLabel.textContent = name === 'guests' ? 'Confirm your presence' : 'Continue';
  }
  function fail(msg) { errorEl.textContent = msg; }

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
    if (stepper.current === 'guests') {
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
      pmsName: mode.name,
      pmsMatched: true,
      yourName: '',
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
