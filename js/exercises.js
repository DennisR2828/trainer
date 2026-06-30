/* Exercise library, split templates, and the equipment/injury filters (§2c, §5).
 *
 * A "day" looks like:
 *   { name, focus, exercises: [{ name, sets, reps, note? }], cardio?, note? }
 *
 * The generator picks a template by training days, then runs it through
 * applyEquipment() and applyInjuries() so the plan fits the user's kit and body.
 */

const ex = (name, sets, reps, note) => (note ? { name, sets, reps, note } : { name, sets, reps });

/* ---- §5 reference 5-day split (the creator's actual knee-safe plan) ---- */
export const REFERENCE_DAYS = [
  {
    name: 'Push', focus: 'Chest / Shoulders / Triceps',
    exercises: [
      ex('Incline DB press', 3, '8-12'),
      ex('Flat machine / DB press', 3, '8-12'),
      ex('Seated shoulder press', 3, '10'),
      ex('Cable lateral raise', 3, '15'),
      ex('Tricep pushdown', 3, '12'),
      ex('Overhead tricep ext', 2, '12'),
    ],
    cardio: '20 min incline walk',
  },
  {
    name: 'Pull', focus: 'Back / Biceps / Rear delts',
    exercises: [
      ex('Lat pulldown', 3, '10-12'),
      ex('Seated cable row', 3, '10'),
      ex('Chest-supported DB row', 3, '12'),
      ex('Face pull', 3, '15'),
      ex('DB curl', 3, '12'),
      ex('Hammer curl', 2, '12'),
    ],
  },
  {
    name: 'Legs', focus: 'Knee-safe lower',
    exercises: [
      ex('RDL', 3, '10'),
      ex('Leg press', 3, '12'),
      ex('Hamstring curl', 3, '12'),
      ex('Hip thrust', 3, '12'),
      ex('Standing calf raise', 3, '15'),
    ],
    cardio: '15 min stairmaster',
    note: 'No deep squats.',
  },
  {
    name: 'Upper', focus: 'Chest / Back / Shoulders',
    exercises: [
      ex('Incline press', 3, '10'),
      ex('Lat pulldown', 3, '10'),
      ex('DB shoulder press', 3, '10'),
      ex('Cable row', 3, '12'),
      ex('Lateral raise', 3, '15'),
      ex('Curls + pushdowns superset', 2, '12'),
    ],
    cardio: '20 min incline walk',
  },
  {
    name: 'Lower + Core', focus: 'Lower / Core',
    exercises: [
      ex('Leg press', 3, '12'),
      ex('RDL', 3, '10'),
      ex('Walking lunges', 2, '10'),
      ex('Hanging knee raise', 3, '12'),
      ex('Plank', 3, '45s'),
    ],
  },
];

/* ---- generic templates for other day counts ---- */
const FULL_BODY = [
  { name: 'Full Body A', focus: 'Whole body', cardio: '15 min incline walk', exercises: [
    ex('Goblet squat', 3, '10'), ex('Incline DB press', 3, '10'), ex('Lat pulldown', 3, '10'),
    ex('DB shoulder press', 3, '10'), ex('RDL', 3, '10'), ex('Plank', 3, '40s'),
  ]},
  { name: 'Full Body B', focus: 'Whole body', exercises: [
    ex('Leg press', 3, '12'), ex('Flat DB press', 3, '10'), ex('Seated cable row', 3, '10'),
    ex('Lateral raise', 3, '15'), ex('Hamstring curl', 3, '12'), ex('Hanging knee raise', 3, '12'),
  ]},
  { name: 'Full Body C', focus: 'Whole body', cardio: '15 min stairmaster', exercises: [
    ex('Walking lunges', 2, '10'), ex('Hip thrust', 3, '12'), ex('Chest-supported DB row', 3, '12'),
    ex('DB curl', 3, '12'), ex('Tricep pushdown', 3, '12'), ex('Standing calf raise', 3, '15'),
  ]},
];

const UPPER_LOWER = [
  { name: 'Upper A', focus: 'Chest / Back / Shoulders', cardio: '15 min incline walk', exercises: [
    ex('Incline DB press', 3, '10'), ex('Lat pulldown', 3, '10'), ex('Seated shoulder press', 3, '10'),
    ex('Seated cable row', 3, '12'), ex('Lateral raise', 3, '15'), ex('DB curl', 2, '12'), ex('Tricep pushdown', 2, '12'),
  ]},
  { name: 'Lower A', focus: 'Knee-safe lower', exercises: [
    ex('RDL', 3, '10'), ex('Leg press', 3, '12'), ex('Hamstring curl', 3, '12'),
    ex('Hip thrust', 3, '12'), ex('Standing calf raise', 3, '15'), ex('Plank', 3, '45s'),
  ]},
  { name: 'Upper B', focus: 'Chest / Back / Shoulders', cardio: '15 min incline walk', exercises: [
    ex('Flat DB press', 3, '10'), ex('Chest-supported DB row', 3, '12'), ex('DB shoulder press', 3, '10'),
    ex('Face pull', 3, '15'), ex('Hammer curl', 2, '12'), ex('Overhead tricep ext', 2, '12'),
  ]},
  { name: 'Lower B', focus: 'Lower / Core', cardio: '15 min stairmaster', exercises: [
    ex('Goblet squat', 3, '10'), ex('RDL', 3, '10'), ex('Leg extension', 3, '12'),
    ex('Hamstring curl', 3, '12'), ex('Hanging knee raise', 3, '12'),
  ]},
];

const ACTIVE_RECOVERY = { name: 'Active recovery', focus: 'Cardio / mobility', exercises: [], cardio: '30-45 min walk', note: 'Optional. Not a 6th lifting day.' };

/* ---- choose a template by training-days bucket (§2c) ---- */
export function pickTemplate(trainingDays) {
  switch (trainingDays) {
    case '1-2':  return { splitName: 'Full Body ×2', days: clone(FULL_BODY.slice(0, 2)) };
    case '3-4':  return { splitName: 'Upper / Lower / Upper / Lower', days: clone(UPPER_LOWER) };
    case '5-6':  return { splitName: 'Push / Pull / Legs / Upper / Lower+Core', days: clone(REFERENCE_DAYS) };
    case 'every':return { splitName: '5-day split + 2 active-recovery days', days: clone([...REFERENCE_DAYS, ACTIVE_RECOVERY, ACTIVE_RECOVERY]) };
    default:     return { splitName: 'Full Body ×3', days: clone(FULL_BODY) };
  }
}

/* ---- equipment downgrade: swap machine/cable work when the kit is limited ---- */
const EQUIP_SUBS = [
  // [match, minimal/home replacement, bodyweight replacement]
  [/lat pulldown/i,        'Band lat pulldown',        'Pull-up / inverted row'],
  [/(seated )?cable row/i, 'One-arm DB row',           'Inverted row'],
  [/cable lateral/i,       'DB lateral raise',         'DB lateral raise'],
  [/tricep pushdown/i,     'DB overhead tricep ext',   'Bench dip'],
  [/curls \+ pushdowns.*/i,'DB curls + overhead ext superset', 'Chin-up + bench dip'],
  [/leg press/i,           'DB goblet squat',          'Bodyweight squat'],
  [/(hamstring|leg) curl/i,'DB single-leg RDL',        'Single-leg RDL'],
  [/leg extension/i,       'DB step-up',               'Bodyweight step-up'],
  [/face pull/i,           'Band pull-apart',          'Band pull-apart'],
  [/machine \/ db press|flat machine/i, 'Flat DB press', 'Push-up'],
  [/incline press/i,       'Incline DB press',         'Decline push-up'],
  [/stairmaster/i,         'brisk incline walk',       'brisk incline walk'],
];

export function applyEquipment(days, equipment) {
  if (equipment === 'full_gym') return days;
  const bw = equipment === 'bodyweight';
  return days.map((d) => ({
    ...d,
    cardio: d.cardio ? subText(d.cardio) : d.cardio,
    exercises: d.exercises.map((e) => {
      for (const [rx, minimal, body] of EQUIP_SUBS) {
        if (rx.test(e.name)) return { ...e, name: bw ? body : minimal, note: e.note || 'kit swap' };
      }
      return e;
    }),
  }));

  function subText(t) {
    for (const [rx, minimal, body] of EQUIP_SUBS) if (rx.test(t)) return (bw ? body : minimal);
    return t;
  }
}

/* ---- injury substitution (§2c). Applied LAST so it always wins. ----
 * Equipment-aware: the knee/back subs depend on whether a machine is on hand,
 * because the equipment downgrade can turn a knee-safe machine move (leg press)
 * into a squat. Match on any "squat"/"lunge" substring so downgraded variants
 * (e.g. "DB goblet squat") are caught too. */
const hasMachines = (eq) => eq === 'full_gym' || eq === 'home_gym';

function injuryRules(equipment) {
  const gym = hasMachines(equipment);
  return {
    knees: [
      [/squat/i, gym ? 'Leg press (limited range)' : 'Glute bridge'],
      [/lunge/i, gym ? 'Leg extension (limited range)' : 'Step-up (limited range)'],
    ],
    lowerBack: [
      [/deadlift/i,            gym ? 'Machine back extension' : 'Glute bridge'],
      [/\brdl\b|romanian/i,    gym ? 'Seated hamstring curl'  : 'Glute bridge'],
    ],
    shoulders: [
      [/behind.?neck|military|overhead press|shoulder press/i, 'Incline neutral-grip DB press'],
    ],
  };
}

export function applyInjuries(days, injuries = {}, equipment = 'full_gym') {
  const RULES = injuryRules(equipment);
  const active = Object.keys(RULES).filter((k) => injuries[k]);
  if (!active.length) return days;
  return days.map((d) => ({
    ...d,
    note: injuries.knees && /lower/i.test(d.name) ? 'Knee-safe: skip lunges if knees bark.' : d.note,
    exercises: d.exercises.map((e) => {
      for (const k of active) {
        for (const [rx, repl] of RULES[k]) {
          if (rx.test(e.name)) return { name: repl, sets: e.sets, reps: e.reps, note: `${k} swap` };
        }
      }
      return e;
    }),
  }));
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

/* ---- exercise how-to: target muscles + short form cues, for beginners ----
 * Keyword-matched (specific -> general) so substituted/variant names resolve too.
 * Pair with demoSearchUrl() for an on-demand video when the user is online. */
const INFO = [
  [/superset/i, { muscles: 'Biceps and triceps', cues: ['Do the two moves back to back with no rest between them.', 'Curls: elbows pinned to your sides, no swinging.', 'Pushdowns/extensions: elbows tucked, fully straighten the arms.', 'Rest only after you finish both.'] }],
  [/single-leg rdl/i, { muscles: 'Hamstrings, glutes, balance', cues: ['Stand on one leg with a soft knee.', 'Hinge at the hip, letting the free leg extend behind you.', 'Keep your hips level and your back flat.', 'Squeeze the glute to return to standing.'] }],
  [/rdl|romanian/i, { muscles: 'Hamstrings, glutes, lower back', cues: ['Soft knees, push your hips straight back.', 'Keep the weight close to your legs the whole way.', 'Lower until you feel a hamstring stretch, back flat.', 'Drive your hips forward to stand tall.'] }],
  [/hamstring curl|leg curl|lying.*curl/i, { muscles: 'Hamstrings', cues: ['Set the pad just above your heels.', 'Curl your heels toward your glutes.', 'Squeeze the hamstrings at the top.', 'Lower slowly, do not let the weight drop.'] }],
  [/hammer curl/i, { muscles: 'Biceps, forearms', cues: ['Hold the dumbbells with palms facing each other.', 'Curl up without letting your elbows drift forward.', 'Squeeze at the top.', 'Lower all the way under control.'] }],
  [/tricep pushdown|pushdown/i, { muscles: 'Triceps', cues: ['Keep your elbows tucked at your sides.', 'Push down until your arms are fully straight.', 'Stay upright, do not lean over the bar.', 'Control it back up to about 90 degrees.'] }],
  [/overhead.*ext|tricep ext/i, { muscles: 'Triceps (long head)', cues: ['Keep your elbows pointing forward, close to your head.', 'Lower the weight behind your head for a stretch.', 'Extend back up without flaring your elbows.', 'Keep your ribs down, do not arch your back.'] }],
  [/curl/i, { muscles: 'Biceps', cues: ['Keep your elbows pinned to your sides.', 'Curl the weight up with palms toward you.', 'No swinging or using your back.', 'Lower all the way, fully straightening the arms.'] }],
  [/incline.*press|incline neutral/i, { muscles: 'Upper chest, front delts, triceps', cues: ['Set the bench to about 30 degrees.', 'Lower to your upper chest, elbows ~45 degrees from your body.', 'Press up and slightly together, no hard lockout.', 'Keep your shoulder blades pulled back and down.'] }],
  [/shoulder press|overhead press/i, { muscles: 'Shoulders, triceps', cues: ['Start with the weights at shoulder height.', 'Brace your core so you do not arch backward.', 'Press overhead until your arms are straight.', 'Lower under control to shoulder height.'] }],
  [/db press|chest press|flat.*press|bench/i, { muscles: 'Chest, front delts, triceps', cues: ['Lower the weight to mid-chest, elbows about 45 degrees.', 'Keep your shoulder blades squeezed back.', 'Press up and slightly inward.', 'Keep your wrists stacked over your elbows.'] }],
  [/push-?up/i, { muscles: 'Chest, triceps, core', cues: ['Hands just wider than your shoulders, body in a straight line.', 'Lower until your chest is just above the floor.', 'Keep elbows ~45 degrees, not flared to 90.', 'Push the floor away; do not let your hips sag.'] }],
  [/pulldown/i, { muscles: 'Lats, biceps', cues: ['Grip slightly wider than your shoulders.', 'Pull the bar to your upper chest, leading with your elbows.', 'Squeeze your shoulder blades down and back.', 'Control the bar back up without yanking your arms straight.'] }],
  [/pull-?up|chin-?up/i, { muscles: 'Lats, biceps', cues: ['Hang with arms straight and shoulders active.', 'Pull your chest toward the bar, elbows driving down.', 'Avoid kipping or swinging.', 'Lower all the way under control.'] }],
  [/inverted row/i, { muscles: 'Back, biceps', cues: ['Hang under a bar set around hip height.', 'Keep your body in a straight line, heels on the floor.', 'Pull your chest to the bar, squeezing your shoulder blades.', 'Lower under control.'] }],
  [/row/i, { muscles: 'Mid-back, lats, biceps', cues: ['Pull the handle/weight to your stomach, elbows close.', 'Squeeze your shoulder blades together at the end.', 'Keep your torso still, do not rock for momentum.', 'Stretch forward under control between reps.'] }],
  [/face pull|pull-apart/i, { muscles: 'Rear delts, upper back', cues: ['Set a rope or band at about face height.', 'Pull toward your forehead with high, wide elbows.', 'Rotate so your knuckles end up pointing back.', 'Light weight, high reps, slow and controlled.'] }],
  [/lateral raise/i, { muscles: 'Side delts', cues: ['Slight bend in your elbows, lead with the elbows.', 'Raise out to the sides to about shoulder height.', 'No shrugging or swinging; keep it strict.', 'Lower slowly, resisting the weight.'] }],
  [/dip/i, { muscles: 'Triceps, chest', cues: ['Lower with control on a bench or parallel bars.', 'Keep your elbows pointing back, not flaring out.', 'Go to about 90 degrees at the elbow.', 'Press back up to straight arms.'] }],
  [/leg press/i, { muscles: 'Quads, glutes, hamstrings', cues: ['Feet shoulder-width on the platform.', 'Lower until your knees reach about 90 degrees (shorter if knees ache).', 'Do not let your lower back round off the pad.', 'Press through your whole foot without hard-locking the knees.'] }],
  [/squat/i, { muscles: 'Quads, glutes', cues: ['Hold a weight at your chest, or just bodyweight.', 'Sit down between your hips, chest up.', 'Let your knees track over your toes.', 'Stand up driving through your heels.'] }],
  [/lunge/i, { muscles: 'Quads, glutes', cues: ['Step forward and lower your back knee toward the floor.', 'Keep your front shin fairly vertical.', 'Push through your front heel to step through.', 'Keep your torso tall.'] }],
  [/hip thrust|glute bridge/i, { muscles: 'Glutes, hamstrings', cues: ['Upper back on a bench (thrust) or on the floor (bridge).', 'Drive through your heels to lift your hips.', 'Squeeze your glutes hard at the top.', 'Keep your ribs down, do not overarch.'] }],
  [/step-?up/i, { muscles: 'Quads, glutes', cues: ['Use a knee-height step or box.', 'Drive through the top foot to stand all the way up.', 'Control the way down; do not push off the bottom leg.', 'Keep your knee tracking over your foot.'] }],
  [/leg extension/i, { muscles: 'Quads', cues: ['Line your knees up with the machine pivot.', 'Straighten your legs, squeezing the quads.', 'Pause briefly at the top.', 'Lower under control; shorten the range if knees are cranky.'] }],
  [/back extension/i, { muscles: 'Lower back, glutes', cues: ['Pad at your hips, body straight.', 'Lower with a flat back, then raise to in-line.', 'Squeeze your glutes at the top, do not hyperextend.', 'Move slowly and controlled.'] }],
  [/calf raise/i, { muscles: 'Calves', cues: ['Balls of your feet on the edge of a step or plate.', 'Rise as high as you can onto your toes.', 'Pause and squeeze at the top.', 'Lower slowly for a full stretch.'] }],
  [/plank/i, { muscles: 'Core', cues: ['Forearms under your shoulders, body in a straight line.', 'Brace your abs and squeeze your glutes.', 'Do not let your hips sag or pike up.', 'Breathe steadily and hold for time.'] }],
  [/knee raise|leg raise/i, { muscles: 'Lower abs', cues: ['Hang from a bar with active shoulders.', 'Raise your knees toward your chest.', 'Avoid swinging; control the movement.', 'Lower your legs slowly.'] }],
  [/walk|stairmaster|stair|cardio/i, { muscles: 'Conditioning', cues: ['Hold a brisk, steady pace you can sustain.', 'Set an incline that is challenging but lets you still talk.', 'Stand tall; avoid leaning on the rails.', 'Aim for the prescribed time.'] }],
];

const GENERIC_INFO = { muscles: '', cues: ['Tap Watch demo for a short video on proper form.'] };

export function exerciseInfo(name = '') {
  for (const [rx, info] of INFO) if (rx.test(name)) return info;
  return GENERIC_INFO;
}

export function demoSearchUrl(name = '') {
  const q = name.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim() + ' proper form technique';
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
}

/* ---- swap suggestions: alternatives that hit the same muscle group ----
 * For "the machine is taken / I'd rather not do this one." Ordered specific ->
 * general so e.g. "leg press" lands in quads (not chest) and "hamstring curl"
 * in hamstrings (not biceps). Candidates are filtered through the same
 * equipment + injury rules so a knee user never gets a squat back, etc. */
const GROUP_RULES = [
  [/\brdl\b|romanian|deadlift|good morning/i, 'hamstrings'],
  [/hamstring|leg curl|lying.*curl/i, 'hamstrings'],
  [/hip thrust|glute bridge|kickback/i, 'glutes'],
  [/calf/i, 'calves'],
  [/squat|lunge|leg press|leg extension|step-?up|split squat|hack/i, 'quads'],
  [/lateral raise/i, 'side_delts'],
  [/face pull|pull-apart|rear/i, 'rear_delts'],
  [/pulldown|pull-?up|chin-?up|\brow\b|inverted/i, 'back'],
  [/shoulder press|overhead press|arnold/i, 'shoulders'],
  [/pushdown|tricep|\bdip\b|close-grip/i, 'triceps'],
  [/curl/i, 'biceps'],
  [/press|push-?up|fly|bench/i, 'chest'],
  [/plank|knee raise|leg raise|crunch|\bab\b/i, 'core'],
];

const ALT_POOL = {
  chest: ['Incline DB press', 'Flat DB press', 'Machine chest press', 'Incline machine press', 'Cable fly', 'Push-up'],
  back: ['Lat pulldown', 'Pull-up', 'Seated cable row', 'Chest-supported DB row', 'One-arm DB row', 'Inverted row', 'Straight-arm pulldown'],
  shoulders: ['Seated shoulder press', 'DB shoulder press', 'Machine shoulder press', 'Arnold press'],
  side_delts: ['Cable lateral raise', 'DB lateral raise', 'Machine lateral raise'],
  rear_delts: ['Face pull', 'Reverse pec deck', 'Band pull-apart', 'Rear-delt DB fly'],
  biceps: ['DB curl', 'Hammer curl', 'Cable curl', 'Incline DB curl', 'Preacher curl'],
  triceps: ['Tricep pushdown', 'Overhead tricep ext', 'Rope pushdown', 'Close-grip press', 'Bench dip'],
  quads: ['Leg press', 'Leg extension', 'Goblet squat', 'Hack squat', 'Walking lunges', 'Bulgarian split squat'],
  hamstrings: ['RDL', 'Seated hamstring curl', 'Lying hamstring curl', 'Single-leg RDL', 'Good morning'],
  glutes: ['Hip thrust', 'Glute bridge', 'Cable kickback', 'Bulgarian split squat'],
  calves: ['Standing calf raise', 'Seated calf raise', 'Leg-press calf raise'],
  core: ['Hanging knee raise', 'Plank', 'Cable crunch', 'Leg raise', 'Ab wheel'],
};

function groupOf(name = '') {
  for (const [rx, g] of GROUP_RULES) if (rx.test(name)) return g;
  return null;
}

export function suggestAlternatives(name, profile = {}, exclude = []) {
  const group = groupOf(name);
  if (!group || !ALT_POOL[group]) return [];
  const skip = new Set([name, ...exclude].map((s) => s.toLowerCase()));
  const cands = ALT_POOL[group].filter((n) => !skip.has(n.toLowerCase()));
  if (!cands.length) return [];
  // run through equipment + injury filters so suggestions fit the user
  const equipment = profile.equipment || 'full_gym';
  const fake = [{ name: 'alts', exercises: cands.map((n) => ({ name: n, sets: 3, reps: '10' })) }];
  const filtered = applyInjuries(applyEquipment(fake, equipment), profile.injuries || {}, equipment);
  const out = [];
  for (const ex of filtered[0].exercises) {
    const key = ex.name.toLowerCase();
    if (!skip.has(key) && !out.some((n) => n.toLowerCase() === key)) out.push(ex.name);
  }
  return out.slice(0, 4);
}
