/* Intake quiz (§2a). Tap-to-answer cards, one screen at a time.
 * Single-select cards auto-advance. Number/injury steps use a Next button.
 * On finish, previews the generated plan, then calls onComplete(profile). */

import { computeTargets, buildSplit } from '../generator.js';

const h = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};

/* Step definitions, in order (§2a). kind: intro | single | number | height | injuries | summary */
const STEPS = [
  { kind: 'intro' },

  { kind: 'single', key: 'sex', title: 'Biological sex', why: 'Sets the calorie formula.', options: [
    { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' } ] },
  { kind: 'number', key: 'age', title: 'How old are you?', unit: 'years', min: 13, max: 100 },
  { kind: 'height', key: 'heightInches', title: 'How tall are you?' },
  { kind: 'number', key: 'weightLb', title: 'Current weight', unit: 'lb', min: 60, max: 800 },
  { kind: 'number', key: 'goalWeightLb', title: 'Goal weight', unit: 'lb', min: 60, max: 800 },

  { kind: 'single', key: 'goal', title: 'Main goal', options: [
    { value: 'lose_fat', label: 'Lose fat' },
    { value: 'lose_build', label: 'Lose fat + build muscle' },
    { value: 'build', label: 'Build muscle' },
    { value: 'health', label: 'General health' } ] },
  { kind: 'single', key: 'dailyActivity', title: 'Day to day, you are', options: [
    { value: 'sitting', label: 'Mostly sitting' },
    { value: 'feet_some', label: 'On your feet some' },
    { value: 'feet_lot', label: 'On your feet a lot' },
    { value: 'demanding', label: 'Physically demanding job' } ] },
  { kind: 'single', key: 'exerciseNow', title: 'Do you exercise now?', options: [
    { value: 'no', label: 'No' },
    { value: 'little', label: 'A little, inconsistently' },
    { value: 'few_week', label: 'A few times a week' },
    { value: 'regular', label: 'Regularly' } ] },

  { kind: 'single', key: 'trainingDays', title: 'Days per week you can train', options: [
    { value: '1-2', label: '1 to 2' },
    { value: '3-4', label: '3 to 4' },
    { value: '5-6', label: '5 to 6' },
    { value: 'every', label: 'Every day' } ] },
  { kind: 'single', key: 'sessionLength', title: 'Time per session', options: [
    { value: 'lte30', label: '30 min or less' },
    { value: '45', label: 'About 45 min' },
    { value: '60', label: 'About 60 min' },
    { value: '60plus', label: '60 min or more' } ] },
  { kind: 'single', key: 'equipment', title: 'Equipment you have', options: [
    { value: 'full_gym', label: 'Full gym' },
    { value: 'home_gym', label: 'Home gym' },
    { value: 'minimal', label: 'Minimal (dumbbells / bands)' },
    { value: 'bodyweight', label: 'Bodyweight only' } ] },
  { kind: 'single', key: 'foodHandling', title: 'How do you handle food?', options: [
    { value: 'cook_most', label: 'Cook most meals' },
    { value: 'mix', label: 'Mix of cooking and takeout' },
    { value: 'mostly_takeout', label: 'Mostly takeout' },
    { value: 'someone_cooks', label: 'Someone cooks for me' } ] },

  { kind: 'single', key: 'sleep', title: 'Typical sleep', options: [
    { value: 'lt5', label: 'Under 5 hours' },
    { value: '5-6', label: '5 to 6 hours' },
    { value: '6-7', label: '6 to 7 hours' },
    { value: '7plus', label: '7 hours or more' } ] },
  { kind: 'single', key: 'stress', title: 'Stress level', options: [
    { value: 'low', label: 'Low' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'high', label: 'High' },
    { value: 'very_high', label: 'Very high' } ] },
  { kind: 'injuries', key: 'injuries', title: 'Any injuries or limitations?', why: 'We will swap risky lifts for safe ones.' },
  { kind: 'single', key: 'history', title: 'Your training history', options: [
    { value: 'fell_off', label: 'Tried before, fell off' },
    { value: 'never', label: 'Never seriously' },
    { value: 'own_thing', label: 'Currently doing my own thing' },
    { value: 'on_off', label: 'On and off for years' } ] },
  { kind: 'single', key: 'foodVariety', title: 'Food preferences', options: [
    { value: 'most', label: 'Eats most things' },
    { value: 'some_dislikes', label: 'Some dislikes' },
    { value: 'restrictions', label: 'Restrictions or allergies' },
    { value: 'picky', label: 'Picky' } ] },

  { kind: 'summary' },
];

export function renderOnboarding(mount, { onComplete }) {
  const answers = { injuries: { knees: false, lowerBack: false, shoulders: false, notes: '' } };
  let i = 0;

  const next = () => { i = Math.min(i + 1, STEPS.length - 1); draw(); };
  const back = () => { i = Math.max(i - 1, 0); draw(); };

  // count only "question" steps for the progress bar
  const qSteps = STEPS.filter((s) => !['intro', 'summary'].includes(s.kind)).length;
  const qIndex = () => STEPS.slice(0, i).filter((s) => !['intro', 'summary'].includes(s.kind)).length;

  function draw() {
    const step = STEPS[i];
    mount.innerHTML = '';
    mount.scrollTop = 0;

    if (step.kind === 'intro') return mount.append(intro());
    if (step.kind === 'summary') return mount.append(summary());

    const pct = Math.round((qIndex() / qSteps) * 100);
    const head = h('div', { class: 'ob-head' }, [
      h('button', { class: 'ob-back', type: 'button', onClick: back, 'aria-label': 'Back' }, '‹'),
      h('div', { class: 'ob-progress' }, [h('span', { style: `transform:scaleX(${pct / 100})` })]),
    ]);

    let body;
    if (step.kind === 'single') body = singleStep(step);
    else if (step.kind === 'number') body = numberStep(step);
    else if (step.kind === 'height') body = heightStep(step);
    else if (step.kind === 'injuries') body = injuriesStep(step);

    mount.append(h('section', { class: 'ob' }, [head, body]));
  }

  /* ---- step renderers ---- */
  function intro() {
    return h('section', { class: 'ob ob-center' }, [
      h('div', { class: 'ob-badge' }, '◇'),
      h('h1', {}, 'Let’s build your plan'),
      h('p', { class: 'muted' }, 'A few quick taps. We set your calories, protein, and a training split that fits your week, your gear, and your body.'),
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', onClick: next }, 'Start'),
    ]);
  }

  function singleStep(step) {
    const cards = step.options.map((o) =>
      h('button', {
        class: 'card-opt' + (answers[step.key] === o.value ? ' is-sel' : ''),
        type: 'button',
        onClick: () => { answers[step.key] = o.value; draw(); setTimeout(next, 160); },
      }, [h('span', {}, o.label), h('span', { class: 'card-chev' }, '›')])
    );
    return h('div', {}, [
      h('h2', {}, step.title), step.why ? h('p', { class: 'muted' }, step.why) : null,
      h('div', { class: 'card-list' }, cards),
    ]);
  }

  function numberStep(step) {
    const input = h('input', {
      class: 'num-input', type: 'number', inputmode: 'numeric',
      value: answers[step.key] ?? '', min: step.min, max: step.max, placeholder: '0',
      onInput: (e) => { answers[step.key] = e.target.value === '' ? undefined : Number(e.target.value); validate(); },
    });
    const err = h('p', { class: 'ob-err' }, '');
    const cont = h('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: 'true', onClick: next }, 'Continue');
    function validate() {
      const v = answers[step.key];
      const ok = typeof v === 'number' && v >= step.min && v <= step.max;
      err.textContent = v != null && !ok ? `Enter a value between ${step.min} and ${step.max}.` : '';
      if (ok) cont.removeAttribute('disabled'); else cont.setAttribute('disabled', 'true');
    }
    validate();
    return h('div', {}, [
      h('h2', {}, step.title),
      h('div', { class: 'num-row' }, [input, h('span', { class: 'num-unit' }, step.unit)]),
      err, cont,
    ]);
  }

  function heightStep(step) {
    let ft = answers._ft, inch = answers._in;
    const sel = (val, max, on) => {
      const s = h('select', { class: 'num-input', onChange: (e) => on(Number(e.target.value)) });
      s.append(h('option', { value: '' }, '--'));
      for (let n = 0; n <= max; n++) s.append(h('option', { value: n, ...(val === n ? { selected: 'true' } : {}) }, String(n)));
      return s;
    };
    const cont = h('button', { class: 'btn btn-primary btn-lg', type: 'button', onClick: next }, 'Continue');
    const sync = () => {
      if (ft != null && inch != null) { answers[step.key] = ft * 12 + inch; cont.removeAttribute('disabled'); }
      else cont.setAttribute('disabled', 'true');
    };
    if (answers[step.key] == null) cont.setAttribute('disabled', 'true');
    return h('div', {}, [
      h('h2', {}, step.title),
      h('div', { class: 'num-row' }, [
        sel(ft, 8, (v) => { ft = answers._ft = v; sync(); }), h('span', { class: 'num-unit' }, 'ft'),
        sel(inch, 11, (v) => { inch = answers._in = v; sync(); }), h('span', { class: 'num-unit' }, 'in'),
      ]),
      cont,
    ]);
  }

  function injuriesStep(step) {
    const toggle = (key, label) =>
      h('button', {
        class: 'card-opt' + (answers.injuries[key] ? ' is-sel' : ''), type: 'button',
        onClick: (e) => { answers.injuries[key] = !answers.injuries[key]; e.currentTarget.classList.toggle('is-sel'); },
      }, [h('span', {}, label), h('span', { class: 'card-chev' }, answers.injuries[key] ? '✓' : '')]);
    const notes = h('textarea', {
      class: 'ob-notes', rows: '2', placeholder: 'Anything else we should know (optional)',
      onInput: (e) => { answers.injuries.notes = e.target.value; },
    });
    notes.value = answers.injuries.notes || '';
    return h('div', {}, [
      h('h2', {}, step.title), h('p', { class: 'muted' }, step.why),
      h('div', { class: 'card-list' }, [toggle('knees', 'Knees'), toggle('lowerBack', 'Lower back'), toggle('shoulders', 'Shoulders')]),
      notes,
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', onClick: next }, 'Continue'),
    ]);
  }

  function summary() {
    const profile = toProfile(answers);
    const t = computeTargets(profile);
    const { splitName, days } = buildSplit(profile);
    const macro = (label, val, cls) => h('div', { class: `macro ${cls}` }, [
      h('div', { class: 'macro-val' }, [String(val), h('span', {}, label === 'Calories' ? '' : 'g')]),
      h('div', { class: 'macro-lbl' }, label),
    ]);
    return h('section', { class: 'ob' }, [
      h('div', { class: 'ob-badge ok' }, '✓'),
      h('h1', {}, 'Your plan is ready'),
      h('p', { class: 'muted' }, 'Daily targets, tuned to protect muscle while the fat comes off. You can re-run this any time from the Plan tab.'),
      h('div', { class: 'macro-grid' }, [
        macro('Calories', t.calories, 'cal'), macro('Protein', t.protein, 'pro'),
        macro('Carbs', t.carbs, 'carb'), macro('Fat', t.fat, 'fat'),
      ]),
      h('p', { class: 'steps-note' }, `Daily steps: ${t.steps.min.toLocaleString()} to ${t.steps.max.toLocaleString()}`),
      h('div', { class: 'plan-split' }, [
        h('div', { class: 'plan-split-name' }, splitName),
        h('div', { class: 'day-chips' }, days.map((d) => h('span', { class: 'chip' }, d.name))),
      ]),
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', onClick: () => onComplete(profile) }, 'Start tracking'),
    ]);
  }

  draw();
}

function toProfile(a) {
  return {
    sex: a.sex, age: a.age, heightInches: a.heightInches, weightLb: a.weightLb, goalWeightLb: a.goalWeightLb,
    goal: a.goal, dailyActivity: a.dailyActivity, exerciseNow: a.exerciseNow,
    trainingDays: a.trainingDays, sessionLength: a.sessionLength, equipment: a.equipment, foodHandling: a.foodHandling,
    sleep: a.sleep, stress: a.stress, injuries: a.injuries, history: a.history, foodVariety: a.foodVariety,
    createdAt: new Date().toISOString(),
  };
}
