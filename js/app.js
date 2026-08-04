/* App shell: service-worker registration, first-run routing, bottom-nav router.
 *
 * Tabs: Today (scheduled workout + targets), Calendar (month grid), Plan
 * (editable — swap exercises, re-run intake, data backup), Progress (bodyweight
 * chart + weekly/all-time summaries). The diet logging UI is built but gated
 * behind DIET_ENABLED in config.js. */

import { isOnboarded, setFlag, saveProfile, savePlan, getPlan, getProfile, exportAll, importAll, requestPersistence, todayKey, setActiveUser, syncDown, syncUp } from './db.js';
import { getToken, getCachedUser, clearSession, fetchMe, ApiError } from './api.js';
import { generatePlan } from './generator.js';
import { renderAuth } from './screens/auth.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderToday } from './screens/today.js';
import { renderCalendar } from './screens/calendar.js';
import { renderProgress } from './screens/progress.js';
import { renderDiet } from './screens/diet.js';
import { openReplaceSheet } from './screens/replace.js';

const view = document.getElementById('view');
const appbar = document.getElementById('appbar');
const tabbar = document.getElementById('tabbar');
const titleEl = document.getElementById('appbar-title');

const h = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};

const TITLES = { today: 'Today', diet: 'Diet', calendar: 'Calendar', plan: 'Plan', progress: 'Progress' };

registerSW();
requestPersistence(); // keep local data from being evicted
boot();

async function boot() {
  if (!getToken()) return showAuth();

  // A stored token is almost always still good, so confirm it with the server —
  // but a dead connection must not lock anyone out of an offline-first app.
  // Only an explicit 401 signs you out; a failed fetch falls back to the cached
  // identity and runs on local data until the connection returns.
  let user = getCachedUser();
  try {
    user = await fetchMe();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearSession();
      return showAuth();
    }
    if (!user) return showAuth(); // offline with nothing cached: nothing to open
  }
  await enterApp(user);
}

function showAuth() {
  document.body.classList.add('is-onboarding');
  appbar.hidden = true;
  tabbar.hidden = true;
  renderAuth(view, { onAuthed: enterApp });
}

async function enterApp(user) {
  setActiveUser(user.id);
  document.body.classList.remove('is-onboarding');
  // Pull whatever this account already has. A failure here is normal (offline,
  // or a brand-new account with nothing saved), so it must not block boot.
  try { await syncDown(); } catch { /* fall through to whatever is local */ }
  if (await isOnboarded()) showApp('today');
  else startOnboarding();
}

async function signOut() {
  // Flush pending writes before dropping the session, or the last few taps of a
  // workout would be lost with no way to recover them.
  try { await syncUp(); } catch { /* offline — local copy stays on the device */ }
  clearSession();
  location.reload();
}

function startOnboarding() {
  document.body.classList.add('is-onboarding');
  appbar.hidden = true;
  tabbar.hidden = true;
  renderOnboarding(view, { onComplete: finishOnboarding });
}

async function finishOnboarding(profile) {
  const plan = generatePlan(profile);
  await saveProfile(profile);
  await savePlan(plan);
  await setFlag('onboarded', true);
  document.body.classList.remove('is-onboarding');
  showApp('today');
}

function showApp(route) {
  appbar.hidden = false;
  tabbar.hidden = false;
  wireTabs();
  navigate(route);
}

function wireTabs() {
  tabbar.querySelectorAll('.tab').forEach((btn) => {
    btn.onclick = () => navigate(btn.dataset.route);
  });
}

function navigate(route) {
  titleEl.textContent = TITLES[route] || '';
  tabbar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.route === route));
  view.scrollTop = 0;
  if (route === 'today') return renderToday(view);
  if (route === 'diet') return renderDiet(view);
  if (route === 'plan') return renderPlan(view);
  if (route === 'calendar') return renderCalendar(view);
  if (route === 'progress') return renderProgress(view);
}

/* ---- Plan screen: editable plan (swap exercises) + re-run intake ---- */
async function renderPlan(mount) {
  const [plan, profile] = await Promise.all([getPlan(), getProfile()]);
  mount.innerHTML = '';
  if (!plan) { mount.append(h('p', { class: 'muted pad' }, 'No plan yet.')); return; }
  const t = plan.targets;
  const macro = (label, val, cls) => h('div', { class: `macro ${cls}` }, [
    h('div', { class: 'macro-val' }, [String(val), h('span', {}, label === 'Calories' ? '' : 'g')]),
    h('div', { class: 'macro-lbl' }, label),
  ]);

  // tap a plan exercise to swap it (opens the picker sheet); saves to the plan
  const planRow = (d, k, e, j) => h('li', { class: 'plan-ex-item' }, [
    h('button', { class: 'plan-ex', type: 'button', onClick: () => openReplaceSheet({
      exerciseName: e.name,
      dayExerciseNames: d.exercises.map((x) => x.name),
      profile,
      onPick: async (newName) => {
        plan.days[k].exercises[j] = { name: newName, sets: e.sets, reps: e.reps };
        await savePlan(plan);
        renderPlan(mount);
      },
    }) }, [
      h('span', { class: 'ex-name' }, e.name),
      h('span', { class: 'ex-target' }, e.rest ? `${e.sets} × ${e.reps} · ${e.rest}s` : `${e.sets} × ${e.reps}`),
      h('span', { class: 'plan-swap', 'aria-hidden': 'true' }, '⇄'),
    ]),
  ]);

  const dayCards = plan.days.map((d, k) => h('div', { class: 'card' }, [
    h('div', { class: 'card-hd' }, [h('h3', {}, d.name), h('span', { class: 'card-sub' }, d.focus || '')]),
    d.exercises.length
      ? h('ul', { class: 'ex-list' }, d.exercises.map((e, j) => planRow(d, k, e, j)))
      : h('p', { class: 'muted small' }, 'Rest / active recovery.'),
    d.cardio ? h('div', { class: 'cardio-tag' }, `Finish: ${d.cardio}`) : null,
    d.note ? h('p', { class: 'muted small' }, d.note) : null,
  ]));

  const dataStatus = h('p', { class: 'muted small', role: 'status' }, '');

  mount.append(h('div', { class: 'screen' }, [
    h('div', { class: 'card' }, [
      h('h2', {}, 'Daily targets'),
      h('div', { class: 'macro-grid' }, [
        macro('Calories', t.calories, 'cal'), macro('Protein', t.protein, 'pro'),
        macro('Carbs', t.carbs, 'carb'), macro('Fat', t.fat, 'fat'),
      ]),
      h('p', { class: 'muted small' }, `Steps ${t.steps.min.toLocaleString()}-${t.steps.max.toLocaleString()} daily. BMR ${t._debug.bmr}, TDEE ${t._debug.tdee}.`),
    ]),
    // why the plan looks the way it does — surfaced once, not buried in a tooltip
    ...((plan.notes || []).map((n) => h('p', { class: 'ob-callout' }, n))),

    h('div', { class: 'section-label' }, plan.splitName),
    ...dayCards,
    h('button', { class: 'btn btn-ghost btn-lg', type: 'button', onClick: startOnboarding }, 'Re-run intake'),

    h('div', { class: 'section-label' }, 'Your account'),
    h('div', { class: 'card' }, [
      h('div', { class: 'card-hd' }, [
        h('h3', {}, getCachedUser()?.name || 'Signed in'),
        h('span', { class: 'card-sub' }, getCachedUser()?.email || ''),
      ]),
      h('p', { class: 'muted small' }, 'Your plan and logs save to this device instantly and sync to your account, so they follow you to any phone you sign in on.'),
      h('div', { class: 'data-btns' }, [
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: doExport }, 'Export backup'),
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: doImport }, 'Import backup'),
      ]),
      dataStatus,
      h('button', { class: 'btn btn-ghost btn-lg', type: 'button', onClick: signOut }, 'Sign out'),
    ]),
  ]));

  async function doExport() {
    const name = `trainer-backup-${todayKey()}.json`;
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    dataStatus.textContent = `Saved ${name} to your downloads.`;
  }

  function doImport() {
    const input = h('input', { type: 'file', accept: 'application/json,.json' });
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!confirm('Import this backup? It replaces your current profile and plan, and merges in its logged days.')) return;
      try {
        await importAll(JSON.parse(await file.text()));
        location.reload();
      } catch (e) { dataStatus.textContent = `Could not import: ${e.message}`; }
    });
    input.click();
  }
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // SW needs a server origin (https or http://localhost); silently skip on file://
  if (location.protocol === 'file:') return;
  // If the page is already SW-controlled, a later controller change means a NEW
  // version activated (the SW uses skipWaiting + clients.claim). Reload once so we
  // run the fresh JS instead of a stale mix of new HTML + old modules — the exact
  // thing that made a new tab appear but not route. (Skip on first-ever load, when
  // there's no controller yet, so the initial claim doesn't cause a reload.)
  if (navigator.serviceWorker.controller) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed:', err));
  });
}
