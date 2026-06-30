# HANDOFF — Trainer (pick up anytime)

**App:** "Trainer" — local-first, mobile fitness + diet tracker PWA.
**Last worked:** 2026-06-23.

Read this first when resuming, then `README.md` for architecture.

---

## TL;DR — where we are right now

- **Live on the phone** at **https://dennisr2828.github.io/trainer/** (GitHub Pages), cache `trainer-v10`.
  Deployed = vibrant palette + SVG tab icons + notch fix + **Today redesign** (day hero, live
  completion bar, exercise checkboxes, replace-exercise swap) + **diet hidden behind a flag**.
- **No blocking open task.** Everything built so far is verified in-browser and pushed.
- **Repo:** https://github.com/DennisR2828/trainer (PUBLIC) — under **DennisR2828**, the user's
  own account. ⚠️ NOT cqdesignsny/Cesar. `gh` has both accounts and **the active one drifts back
  to cqdesignsny** — always run `gh auth switch --user DennisR2828` and verify before any push.

---

## Recently shipped (Today tab, in `js/screens/daylog.js` + `css/styles.css`)

- Bold **day hero**: focus eyebrow, big day name, exercise/cardio chips, and a **live completion
  bar** ("X / Y done" across exercises + the cardio finisher; turns green at 100%).
- Each exercise has a **tap-to-complete checkbox** (shows its number, flips to a ✓; row strikes
  through). This is the fast "I did my day" path — independent of logging sets.
- **Replace exercise** (in the expanded panel): `suggestAlternatives()` in `exercises.js` offers
  same-muscle swaps, filtered by the user's equipment + injuries. Tap a chip to swap it in.
- Interactive **cardio finisher** you tap to check off (counts toward the bar).
- **Diet hidden** everywhere via `DIET_ENABLED` in `js/config.js` (flip to `true` to restore).
- SW now precaches with `cache:'reload'` so version bumps reliably reach phones.

All verified in-browser and deployed (v10).

## Ideas parked for next time
- Show last-session weights as a hint on each exercise; PR tracking.
- Per-exercise rest timer.
- Re-enable diet when wanted (`DIET_ENABLED = true`).
- Supabase sync (step 8) for multi-device.

---

## How to run / verify locally

```bash
cd ~/fitness-tracker
python3 -m http.server 4178 --bind 127.0.0.1
# open http://127.0.0.1:4178   (or double-click Trainer.command)
```

### Dev caching gotcha (important — this is what bit us)
The service worker is cache-first, so edits don't show on reload. To see changes, in DevTools
console (or just use an **incognito window**, which is cleanest):
```js
(async () => {
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  for (const k of await caches.keys()) await caches.delete(k);
  location.reload();
})()
```
Then **reload one more time** (the SW re-caches on the first reload, serves fresh on the second).
If still stale, hard-bypass: `fetch('js/screens/daylog.js',{cache:'reload'})` for the changed files,
then reload. Bumping `CACHE` in `sw.js` is required for real users to get updates, but does NOT
help local dev because the SW install re-fetches through the HTTP cache.

---

## Deploy (push → phone updates)

```bash
cd ~/fitness-tracker
gh api user --jq .login          # MUST print DennisR2828 (if not: gh auth switch --user DennisR2828)
git push origin main             # GitHub Pages rebuilds in ~1 min
```
Then on the iPhone: open the app on wifi, **close it fully and reopen** (the new service worker
installs in the background; the second open switches to it). If the very top ever looks tight
against the notch, **remove + re-add to Home Screen** (iOS caches the status-bar meta at install).

⚠️ When you change any **precached** file (anything in `SHELL` in `sw.js`), **bump `CACHE`**
(`trainer-vN` → `vN+1`) or phones won't pick up the change. Currently at **v9**.

---

## What's done (MVP steps 1–7, per the original spec §6)

1. PWA shell (manifest, service worker, offline, installable) ✓
2. IndexedDB data layer (`js/db.js`) ✓
3. Onboarding quiz → generator (calories/macros + split) → save ✓
4. Today: workout set logging (+ diet, now flag-hidden) ✓
5. Calendar (centerpiece): month grid, per-day status, tap to log ✓
6. Plan: read-only plan + re-run intake + **data backup export/import** ✓
7. Progress: bodyweight chart + weigh-in + weekly/all-time summary ✓
8. (Phase 2, not started) Supabase sync — data layer is abstracted for it.

Plus: exercise how-to cues + "Watch demo" links; **vibrant violet/jewel-tone design** on Archivo;
local-run helpers (`Trainer.command`, optional `enable-autostart.command`); GitHub + Pages hosting.

---

## Key facts / decisions (don't re-litigate)

- **GitHub account = DennisR2828** (personal). cqdesignsny is Cesar's — never push there.
  Commit identity is set repo-local to DennisR2828; global git config is untouched.
- **Data is local-only**, per-device, in the browser (IndexedDB). No cloud, no account.
  Backup via **Plan → Your data → Export** (the only safety net — remind the user occasionally).
- **Design = CSS variables in `css/styles.css :root`.** Accent (violet `#9470ff`) is one line.
  Macro colors: cal magenta, protein green, carbs blue, fat cyan. Type = bundled Archivo (offline).
- **Generator coefficients** are tunable constants atop `js/generator.js`. Reference user
  (M/26/6'0"/257) → 2240/210/215/60.
- **iOS:** status-bar style `black` (reserves notch space) + `env(safe-area-inset-*)` used directly
  (not via a CSS var — that was unreliable on iOS).

---

## File map (the bits you'll touch)

```
js/config.js              feature flags (DIET_ENABLED)
js/screens/daylog.js      Today + Calendar day view (the redesign lives here)
js/screens/calendar.js    month grid
js/screens/progress.js    bodyweight + summaries
js/generator.js           calories/macros + split logic
js/exercises.js           exercise library, filters, how-to cues
css/styles.css            all styles + :root design tokens
sw.js                     service worker (bump CACHE when precached files change)
```

## Ideas parked for later
- Re-enable diet (`DIET_ENABLED = true`) when the user wants to track food.
- Supabase sync (step 8) for multi-device.
- Optional: per-exercise rest timer, last-session weights shown as a hint, PR tracking.
