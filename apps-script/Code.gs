/**
 * UpperCrust Wealth Conclave — registration backend.
 * Bind this script to a Google Sheet (Extensions > Apps Script), deploy as a
 * Web App, and paste the deployment URL into ENDPOINT_URL in register.html.
 * See SETUP.md for step-by-step instructions.
 */

const SHEET_NAME = 'Registrations';
const HEADERS = [
  'Timestamp', 'Full Name', 'Phone', 'Email', 'Capital Priority',
  'Capital Focus', 'Capital Scale', 'Evening Intent', 'Status', 'Source', 'IP/User-Agent',
  'Referred By', 'Referrer Name', 'Social Media'
];
// Shared secret for the read-only "confirmed" report used by the Master
// consolidated sheet (apps-script-master/Code.gs). Keep this in sync with the
// REPORT_KEY there. Without the correct key, doGet() reveals nothing beyond
// the existing health-check message — this does not open up the sheet to
// anyone with just the /exec link.
// This repo is public — NEVER put the real secret here. Paste your own
// random value directly in the Apps Script editor after pasting this file in.
const REPORT_KEY = 'PASTE_YOUR_OWN_RANDOM_SECRET_HERE';

// One-time setup: creates the sheet + header row and formats the Phone column
// as plain text. Run this once from the editor (select setupSheet > Run).
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  // (re)write the header row so newly added columns get their titles
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  // plain text for the whole Phone column so "+" numbers never become formulas
  sheet.getRange('C:C').setNumberFormat('@');
  return sheet;
}

function getSheet_() {
  // fast path on every submission: just look the sheet up
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || setupSheet();
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ result: 'error', error: 'No data received' });
    }
    const data = JSON.parse(e.postData.contents);

    // honeypot / basic bot check happens client-side; re-validate required fields here.
    // The form no longer asks for email, "where is it invested" or "how much do you
    // manage", so those are not required (and won't be sent).
    const required = ['fullName', 'phone', 'capitalPriority', 'eveningIntent'];
    for (const field of required) {
      if (!data[field] || String(data[field]).trim() === '') {
        return jsonOut_({ result: 'error', error: 'Missing field: ' + field });
      }
    }

    // Serialise concurrent submissions: only one request at a time may check
    // for duplicates and write its row, so simultaneous registrations queue up
    // instead of overwriting each other or slipping past the duplicate check.
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) {
      // too many people at once — tell the page to retry shortly
      return jsonOut_({ result: 'busy' });
    }
    try {
      const sheet = getSheet_();

      // simple de-dupe: same phone number already applied (the form no longer
      // collects email, so phone is now the unique key). This also makes a
      // client retry after a timeout harmless.
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const target = String(data.phone).trim();
        const existingPhones = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
        for (let i = 0; i < existingPhones.length; i++) {
          if (String(existingPhones[i][0]).trim() === target) {
            return jsonOut_({ result: 'success', note: 'duplicate — already recorded' });
          }
        }
      }

      // one write call (Phone column is already plain text from setupSheet)
      sheet.appendRow([
        new Date(),
        data.fullName || '',
        data.phone || '',
        data.email || '',
        data.capitalPriority || '',
        data.capitalLocation || '',
        data.capitalScale || '',
        data.eveningIntent || '',
        'Pending Review',
        data.source || '',
        '',
        data.referredBy || '',
        data.referrerName || '',
        data.socialMedia || ''
      ]);
      // commit before releasing the lock so the next request sees this row
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    return jsonOut_({ result: 'success' });
  } catch (err) {
    return jsonOut_({ result: 'error', error: String(err) });
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.report === '1' && e.parameter.key === REPORT_KEY) {
    return jsonOut_(buildConfirmedReport_());
  }
  return jsonOut_({ status: 'ok', message: 'UCW Conclave registration endpoint is live' });
}

// Only rows someone on the team has manually marked Status = "Confirmed"
// in the sheet. Prospect requests sitting at "Pending Review" never appear.
function buildConfirmedReport_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { result: 'success', rows: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const rows = values
    .filter((r) => String(r[8]).trim() === 'Confirmed') // Status column
    .map((r) => ({ name: r[1], timestamp: r[0] }));      // Full Name, Timestamp
  return { result: 'success', rows: rows };
}
