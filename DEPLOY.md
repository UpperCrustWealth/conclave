# Deploying the Conclave site (GitHub Pages)

The site is static: no build step. Push to the branch GitHub Pages serves and it is live.

## First deploy of v2
```bash
cd path/to/your/conclave-repo
git pull
# remove files v2 no longer uses
git rm -r --ignore-unmatch register.html assets/styles.css assets/ucw-logo.png assets/speakers
# copy the new files over the repo (from the downloaded zip)
unzip -o ~/Downloads/conclave-final.zip -d .
git add -A
git commit -m "Conclave v2: single-page site, personalised client links, faster load"
git push
```
Check https://uppercrustconclave.in after 1–2 minutes. Hard-refresh once (Ctrl+Shift+R).

## Everyday edits
- Dates, venue, endpoints, email, phone, WhatsApp: `assets/js/config.js` (+ matching text in `index.html`)
- Colours and spacing: `assets/css/tokens.css`
- Speakers / agenda text: `index.html`
- After changing any CSS or JS, bump `?v=13` to the next number everywhere in `index.html`
  so visitors get the new files instead of cached ones.

## Test locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
# client view: http://localhost:8000/?client=1&name=Test%20Name&hi=Test
```

## Backend
`apps-script/Code.gs` and `apps-script-client/Code.gs` are unchanged; no redeploy needed.
The prospect sheet's existing Email column now receives the email from the form.
