// "Add to calendar": builds an .ics on the fly (Apple, Google, Outlook all accept it).
const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

export function initCalendar(event) {
  document.querySelectorAll('[data-add-calendar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UpperCrust Wealth//Conclave//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:wealth-conclave-2026@uppercrustwealth.com',
        'DTSTAMP:' + stamp(new Date().toISOString()),
        'DTSTART:' + stamp(event.start),
        'DTEND:' + stamp(event.end),
        'SUMMARY:' + esc(event.title),
        'LOCATION:' + esc(event.location),
        'DESCRIPTION:' + esc(event.details),
        'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(event.title), 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR',
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'wealth-conclave-26.ics' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
  });
}
