/* Calendar (centerpiece): month grid. Each day shows a check when a workout was
 * logged and a ring for diet progress (green when on target). Tap a day to open
 * its log. Monday-start weeks to match the schedule mapping. */

import { h, clearNode, num } from '../ui.js';
import { getPlan, getDays, todayKey } from '../db.js';
import { dayStatus, isTrainingDay } from '../log.js';
import { renderDayLog } from './daylog.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const keyOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export async function renderCalendar(mount) {
  const today = todayKey();
  const [ty, tm] = today.split('-').map(Number);
  let year = ty, month = tm - 1; // month 0-indexed

  const plan = await getPlan();
  const targets = plan ? plan.targets : null;

  async function draw() {
    const rows = await getDays();
    const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));
    clearNode(mount);

    const grid = h('div', { class: 'cal-grid' });
    WEEKDAYS.forEach((w) => grid.append(h('div', { class: 'cal-wd' }, w)));

    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;           // Monday-start offset
    const days = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < lead; i++) grid.append(h('div', { class: 'cal-cell empty' }));

    for (let dnum = 1; dnum <= days; dnum++) {
      const key = keyOf(year, month, dnum);
      grid.append(cell(key, dnum, byDate[key]));
    }

    mount.append(h('div', { class: 'screen' }, [
      h('div', { class: 'cal-bar' }, [
        h('button', { class: 'cal-nav', type: 'button', 'aria-label': 'Previous month', onClick: () => { month--; if (month < 0) { month = 11; year--; } draw(); } }, '‹'),
        h('div', { class: 'cal-title' }, `${MONTHS[month]} ${year}`),
        h('button', { class: 'cal-nav', type: 'button', 'aria-label': 'Next month', onClick: () => { month++; if (month > 11) { month = 0; year++; } draw(); } }, '›'),
      ]),
      grid,
      legend(),
    ]));

    function cell(key, dnum, rec) {
      const isToday = key === today;
      const isPast = key <= today;
      const st = rec ? dayStatus(rec, targets) : null;
      const training = isTrainingDay(plan, key);

      const marks = h('div', { class: 'cal-marks' });
      // workout: filled check if logged; faint dot if it was a scheduled training day not (yet) done
      if (st && st.workoutLogged) marks.append(h('span', { class: 'm-workout done' }, '✓'));
      else if (training && isPast) marks.append(h('span', { class: 'm-workout miss' }));
      else if (training) marks.append(h('span', { class: 'm-workout sched' }));
      // diet: tiny progress ring if any food logged
      if (st && st.dietLogged) {
        const pct = targets ? Math.min(1, st.totals.calories / targets.calories) : 0;
        const dash = (2 * Math.PI * 7).toFixed(1);
        marks.append(h('span', { class: 'm-diet', html:
          `<svg viewBox="0 0 18 18" width="16" height="16"><circle cx="9" cy="9" r="7" class="md-bg"></circle>`
          + `<circle cx="9" cy="9" r="7" class="md-fg ${st.onTarget ? 'ok' : ''}" stroke-dasharray="${dash}" stroke-dashoffset="${(2 * Math.PI * 7 * (1 - pct)).toFixed(1)}"></circle></svg>` }));
      }

      return h('button', {
        class: 'cal-cell' + (isToday ? ' today' : '') + (rec ? ' has' : ''), type: 'button',
        onClick: () => openDay(key),
      }, [h('span', { class: 'cal-num' }, String(dnum)), marks]);
    }
  }

  function openDay(key) {
    renderDayLog(mount, key, { onBack: () => draw() });
  }

  function legend() {
    return h('div', { class: 'cal-legend' }, [
      h('span', {}, [h('span', { class: 'lg lg-done' }, '✓'), ' workout logged']),
      h('span', {}, [h('span', { class: 'lg lg-ring' }), ' diet on target']),
    ]);
  }

  await draw();
}
