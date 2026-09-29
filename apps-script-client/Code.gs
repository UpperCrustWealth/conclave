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
  'Timestamp', 'PMS Registered Under', 'Matched', 'Your Name', 'Attending', 'No. of People', 'Source'
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
    if (!yourName) return jsonOut_({ result: 'error', error: 'Missing your name' });
    if (attending !== 'Yes' && attending !== 'No') return jsonOut_({ result: 'error', error: 'Invalid attending value' });

    let guests = '';
    if (attending === 'Yes') {
      guests = parseInt(data.guests, 10);
      if (!(guests >= 1 && guests <= 100)) return jsonOut_({ result: 'error', error: 'Invalid number of people' });
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return jsonOut_({ result: 'busy' });
    try {
      const sheet = getSheet_();
      // every RSVP is logged as its own row (not overwritten), so a client
      // who submits twice just leaves two rows — an audit trail, not a state
      sheet.appendRow([
        new Date(),
        pmsName,
        data.pmsMatched ? 'Yes' : 'No',
        yourName,
        attending,
        guests,
        data.source || ''
      ]);
      SpreadsheetApp.flush();
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
