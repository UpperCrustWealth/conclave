/**
 * UpperCrust Wealth Conclave — Master confirmed-guest list.
 *
 * Pulls together everyone who has actually CONFIRMED, from all three
 * independent sources, into one sheet:
 *   - Prospect / social-media site  (apps-script/Code.gs)        — rows where Status = "Confirmed" (set by hand)
 *   - PMS client RSVP links         (apps-script-client/Code.gs) — rows where Attending = "Yes" (their latest answer)
 *   - RM attendance tracker         (RM form's apps-script/Code.gs) — rows where Status = "Confirmed"
 *
 * This is a BRAND-NEW, separate Google Sheet — bind this script to it.
 * Nothing here writes back to any of the three source sheets; it only reads
 * from them (the first two through a key-protected report endpoint added to
 * their doGet(), the RM one through its existing open doGet()).
 *
 * Setup:
 *   1. Create a new Google Sheet, e.g. "UCW Conclave — Master Confirmed List".
 *   2. Extensions > Apps Script → delete the placeholder → paste this whole file.
 *   3. Run `setup` once from the editor (authorize when asked). This creates
 *      the "Confirmed" tab and installs the "UCW Conclave" menu.
 *   4. Reload the spreadsheet. Use menu UCW Conclave > Refresh confirmed list
 *      now, or run `createAutoRefreshTrigger` once to have it refresh itself
 *      automatically (default: every 15 minutes).
 *
 * This script does NOT need to be deployed as a Web App — it only reads from
 * the other three, it doesn't need to be called by anything itself.
 */

const SHEET_NAME = 'Confirmed';
const HEADERS = ['Name', 'Source', 'Guests', 'Confirmed On', 'Last Refreshed'];

// Must match REPORT_KEY in apps-script/Code.gs and apps-script-client/Code.gs.
// This repo is public — NEVER put the real secret here. Paste your own
// random value directly in the Apps Script editor after pasting this file in.
const REPORT_KEY = 'PASTE_YOUR_OWN_RANDOM_SECRET_HERE';

const SOURCES = {
  prospect: 'https://script.google.com/macros/s/AKfycbz_fEoEaNBCcx1-XPOtqDesTr5j4kyJITNfwz4aFbGQ2FU_0UfWBBt3fHf0aFYI0Eo/exec',
  pms: 'https://script.google.com/macros/s/AKfycbyusCglVKDwgUIbD9lpwdZDhy6z2IpjS-rWN5Z4-MvaykYUUjCJrljMzuM0e5C0fi0/exec',
  rm: 'https://script.google.com/macros/s/AKfycbxuAb2ncBt-Ou5CBv-DPq-91f6UfkVsFoUsG0dbm_uZwgE9wOgKoyowCVBHwYMdfyCl/exec',
};

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function tab_(name, headers) {
  let sh = ss_().getSheetByName(name);
  if (!sh) sh = ss_().insertSheet(name);
  if (headers) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function setup() {
  tab_(SHEET_NAME, HEADERS);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('UCW Conclave')
    .addItem('Refresh confirmed list now', 'refresh')
    .addToUi();
}

// Reads confirmed rows from the prospect / social-media site.
function fetchProspect_() {
  try {
    const res = UrlFetchApp.fetch(SOURCES.prospect + '?report=1&key=' + REPORT_KEY, { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    return (data.rows || []).map((r) => [r.name, 'Social Media / Website', '', r.timestamp]);
  } catch (err) {
    Logger.log('Prospect fetch failed: ' + err);
    return [];
  }
}

// Reads confirmed rows from the PMS client RSVP links (family + individual).
function fetchPms_() {
  try {
    const res = UrlFetchApp.fetch(SOURCES.pms + '?report=1&key=' + REPORT_KEY, { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    return (data.rows || []).map((r) => [r.name, 'PMS Link', r.guests, r.timestamp]);
  } catch (err) {
    Logger.log('PMS fetch failed: ' + err);
    return [];
  }
}

// Reads confirmed rows from the RM attendance tracker. Its doGet() already
// returns every RM's full client list with status (no key needed — see that
// project's SETUP.md), so this just filters for Status = "Confirmed".
function fetchRm_() {
  try {
    const res = UrlFetchApp.fetch(SOURCES.rm, { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    const rows = [];
    (data.rms || []).forEach((rm) => {
      (rm.clients || []).forEach((c) => {
        if (c.status === 'Confirmed') rows.push([c.name, 'RM Confirmed (' + rm.name + ')', c.guests, '']);
      });
    });
    return rows;
  } catch (err) {
    Logger.log('RM fetch failed: ' + err);
    return [];
  }
}

// Pulls fresh data from all three sources and rewrites the Confirmed tab.
// Each person appears once per source they were confirmed through — if the
// same real person shows up under more than one source (e.g. confirmed both
// via their PMS link AND marked Confirmed by their RM), you'll see two rows;
// names aren't auto-merged across sources since they're typed differently in
// each system, so a quick eyeball check for duplicates is worth doing before
// using this as a final headcount.
function refresh() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const rows = [].concat(fetchProspect_(), fetchPms_(), fetchRm_());
    const now = new Date();
    const sh = tab_(SHEET_NAME, HEADERS);
    const lastRow = sh.getLastRow();
    if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
    if (rows.length) {
      const withRefreshedAt = rows.map((r) => r.concat([now]));
      sh.getRange(2, 1, withRefreshedAt.length, HEADERS.length).setValues(withRefreshedAt);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

// Optional: run this ONCE from the editor to have the sheet refresh itself
// automatically. Safe to re-run (clears any existing trigger from this
// script first, so you never end up with duplicates).
function createAutoRefreshTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'refresh') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refresh').timeBased().everyMinutes(15).create();
}
