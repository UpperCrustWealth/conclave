// Entry point. Everything is progressive: the page is fully readable without JS.
import { CONFIG } from './config.js';
import { getMode, applyGreeting } from './modules/mode.js';
import { initNav } from './modules/nav.js';
import { initDock } from './modules/dock.js';
import { initCountdown } from './modules/countdown.js';
import { initCalendar } from './modules/calendar.js';
import { initProspectForm } from './modules/prospect-form.js';
import { initClientForm } from './modules/client-form.js';
import { warmUp, flushOutbox } from './modules/api.js';
import { initWhatsApp } from './modules/whatsapp.js';

const mode = getMode();
applyGreeting(mode);
initNav();
initDock();
initCountdown(document.querySelector('[data-countdown]'), CONFIG.event.start, CONFIG.event.end);
initCalendar(CONFIG.event);
initWhatsApp(CONFIG.whatsapp, CONFIG.whatsappText);
if (mode.isClient) initClientForm(mode);
else initProspectForm();

// Wake the Apps Script backend before the visitor reaches the form.
const endpoint = mode.isClient ? CONFIG.endpoints.client : CONFIG.endpoints.prospect;
const wake = () => warmUp(endpoint);
['pointerdown', 'scroll', 'keydown'].forEach((ev) => addEventListener(ev, wake, { once: true, passive: true }));
if (mode.isClient) wake();

(window.requestIdleCallback || ((fn) => setTimeout(fn, 1500)))(flushOutbox);
