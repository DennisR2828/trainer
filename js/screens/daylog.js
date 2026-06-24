/* Day log: workout set logging (with how-to + demo link) and diet logging
 * (quick add food, calorie/protein rings). Renders for any date, so it powers
 * both Today and the Calendar day-detail view. */

import { h, clearNode, ring, num } from '../ui.js';
import { getPlan } from '../db.js';
import { loadDay, persistDay, foodTotals, uid } from '../log.js';
import { exerciseInfo, demoSearchUrl } from '../exercises.js';

export async function renderDayLog(mount, dateKey, opts = {}) {
  const plan = await getPlan();
  const day = await loadDay(dateKey, plan);
  const targets = plan ? plan.targets : { calories: 2000, protein: 150, carbs: 200, fat: 60 };

  let saveTimer;
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => persistDay(day), 350); };

  clearNode(mount);
  const wrap = h('div', { class: 'screen' });

  // header: optional back + date
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

  wrap.append(renderWorkout());
  const dietHost = h('div');
  wrap.append(dietHost);
  renderDiet(dietHost);
  mount.append(wrap);

  /* ---------- workout ---------- */
  function renderWorkout() {
    if (!day.workout) {
      return h('div', { class: 'card card-rest' }, [
        h('h2', {}, 'Rest day'),
        h('p', { class: 'muted' }, 'Optional walk. Hit your step goal and your protein.'),
      ]);
    }
    const w = day.workout;
    const items = w.exercises.map((ex, i) => exerciseItem(ex, i));
    return h('div', { class: 'card' }, [
      h('div', { class: 'card-hd' }, [h('h2', {}, w.dayName), h('span', { class: 'card-sub' }, w.focus || '')]),
      h('div', { class: 'ex-items' }, items),
      w.cardio ? h('div', { class: 'cardio-tag' }, `Finish: ${w.cardio}`) : null,
      w.note ? h('p', { class: 'muted small' }, w.note) : null,
    ]);
  }

  function exerciseItem(ex, i) {
    // pad set rows up to the target so the inputs are ready to fill
    while (ex.sets.length < ex.targetSets) ex.sets.push({ weight: '', reps: '' });

    const status = h('span', { class: 'ex-status' });
    const updateStatus = () => {
      const done = ex.sets.filter((s) => num(s.reps) > 0).length;
      status.textContent = done ? `${done}/${ex.targetSets} sets` : `${ex.targetSets} × ${ex.targetReps}`;
      status.classList.toggle('done', done > 0);
    };

    const setRows = h('div', { class: 'set-rows' });
    const addRow = (j) => setRows.append(setRow(ex, j, updateStatus, scheduleSave));
    ex.sets.forEach((_, j) => addRow(j));

    const addBtn = h('button', { class: 'set-add', type: 'button', onClick: () => { ex.sets.push({ weight: '', reps: '' }); addRow(ex.sets.length - 1); } }, '+ Add set');

    const item = h('div', { class: 'ex-item' }, [
      h('button', {
        class: 'ex-head', type: 'button', 'aria-expanded': 'false',
        onClick: (e) => {
          const open = item.classList.toggle('open');
          e.currentTarget.setAttribute('aria-expanded', String(open));
        },
      }, [
        h('span', { class: 'ex-name' }, ex.name),
        h('span', { class: 'ex-right' }, [status, h('span', { class: 'ex-caret' }, '⌄')]),
      ]),
      h('div', { class: 'ex-panel' }, [
        h('div', { class: 'set-grid-hd' }, [h('span', {}, 'Set'), h('span', {}, 'Weight'), h('span', {}, 'Reps')]),
        setRows,
        addBtn,
        howTo(ex.name),
      ]),
    ]);
    updateStatus();
    return item;
  }

  /* ---------- diet ---------- */
  function renderDiet(host) {
    clearNode(host);
    const totals = foodTotals(day);
    const card = h('div', { class: 'card' }, [
      h('div', { class: 'card-hd' }, [h('h2', {}, 'Diet'), h('span', { class: 'card-sub' }, 'Protein first')]),
      h('div', { class: 'rings' }, [
        ring({ value: totals.calories, max: targets.calories, color: 'var(--cal)', label: 'Calories' }),
        ring({ value: totals.protein, max: targets.protein, color: 'var(--pro)', label: 'Protein', unit: 'g' }),
      ]),
      h('p', { class: 'diet-ref muted small' }, dietRemark(totals)),
      foodList(host),
      addFood(host),
    ]);
    host.append(card);
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
          day.food = day.food.filter((x) => x.id !== f.id);
          persistDay(day); renderDiet(host);
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
      persistDay(day);
      renderDiet(host);
    };
    const add = h('button', { class: 'btn btn-primary', type: 'button', onClick: submit }, 'Add');
    // Enter in any field submits, for fast logging
    [name, cal, pro].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
    return h('div', { class: 'food-add-form' }, [name, h('div', { class: 'food-add-row' }, [cal, pro, add])]);
  }
}

/* set row: weight + reps inputs that mutate the model and debounce-save */
function setRow(ex, j, updateStatus, scheduleSave) {
  const mk = (field, ph) => {
    const inp = h('input', {
      class: 'set-in', type: 'number', inputmode: 'decimal', placeholder: ph, value: ex.sets[j][field] ?? '',
    });
    inp.addEventListener('input', () => { ex.sets[j][field] = inp.value; updateStatus(); scheduleSave(); });
    return inp;
  };
  return h('div', { class: 'set-row' }, [
    h('span', { class: 'set-n' }, String(j + 1)),
    mk('weight', 'lb'),
    mk('reps', ex.targetReps),
  ]);
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
