# Trainer — Personal Fitness Tracker (PWA)

Mobile-first, offline-first workout and diet tracker. Calendar-first by design.
Zero dependencies, zero build step: plain HTML, CSS, and ES modules with IndexedDB.

## Run it

Service workers need a server origin (not `file://`), so serve the folder:

```bash
cd fitness-tracker
python3 -m http.server 4178
# open http://localhost:4178 on the phone or desktop
```

To install to a phone home screen: open the URL in Safari (iOS) or Chrome (Android)
and choose "Add to Home Screen". It then opens fullscreen and works offline.

## Build status (per HANDOFF §6)

| Step | Area | Status |
|---|---|---|
| 1 | PWA scaffold: manifest, service worker, installable, offline shell | Done |
| 2 | Data layer (IndexedDB) + profile + plan model | Done |
| 3 | Onboarding quiz (§2a) → generator (§2b, §2c) → save plan | Done |
| 4 | Today screen: workout set logging + diet logging (rings) | Done |
| 5 | Calendar (centerpiece): month grid, per-day workout check + diet ring, tap to log | Done |
| 6 | Plan screen + re-run intake | Done |
| 7 | Progress: bodyweight trend chart + weigh-in log + weekly/all-time summary | Done |
| 8 | Phase 2: Supabase sync | Not started (data layer is abstracted for the swap) |

MVP (steps 1–7) is feature-complete. A design-polish pass (reduced-motion support,
focus-visible states, placeholder/contrast verified to WCAG AA, ring fill motion,
≥40px tap targets) has been applied.

**Exercise how-to:** every exercise has bundled form cues + target muscles (offline),
plus a "Watch demo" link that opens a video search when online — see `exerciseInfo()`
and `demoSearchUrl()` in `exercises.js`, shown in each exercise's expanded panel.

## Architecture

```
index.html              app shell (appbar, #view, bottom tab bar)
manifest.webmanifest    PWA manifest
sw.js                   service worker (precache app shell, offline)
css/styles.css          mobile-first dark theme
js/
  app.js                boot, SW registration, first-run routing, tab router
  db.js                 IndexedDB data layer (the only storage touchpoint)
  ui.js                 shared DOM helpers + the SVG progress ring
  log.js                day-log helpers: load/init a day, totals, workout/diet status
  generator.js          §2b calories/macros + §2c split assembly
  exercises.js          exercise library, §5 split, equipment/injury filters, how-to cues
  screens/
    onboarding.js       §2a intake quiz → plan preview
    daylog.js           workout set logging + diet logging (used by Today and Calendar)
    today.js            the day log for the current date
    calendar.js         month grid; per-day status; tap a day to log it
    progress.js         bodyweight chart + weigh-in log + weekly/all-time summary
fonts/                  Archivo variable font, bundled for offline use
icons/                  app icons (gen_icons.py regenerates the PNGs)
```

## Design system

Warm near-black base with a single committed brand accent — **electric orange**
(`--accent`) for actions, the active tab, focus, and identity. Macro data keeps a
multi-hue scale (calories amber, protein green, carbs sky, fat violet), confined to
the rings and tiles. Type is **Archivo** (bundled, offline) with heavy weights and
tight tracking so the data reads as the hero. All colors are CSS variables in
`css/styles.css :root` — change the identity there; the accent is one line.

## Generator notes (§2b/§2c)

- **Reference user** (M, 26, 6'0", 257 lb, sitting, 5x): generator returns
  **2240 cal / 210 P / 215 C / 60 F** vs the doc's ≈ 2150 / 210 / 200 / 60.
  Protein and fat match exactly; calories/carbs are ~4% high because §2b's stated
  1.3 sitting multiplier yields a higher TDEE than the 2150 figure implies.
- All coefficients are one-line constants at the top of `generator.js`
  (`ACTIVITY_MULT`, `FAT_LOSS_DEFICIT`, `PROTEIN_G_PER_LB`, `FAT_G_PER_LB`).
  Note: §2b's prose says fat ≈ 0.35 g/lb (→ ~90 g) but its reference output says
  60 g; we follow the reference (0.24 g/lb). See the TUNING NOTES comment.
- **Injury filtering** runs last and is equipment-aware, so a knee-flagged user
  never ends up with a squat/lunge even after a limited-equipment downgrade.

## Data model

- `profile` (singleton) — intake answers.
- `plan` (singleton) — generated `targets` + `days` split.
- `days` — one row per `YYYY-MM-DD`: workout sets, food entries, steps, bodyweight (steps 4–7).
- `meta` — small flags (`onboarded`).

Everything reads/writes through `js/db.js`. Phase-2 cloud sync replaces those
function bodies only.
