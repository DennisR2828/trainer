/* Progress (step 7): bodyweight trend (line chart + quick weigh-in) and a
 * weekly / all-time summary of workouts completed and diet days on target. */

import { h, clearNode, num } from '../ui.js';
import { getProfile, getPlan, getDays, todayKey } from '../db.js';
import { dayStatus, isTrainingDay, bodyweightSeries, weekKeys, logBodyweight } from '../log.js';

const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const shortDate = (key) => { const [, m, d] = key.split('-'); return `${num(m)}/${num(d)}`; };

export async function renderProgress(mount) {
  const [profile, plan] = await Promise.all([getProfile(), getPlan()]);
  const targets = plan ? plan.targets : null;

  async function draw() {
    const [series, rows] = await Promise.all([bodyweightSeries(profile), getDays()]);
    const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));
    clearNode(mount);
    mount.append(h('div', { class: 'screen' }, [
      bodyweightCard(series),
      weekCard(byDate),
      allTimeCard(rows),
    ]));
  }

  /* ---- bodyweight ---- */
  function bodyweightCard(series) {
    const start = profile ? profile.weightLb : (series[0] && series[0].lb);
    const goal = profile ? profile.goalWeightLb : null;
    const current = series.length ? series[series.length - 1].lb : start;
    const losing = goal != null && start != null ? start > goal : true;
    const toGo = goal != null ? Math.round(Math.abs(current - goal)) : null;
    const changed = start != null ? Math.round(current - start) : 0;

    const stat = (label, val) => h('div', { class: 'pstat' }, [h('div', { class: 'pstat-val' }, String(val)), h('div', { class: 'pstat-lbl' }, label)]);

    const wInput = h('input', { class: 'food-in', type: 'number', inputmode: 'decimal', placeholder: 'lb', 'aria-label': 'Today’s weight' });
    const logBtn = h('button', { class: 'btn btn-primary', type: 'button', onClick: async () => {
      const v = num(wInput.value); if (!v) return; await logBodyweight(todayKey(), v); draw();
    } }, 'Log');
    wInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') logBtn.click(); });

    return h('div', { class: 'card' }, [
      h('div', { class: 'card-hd' }, [h('h2', {}, 'Bodyweight'), h('span', { class: 'card-sub' }, goal != null ? `Goal ${goal} lb` : '')]),
      h('div', { class: 'pstats' }, [
        stat('Start', start ?? '--'),
        stat('Now', current ?? '--'),
        stat(changed <= 0 ? 'Lost' : 'Gained', `${Math.abs(changed)} lb`),
        toGo != null ? stat('To go', `${toGo} lb`) : null,
      ]),
      chart(series, goal, losing),
      h('div', { class: 'food-add-row', style: 'margin-top:14px' }, [
        h('label', { class: 'weigh-lbl muted small' }, 'Log today'),
        wInput, logBtn,
      ]),
    ]);
  }

  /* ---- this week ---- */
  function weekCard(byDate) {
    const today = todayKey();
    const week = weekKeys(today);
    let scheduled = 0, done = 0, onTarget = 0;
    const dots = week.map((key, i) => {
      const rec = byDate[key];
      const st = rec ? dayStatus(rec, targets) : null;
      const training = isTrainingDay(plan, key);
      if (training) scheduled++;
      if (st && st.workoutLogged) done++;
      if (st && st.onTarget) onTarget++;
      let cls = 'pd';
      if (st && st.workoutLogged) cls += ' done';
      else if (training && key < today) cls += ' miss';
      else if (training) cls += ' sched';
      if (key === today) cls += ' is-today';
      return h('div', { class: 'pd-cell' }, [h('span', { class: cls }), h('span', { class: 'pd-wd' }, WD[i])]);
    });
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-hd' }, [h('h2', {}, 'This week'), h('span', { class: 'card-sub' }, 'Mon–Sun')]),
      h('div', { class: 'week-dots' }, dots),
      h('div', { class: 'week-tallies' }, [
        h('div', { class: 'wt' }, [h('b', {}, `${done}/${scheduled || 0}`), ' workouts']),
        h('div', { class: 'wt' }, [h('b', {}, String(onTarget)), ' diet days on target']),
      ]),
    ]);
  }

  /* ---- all time ---- */
  function allTimeCard(rows) {
    let workouts = 0, target = 0;
    for (const r of rows) { const st = dayStatus(r, targets); if (st.workoutLogged) workouts++; if (st.onTarget) target++; }
    const stat = (label, val) => h('div', { class: 'pstat' }, [h('div', { class: 'pstat-val' }, String(val)), h('div', { class: 'pstat-lbl' }, label)]);
    return h('div', { class: 'card' }, [
      h('h2', {}, 'All time'),
      h('div', { class: 'pstats' }, [stat('Workouts', workouts), stat('On-target diet days', target)]),
    ]);
  }

  await draw();
}

/* ---- dependency-free SVG line chart ---- */
function chart(series, goal, losing) {
  const W = 300, H = 150, pad = { l: 32, r: 12, t: 14, b: 22 };
  if (!series.length) return h('p', { class: 'muted small pad-y' }, 'Log a weigh-in to start your trend.');

  const ys = series.map((p) => p.lb).concat(goal != null ? [goal] : []);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 5; max += 5; }
  const m = (max - min) * 0.12; min -= m; max += m;

  const n = series.length;
  const X = (i) => (n > 1 ? pad.l + (i * (W - pad.l - pad.r)) / (n - 1) : pad.l + (W - pad.l - pad.r) / 2);
  const Y = (v) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);

  const line = series.map((p, i) => `${X(i).toFixed(1)},${Y(p.lb).toFixed(1)}`).join(' ');
  const dots = series.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.lb).toFixed(1)}" r="${i === n - 1 ? 4 : 2.6}" class="${i === n - 1 ? 'pt-now' : 'pt'}"/>`).join('');
  const goalLine = goal != null
    ? `<line x1="${pad.l}" y1="${Y(goal).toFixed(1)}" x2="${W - pad.r}" y2="${Y(goal).toFixed(1)}" class="goal-line"/>`
      + `<text x="${W - pad.r}" y="${(Y(goal) - 4).toFixed(1)}" class="ax goal-tx" text-anchor="end">goal ${goal}</text>`
    : '';
  const yLabels = `<text x="2" y="${(Y(max) + 9).toFixed(1)}" class="ax">${Math.round(max)}</text>`
    + `<text x="2" y="${Y(min).toFixed(1)}" class="ax">${Math.round(min)}</text>`;
  const xLabels = `<text x="${X(0).toFixed(1)}" y="${H - 6}" class="ax" text-anchor="start">${shortDate(series[0].date)}</text>`
    + (n > 1 ? `<text x="${X(n - 1).toFixed(1)}" y="${H - 6}" class="ax" text-anchor="end">${shortDate(series[n - 1].date)}</text>` : '');

  return h('div', { class: 'chart', html:
    `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" class="wt-chart">
       ${goalLine}
       <polyline points="${line}" class="wt-line ${losing ? 'down' : 'up'}"/>
       ${dots}${yLabels}${xLabels}
     </svg>` });
}
