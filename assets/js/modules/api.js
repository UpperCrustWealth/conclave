// Network layer: warm-up, retry with back-off, and a local outbox so an
// optimistic "Thank you" never loses a submission.
const OUTBOX_KEY = 'ucw_outbox_v1';
const warmed = new Set();

class FatalError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Apps Script cold-starts take seconds. Pinging doGet while the visitor is
// still reading means the real POST hits a warm instance.
export function warmUp(url) {
  if (!url || warmed.has(url)) return;
  warmed.add(url);
  fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit' }).catch(() => {});
}

function readBox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch (e) { return []; }
}
function writeBox(box) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(box)); } catch (e) { /* private mode */ }
}
function enqueue(item) { writeBox(readBox().filter((i) => i.id !== item.id).concat(item)); }
function dequeue(id) { writeBox(readBox().filter((i) => i.id !== id)); }

async function parse(res) {
  try { return JSON.parse(await res.text()); }
  catch (e) { return res.ok ? { result: 'success' } : { result: 'error', error: 'HTTP ' + res.status }; }
}

export function postWithRetry(endpoint, payload, { maxAttempts = 6, timeoutMs = 25000 } = {}) {
  const body = JSON.stringify(payload);
  let attempt = 0;
  const once = async () => {
    attempt++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      // text/plain keeps this a "simple" request: no CORS preflight to Apps Script
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status >= 500) throw new Error('HTTP ' + res.status);
      const data = await parse(res);
      if (data.result === 'busy') throw new Error('busy');
      if (data.result === 'error') throw new FatalError(data.error || 'Rejected by server');
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof FatalError || attempt >= maxAttempts) throw err;
      await sleep(900 * attempt + Math.random() * 1200);
      return once();
    }
  };
  return once();
}

// Resolves on confirmed success OR after `optimisticMs` (the payload is safe in
// the outbox and keeps retrying). Rejects only on an early hard failure.
export function submit(endpoint, payload, { optimisticMs = 3500 } = {}) {
  const id = payload.submittedAt + '|' + (payload.phone || payload.pmsName || '');
  enqueue({ id, endpoint, payload });
  const request = postWithRetry(endpoint, payload).then(
    (r) => { dequeue(id); return r; },
    (err) => { if (err instanceof FatalError) dequeue(id); throw err; }
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ optimistic: true }), optimisticMs);
    request.then((r) => { clearTimeout(timer); resolve(r); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

// Anything left from a previous visit (tab closed mid-retry) is re-sent.
// Safe: the backends de-duplicate by phone / submittedAt.
export function flushOutbox() {
  readBox().forEach((item) => {
    postWithRetry(item.endpoint, item.payload, { maxAttempts: 3 })
      .then(() => dequeue(item.id), (err) => { if (err instanceof FatalError) dequeue(item.id); });
  });
}
