// Site-wide settings. Endpoints are the SAME Apps Script deployments as before — no backend redeploy needed.
export const CONFIG = {
  endpoints: {
    prospect: 'https://script.google.com/macros/s/AKfycbz_fEoEaNBCcx1-XPOtqDesTr5j4kyJITNfwz4aFbGQ2FU_0UfWBBt3fHf0aFYI0Eo/exec',
    client: 'https://script.google.com/macros/s/AKfycbyusCglVKDwgUIbD9lpwdZDhy6z2IpjS-rWN5Z4-MvaykYUUjCJrljMzuM0e5C0fi0/exec',
  },
  event: {
    title: "UpperCrust Wealth Conclave '26",
    start: '2026-10-10T09:30:00+05:30',
    end: '2026-10-10T13:30:00+05:30',
    location: 'Ocean Hall, Waves Club, Vadodara',
    details: 'Registration and welcome tea from 9:30 am. Grand lunch at 1:30 pm in Pacific Hall.',
  },
  contactEmail: 'yash@uppercrustwealth.com',
  contactPhone: '+919727753518',
  // WhatsApp button: country code + number, digits only (e.g. '919876543210'). Leave '' to hide it.
  whatsapp: '',
  whatsappText: "Hello, I'd like to know more about the UpperCrust Wealth Conclave '26.",
  optimisticMs: 3500, // show the thank-you after this long even if Google is still answering
};
