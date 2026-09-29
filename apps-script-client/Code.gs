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

function doGet() {
  return jsonOut_({ status: 'ok', message: 'UCW Conclave client RSVP endpoint is live' });
}
