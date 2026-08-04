/* Curated exercise database + swap suggestions.
 *
 * EXERCISE_DB: muscle group -> exercises, ordered MOST-RECOMMENDED FIRST
 * (staple compound lifts up top, then variations / isolation; basic + some
 * intermediate). This ordering IS the ranking used for the swap list.
 *
 * alternativesFor() scopes suggestions to the muscle groups the *day* trains
 * (so a lower day never shows an upper move), ranks same-muscle matches first,
 * and filters out anything the user's injuries/equipment rule out. */

export const GROUP_LABEL = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', side_delts: 'Side delts', rear_delts: 'Rear delts',
  biceps: 'Biceps', triceps: 'Triceps', quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', core: 'Core', traps: 'Traps', forearms: 'Forearms',
};

export const EXERCISE_DB = {
  chest: ['Barbell bench press', 'Incline barbell press', 'Incline DB press', 'Flat DB press', 'Machine chest press', 'Incline machine press', 'Weighted dip', 'Cable fly', 'Pec deck', 'Push-up', 'Decline bench press'],
  back: ['Pull-up', 'Lat pulldown', 'Barbell row', 'Seated cable row', 'Chest-supported DB row', 'One-arm DB row', 'T-bar row', 'Machine row', 'Inverted row', 'Straight-arm pulldown', 'Chin-up'],
  shoulders: ['Overhead barbell press', 'Seated DB shoulder press', 'Machine shoulder press', 'Arnold press', 'Push press', 'Landmine press'],
  side_delts: ['DB lateral raise', 'Cable lateral raise', 'Machine lateral raise', 'Leaning cable raise', 'Upright row'],
  rear_delts: ['Face pull', 'Reverse pec deck', 'Bent-over reverse fly', 'Cable rear-delt fly', 'Band pull-apart'],
  biceps: ['Barbell curl', 'DB curl', 'Hammer curl', 'Incline DB curl', 'Cable curl', 'Preacher curl', 'Concentration curl'],
  triceps: ['Tricep pushdown', 'Close-grip bench press', 'Overhead cable extension', 'Skull crusher', 'DB overhead extension', 'Rope pushdown', 'Bench dip'],
  quads: ['Back squat', 'Front squat', 'Leg press', 'Hack squat', 'Bulgarian split squat', 'Walking lunge', 'Leg extension', 'Goblet squat', 'Step-up'],
  hamstrings: ['Romanian deadlift', 'Lying leg curl', 'Seated leg curl', 'Stiff-leg deadlift', 'Single-leg RDL', 'Good morning', 'Nordic curl'],
  glutes: ['Hip thrust', 'Barbell glute bridge', 'Bulgarian split squat', 'Cable kickback', 'Reverse lunge', 'Sumo deadlift', 'Step-up'],
  calves: ['Standing calf raise', 'Seated calf raise', 'Leg-press calf raise', 'Single-leg calf raise'],
  core: ['Hanging leg raise', 'Hanging knee raise', 'Cable crunch', 'Plank', 'Ab wheel rollout', 'Russian twist', 'Bicycle crunch', 'Leg raise', 'Side plank'],
  traps: ['Barbell shrug', 'DB shrug', 'Rack pull', 'Farmer carry'],
  forearms: ['Wrist curl', 'Reverse wrist curl', 'Reverse curl', 'Farmer carry'],
};

/* name -> group (exact), with a keyword fallback for plan names phrased differently */
const NAME_TO_GROUP = {};
for (const [g, list] of Object.entries(EXERCISE_DB)) for (const n of list) NAME_TO_GROUP[n.toLowerCase()] = g;

const KEYWORD_GROUP = [
  [/\brdl\b|romanian|deadlift|good morning|stiff-leg|nordic/i, 'hamstrings'],
  [/hamstring|leg curl|lying.*curl|seated.*curl/i, 'hamstrings'],
  [/hip thrust|glute bridge|kickback|hip abduction/i, 'glutes'],
  [/calf/i, 'calves'],
  [/squat|lunge|leg press|leg extension|step-?up|split squat|hack|sissy/i, 'quads'],
  [/lateral raise|upright row/i, 'side_delts'],
  [/face pull|pull-apart|rear.?delt|reverse (pec|fly)/i, 'rear_delts'],
  [/shrug|farmer/i, 'traps'],
  [/wrist curl|reverse curl|forearm/i, 'forearms'],
  [/pulldown|pull-?up|chin-?up|\brow\b|inverted|t-bar/i, 'back'],
  [/shoulder press|overhead press|arnold|push press|military|landmine press/i, 'shoulders'],
  [/pushdown|tricep|\bdip\b|close-grip|skull/i, 'triceps'],
  [/curl/i, 'biceps'],
  [/press|push-?up|fly|bench|pec deck/i, 'chest'],
  [/plank|knee raise|leg raise|crunch|\bab\b|russian twist|bicycle|dead bug|hollow|sit-?up/i, 'core'],
];

export function groupOf(name = '') {
  const hit = NAME_TO_GROUP[name.toLowerCase()];
  if (hit) return hit;
  for (const [rx, g] of KEYWORD_GROUP) if (rx.test(name)) return g;
  return null;
}

export function muscleLabel(name = '') {
  const g = groupOf(name);
  return g ? GROUP_LABEL[g] : '';
}

/* exclude moves the user's injuries or kit rule out (so the list only shows safe/doable options) */
function injuryBlocked(name, injuries = {}) {
  const n = name.toLowerCase();
  if (injuries.knees && /\bsquat\b|lunge|step-?up|sissy/.test(n)) return true;
  if (injuries.lowerBack && /deadlift|good morning|barbell row|bent-over|rack pull|romanian|stiff-leg|\brdl\b/.test(n)) return true;
  if (injuries.shoulders && /overhead|behind|upright row|arnold|push press|military/.test(n)) return true;
  return false;
}
/* The bodyweight list below matches on movement keywords, which alone would let
 * "Barbell glute bridge" and "Leg-press calf raise" through on the strength of
 * "glute bridge" and "calf raise". Anything naming kit is rejected first. */
const NEEDS_KIT = /barbell|dumbbell|\bdb\b|machine|cable|smith|hack|leg-?press|pec deck|t-bar|preacher|rope|band|kettlebell|\bplate\b|weighted|landmine|pulldown/i;
const BODYWEIGHT_OK = /push-?up|pull-?up|chin-?up|\bdip\b|plank|inverted row|nordic|glute bridge|bodyweight|squat|lunge|step-?up|calf raise|crunch|leg raise|russian twist|bicycle|dead bug|side plank|hollow|sit-?up/i;

function equipmentBlocked(name, eq = 'full_gym') {
  if (eq === 'full_gym' || eq === 'home_gym') return false;
  const n = name.toLowerCase();
  if (eq === 'minimal') return /barbell|machine|cable|hack|leg press|pec deck|smith|t-bar|lat pulldown|pulldown|preacher|rope/.test(n) && !/db|dumbbell|band/.test(n);
  if (eq === 'bodyweight') return NEEDS_KIT.test(n) || !BODYWEIGHT_OK.test(n);
  return false;
}
export function isAllowed(name, profile = {}) {
  return !injuryBlocked(name, profile.injuries || {}) && !equipmentBlocked(name, profile.equipment || 'full_gym');
}

/* Ranked swap list, scoped to the day's muscle groups.
 * Returns [{ name, group, label }, ...] — same muscle as `exerciseName` first
 * (best matches), then the day's other muscle groups. Caller shows the first 5
 * as "Recommended" and the rest as "More options". */
export function alternativesFor(exerciseName, dayExerciseNames = [], profile = {}, extraExclude = []) {
  const replacedGroup = groupOf(exerciseName);
  const dayGroups = [];
  for (const n of dayExerciseNames) { const g = groupOf(n); if (g && !dayGroups.includes(g)) dayGroups.push(g); }
  if (replacedGroup && !dayGroups.includes(replacedGroup)) dayGroups.push(replacedGroup);
  const orderedGroups = replacedGroup ? [replacedGroup, ...dayGroups.filter((g) => g !== replacedGroup)] : dayGroups;

  const skip = new Set([exerciseName, ...extraExclude, ...dayExerciseNames].map((s) => s.toLowerCase()));
  const ranked = [];
  for (const g of orderedGroups) {
    for (const name of (EXERCISE_DB[g] || [])) {
      const key = name.toLowerCase();
      if (skip.has(key) || !isAllowed(name, profile)) continue;
      skip.add(key);
      ranked.push({ name, group: g, label: GROUP_LABEL[g] });
    }
  }
  return ranked;
}
