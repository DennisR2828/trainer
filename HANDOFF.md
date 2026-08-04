# HANDOFF — Trainer (pick up from any session or machine)

**App:** "Trainer" — a local-first, mobile fitness (and soon diet) tracker PWA.
**Last updated:** 2026-08-04. **Deployed:** cache `trainer-v16`, hosted on **Vercel**.

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
- **Data is local-only** (in the browser, per device). No account, no cloud. Backups are manual
  (Plan → Your data → Export).

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

## ▶ What's NEXT

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
