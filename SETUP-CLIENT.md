# Client RSVP link — Setup

There are exactly **two ways into this site**, both served from the same `index.html`:
- **Public / prospects:** `https://uppercrustconclave.in/` — the full landing page and the
  "Request an invitation" wizard, for anyone.
- **Existing clients:** `https://uppercrustconclave.in/?client=1&name=<Family or first name>`
  — a personalized link, one per family/client, that greets them by name and skips straight
  to a 2-question RSVP (attending? how many?).

**There is no generic, name-less client link.** `?client=1` on its own is deliberately treated
as an ordinary visit (see `assets/js/modules/mode.js`) — it falls back to the public form
rather than showing any client-only content. Earlier versions of this site had a "by which
name is your PMS registered?" step with a search box that suggested names from the full
242-client list as you typed. That was removed: anyone holding a bare `?client=1` link could
type letters and see every other client's name, which is exactly the kind of exposure a
personalized-link model is supposed to avoid. Every client-facing link must now carry its own
`&name=`, generated per person/family — never a link that lets someone search or browse.

It saves to a **brand-new, separate Google Sheet** — completely independent from both the
main conclave Registrations sheet and the RM attendance sheet. Nothing here reads or writes
either of those.

## 1. Database (Google Sheet, ~3 minutes)
1. Create a new Google Sheet, e.g. **"UCW Conclave — Client RSVP"**.
2. Extensions > Apps Script → delete the placeholder → paste all of `apps-script-client/Code.gs`.
3. Select **`setupSheet`** in the function dropdown → **Run** → authorize. This creates one
   tab, **Responses**, with columns: Timestamp, PMS Registered Under, Matched, Your Name,
   Attending, No. of People, Source, Client Submitted At.
4. **Deploy > New deployment** → Web app → Execute as **Me**, Access **Anyone** → Deploy →
   copy the `/exec` URL.

## 2. Connect the form
In `assets/js/config.js`, set `endpoints.client` to that URL.

## 3. Generating client links
Each row you send out needs its own `&name=` value (URL-encoded), e.g. for the Patel family:
`https://uppercrustconclave.in/?client=1&name=Patel%20Family`. Optionally add `&hi=` if you
want the on-page greeting to read differently from the `name` value that gets logged (by
default the page tidies `name` itself — see `tidyName()` in `mode.js`).

## 4. What the client sees
1. The full landing page, personalized: "Hi Patel Family, you are invited to…" in the hero,
   and the nav CTA reads "Confirm your presence" instead of "Request invitation".
2. In the RSVP card: **"Shall we reserve your place at the Wealth Conclave '26?"** → if Yes,
   **"How many people will attend?"** (1–5, chip picker).
3. A "Thank you" celebration, with copy that reflects their actual answer (seat count, or a
   "we'll miss you" note if they declined) — shown within `CONFIG.optimisticMs` regardless of
   how long the Apps Script round-trip actually takes.

No search box, no name-typing, no list of other clients — the link itself is the only
identification.
