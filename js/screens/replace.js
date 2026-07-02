/* "Replace exercise" bottom sheet — a focused picker that slides up over a
 * dimmed backdrop. Shows the ranked list (top-5 "Recommended" then "More
 * options", scoped to the day's muscle groups). Dismisses on pick, backdrop
 * tap, the close button, or Escape — so it never lingers. Shared by Today + Plan. */

import { h } from '../ui.js';
import { alternativesFor } from '../exercise-db.js';

export function openReplaceSheet({ exerciseName, dayExerciseNames, profile, onPick }) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Replace ${exerciseName}`, tabindex: '-1' });

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
  const pick = (name) => { close(); onPick(name); };

  const header = h('div', { class: 'sheet-hd' }, [
    h('div', { class: 'sheet-htext' }, [
      h('div', { class: 'sheet-eyebrow' }, 'Replace'),
      h('div', { class: 'sheet-title' }, exerciseName),
    ]),
    h('button', { class: 'sheet-close', type: 'button', 'aria-label': 'Close', onClick: close }, '✕'),
  ]);

  const body = h('div', { class: 'sheet-body' });
  const ranked = alternativesFor(exerciseName, dayExerciseNames, profile);
  if (!ranked.length) {
    body.append(h('p', { class: 'muted pad' }, 'No alternatives found for this one.'));
  } else {
    const top = ranked.slice(0, 5);
    const rest = ranked.slice(5);
    const row = (a, n) => h('button', { class: 'alt-row', type: 'button', onClick: () => pick(a.name) }, [
      h('span', { class: 'alt-rank' }, String(n)),
      h('span', { class: 'alt-name' }, a.name),
      h('span', { class: 'alt-muscle' }, a.label),
    ]);
    body.append(h('div', { class: 'alt-section' }, 'Recommended'));
    top.forEach((a, i) => body.append(row(a, i + 1)));
    if (rest.length) {
      body.append(h('div', { class: 'alt-section' }, 'More options'));
      rest.forEach((a, i) => body.append(row(a, i + 1 + top.length)));
    }
  }

  sheet.append(h('div', { class: 'sheet-grip' }), header, body);
  backdrop.append(sheet);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => { backdrop.classList.add('open'); sheet.classList.add('open'); sheet.focus(); });
}
