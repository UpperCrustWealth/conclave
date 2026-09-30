# Client RSVP link — Setup

This is the second link: `index.html?client=1`, sent directly to existing clients. It shows
the same door/cover as the main conclave site, but opens into a short 3-question RSVP
instead of the 7-step prospect wizard, then closes with the same coin-shower "Thank You" —
no redirect anywhere.

It saves to a **brand-new, separate Google Sheet** — completely independent from both the
main conclave Registrations sheet and the RM attendance sheet. Nothing here reads or writes
either of those.

## 1. Database (Google Sheet, ~3 minutes)
1. Create a new Google Sheet, e.g. **"UCW Conclave — Client RSVP"**.
2. Extensions > Apps Script → delete the placeholder → paste all of `apps-script-client/Code.gs`.
3. Select **`setupSheet`** in the function dropdown → **Run** → authorize. This creates one
   tab, **Responses**, with columns: Timestamp, PMS Registered Under, Matched, Your Name,
   Attending, No. of People, Source.
4. **Deploy > New deployment** → Web app → Execute as **Me**, Access **Anyone** → Deploy →
   copy the `/exec` URL.

## 2. Connect the form
In `assets/js/config.js`, set `endpoints.client` to that URL.

## 3. The two links
- **Public / prospects:** `.../index.html`
- **Existing clients:** `.../index.html?client=1`

Both are the same file, same hosting — just add `?client=1` when you share the link with
clients.

## 4. What the client sees
1. The same cover ("ENTER THE TOP 1%") and door-opening animation as everyone else.
2. **"By which name is your PMS registered?"** — typing shows a live fuzzy-match dropdown
   built from the 242 client names (a static list copied from the RM attendance form's
   client list at build time — see note below). Clicking a suggestion fills the field.
3. **"Your name"** — in case the person filling it out isn't the registered client themself.
4. **"Will you be attending?"** → if Yes, **"How many people?"** (chip picker, same as the
   RM attendance form).
5. Same coin-shower + "Thank You" close as the prospect form — no page navigation, no
   redirect to any other link.

## Note on the autocomplete list
`assets/js/data/client-names.js` is a **static copy**, loaded only on `?client=1` links, of the 242 client names — it
does not call out to the RM attendance sheet or any other backend. This keeps the two
systems fully independent (nothing to "merge"), but it also means: if the RM client list
changes (new client added, name corrected), this list won't update on its own. Re-generate
it from the RM form's `apps-script/Code.gs` `SEED_CLIENTS` and paste the updated array in
before your next batch of client invites, if the list has changed meaningfully.

