/**
 * UpperCrust Wealth Conclave — Master confirmed list + management dashboard.
 *
 * One BRAND-NEW Google Sheet (bind this script to it) that pulls everyone who
 * has CONFIRMED from every channel, groups them, and draws a dashboard:
 *
 *   PMS Clients            <- PMS client RSVP links  (apps-script-client/Code.gs): latest answer = Yes
 *   Referrals              <- online form, "Who referred you" = A friend      (Status = Confirmed)
 *   Direct Invites         <- "Direct Invites" tab of THIS sheet (typed by hand) and
 *                             online form, "Who referred you" = UpperCrust team (Status = Confirmed)
 *   RM List                <- RM attendance tracker (RM form's apps-script/Code.gs): Status = Confirmed
 *   Online (Social Media)  <- online form, "Who referred you" = No one (Status = Confirmed)
 *
 * The team can override an online registrant's group with the Category column
 * in the Registrations sheet, and set their real headcount in its Guests
 * column (blank = 1 person).
 *
 * Tabs: Dashboard (for management), Confirmed (flat list — also the table to
 * point Looker Studio at), Direct Invites (typed by hand).
 *
 * Nothing here writes back to the source sheets. This script does NOT need to
 * be deployed as a Web App.
 *
 * Setup:
 *   1. Paste this whole file into Extensions > Apps Script of the Master sheet.
 *   2. Replace PASTE_YOUR_OWN_RANDOM_SECRET_HERE below with the shared secret
 *      (same value as in the other three scripts). This repo is public —
 *      never commit the real value.
 *   3. Run `setup` once (authorize when asked).
 *   4. Run `createAutoRefreshTrigger` once so it refreshes itself every 10 min,
 *      or use the menu UCW Conclave > Refresh now.
 */

const SHEET_CONFIRMED = 'Confirmed';
const SHEET_DIRECT = 'Direct Invites';
const SHEET_DASH = 'Dashboard';

const HEADERS = ['Category', 'Name', 'Phone', 'Guests', 'Source Detail', 'Confirmed On', 'Last Refreshed'];
const DIRECT_HEADERS = ['Name', 'Phone', 'Guests', 'Invited By', 'Status', 'Notes'];

// Priority order = the order shown on the dashboard. Must match CATEGORY_OPTIONS
// in apps-script/Code.gs exactly.
const CATS = ['PMS Clients', 'Referrals', 'Direct Invites', 'RM List', 'Online (Social Media)'];
const PLATFORMS = ['Instagram', 'LinkedIn', 'Facebook'];
const NOT_SPECIFIED = 'Not specified';

// This repo is public — NEVER put the real secret here. Paste your own
// random value directly in the Apps Script editor after pasting this file in.
const REPORT_KEY = 'PASTE_YOUR_OWN_RANDOM_SECRET_HERE';

const SOURCES = {
  prospect: 'https://script.google.com/macros/s/AKfycbz_fEoEaNBCcx1-XPOtqDesTr5j4kyJITNfwz4aFbGQ2FU_0UfWBBt3fHf0aFYI0Eo/exec',
  pms: 'https://script.google.com/macros/s/AKfycbyusCglVKDwgUIbD9lpwdZDhy6z2IpjS-rWN5Z4-MvaykYUUjCJrljMzuM0e5C0fi0/exec',
  rm: 'https://script.google.com/macros/s/AKfycbxuAb2ncBt-Ou5CBv-DPq-91f6UfkVsFoUsG0dbm_uZwgE9wOgKoyowCVBHwYMdfyCl/exec',
};

// ---------- pure helpers (no spreadsheet access) ----------

const str_ = (v) => String(v == null ? '' : v).trim();

function guestsOr1_(v) {
  const n = parseInt(v, 10);
  return n >= 1 ? n : 1;
}

function toDate_(v) {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d;
}

function prospectCategory_(r) {
  if (CATS.indexOf(str_(r.category)) >= 0) return str_(r.category);
  if (str_(r.referredBy) === 'Your friend') return 'Referrals';
  if (str_(r.referredBy) === 'UpperCrust Wealth employee') return 'Direct Invites';
  return 'Online (Social Media)';
}

function prospectDetail_(r, cat) {
  const auto = CATS.indexOf(str_(r.category)) < 0;
  const referrer = str_(r.referrerName);
  if (cat === 'Online (Social Media)') return PLATFORMS.indexOf(str_(r.socialMedia)) >= 0 ? str_(r.socialMedia) : NOT_SPECIFIED;
  if (auto && cat === 'Referrals') return referrer ? 'Referred by ' + referrer : 'Referred by a friend';
  if (auto && cat === 'Direct Invites') return referrer ? 'Invited by ' + referrer : 'Invited by UpperCrust team';
  if (cat === 'RM List') return 'RM not recorded';   // this column is the RM name for RM rows
  return referrer ? 'Online form, referrer: ' + referrer : 'Online form (re-categorised)';
}

// src = { prospect, pms, rm, direct } -> [category, name, phone, guests, detail, confirmedOn] rows,
// ordered by priority group, then name.
function buildRows_(src) {
  const rows = [];
  (src.pms || []).forEach((r) => rows.push(
    ['PMS Clients', str_(r.name), '', guestsOr1_(r.guests), 'PMS RSVP link', toDate_(r.timestamp)]));
  (src.prospect || []).forEach((r) => {
    const cat = prospectCategory_(r);
    rows.push([cat, str_(r.name), str_(r.phone), guestsOr1_(r.guests), prospectDetail_(r, cat), toDate_(r.timestamp)]);
  });
  (src.rm || []).forEach((r) => rows.push(
    ['RM List', str_(r.name), str_(r.phone), guestsOr1_(r.guests), str_(r.rm), toDate_(r.timestamp)]));
  (src.direct || []).forEach((r) => rows.push(
    ['Direct Invites', str_(r.name), str_(r.phone), guestsOr1_(r.guests),
      str_(r.invitedBy) ? 'Invited by ' + str_(r.invitedBy) : 'Invited by UpperCrust team', '']));
  return rows
    .filter((r) => r[1])
    .sort((a, b) => (CATS.indexOf(a[0]) - CATS.indexOf(b[0])) || a[1].localeCompare(b[1]));
}

function summarize_(rows) {
  const byCat = {};
  CATS.forEach((c) => { byCat[c] = { n: 0, g: 0 }; });
  const platforms = {};
  PLATFORMS.concat([NOT_SPECIFIED]).forEach((p) => { platforms[p] = { n: 0, g: 0 }; });
  const rmMap = {};
  let total = 0, guests = 0;
  rows.forEach((r) => {
    const cat = r[0], g = r[3], detail = r[4];
    total++; guests += g;
    if (byCat[cat]) { byCat[cat].n++; byCat[cat].g += g; }
    if (cat === 'Online (Social Media)') {
      const p = platforms[detail] ? detail : NOT_SPECIFIED;
      platforms[p].n++; platforms[p].g += g;
    }
    if (cat === 'RM List') {
      const k = detail || 'Unknown RM';
      if (!rmMap[k]) rmMap[k] = { n: 0, g: 0 };
      rmMap[k].n++; rmMap[k].g += g;
    }
  });
  const rms = Object.keys(rmMap).sort().map((k) => [k, rmMap[k].n, rmMap[k].g]);
  return { total: total, guests: guests, byCat: byCat, platforms: platforms, rms: rms };
}

// ---------- spreadsheet / network ----------

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

function toast_(msg) {
  try { ss_().toast(msg, 'UCW Conclave', 5); } catch (err) { /* no UI in timer runs */ }
}

function setup() {
  const c = tab_(SHEET_CONFIRMED, HEADERS);
  [170, 240, 140, 70, 230, 170, 170].forEach((w, i) => c.setColumnWidth(i + 1, w));

  const d = tab_(SHEET_DIRECT, DIRECT_HEADERS);
  const n = Math.max(d.getMaxRows() - 1, 1);
  d.getRange('B:B').setNumberFormat('@');
  d.getRange(2, 3, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberBetween(1, 100).setAllowInvalid(false).build());
  d.getRange(2, 5, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Confirmed', 'Pending', 'Declined'], true).setAllowInvalid(false).build());
  [220, 140, 70, 180, 110, 260].forEach((w, i) => d.setColumnWidth(i + 1, w));

  const dash = tab_(SHEET_DASH);
  ss_().setActiveSheet(dash);
  ss_().moveActiveSheet(1);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('UCW Conclave')
    .addItem('Refresh now', 'refresh')
    .addToUi();
}

// Returns the report rows, or null if the source could not be read properly
// (wrong key, script not redeployed, network error). A wrong key makes the
// source answer with its plain health-check JSON, which has no rows array —
// that must count as a failure, not as "nobody confirmed yet".
function fetchReport_(label, baseUrl) {
  try {
    const res = UrlFetchApp.fetch(baseUrl + '?report=1&key=' + encodeURIComponent(REPORT_KEY), { muteHttpExceptions: true });
    const data = JSON.parse(res.getContentText());
    if (data.result === 'success' && Array.isArray(data.rows)) return data.rows;
    Logger.log(label + ': unexpected response ' + res.getContentText().slice(0, 200));
    return null;
  } catch (err) {
    Logger.log(label + ': fetch failed ' + err);
    return null;
  }
}

// People typed by hand into the "Direct Invites" tab; only Status = Confirmed counts.
function readDirect_() {
  const sh = ss_().getSheetByName(SHEET_DIRECT);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, DIRECT_HEADERS.length).getValues()
    .filter((r) => str_(r[0]) && str_(r[4]) === 'Confirmed')
    .map((r) => ({ name: r[0], phone: r[1], guests: r[2], invitedBy: r[3] }));
}

function writeConfirmed_(rows, now) {
  const sh = tab_(SHEET_CONFIRMED, HEADERS);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, HEADERS.length).clearContent();
  if (!rows.length) return;
  const out = rows.map((r) => r.concat([now]));
  sh.getRange(2, 3, out.length, 1).setNumberFormat('@');   // keep "+91..." as text
  sh.getRange(2, 1, out.length, HEADERS.length).setValues(out);
  sh.getRange(2, 6, out.length, 2).setNumberFormat('dd MMM yyyy, hh:mm a');
}

function setDashStatus_(msg) {
  const sh = tab_(SHEET_DASH);
  sh.getRange('A3:B3').setValues([['Data status', msg]]);
  sh.getRange('B3').setFontColor('#a3402f');
}

function writeDashboard_(s, now) {
  const sh = tab_(SHEET_DASH);
  sh.getCharts().forEach((c) => sh.removeChart(c));
  sh.clear();

  sh.getRange('A1').setValue("UpperCrust Wealth Conclave '26 — Confirmed Registrations")
    .setFontSize(16).setFontWeight('bold');
  sh.getRange('A2:B3').setValues([['Last refreshed', now], ['Data status', 'All sources read OK']]);
  sh.getRange('B2').setNumberFormat('dd MMM yyyy, hh:mm a').setHorizontalAlignment('left');
  sh.getRange('A4:B5').setValues([['Total registrations', s.total], ['Total guests', s.guests]])
    .setFontSize(13).setFontWeight('bold');
  sh.getRange('B4:B5').setHorizontalAlignment('left');

  // by group, in priority order
  const catRows = CATS.map((c) => [c, s.byCat[c].n, s.byCat[c].g, s.guests ? s.byCat[c].g / s.guests : 0]);
  sh.getRange(7, 1, 1, 4).setValues([['Category', 'Registrations', 'Guests', '% of guests']]);
  sh.getRange(8, 1, catRows.length, 4).setValues(catRows);
  const totalRow = 8 + catRows.length;
  sh.getRange(totalRow, 1, 1, 4).setValues([['Total', s.total, s.guests, s.guests ? 1 : 0]]).setFontWeight('bold');
  sh.getRange(8, 4, catRows.length + 1, 1).setNumberFormat('0%');

  // online registrations by platform
  const pNames = PLATFORMS.concat([NOT_SPECIFIED]);
  const pRow = totalRow + 2;
  sh.getRange(pRow, 1, 1, 3).setValues([['Online registrations by platform', 'Registrations', 'Guests']]);
  sh.getRange(pRow + 1, 1, pNames.length, 3).setValues(pNames.map((p) => [p, s.platforms[p].n, s.platforms[p].g]));

  // RM list by RM
  const rRow = pRow + pNames.length + 2;
  sh.getRange(rRow, 1, 1, 3).setValues([['RM list by Relationship Manager', 'Registrations', 'Guests']]);
  if (s.rms.length) sh.getRange(rRow + 1, 1, s.rms.length, 3).setValues(s.rms);
  else sh.getRange(rRow + 1, 1).setValue('No RM-confirmed clients yet');

  sh.getRange(7, 1, 1, 4).setFontWeight('bold').setBackground('#efe6cf');
  sh.getRange(pRow, 1, 1, 3).setFontWeight('bold').setBackground('#efe6cf');
  sh.getRange(rRow, 1, 1, 3).setFontWeight('bold').setBackground('#efe6cf');
  sh.setColumnWidth(1, 270);
  sh.setColumnWidths(2, 3, 120);

  sh.insertChart(sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(7, 1, CATS.length + 1, 1))
    .addRange(sh.getRange(7, 3, CATS.length + 1, 1))
    .setNumHeaders(1)
    .setPosition(4, 6, 0, 0)
    .setOption('title', 'Guests by category')
    .setOption('legend', { position: 'none' })
    .build());
}

// Pulls fresh data from all sources and rebuilds Confirmed + Dashboard. If ANY
// source can't be read, nothing is overwritten (so management never sees
// numbers that silently dropped a whole channel) and the Dashboard says why.
function refresh() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const prospect = fetchReport_('Online registrations', SOURCES.prospect);
    const pms = fetchReport_('PMS links', SOURCES.pms);
    const rm = fetchReport_('RM list', SOURCES.rm);
    const failed = [];
    if (!prospect) failed.push('Online registrations');
    if (!pms) failed.push('PMS links');
    if (!rm) failed.push('RM list');
    if (failed.length) {
      setDashStatus_('Refresh FAILED for: ' + failed.join(', ') +
        ' — still showing the previous data. Check the secret key and that script was redeployed.');
      toast_('Refresh failed for: ' + failed.join(', '));
      return;
    }
    const now = new Date();
    const rows = buildRows_({ prospect: prospect, pms: pms, rm: rm, direct: readDirect_() });
    writeConfirmed_(rows, now);
    writeDashboard_(summarize_(rows), now);
    SpreadsheetApp.flush();
    toast_('Refreshed: ' + rows.length + ' confirmed registrations');
  } finally {
    lock.releaseLock();
  }
}

// Run this ONCE to keep the sheet fresh by itself (every 10 minutes). Safe to
// re-run: it removes any earlier refresh trigger first.
function createAutoRefreshTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'refresh') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refresh').timeBased().everyMinutes(10).create();
}
