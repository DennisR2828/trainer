# HANDOFF — Trainer (pick up from any session or machine)

**App:** "Trainer" — a local-first, mobile fitness (and soon diet) tracker PWA.
**Last updated:** 2026-08-04. **Deployed:** cache `trainer-v19`, hosted on **Vercel**, with accounts.

Read this first when resuming, then `README.md` for the fuller reference.

---

## TL;DR — where we are

- **Live on the phone** at **https://trainer-dman-industries.vercel.app** (Vercel, free tier).
  ⚠️ Moved off GitHub Pages 2026-08-04. The old `dennisr2828.github.io/trainer/` URL still serves
  the *old* build — different origin, so it also has its own separate IndexedDB data.
- **Repo:** https://github.com/DennisR2828/trainer — **PUBLIC**, under **DennisR2828** (the user's
  own GitHub). ⚠️ NOT `cqdesignsny` (that's a different/Cesar account). See "Deploying" for the
  account gotcha.
- **Stack:** zero-dependency, zero-build vanilla PWA — plain HTML + ES modules + IndexedDB. No
  framework, no npm, no build step. Works fully offline once installed.
- **State:** the workout side is feature-complete and polished. **Diet is now its own tab** —
  a researched meal database + a per-slot "pick a meal" sheet ranked to your remaining macros.
- **Accounts are live.** Email/password sign-in, data synced to Vercel Blob. Reads still come from
  local IndexedDB so the app works offline; writes push on a debounce. Signup needs `SIGNUP_CODE`.
  Two users planned: Dennis and his girlfriend. Manual backup (Plan → Export) still works.

---

## Pick it up on another computer

```bash
git clone https://github.com/DennisR2828/trainer.git
cd trainer
python3 -m http.server 4178            # any static server works; SW needs http, not file://
# open http://127.0.0.1:4178
```

- **Your logged data does NOT come with the repo** — it lives in each browser locally. To move it:
  on the old device, app → **Plan → Your data → Export backup** (a JSON file); on the new device,
  **Import backup**.
- **To deploy from another machine**, you need the GitHub CLI authenticated as DennisR2828
  (`gh auth login`) or git push credentials for that account. Then `git push` (see "Deploying").

---

## How to run + verify locally

```bash
cd ~/fitness-tracker
python3 -m http.server 4178 --bind 127.0.0.1   # or double-click Trainer.command
# open http://127.0.0.1:4178
```

### ⚠️ Dev caching gotcha (this WILL bite you)
The service worker is cache-first, so edits don't show on a normal reload. To see changes:
- **Easiest:** use an **incognito window** (no prior service worker there).
- **Otherwise**, in the DevTools console:
  ```js
  (async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    location.reload();
  })()
  ```
  then **reload a SECOND time** (the SW re-caches on the first reload, serves fresh on the second).
  The SW precaches with `cache:'reload'` (bypasses the HTTP cache), so a version bump is reliable —
  but the *local dev* view still needs the double-reload.

---

## Deploying (push → phone updates)

Hosting is **Vercel** as of 2026-08-04. The project is connected to this GitHub repo, so a push to
`main` builds and deploys automatically — no CLI, no token needed.

```bash
cd ~/fitness-tracker
gh auth switch --user DennisR2828      # ⚠️ REQUIRED — see gotcha
gh api user --jq .login                # MUST print DennisR2828 before you push
git push origin main                   # Vercel builds and deploys
```

- ⚠️ **The active `gh` account keeps drifting back to `cqdesignsny`.** Always switch + verify
  before any push. A guard like `A=$(gh api user --jq .login); [ "$A" = DennisR2828 ] || exit 1`
  already caught a wrong-account push. The repo's git commit identity is set repo-locally to
  DennisR2828 (global git config is untouched).
- ⚠️ **Bump `CACHE` in `sw.js`** (`trainer-vN` → `vN+1`) whenever you change any **precached** file
  (anything in the `SHELL` list), or phones won't pick up the change. Currently **v16**.
- Verify it's live by curling a changed file:
  `curl -s https://trainer-dman-industries.vercel.app/sw.js | grep -o trainer-v[0-9]*`
- **On the iPhone:** open the app on wifi, then **close it fully and reopen** (the new service
  worker installs in the background; the second open switches to it).

### Vercel account gotcha (mirrors the GitHub one)
The Vercel project lives under **`dman-industries`** — Dennis's **personal** Vercel
(`dmanbananaman`), NOT the **cqdesignsny** Vercel where CQ Designs client work lives.

- The Vercel **CLI's global login on this laptop is deliberately left as `cqdesignsny`.** Do not run
  `vercel login` / `vercel logout` here — it would break client deploys from this machine.
- If a CLI deploy is ever needed, use a scoped personal token instead of switching the login:
  `vercel deploy --prod --token "$(cat ~/.trainer-vercel-token)"`. The `--token` flag overrides the
  global login per-command, so `auth.json` is never rewritten.
- Normally you shouldn't need the CLI at all — just push to `main`.

### Things that will silently break a fresh Vercel project
- **Deployment Protection is ON by default.** New projects 302 every visitor to a Vercel login wall,
  which looks like the app is broken. It's disabled here (`ssoProtection: null`); if the app ever
  starts redirecting to `vercel.com/login`, that's what came back on.
- **`vercel.json` rejects unknown keys.** A stray `"comment"` field fails the whole deploy with
  "Schema verification failed". JSON has no comments; don't add them.
- **Vercel's GitHub App needs repo access.** If `vercel git connect` fails with a "typos or private
  repo" error, the real cause is the App being installed with *selected repositories* that exclude
  this one. Fix at github.com/settings/installations → Vercel → Configure.

---

## What's DONE (feature by feature)

**PWA shell** — `index.html`, `manifest.webmanifest`, `sw.js`. Installable, offline (cache-first
precache of the whole app shell), app icons (incl. maskable + apple-touch), iOS home-screen support
(status-bar `black` + `env(safe-area-inset-*)` so it clears the notch).

**Data layer** — `js/db.js`. IndexedDB, abstracted behind functions (swap to cloud later touches
only this file). Stores: `profile`, `plan`, `days` (one per YYYY-MM-DD), `meta`. Plus **backup
export/import** (`exportAll`/`importAll`) and a `requestPersistence()` call so the browser won't
evict data.

**Onboarding → generator** — `js/screens/onboarding.js` (tap-to-answer intake quiz) →
`js/generator.js` (Mifffin-St Jeor BMR → TDEE → calorie/macro targets, and a training split by
days/week filtered for equipment + injuries). Lands on Today.

**Today** — `js/screens/daylog.js`. Bold **day hero** with focus, chips, and a live **"X / Y done"
completion bar** (exercises + cardio; turns green at 100%). Each exercise has a **tap-to-complete
checkbox** (this is the fast "I did my day" path — no set logging). Tapping a row expands a
**how-to** (form cues + "Watch demo" link) and a **Replace** button. Interactive **cardio finisher**.
Per-set weight/reps logging was intentionally removed.

**Calendar** — `js/screens/calendar.js`. Month grid; each day shows a check when the workout was
done (reads the checkboxes via `dayStatus` in `log.js`). Tap a day → its log.

**Progress** — `js/screens/progress.js`. Bodyweight line chart + quick weigh-in, plus a
weekly + all-time summary of workouts done.

**Plan (editable)** — in `js/app.js` (`renderPlan`). Shows targets + the weekly split, **swap any
exercise** (opens the picker sheet), re-run intake, and the data backup controls.

**Exercise database + swaps** — `js/exercise-db.js` (~95 moves across 14 muscle groups, ordered
most-recommended first, with injury/equipment filtering) + `js/screens/replace.js`. Replace opens a
**bottom sheet** picker (slides up over a dimmed backdrop; auto-dismisses on pick / backdrop / ✕ /
Escape). The list is **scoped to the muscle groups the day trains** (a lower day never shows upper),
ranked **same-muscle first as a top-5 "Recommended," then "More options."** A pick **persists to the
plan template** (`plan.days[p].exercises[i]` + `savePlan`) so it sticks for future days. Works from
Today AND the Plan tab.

**Exercise how-to** — `exerciseInfo()`/`demoSearchUrl()` in `js/exercises.js`: target muscles +
form cues + a "Watch demo" YouTube-search link, shown in each exercise's expanded panel.

**Design** — vibrant cool palette on a deep near-black base: **electric-violet brand accent**
(`--accent #9470ff`), jewel-tone macro data colors (magenta cal, green protein, blue carbs, cyan
fat). Bundled **Archivo** font (offline). WCAG-AA contrast verified, `prefers-reduced-motion`
handled, `:focus-visible` states. All tokens are CSS variables in `css/styles.css :root`.

**Diet (its own tab)** — `js/screens/diet.js`. Calorie + protein rings (protein-first) with
carbs/fat bars, a card per meal slot (breakfast/lunch/dinner/snack), and an "Add {slot}" that opens
a ranked **meal-idea sheet** (`js/screens/meal-picker.js`) fitting the day's remaining calories/
protein. Backed by `js/food-db.js` — ~57 dietitian/trainer-sourced high-protein meals (+ staples),
macro-validated (4·P + 4·C + 9·F ≈ kcal). A slim nudge on Today links here. `day.food` items now
carry `carbs`, `fat` and `slot`. (The legacy inline diet card on the day log / calendar ring stays
gated behind `DIET_ENABLED` in `js/config.js`, still `false`.)

---

**Accounts + sync (2026-08-04)** — `api/` (Vercel Functions) + `js/api.js` + `js/screens/auth.js`.
Email/password sign-in gates the app. Passwords use scrypt (N=32768) and sessions are HMAC-SHA256
signed tokens, both from `node:crypto` — no auth dependency, no invented crypto. Storage is Vercel
Blob (`trainer-data`, private): `users/<sha256(email)>.json`, `userids/<userId>.json` (reverse
index), `data/<userId>.json` (the snapshot). `db.js` keeps IndexedDB as the read path and pushes the
whole snapshot on a 1.5s debounce, retrying on reconnect and on backgrounding. Each account gets its
own database (`trainer-u-<userId>`), so two people can share a phone.

### Auth gotchas worth remembering
- **Env vars:** `SESSION_SECRET` (rotating it signs everyone out), `SIGNUP_CODE` (signup gate — the
  app is on a public URL), `BLOB_READ_WRITE_TOKEN` (auto-set by the Blob integration). All three are
  set in Production, Preview, and Development.
- Production/Preview env vars are **sensitive by default**, meaning write-only — `vercel env pull`
  returns them blank. That is expected, not a failure. Pull from **development** to read a value.
- `vercel env add` needs `--value X --yes` to run non-interactively; piping to stdin silently stores
  an **empty string**. Preview additionally refuses both and needs the REST API (`POST /v10/projects/
  <id>/env` with `target:["preview"]`).
- The service worker **must skip `/api`** — its fetch handler is cache-first for every same-origin
  GET, which would otherwise serve a stale signed-in state or one account's snapshot to the next
  person who signs in on that device.
- A failed `/api/auth/me` does **not** sign you out; only an explicit 401 does. Otherwise a dead
  connection would lock you out of an offline-first app.

**Intake rebuilt as a trainer consultation (2026-08-04)** — `js/screens/onboarding.js`. ~29 questions,
branched (27 male / 28 female / 29 if postpartum). Adds motivation, timeline, what derailed you last
time, attitude to lifting heavy, **confidence**, a condensed PAR-Q, diet pattern, allergens, weight
trend, and alcohol. Six previously-dead answers now drive the plan.

### What sex actually changes — and what it deliberately does not
Before this, `buildSplit()` never received `sex`; men and women got byte-identical workouts and the
only difference in the whole app was one constant in the BMR formula. Now `sex` sets **rest
intervals** (women 120s/60s vs men 150s/90s) and **nudges volume up ~10%** for women. Grounded in
trained women completing ~2× the reps of men in a matched multi-set protocol with similar soreness
and 1RM recovery — the advantage is between-set recovery, not slower fatigue.

It does **not** change exercise selection. Same movement patterns for everyone.

**There is deliberately no menstrual-cycle periodization.** Current evidence shows no effect of cycle
phase on strength performance or adaptation, and umbrella reviews call programming around it
premature. Lots of women's apps do it anyway. Don't add it without new evidence.

Female **life stage** does change programming: irregular/absent cycles and early postpartum cap the
deficit (low energy availability is the one harm this app could actively cause); pregnancy goes to
maintenance; uncleared postpartum swaps hanging/supine core for gentler options.

### Traps in this area
- **`scaleVolume` carries its rounding remainder across the day on purpose.** Rounding each exercise
  independently swallows any modest factor whole (3 sets × 1.1 → 3), which silently nulled the entire
  female volume bump until it was fixed. Don't "simplify" it back.
- **The PAR-Q section is recorded only** — it does not gate or soften the plan. That was an explicit
  call for a two-person private app. Revisit if this ever goes wider.
- `isAllowedFood()` filters allergens by **matching ingredient words in the recipe text**, because the
  meals have diet tags but no ingredient tags. It is a heuristic. Tagging all ~57 meals properly is
  the durable fix.
- Reference-user regression is the acceptance check for generator changes:
  M/26/6'0"/257lb/sitting → **2240 cal / 210P / 215C / 60F**.

## ▶ What's NEXT

**Tune against real users.** The intake and the sex-aware generator are in (see "What's DONE"), but
nobody has run it with real numbers yet. Dennis and his girlfriend sign up, run the intake, and the
plans get judged against what they actually want. Expect tuning of the volume factor and the split
templates rather than structural change.

**Split templates are still one-size.** `pickTemplate()` returns the same day structures for
everyone; only sets, rest, and substitutions vary. If the plans come back wrong for her, that is the
next place to look — likely more direct glute/hamstring and upper-back work in the templates rather
than anything sex-conditional in the code.

**Weekly editing is done** (2026-08-04) — Plan tab, per-day **Edit** mode with reorder / remove /
swap / add. Adds reuse the ranked picker with **no anchor exercise**, so `alternativesFor('')` ranks
across every muscle group that day already trains and excludes what is on it; injury and equipment
filters still apply. Rest is re-derived via `applyRest()` after every structural edit rather than
carried through, because it depends on sex and on whether the new movement is a compound.

Note that plan edits reach **today** automatically: `log.js` only materializes a day record once you
log something, so an untouched day re-reads the edited plan. A workout already in progress is left
alone on purpose.

**The diet section is DONE** (2026-07-06): its own tab, `js/food-db.js` (~57 researched meals +
staples), `js/screens/diet.js`, and the `js/screens/meal-picker.js` sheet, with a Today nudge —
see "What's DONE" above. Natural follow-ups:

- **Capture a diet preference in onboarding** (omnivore / vegetarian / vegan). `food-db.js`'s ranker
  already filters on `profile.diet` via `isAllowedFood` — onboarding just needs to set that field.
- **Meal favorites / recents** + a "log again" shortcut; maybe portion scaling (½× / 2×).
- Surface diet on **Calendar / Progress** (the calendar diet ring already exists behind `DIET_ENABLED`).

### Other parked ideas
- Plan tab: add / remove / reorder exercises (only swap-in-place exists today).
- Show last-session weights as a hint; PR tracking; per-exercise rest timer.
- Supabase sync so friends get accounts + multi-device (the data layer is abstracted for it).
- Reset a mangled plan → Plan tab → Re-run intake (already works).

---

## Key decisions / gotchas (don't re-litigate)

- **GitHub = DennisR2828, never cqdesignsny.** Switch + verify before every push.
- **Data is local-only, per browser.** The only backup is Plan → Your data → Export. Remind the user.
- **iOS install:** Safari → Share → **Add to Home Screen**, then **onboard inside the installed app**
  (iOS gives the home-screen app its own storage, separate from the Safari tab).
- **The user does not log weights/reps** — the app is a check-off + how-to + swap tool. Diet logging
  is also opt-in. Keep it fast; don't re-add friction without being asked.
- **Design lives in `css/styles.css :root`.** Accent is one line (`--accent`). Macro colors are for
  data only (rings/tiles), not chrome.
- **Generator coefficients** are tunable constants atop `js/generator.js`. Reference user
  (M/26/6'0"/257 lb/sitting) → **2240 cal / 210 P / 215 C / 60 F**.

---

## File map

```
index.html                app shell (appbar, #view, bottom tab bar) + PWA/iOS meta
manifest.webmanifest      PWA manifest
sw.js                     service worker (precache SHELL; bump CACHE on precached-file changes)
css/styles.css            all styles + :root design tokens
fonts/archivo.woff2       bundled font (offline)
icons/                    app icons (gen_icons.py regenerates the PNGs)
js/
  app.js                  boot, SW registration, first-run routing, tab router, Plan screen
  config.js               feature flags (DIET_ENABLED)
  db.js                   IndexedDB data layer + backup export/import (only storage touchpoint)
  ui.js                   shared DOM helper (h) + SVG progress ring
  log.js                  day-log helpers: load/init a day, totals, workout status, weigh-ins
  generator.js            calorie/macro math + training-split assembly
  exercises.js            exercise library (templates), equipment/injury filters, how-to cues
  exercise-db.js          ~95-move database + ranked, day-scoped swap suggestions
  food-db.js              ~57-meal food database + target-aware meal suggestions
  screens/
    onboarding.js         intake quiz → plan preview
    today.js              thin wrapper → daylog for today
    daylog.js             the workout view (Today + Calendar day): hero, checkboxes, finisher
    calendar.js           month grid; per-day status; tap a day to open its log
    progress.js           bodyweight chart + weigh-in + weekly/all-time summary
    replace.js            the "Replace exercise" bottom-sheet picker
    diet.js               the Diet tab: rings, meal slots, custom add, staples
    meal-picker.js        the "Add a meal" bottom-sheet picker (ranked to targets)
Trainer.command           double-click launcher (local Mac server + open browser)
enable/disable-autostart.command   optional: run the local server at login (opt-in)
LOCAL-SETUP.md            full guide to running/installing locally on a Mac
README.md                 project reference
```

## Commit history (what shipped, newest first)
```
7474b07  Intake: rebuild as a real trainer consultation; sex now reaches the split
e9dbb6b  docs: accounts + sync, and the env-var traps this build hit
dac97e9  Accounts: email/password auth + per-user cloud sync on Vercel Blob
12f158f  docs: hosting moved to Vercel; record the account + first-deploy gotchas
839b1da  Vercel: drop unsupported key from vercel.json, ignore .vercel
8b7632e  Vercel: static hosting config (never cache sw.js or index.html)
547807f  SW: auto-reload on controllerchange so updates don't leave stale JS; cache v16
7c435d2  Calendar: fix 7-column grid overflow on narrow screens; cache v15
34039da  Diet: its own tab with a researched meal database + pick-a-meal sheet
486db59  docs: comprehensive README + HANDOFF for resuming anywhere
82bd67b  Replace picker as a bottom sheet (auto-dismiss, more distinct)
2098b8e  Exercise database + persistent, day-scoped swaps + editable Plan
7e15deb  Today: drop per-set logging; expand shows only how-to + replace
67e18c9  Today: tap-to-complete checkbox + replace-exercise swap
b3a154e  Today redesign (day hero + progress + completion), diet behind flag
d031dab  Redesign: vibrant cool palette, SVG tab icons, notch-safe top
b939637  Initial: local-first fitness & diet tracker PWA (onboarding→generator, Today,
         Calendar, Progress, Plan, backup, offline, GitHub Pages)
```
