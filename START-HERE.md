# Upload in 5 steps (GitHub website, no coding)

1. Unzip this file on your computer.
2. Open your GitHub repo (the one for uppercrustconclave.in).
3. Delete these OLD files (open each, click ⋯ at top right, then "Delete file", then "Commit"):
   - `register.html`
   - `assets/styles.css`
   - `assets/ucw-logo.png`
   - `assets/speakers` (all 4 .jpg photos inside it)
4. Click **Add file, then Upload files**. Select EVERYTHING inside the unzipped folder
   (index.html, CNAME, the .md files, and the folders `assets`, `apps-script`, `apps-script-client`)
   and drag it in. Click **Commit changes**.
5. Wait 2 minutes, open https://uppercrustconclave.in and press Ctrl+Shift+R (on a phone, just reload).

## Check it works (2 minutes)
- Submit one test request on the site, and check that a new row appears in the Registrations sheet.
- Open one client link from `conclave-client-links.xlsx`, confirm, and check that a row appears in the client Responses sheet.
- Delete both test rows.

Nothing to change in Google Apps Script. Both sheets keep working as before.

## Later edits
- Phone, email, event date, venue: `assets/js/config.js` and the same text in `index.html`
- After any change to CSS or JS: in `index.html`, replace every `?v=13` with `?v=14` (then 15, 16…)
  so visitors see the new version.
