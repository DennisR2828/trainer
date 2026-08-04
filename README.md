# Trainer — Personal Fitness Tracker (PWA)

A mobile-first, **local-first**, **offline-first** workout tracker you install to your phone's home
screen. It runs a first-time intake quiz, generates your calorie/macro targets and a training split,
then gives you a fast check-off workout for each day with built-in how-to guidance and one-tap
exercise swaps, plus a dedicated **Diet tab** with a researched meal database.

- **Live:** https://trainer-dman-industries.vercel.app (Vercel)
- **Repo:** https://github.com/DennisR2828/trainer
- **Stack:** zero dependencies, **zero build step** — plain HTML, CSS, and ES modules with IndexedDB.
  No framework, no npm, no bundler.

> Resuming work on this project? Read **[HANDOFF.md](HANDOFF.md)** first — it has the current status,
> the deploy workflow (and gotchas), and what's next.

---

## Features

- **A real trainer intake → auto-generated plan.** ~29 tap-to-answer questions, branched, modelled on
  how trainers and dietitians actually run a first consultation: your goal *and the reason behind it*,
  what derailed you last time, how confident you honestly are, how you sleep and recover, a health
  screen, and how you eat. Sets calories and macros (Mifflin-St Jeor BMR → TDEE → targets) and builds
  a split filtered for your equipment, injuries, session length, and recovery.
- **Today = a fast workout checklist.** A bold day hero with a live "X / Y done" progress bar. Each
  exercise is a tap-to-complete checkbox. Tap a row for **how-to** (form cues + a "Watch demo" video
  link) or to **Replace** it. An interactive cardio finisher rounds out the day.
- **Replace any exercise.** Opens a bottom-sheet picker with a **ranked list scoped to that day's
  muscles** (a lower day only shows lower-body options) — a top-5 "Recommended" (best same-muscle
  matches) then "More options." Picks **save to your plan**, so they stick for future days. ~95
  exercises across 14 muscle groups, injury/equipment-aware.
- **Calendar.** Month grid marking which days you worked out; tap a day to see/edit its log.
- **Progress.** Bodyweight trend chart + quick weigh-in, plus weekly and all-time workout summaries.
- **Editable weekly plan.** Each day has an **Edit** mode: reorder, remove, swap, or add exercises,
  saved to your week the moment you tap. Additions are ranked and scoped to the muscle groups that
  day already trains, so leg day stays leg day. Re-run the intake any time to regenerate.
- **Accounts + sync.** Email/password sign-in. Reads always come from local IndexedDB (so the app is
  instant and works with no signal), and writes push to your account on a short debounce. Sign in on
  any phone and your plan, workouts, and history come down with you. Two people can share a device —
  each account gets its own local database. Export/Import a backup JSON still works.
- **Diet tab.** Its own tab with calorie + protein rings (protein-first) and carbs/fat bars, a card
  per meal slot, and an **Add** that opens a meal-idea sheet **ranked to your remaining macros**. ~57
  easy, high-protein meals (dietitian/trainer-sourced, macro-checked) plus protein staples live in
  `js/food-db.js`; a slim nudge on Today links to it.

---

## Run it locally

A tiny static server is required (service workers and the local database don't work from a `file://`
page). Python is built into macOS, so there's nothing to install:

```bash
cd fitness-tracker
python3 -m http.server 4178
# open http://127.0.0.1:4178
```

On a Mac you can also just double-click **`Trainer.command`**. Full local/install guide:
**[LOCAL-SETUP.md](LOCAL-SETUP.md)**.

> **Editing gotcha:** the service worker caches aggressively, so edits may not show on a plain
> reload. Use an incognito window, or unregister the SW + clear caches + reload twice. Details in
> HANDOFF.

## Install on your phone (iOS)

1. Open **https://trainer-dman-industries.vercel.app** in **Safari**.
2. Share → **Add to Home Screen**.
3. Open the new icon and go through the intake **there** (the installed app has its own storage,
   separate from Safari). After the first load it works fully offline.

---

## Architecture

```
index.html                app shell + PWA / iOS meta
manifest.webmanifest      PWA manifest
sw.js                     service worker (precache shell; bump CACHE on changes; skips /api)
vercel.json               static hosting headers (sw.js/index.html must never be cached)
package.json              exists only for the /api functions — the client has no dependencies
css/styles.css            all styles + :root design tokens
fonts/archivo.woff2       bundled font
icons/                    app icons (gen_icons.py regenerates PNGs)
api/                      Vercel Functions (Node)
  _lib/auth.js            scrypt password hashing + HMAC session tokens (node:crypto only)
  _lib/store.js           Vercel Blob read/write + shared response helpers
  auth/register.js        POST — create an account (gated by SIGNUP_CODE)
  auth/login.js           POST — exchange email/password for a token
  auth/me.js              GET  — validate a stored token on boot
  data.js                 GET/PUT — pull and push this user's snapshot
js/
  app.js                  boot, auth gate, SW registration, routing, bottom-nav, Plan screen
  api.js                  the only module that knows about the session token
  config.js               feature flags (DIET_ENABLED)
  db.js                   IndexedDB + sync (the only storage touchpoint)
  ui.js                   shared DOM helper + SVG progress ring
  log.js                  day-log helpers (load/init a day, totals, status, weigh-ins)
  generator.js            calorie/macro math + split assembly
  exercises.js            exercise templates, equipment/injury filters, how-to cues
  exercise-db.js          ~95-move database + ranked, day-scoped swap suggestions
  food-db.js              ~57-meal food database + target-aware meal suggestions
  screens/
    auth.js  onboarding.js  today.js  daylog.js  calendar.js  progress.js
    replace.js  diet.js  meal-picker.js
```

**Data model (IndexedDB, via `db.js`):** each account gets its own database, `trainer-u-<userId>`.
- `profile` — intake answers (singleton).
- `plan` — generated `targets` + `days` split (singleton); editing a workout writes here.
- `days` — one record per `YYYY-MM-DD`: the day's workout (with per-exercise `done` flags), any
  weigh-in, and food (when diet is on).
- `meta` — small flags (`onboarded`).

**Sync.** Local is the read path; nothing blocks on the network. A write marks the store dirty and
pushes the whole snapshot after a 1.5s debounce, retrying when the connection returns and when the
app is backgrounded. Server-side, the blob key comes from the verified session and never from the
request body, so one account cannot address another's data.

**Auth.** Passwords are hashed with scrypt (N=32768) and sessions are HMAC-SHA256 signed tokens,
both from `node:crypto` — there is no auth dependency and no hand-rolled crypto. Signup requires
`SIGNUP_CODE` because the app sits on a public URL. Rotating `SESSION_SECRET` invalidates every
session at once.

## Design system

Deep cool-dark base with a single committed brand accent — **electric violet** (`--accent`, used for
actions, the active tab, focus, and identity). Macro data uses a jewel-tone scale (calories magenta,
protein green, carbs blue, fat cyan), confined to rings and tiles. Type is **Archivo** (bundled,
offline). All colors are CSS variables in `css/styles.css :root` — change the identity there; the
accent is one line. Contrast is verified to WCAG AA; `prefers-reduced-motion` and `:focus-visible`
are handled.

## Generator notes

`js/generator.js` computes BMR (Mifflin-St Jeor) → TDEE (activity multiplier) → calorie target
(deficit for fat loss) → protein/fat per bodyweight → carbs fill the rest. All coefficients are
tunable constants at the top of the file. Reference user (M, 26, 6'0", 257 lb, mostly sitting) →
**2240 cal / 210 P / 215 C / 60 F** — that's the acceptance check for any change here.

Beyond the formulas, the plan responds to the things a trainer would actually adjust for:

| Input | Effect |
|---|---|
| **Confidence** | Low confidence shrinks the training week. Self-efficacy is the strongest known predictor of adherence, so a smaller plan finished beats a bigger one abandoned |
| **Sleep / stress / training age** | Scale training volume — you adapt to what you recover from |
| **Session length** | Trims each day, dropping isolation work before compounds |
| **Goal weight + timeline** | Produces an honest pace, and says so when it misses the timeline you picked |
| **Sex** | Sets rest intervals and nudges volume — see below |
| **Life stage** | Irregular cycles and early postpartum cap the deficit; pregnancy goes to maintenance; uncleared postpartum gets gentler core work |

### What sex changes

Rest intervals (women 120s/60s, men 150s/90s) and about 10% more volume for women. That comes from
trained women completing roughly twice the reps of men in a matched multi-set protocol with similar
soreness and 1RM recovery afterward — the advantage is in between-set recovery, not slower fatigue.

It does **not** change exercise selection. Squat, hinge, push, pull, carry, for everyone.

There is deliberately **no menstrual-cycle periodization**. Current evidence shows no effect of cycle
phase on strength performance or adaptation, so programming around it would invent precision that
isn't there.

## Deploying

Push to `main`; **Vercel** builds and deploys automatically. Two things to remember: the repo lives
under the **DennisR2828** GitHub account and the Vercel project under Dennis's **personal** account
(`dman-industries`) — never the cqdesignsny accounts — and **bump `CACHE` in `sw.js`** whenever a
precached file changes so installed phones pull the update. See HANDOFF for the exact commands and
the account/cache gotchas.

## License / notes

Personal project. The bundled Archivo font is under the SIL Open Font License. Exercise how-to links
point to public YouTube searches. No third-party runtime dependencies.
