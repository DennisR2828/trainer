# Trainer — Personal Fitness Tracker (PWA)

A mobile-first, **local-first**, **offline-first** workout tracker you install to your phone's home
screen. It runs a first-time intake quiz, generates your calorie/macro targets and a training split,
then gives you a fast check-off workout for each day with built-in how-to guidance and one-tap
exercise swaps. A diet section is built and coming next.

- **Live:** https://dennisr2828.github.io/trainer/ (GitHub Pages)
- **Repo:** https://github.com/DennisR2828/trainer
- **Stack:** zero dependencies, **zero build step** — plain HTML, CSS, and ES modules with IndexedDB.
  No framework, no npm, no bundler.

> Resuming work on this project? Read **[HANDOFF.md](HANDOFF.md)** first — it has the current status,
> the deploy workflow (and gotchas), and what's next.

---

## Features

- **Onboarding quiz → auto-generated plan.** A tap-to-answer intake sets your calories, protein,
  carbs, and fat (Mifflin-St Jeor BMR → TDEE → targets) and builds a weekly training split, filtered
  for your equipment and any injuries.
- **Today = a fast workout checklist.** A bold day hero with a live "X / Y done" progress bar. Each
  exercise is a tap-to-complete checkbox. Tap a row for **how-to** (form cues + a "Watch demo" video
  link) or to **Replace** it. An interactive cardio finisher rounds out the day.
- **Replace any exercise.** Opens a bottom-sheet picker with a **ranked list scoped to that day's
  muscles** (a lower day only shows lower-body options) — a top-5 "Recommended" (best same-muscle
  matches) then "More options." Picks **save to your plan**, so they stick for future days. ~120
  exercises across 14 muscle groups, injury/equipment-aware.
- **Calendar.** Month grid marking which days you worked out; tap a day to see/edit its log.
- **Progress.** Bodyweight trend chart + quick weigh-in, plus weekly and all-time workout summaries.
- **Editable Plan.** View and swap exercises for any day; re-run the intake to regenerate.
- **Your data, on your device.** Everything is stored locally (IndexedDB). No account, works offline.
  Export/Import a backup JSON to move between devices.
- **Diet (built, hidden for now).** Calorie/protein rings and food logging exist behind a feature
  flag; the next milestone turns diet into its own tab with a meal database (see HANDOFF).

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

1. Open **https://dennisr2828.github.io/trainer/** in **Safari**.
2. Share → **Add to Home Screen**.
3. Open the new icon and go through the intake **there** (the installed app has its own storage,
   separate from Safari). After the first load it works fully offline.

---

## Architecture

```
index.html                app shell + PWA / iOS meta
manifest.webmanifest      PWA manifest
sw.js                     service worker (precache app shell for offline; bump CACHE on changes)
css/styles.css            all styles + :root design tokens
fonts/archivo.woff2       bundled font
icons/                    app icons (gen_icons.py regenerates PNGs)
js/
  app.js                  boot, SW registration, routing, bottom-nav, Plan screen
  config.js               feature flags (DIET_ENABLED)
  db.js                   IndexedDB data layer + backup export/import (the only storage touchpoint)
  ui.js                   shared DOM helper + SVG progress ring
  log.js                  day-log helpers (load/init a day, totals, status, weigh-ins)
  generator.js            calorie/macro math + split assembly
  exercises.js            exercise templates, equipment/injury filters, how-to cues
  exercise-db.js          ~120-move database + ranked, day-scoped swap suggestions
  screens/
    onboarding.js  today.js  daylog.js  calendar.js  progress.js  replace.js
```

**Data model (IndexedDB, via `db.js`):**
- `profile` — intake answers (singleton).
- `plan` — generated `targets` + `days` split (singleton); editing a workout writes here.
- `days` — one record per `YYYY-MM-DD`: the day's workout (with per-exercise `done` flags), any
  weigh-in, and food (when diet is on).
- `meta` — small flags (`onboarded`).

Cloud sync (future) would replace the bodies of the `db.js` functions and nothing else.

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
**2240 cal / 210 P / 215 C / 60 F**.

## Deploying

Push to `main`; GitHub Pages rebuilds and serves the app. Two things to remember: the repo lives
under the **DennisR2828** GitHub account (make sure `gh`/git is authenticated as that account before
pushing), and **bump `CACHE` in `sw.js`** whenever a precached file changes so installed phones pull
the update. See HANDOFF for the exact commands and the Pages/cache gotchas.

## License / notes

Personal project. The bundled Archivo font is under the SIL Open Font License. Exercise how-to links
point to public YouTube searches. No third-party runtime dependencies.
