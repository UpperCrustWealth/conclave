/**
 * UpperCrust Wealth Conclave — Client RSVP backend.
 *
 * This is a SEPARATE Google Sheet and Apps Script deployment from the main
 * conclave registration one (apps-script/Code.gs) and from the RM attendance
 * one — nothing here reads or writes either of those. Bind this script to a
 * brand-new Google Sheet, deploy as a Web App, and paste the deployment URL
 * into CLIENT_ENDPOINT_URL in index.html. See SETUP-CLIENT.md.
 */

const SHEET_NAME = 'Responses';
const HEADERS = [
  'Timestamp', 'PMS Registered Under', 'Matched', 'Your Name', 'Attending', 'No. of People', 'Source', 'Client Submitted At'
];
// Shared secret for the read-only "confirmed" report used by the Master
// consolidated sheet (apps-script-master/Code.gs). Keep this in sync with the
// REPORT_KEY there. Without the correct key, doGet() reveals nothing beyond
// the existing health-check message.
// This repo is public — NEVER put the real secret here. Paste your own
// random value directly in the Apps Script editor after pasting this file in.
const REPORT_KEY = 'PASTE_YOUR_OWN_RANDOM_SECRET_HERE';

// One-time setup: creates the sheet + header row. Run this once from the
// editor (select setupSheet > Run). Safe to re-run.
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || setupSheet();
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ result: 'error', error: 'No data received' });
    }
    const data = JSON.parse(e.postData.contents);

    const pmsName = String(data.pmsName || '').trim();
    const yourName = String(data.yourName || '').trim();
    const attending = String(data.attending || '').trim();

    if (!pmsName) return jsonOut_({ result: 'error', error: 'Missing PMS name' });
    // "Your name" is optional: personalized links (?client=1&name=...) already
    // identify the family/client via pmsName and skip asking this at all.
    if (attending !== 'Yes' && attending !== 'No') return jsonOut_({ result: 'error', error: 'Invalid attending value' });

    let guests = '';
    if (attending === 'Yes') {
      guests = parseInt(data.guests, 10);
      if (!(guests >= 1 && guests <= 100)) return jsonOut_({ result: 'error', error: 'Invalid number of people' });
    }

    const submittedAt = String(data.submittedAt || '');

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return jsonOut_({ result: 'busy' });
    try {
      const sheet = getSheet_();
      // A slow/flaky connection can make the browser retry the exact same
      // click several times even after the first attempt already wrote a
      // row (the write happens before Apps Script finishes sending its
      // response). submittedAt is generated once per click and stays the
      // same across those retries, so checking recent rows for the same
      // (pmsName, submittedAt) pair makes a retried submission a no-op
      // instead of a duplicate row.
      const lastRow = sheet.getLastRow();
      let isDuplicate = false;
      if (submittedAt && lastRow > 1) {
        const scanFrom = Math.max(2, lastRow - 20);
        // columns B..H (7 wide, starting at column 2): B=PMS Registered Under
        // (index 0 in this range) .. H=Client Submitted At (index 6)
        const recent = sheet.getRange(scanFrom, 2, lastRow - scanFrom + 1, 7).getValues();
        isDuplicate = recent.some((r) => r[0] === pmsName && String(r[6]) === submittedAt);
      }
      if (!isDuplicate) {
        // every genuinely new RSVP is logged as its own row (not overwritten),
        // so a client who submits twice on purpose still leaves two rows
        sheet.appendRow([
          new Date(),
          pmsName,
          data.pmsMatched ? 'Yes' : 'No',
          yourName,
          attending,
          guests,
          data.source || '',
          submittedAt
        ]);
        SpreadsheetApp.flush();
      }
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
  return jsonOut_({ status: 'ok', message: 'UCW Conclave client RSVP endpoint is live' });
}

// Every RSVP is logged as its own row (see doPost), so the same family/client
// can have more than one — e.g. they said No, then later reopened the link
// and said Yes. This keeps only each person's LATEST row, and reports them
// only if that latest answer is "Yes".
function buildConfirmedReport_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { result: 'success', rows: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const latestByName = {};
  values.forEach((r) => {
    const name = String(r[1]).trim(); // PMS Registered Under
    if (!name) return;
    latestByName[name] = { timestamp: r[0], attending: r[4], guests: r[5] }; // later rows overwrite earlier ones
  });
  const rows = Object.keys(latestByName)
    .filter((name) => latestByName[name].attending === 'Yes')
    .map((name) => ({ name: name, guests: latestByName[name].guests, timestamp: latestByName[name].timestamp }));
  return { result: 'success', rows: rows };
}
