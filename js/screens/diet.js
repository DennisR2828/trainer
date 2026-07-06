/* Diet tab — its own home for food, separate from the workout on Today.
 *
 * Shows the day's calorie + protein rings (protein-first, "remaining" framing),
 * then a card per meal slot (breakfast / lunch / dinner / snack). Each slot lists
 * what's logged and an "Add" button that opens the meal-idea sheet, ranked to fit
 * the day's remaining macros. A custom quick-add and a protein-staple reference
 * round it out. Reads/writes the same day.food model as the rest of the app. */

import { h, clearNode, ring, num } from '../ui.js';
import { getPlan, getProfile, todayKey } from '../db.js';
import { loadDay, persistDay, foodTotals, uid } from '../log.js';
import { SLOTS, STAPLES } from '../food-db.js';
import { openMealSheet } from './meal-picker.js';

const DEFAULT_TARGETS = { calories: 2000, protein: 150, carbs: 200, fat: 60 };

export async function renderDiet(mount) {
  const [plan, profile] = await Promise.all([getPlan(), getProfile()]);
  const dateKey = todayKey();
  const day = await loadDay(dateKey, plan);
  const targets = (plan && plan.targets) || DEFAULT_TARGETS;
  const reRender = () => renderDiet(mount);

  clearNode(mount);
  const wrap = h('div', { class: 'screen' });

  const totals = foodTotals(day);
  const remaining = { calories: targets.calories - totals.calories, protein: targets.protein - totals.protein };

  const d = new Date(dateKey + 'T00:00:00');
  wrap.append(h('p', { class: 'today-date' }, d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })));

  /* ---------- summary: rings + carbs/fat + remark ---------- */
  const calLeft = Math.round(targets.calories - totals.calories);
  const proLeft = Math.round(targets.protein - totals.protein);
  const remark = `${calLeft >= 0 ? `${calLeft} cal left` : `${-calLeft} cal over`} · ${proLeft > 0 ? `${proLeft}g protein to go` : 'protein goal hit 💪'}`;

  wrap.append(h('div', { class: 'card' }, [
    h('div', { class: 'card-hd' }, [h('h2', {}, "Today's fuel"), h('span', { class: 'card-sub' }, 'Protein first')]),
    h('div', { class: 'rings' }, [
      ring({ value: totals.calories, max: targets.calories, color: 'var(--cal)', label: 'Calories' }),
      ring({ value: totals.protein, max: targets.protein, color: 'var(--pro)', label: 'Protein', unit: 'g' }),
    ]),
    h('div', { class: 'macro-mini' }, [
      miniMacro('Carbs', totals.carbs, targets.carbs, 'carb'),
      miniMacro('Fat', totals.fat, targets.fat, 'fat'),
    ]),
    h('p', { class: 'diet-ref muted small' }, remark),
  ]));

  /* ---------- one card per meal slot ---------- */
  SLOTS.forEach((s) => wrap.append(slotSection(s)));

  /* ---------- custom quick-add + staples reference ---------- */
  wrap.append(customAdd(), staplesCard());

  mount.append(wrap);

  function miniMacro(label, val, max, cls) {
    const pct = max > 0 ? Math.min(1, val / max) : 0;
    return h('div', { class: `mini mini-${cls}` }, [
      h('div', { class: 'mini-top' }, [
        h('span', { class: 'mini-lbl' }, label),
        h('span', { class: 'mini-val' }, `${Math.round(val)} / ${max}g`),
      ]),
      h('div', { class: 'mini-bar' }, [h('span', { style: `transform:scaleX(${pct})` })]),
    ]);
  }

  function slotSection(s) {
    const items = day.food.filter((f) => (f.slot || 'other') === s.key);
    const kcal = items.reduce((t, f) => t + num(f.calories), 0);
    const pro = items.reduce((t, f) => t + num(f.protein), 0);
    return h('div', { class: 'card meal-slot' }, [
      h('div', { class: 'meal-slot-hd' }, [
        h('span', { class: 'meal-slot-title' }, [h('span', { class: 'meal-slot-ico' }, s.icon), s.label]),
        items.length
          ? h('span', { class: 'meal-slot-sum' }, `${Math.round(kcal)} cal · ${Math.round(pro)}g P`)
          : h('span', { class: 'meal-slot-sum muted' }, '—'),
      ]),
      items.length ? h('ul', { class: 'food-list' }, items.map(loggedRow)) : null,
      h('button', { class: 'meal-add-btn', type: 'button', onClick: () => openSheet(s.key) }, `＋  Add ${s.label.toLowerCase()}`),
    ]);
  }

  function loggedRow(f) {
    return h('li', { class: 'food-row' }, [
      h('span', { class: 'food-name' }, f.name),
      h('span', { class: 'food-macros' }, `${num(f.calories)} cal · ${num(f.protein)}g P`),
      h('button', { class: 'food-del', type: 'button', 'aria-label': `Remove ${f.name}`, onClick: () => removeFood(f.id) }, '×'),
    ]);
  }

  function openSheet(slotKey) {
    openMealSheet({ slot: slotKey, remaining, profile, onPick: (m) => logMeal(slotKey, m) });
  }

  function logMeal(slotKey, m) {
    day.food.push({ id: uid(), name: m.name, calories: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, slot: slotKey });
    persistDay(day);
    reRender();
  }

  function removeFood(id) {
    day.food = day.food.filter((x) => x.id !== id);
    persistDay(day);
    reRender();
  }

  function customAdd() {
    const name = h('input', { class: 'food-in name', type: 'text', placeholder: 'Custom food', 'aria-label': 'Food name' });
    const cal = h('input', { class: 'food-in', type: 'number', inputmode: 'numeric', placeholder: 'Cal', 'aria-label': 'Calories' });
    const pro = h('input', { class: 'food-in', type: 'number', inputmode: 'numeric', placeholder: 'Protein', 'aria-label': 'Protein grams' });
    const slotSel = h('select', { class: 'food-in', 'aria-label': 'Meal' }, SLOTS.map((s) => h('option', { value: s.key }, s.label)));
    const submit = () => {
      if (!name.value.trim() && !num(cal.value) && !num(pro.value)) return;
      day.food.push({ id: uid(), name: name.value.trim() || 'Food', calories: num(cal.value), protein: num(pro.value), slot: slotSel.value });
      persistDay(day);
      reRender();
    };
    const add = h('button', { class: 'btn btn-primary', type: 'button', onClick: submit }, 'Add');
    [name, cal, pro].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
    return h('div', { class: 'card' }, [
      h('div', { class: 'section-label', style: 'margin:0 0 10px' }, 'Add something custom'),
      h('div', { class: 'food-add-form' }, [name, h('div', { class: 'food-add-row four' }, [cal, pro, slotSel, add])]),
    ]);
  }

  function staplesCard() {
    return h('details', { class: 'card staples' }, [
      h('summary', { class: 'staples-sum' }, 'Protein staples'),
      h('ul', { class: 'staple-list' }, STAPLES.map((s) => h('li', { class: 'staple-row' }, [
        h('span', { class: 'staple-name' }, [s.name, h('span', { class: 'staple-per muted' }, s.per)]),
        h('span', { class: 'staple-macros' }, `${s.protein}g P · ${s.kcal} cal`),
      ]))),
    ]);
  }
}
