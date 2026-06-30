/* Day log: the workout for a date — a bold day hero with a live completion bar,
 * exercise rows with a tap-to-complete checkbox, a "replace exercise" swap, and
 * an expand for set logging + how-to. An interactive cardio finisher too.
 * Powers Today and the Calendar day-detail. Diet is built below but only shown
 * when DIET_ENABLED (see config.js). */

import { h, clearNode, ring, num } from '../ui.js';
import { getPlan, getProfile } from '../db.js';
import { loadDay, persistDay, foodTotals, uid } from '../log.js';
import { exerciseInfo, demoSearchUrl, suggestAlternatives } from '../exercises.js';
import { DIET_ENABLED } from '../config.js';

export async function renderDayLog(mount, dateKey, opts = {}) {
  const [plan, profile] = await Promise.all([getPlan(), getProfile()]);
  const day = await loadDay(dateKey, plan);
  const targets = plan ? plan.targets : { calories: 2000, protein: 150, carbs: 200, fat: 60 };
  const reRender = () => renderDayLog(mount, dateKey, opts);

  let saveTimer;
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => persistDay(day), 350); };

  clearNode(mount);
  const wrap = h('div', { class: 'screen' });

  const d = new Date(dateKey + 'T00:00:00');
  const dateLabel = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  if (opts.onBack) {
    wrap.append(h('div', { class: 'daylog-head' }, [
      h('button', { class: 'ob-back', type: 'button', 'aria-label': 'Back', onClick: opts.onBack }, '‹'),
      h('span', { class: 'daylog-date' }, dateLabel),
    ]));
  } else {
    wrap.append(h('p', { class: 'today-date' }, dateLabel));
  }

  wrap.append(...renderWorkout());

  if (DIET_ENABLED) {
    const dietHost = h('div');
    wrap.append(dietHost);
    renderDiet(dietHost);
  }
  mount.append(wrap);

  /* ---------- workout ---------- */
  function renderWorkout() {
    if (!day.workout) {
      return [h('div', { class: 'rest-hero' }, [
        h('div', { class: 'rest-badge' }, '☾'),
        h('h1', {}, 'Rest day'),
        h('p', { class: 'muted' }, 'Recover, walk if you feel like it, and keep your protein up.'),
      ])];
    }
    const w = day.workout;

    const heroFill = h('span');
    const heroPct = h('span', { class: 'hero-pct' });
    const heroDone = h('span', { class: 'hero-done' });
    const hero = h('section', { class: 'day-hero' }, [
      h('div', { class: 'day-hero-top' }, [
        h('div', {}, [
          h('div', { class: 'day-focus' }, w.focus || 'Training'),
          h('h1', { class: 'day-name' }, w.dayName),
        ]),
        heroPct,
      ]),
      h('div', { class: 'day-chips' }, [
        h('span', { class: 'chip' }, `${w.exercises.length} exercises`),
        w.cardio ? h('span', { class: 'chip chip-cardio' }, w.cardio) : null,
      ]),
      h('div', { class: 'hero-bar' }, [heroFill]),
      h('div', { class: 'hero-bar-label' }, [heroDone, ' done']),
    ]);

    function updateProgress() {
      const total = w.exercises.length + (w.cardio ? 1 : 0);
      const done = w.exercises.filter((e) => e.done).length + (w.cardio && w.cardioDone ? 1 : 0);
      const pct = total ? done / total : 0;
      heroFill.style.transform = `scaleX(${pct})`;
      heroDone.textContent = `${done} / ${total}`;
      heroPct.textContent = `${Math.round(pct * 100)}%`;
      hero.classList.toggle('is-complete', total > 0 && done >= total);
    }

    const list = h('div', { class: 'ex-items' }, w.exercises.map((ex, i) => exerciseItem(ex, i, updateProgress)));

    const blocks = [hero, h('div', { class: 'card card-flush' }, [list])];
    if (w.cardio) blocks.push(finisher(w, updateProgress));
    if (w.note) blocks.push(h('div', { class: 'day-note' }, [h('span', {}, '!'), w.note]));

    updateProgress();
    return blocks;
  }

  function exerciseItem(ex, i, updateProgress) {
    while (ex.sets.length < ex.targetSets) ex.sets.push({ weight: '', reps: '' });
    const info = exerciseInfo(ex.name);
    const item = h('div', { class: 'ex-item' + (ex.done ? ' done' : '') });

    // tap-to-complete checkbox (shows the position number until done, then a check)
    const check = h('button', {
      class: 'ex-check', type: 'button', 'aria-pressed': String(!!ex.done), 'aria-label': `Mark ${ex.name} done`,
      onClick: () => {
        ex.done = !ex.done;
        item.classList.toggle('done', ex.done);
        check.setAttribute('aria-pressed', String(ex.done));
        check.textContent = ex.done ? '✓' : String(i + 1);
        persistDay(day); updateProgress();
      },
    }, ex.done ? '✓' : String(i + 1));

    const status = h('span', { class: 'ex-status' });
    const updateStatus = () => {
      const logged = ex.sets.filter((s) => num(s.reps) > 0).length;
      status.textContent = logged ? `${logged}/${ex.targetSets}` : `${ex.targetSets} × ${ex.targetReps}`;
      status.classList.toggle('done', logged > 0);
    };

    const head = h('button', {
      class: 'ex-head', type: 'button', 'aria-expanded': 'false',
      onClick: (e) => { const open = item.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open)); },
    }, [
      h('span', { class: 'ex-main' }, [
        h('span', { class: 'ex-name' }, ex.name),
        info.muscles ? h('span', { class: 'ex-muscle' }, info.muscles) : null,
      ]),
      h('span', { class: 'ex-right' }, [status, h('span', { class: 'ex-caret' }, '⌄')]),
    ]);

    const setRows = h('div', { class: 'set-rows' });
    const addRow = (j) => setRows.append(setRow(ex, j, updateStatus, scheduleSave));
    ex.sets.forEach((_, j) => addRow(j));
    const addBtn = h('button', { class: 'set-add', type: 'button', onClick: () => { ex.sets.push({ weight: '', reps: '' }); addRow(ex.sets.length - 1); } }, '+ Add set');

    item.append(
      h('div', { class: 'ex-row-top' }, [check, head]),
      h('div', { class: 'ex-panel' }, [
        replaceControl(ex),
        h('div', { class: 'set-grid-hd' }, [h('span', {}, 'Set'), h('span', {}, 'Weight'), h('span', {}, 'Reps')]),
        setRows, addBtn, howTo(ex.name),
      ])
    );
    updateStatus();
    return item;
  }

  // "Replace exercise" — show fitting alternatives, tap one to swap it in
  function replaceControl(ex) {
    const optsBox = h('div', { class: 'replace-opts', hidden: true });
    const btn = h('button', { class: 'replace-btn', type: 'button', onClick: () => {
      if (!optsBox.hidden) { optsBox.hidden = true; return; }
      const exclude = day.workout.exercises.map((e) => e.name);
      const alts = suggestAlternatives(ex.name, profile, exclude);
      clearNode(optsBox);
      optsBox.append(h('div', { class: 'replace-hint muted small' }, alts.length ? 'Pick a swap that hits the same muscles:' : 'No good swap found for this one.'));
      alts.forEach((a) => optsBox.append(h('button', { class: 'alt-chip', type: 'button', onClick: () => {
        ex.name = a; ex.sets = []; ex.done = false; persistDay(day); reRender();
      } }, a)));
      optsBox.hidden = false;
    } }, '⇄  Replace exercise');
    return h('div', { class: 'replace' }, [btn, optsBox]);
  }

  function finisher(w, updateProgress) {
    const card = h('button', {
      class: 'finisher' + (w.cardioDone ? ' done' : ''), type: 'button',
      onClick: () => { w.cardioDone = !w.cardioDone; card.classList.toggle('done', w.cardioDone); persistDay(day); updateProgress(); },
    }, [
      h('span', { class: 'finisher-check' }, w.cardioDone ? '✓' : ''),
      h('span', { class: 'finisher-main' }, [h('span', { class: 'finisher-label' }, 'Finish with'), h('span', { class: 'finisher-text' }, w.cardio)]),
    ]);
    return card;
  }

  /* ---------- diet (only rendered when DIET_ENABLED) ---------- */
  function renderDiet(host) {
    clearNode(host);
    const totals = foodTotals(day);
    host.append(h('div', { class: 'card' }, [
      h('div', { class: 'card-hd' }, [h('h2', {}, 'Diet'), h('span', { class: 'card-sub' }, 'Protein first')]),
      h('div', { class: 'rings' }, [
        ring({ value: totals.calories, max: targets.calories, color: 'var(--cal)', label: 'Calories' }),
        ring({ value: totals.protein, max: targets.protein, color: 'var(--pro)', label: 'Protein', unit: 'g' }),
      ]),
      h('p', { class: 'diet-ref muted small' }, dietRemark(totals)),
      foodList(host), addFood(host),
    ]));
  }
  function dietRemark(totals) {
    const calLeft = targets.calories - totals.calories;
    const proLeft = targets.protein - totals.protein;
    const calPart = calLeft >= 0 ? `${calLeft} cal left` : `${-calLeft} cal over`;
    const proPart = proLeft > 0 ? `${proLeft}g protein to go` : 'protein goal hit';
    return `${calPart} · ${proPart} · carbs ${targets.carbs}g / fat ${targets.fat}g target`;
  }
  function foodList(host) {
    if (!day.food.length) return h('p', { class: 'muted small pad-y' }, 'No food logged yet.');
    return h('ul', { class: 'food-list' }, day.food.map((f) =>
      h('li', { class: 'food-row' }, [
        h('span', { class: 'food-name' }, f.name),
        h('span', { class: 'food-macros' }, `${num(f.calories)} cal · ${num(f.protein)}g`),
        h('button', { class: 'food-del', type: 'button', 'aria-label': `Remove ${f.name}`, onClick: () => {
          day.food = day.food.filter((x) => x.id !== f.id); persistDay(day); renderDiet(host);
        } }, '×'),
      ])
    ));
  }
  function addFood(host) {
    const name = h('input', { class: 'food-in name', type: 'text', placeholder: 'Food', 'aria-label': 'Food name' });
    const cal = h('input', { class: 'food-in', type: 'number', inputmode: 'numeric', placeholder: 'Cal', 'aria-label': 'Calories' });
    const pro = h('input', { class: 'food-in', type: 'number', inputmode: 'numeric', placeholder: 'Protein', 'aria-label': 'Protein grams' });
    const submit = () => {
      if (!name.value.trim() && !num(cal.value) && !num(pro.value)) return;
      day.food.push({ id: uid(), name: name.value.trim() || 'Food', calories: num(cal.value), protein: num(pro.value) });
      persistDay(day); renderDiet(host);
    };
    const add = h('button', { class: 'btn btn-primary', type: 'button', onClick: submit }, 'Add');
    [name, cal, pro].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
    return h('div', { class: 'food-add-form' }, [name, h('div', { class: 'food-add-row' }, [cal, pro, add])]);
  }
}

/* set row: weight + reps inputs; logging a rep marks the set's number */
function setRow(ex, j, updateStatus, scheduleSave) {
  const row = h('div', { class: 'set-row' });
  const mk = (field, ph) => {
    const inp = h('input', { class: 'set-in', type: 'number', inputmode: 'decimal', placeholder: ph, value: ex.sets[j][field] ?? '' });
    inp.addEventListener('input', () => {
      ex.sets[j][field] = inp.value;
      row.classList.toggle('done', num(ex.sets[j].reps) > 0);
      updateStatus(); scheduleSave();
    });
    return inp;
  };
  row.append(h('span', { class: 'set-n' }, String(j + 1)), mk('weight', 'lb'), mk('reps', ex.targetReps));
  if (num(ex.sets[j].reps) > 0) row.classList.add('done');
  return row;
}

/* how-to block: target muscles + form cues + watch-demo link */
function howTo(name) {
  const info = exerciseInfo(name);
  return h('div', { class: 'howto' }, [
    h('div', { class: 'howto-hd' }, [
      h('span', { class: 'howto-title' }, 'How to'),
      info.muscles ? h('span', { class: 'howto-muscles' }, info.muscles) : null,
    ]),
    h('ul', { class: 'howto-cues' }, info.cues.map((c) => h('li', {}, c))),
    h('a', { class: 'demo-link', href: demoSearchUrl(name), target: '_blank', rel: 'noopener noreferrer' }, '▶ Watch demo'),
  ]);
}
