/* Shared "Replace exercise" list — a ranked, scrollable list of alternatives
 * scoped to the day's muscle groups: top 5 "Recommended" (best same-muscle
 * matches), then "More options". Used by Today and the Plan tab. */

import { h, clearNode } from '../ui.js';
import { alternativesFor } from '../exercise-db.js';

export function renderReplaceList(container, { exerciseName, dayExerciseNames, profile, onPick }) {
  clearNode(container);
  const ranked = alternativesFor(exerciseName, dayExerciseNames, profile);
  if (!ranked.length) {
    container.append(h('p', { class: 'muted small pad-y' }, 'No alternatives found for this one.'));
    return;
  }
  const top = ranked.slice(0, 5);
  const rest = ranked.slice(5);
  const row = (a, n) => h('button', { class: 'alt-row', type: 'button', onClick: () => onPick(a.name) }, [
    h('span', { class: 'alt-rank' }, String(n)),
    h('span', { class: 'alt-name' }, a.name),
    h('span', { class: 'alt-muscle' }, a.label),
  ]);
  const list = h('div', { class: 'alt-list' }, [
    h('div', { class: 'alt-section' }, 'Recommended'),
    ...top.map((a, i) => row(a, i + 1)),
  ]);
  if (rest.length) {
    list.append(h('div', { class: 'alt-section' }, 'More options'));
    rest.forEach((a, i) => list.append(row(a, i + 1 + top.length)));
  }
  container.append(list);
}
