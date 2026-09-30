// Remembers a completed response on this device so a returning visitor
// sees their confirmation instead of an empty form.
const key = (kind) => 'ucw_done_' + kind;

export function markDone(kind, info) {
  try { localStorage.setItem(key(kind), JSON.stringify({ ...info, at: Date.now() })); } catch (e) {}
}
export function getDone(kind) {
  try { return JSON.parse(localStorage.getItem(key(kind)) || 'null'); } catch (e) { return null; }
}
export function clearDone(kind) {
  try { localStorage.removeItem(key(kind)); } catch (e) {}
}
