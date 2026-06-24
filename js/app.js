/* App shell: service-worker registration, first-run routing, bottom-nav router.
 *
 * Fully built (steps 1-3): PWA shell, data layer, onboarding -> generator -> save,
 * Today (scheduled workout + targets), Plan (read-only plan + re-run intake).
 * Placeholder (steps 4-7): Calendar, Progress, and the Today/diet logging UI. */

import { isOnboarded, setFlag, saveProfile, savePlan, getPlan, exportAll, importAll, requestPersistence, todayKey } from './db.js';
import { generatePlan } from './generator.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderToday } from './screens/today.js';
import { renderCalendar } from './screens/calendar.js';
import { renderProgress } from './screens/progress.js';

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

const TITLES = { today: 'Today', calendar: 'Calendar', plan: 'Plan', progress: 'Progress' };

registerSW();
requestPersistence(); // keep local data from being evicted
boot();

async function boot() {
  if (await isOnboarded()) showApp('today');
  else startOnboarding();
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
  if (route === 'plan') return renderPlan(view);
  if (route === 'calendar') return renderCalendar(view);
  if (route === 'progress') return renderProgress(view);
}

/* ---- Plan screen: read-only view of the generated plan + re-run intake ---- */
async function renderPlan(mount) {
  const plan = await getPlan();
  mount.innerHTML = '';
  if (!plan) { mount.append(h('p', { class: 'muted pad' }, 'No plan yet.')); return; }
  const t = plan.targets;
  const macro = (label, val, cls) => h('div', { class: `macro ${cls}` }, [
    h('div', { class: 'macro-val' }, [String(val), h('span', {}, label === 'Calories' ? '' : 'g')]),
    h('div', { class: 'macro-lbl' }, label),
  ]);

  const dayCards = plan.days.map((d) => h('div', { class: 'card' }, [
    h('div', { class: 'card-hd' }, [h('h3', {}, d.name), h('span', { class: 'card-sub' }, d.focus || '')]),
    d.exercises.length
      ? h('ul', { class: 'ex-list' }, d.exercises.map((e) =>
          h('li', { class: 'ex-row' }, [h('span', { class: 'ex-name' }, e.name), h('span', { class: 'ex-target' }, `${e.sets} × ${e.reps}`)])))
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
    h('div', { class: 'section-label' }, plan.splitName),
    ...dayCards,
    h('button', { class: 'btn btn-ghost btn-lg', type: 'button', onClick: startOnboarding }, 'Re-run intake'),

    h('div', { class: 'section-label' }, 'Your data'),
    h('div', { class: 'card' }, [
      h('p', { class: 'muted small' }, 'Everything is stored only on this device. Export a backup file to keep it safe or move it to another browser or device.'),
      h('div', { class: 'data-btns' }, [
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: doExport }, 'Export backup'),
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: doImport }, 'Import backup'),
      ]),
      dataStatus,
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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed:', err));
  });
}
