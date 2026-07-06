/* "Add a meal" bottom sheet — the diet twin of replace.js. Slides up over a
 * dimmed backdrop and shows meal ideas for one slot (breakfast/lunch/dinner/
 * snack), ranked to fit the day's REMAINING calories/protein: a short "Best for
 * your targets" set, then "More ideas." Each row shows the how-to + macros;
 * tapping it logs that meal. Dismisses on pick, backdrop, ✕, or Escape. */

import { h } from '../ui.js';
import { rankedMeals, SLOT_LABEL } from '../food-db.js';

export function openMealSheet({ slot, remaining = {}, profile = {}, onPick }) {
  const slotLabel = SLOT_LABEL[slot] || 'Meal';
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Add ${slotLabel}`, tabindex: '-1' });

  let closing = false;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    if (closing) return;
    closing = true;
    backdrop.classList.remove('open');
    sheet.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => backdrop.remove(), 300);
  }
  const pick = (m) => { close(); onPick(m); };

  const proLeft = Math.max(0, Math.round(remaining.protein || 0));
  const calLeft = Math.round(remaining.calories || 0);
  const goal = proLeft > 0
    ? `${proLeft}g protein${calLeft > 0 ? ` · ${calLeft} cal` : ''} left today`
    : 'protein goal already hit — anything here keeps it easy';

  const header = h('div', { class: 'sheet-hd' }, [
    h('div', { class: 'sheet-htext' }, [
      h('div', { class: 'sheet-eyebrow' }, `Add ${slotLabel.toLowerCase()}`),
      h('div', { class: 'sheet-title' }, 'Meal ideas'),
      h('div', { class: 'sheet-goal muted small' }, goal),
    ]),
    h('button', { class: 'sheet-close', type: 'button', 'aria-label': 'Close', onClick: close }, '✕'),
  ]);

  const body = h('div', { class: 'sheet-body' });
  const ranked = rankedMeals(slot, remaining, profile);
  if (!ranked.length) {
    body.append(h('p', { class: 'muted pad' }, 'No meal ideas for this slot yet.'));
  } else {
    const top = ranked.slice(0, 6);
    const rest = ranked.slice(6);
    const macro = (val, unit, cls) => h('span', { class: `mm ${cls || ''}` }, `${val}${unit}`);
    const row = (m) => h('button', { class: 'meal-row', type: 'button', onClick: () => pick(m) }, [
      h('span', { class: 'meal-main' }, [
        h('span', { class: 'meal-name' }, m.name),
        h('span', { class: 'meal-how' }, m.how),
        h('span', { class: 'meal-macros' }, [
          macro(m.kcal, ' cal', 'mm-cal'),
          macro(m.protein, 'g P', 'mm-pro'),
          macro(m.carbs, 'g C', 'mm-carb'),
          macro(m.fat, 'g F', 'mm-fat'),
          m.prepMin ? h('span', { class: 'meal-prep' }, `${m.prepMin} min`) : null,
        ]),
      ]),
      h('span', { class: 'meal-add', 'aria-hidden': 'true' }, '+'),
    ]);
    body.append(h('div', { class: 'alt-section' }, 'Best for your targets'));
    top.forEach((m) => body.append(row(m)));
    if (rest.length) {
      body.append(h('div', { class: 'alt-section' }, 'More ideas'));
      rest.forEach((m) => body.append(row(m)));
    }
  }

  sheet.append(h('div', { class: 'sheet-grip' }), header, body);
  backdrop.append(sheet);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => { backdrop.classList.add('open'); sheet.classList.add('open'); sheet.focus(); });
}
