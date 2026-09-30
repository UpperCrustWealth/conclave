// Floating WhatsApp chat — appears only when CONFIG.whatsapp has a number.
export function initWhatsApp(number, text) {
  const el = document.querySelector('[data-whatsapp]');
  const digits = String(number || '').replace(/\D/g, '');
  if (!el || digits.length < 10) return;
  el.href = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text || '');
  el.hidden = false;
}
