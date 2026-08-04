/* Intake. Tap-to-answer cards, one screen at a time.
 *
 * Modelled on how trainers and dietitians actually run a first consultation
 * rather than on the minimum needed to run the formulas. Two things drive the
 * shape of it:
 *
 *  • Self-efficacy — how confident someone is they will actually do it — is the
 *    strongest known predictor of exercise adherence, ahead of motivation. So we
 *    ask outright, and size the plan to the answer instead of to the ambition.
 *  • What derailed someone last time is more useful than what they hope for, so
 *    that gets its own question and feeds the plan notes.
 *
 * Steps can declare `when(answers)` to branch. The female life-stage questions
 * are the only branch today.
 *
 * kind: intro | single | multi | number | height | injuries | summary
 */

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

const STEPS = [
  { kind: 'intro' },

  /* ---- about you ---- */
  { kind: 'single', key: 'sex', title: 'Biological sex', why: 'Sets the calorie formula, your rest intervals, and how much volume we start you with.', options: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' } ] },
  { kind: 'number', key: 'age', title: 'How old are you?', unit: 'years', min: 13, max: 100 },
  { kind: 'height', key: 'heightInches', title: 'How tall are you?' },
  { kind: 'number', key: 'weightLb', title: 'Current weight', unit: 'lb', min: 60, max: 800 },
  { kind: 'number', key: 'goalWeightLb', title: 'Goal weight', unit: 'lb', min: 60, max: 800,
    why: 'We use this to tell you honestly how long it should take.' },

  /* ---- the goal, and the reason behind it ---- */
  { kind: 'single', key: 'goal', title: 'Main goal', options: [
    { value: 'lose_fat', label: 'Lose fat' },
    { value: 'lose_build', label: 'Get leaner and more defined' },
    { value: 'build', label: 'Build muscle' },
    { value: 'strength', label: 'Get stronger' },
    { value: 'health', label: 'General health and energy' } ] },
  { kind: 'single', key: 'motivation', title: 'What is driving this right now?', why: 'The reason underneath tends to outlast the goal itself.', options: [
    { value: 'health_scare', label: 'A checkup or health scare' },
    { value: 'feel_better', label: 'Want to feel better day to day' },
    { value: 'event', label: 'An event or date coming up' },
    { value: 'look', label: 'Want to look different' },
    { value: 'someone', label: 'Want to be strong for someone' },
    { value: 'ready', label: 'Just ready' } ] },
  { kind: 'single', key: 'timeline', title: 'What timeline do you have in mind?', options: [
    { value: '3mo', label: 'About 3 months' },
    { value: '6mo', label: 'About 6 months' },
    { value: '1yr', label: 'A year or so' },
    { value: 'none', label: 'No deadline, just consistent' } ] },

  /* ---- history, and what actually went wrong before ---- */
  { kind: 'single', key: 'history', title: 'Your training history', options: [
    { value: 'never', label: 'Never seriously' },
    { value: 'fell_off', label: 'Tried before, fell off' },
    { value: 'on_off', label: 'On and off for years' },
    { value: 'own_thing', label: 'Currently doing my own thing' },
    { value: 'returning', label: 'Trained seriously before, coming back' } ] },
  { kind: 'single', key: 'exerciseNow', title: 'Right now, how often do you actually train?', why: 'Where we start you, so nothing is a shock.', options: [
    { value: 'none', label: 'Not at all' },
    { value: '1-2', label: '1 to 2 times a week' },
    { value: '3-4', label: '3 to 4 times a week' },
    { value: '5plus', label: '5 or more' } ] },
  { kind: 'multi', key: 'enjoys', title: 'What have you actually enjoyed?', why: 'Pick any. We keep more of it in the plan.', options: [
    { value: 'lifting', label: 'Lifting weights' },
    { value: 'classes', label: 'Classes or group training' },
    { value: 'cardio', label: 'Running or cardio' },
    { value: 'sports', label: 'Sports' },
    { value: 'walking', label: 'Walking or hiking' },
    { value: 'none', label: 'Nothing yet, honestly', exclusive: true } ] },
  { kind: 'single', key: 'derailer', title: 'What has stopped you before?', why: 'More useful than knowing the goal. We build around this.', options: [
    { value: 'busy', label: 'Got busy, life got in the way' },
    { value: 'motivation', label: 'Lost motivation' },
    { value: 'injury', label: 'Got injured or too sore' },
    { value: 'results', label: 'Was not seeing results' },
    { value: 'confused', label: 'Did not know what to do' },
    { value: 'na', label: 'Never really started' } ] },
  { kind: 'single', key: 'liftingAttitude', title: 'How do you feel about lifting heavy?', options: [
    { value: 'love', label: 'Love it' },
    { value: 'willing', label: 'Willing to try' },
    { value: 'bulky', label: 'Worried it will make me bulky' },
    { value: 'light', label: 'Prefer lighter weights' } ] },

  /* ---- logistics ---- */
  { kind: 'single', key: 'trainingDays', title: 'Days per week you can train', options: [
    { value: '1-2', label: '1 to 2' },
    { value: '3-4', label: '3 to 4' },
    { value: '5-6', label: '5 to 6' },
    { value: 'every', label: 'Every day' } ] },
  { kind: 'single', key: 'sessionLength', title: 'Time per session', why: 'We trim each day to fit it.', options: [
    { value: 'lte30', label: '30 min or less' },
    { value: '45', label: 'About 45 min' },
    { value: '60', label: 'About 60 min' },
    { value: '60plus', label: '60 min or more' } ] },
  { kind: 'single', key: 'equipment', title: 'Equipment you have', options: [
    { value: 'full_gym', label: 'Full gym' },
    { value: 'home_gym', label: 'Home gym' },
    { value: 'minimal', label: 'Minimal (dumbbells / bands)' },
    { value: 'bodyweight', label: 'Bodyweight only' } ] },
  { kind: 'single', key: 'confidence', title: 'Honestly — how confident are you that you will stick to that?',
    why: 'No wrong answer, and no judgement. It predicts follow-through better than anything else we could ask, so we size the plan to it.', options: [
    { value: 'very', label: 'Very confident' },
    { value: 'fairly', label: 'Fairly confident' },
    { value: 'not_very', label: 'Not very' },
    { value: 'unsure', label: 'Honestly unsure' } ] },

  /* ---- your day ---- */
  { kind: 'single', key: 'dailyActivity', title: 'Day to day, you are', options: [
    { value: 'sitting', label: 'Mostly sitting' },
    { value: 'feet_some', label: 'On your feet some' },
    { value: 'feet_lot', label: 'On your feet a lot' },
    { value: 'demanding', label: 'Physically demanding job' } ] },
  { kind: 'single', key: 'sleep', title: 'Typical sleep', why: 'You adapt to what you recover from, so this changes your volume.', options: [
    { value: 'lt5', label: 'Under 5 hours' },
    { value: '5-6', label: '5 to 6 hours' },
    { value: '6-7', label: '6 to 7 hours' },
    { value: '7plus', label: '7 hours or more' } ] },
  { kind: 'single', key: 'stress', title: 'Stress level', options: [
    { value: 'low', label: 'Low' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'high', label: 'High' },
    { value: 'very_high', label: 'Very high' } ] },

  /* ---- health. Recorded for your own reference; it does not gate the plan. ---- */
  { kind: 'multi', key: 'health', title: 'Do any of these apply?', why: 'Kept for your reference. Pick any.', options: [
    { value: 'heart_bp', label: 'Heart condition or high blood pressure' },
    { value: 'chest_pain', label: 'Chest pain, with activity or at rest' },
    { value: 'dizzy', label: 'Dizziness or fainting spells' },
    { value: 'bone_joint', label: 'A bone or joint problem' },
    { value: 'meds', label: 'Taking prescribed medication' },
    { value: 'doctor', label: 'Under a doctor’s care for something ongoing' },
    { value: 'none', label: 'None of these', exclusive: true } ] },
  { kind: 'injuries', key: 'injuries', title: 'Any injuries or limitations?', why: 'We swap risky lifts for safe ones.' },

  /* ---- female-specific. The one branch. ---- */
  { kind: 'single', key: 'lifeStage', title: 'Which describes you right now?',
    why: 'Changes how hard we push the deficit and which core work you get. Nothing here is shared anywhere.',
    when: (a) => a.sex === 'female', options: [
    { value: 'cycling', label: 'Cycling regularly' },
    { value: 'irregular', label: 'Cycles irregular or absent' },
    { value: 'pregnant', label: 'Pregnant' },
    { value: 'postpartum', label: 'Postpartum, under 12 months' },
    { value: 'peri', label: 'Perimenopause' },
    { value: 'post_meno', label: 'Postmenopause' },
    { value: 'skip', label: 'Prefer not to say' } ] },
  { kind: 'single', key: 'postpartumCleared', title: 'Has your provider cleared you for exercise?',
    when: (a) => a.sex === 'female' && a.lifeStage === 'postpartum', options: [
    { value: 'yes', label: 'Yes, cleared' },
    { value: 'not_yet', label: 'Not yet' },
    { value: 'unsure', label: 'Not sure' } ] },

  /* ---- nutrition ---- */
  { kind: 'single', key: 'diet', title: 'How do you eat?', why: 'Filters every meal idea we show you.', options: [
    { value: 'omnivore', label: 'Everything' },
    { value: 'pescatarian', label: 'Pescatarian' },
    { value: 'vegetarian', label: 'Vegetarian' },
    { value: 'vegan', label: 'Vegan' } ] },
  { kind: 'multi', key: 'avoids', title: 'Anything you cannot eat?', why: 'Pick any.', options: [
    { value: 'dairy', label: 'Dairy' },
    { value: 'gluten', label: 'Gluten' },
    { value: 'nuts', label: 'Nuts' },
    { value: 'shellfish', label: 'Shellfish' },
    { value: 'eggs', label: 'Eggs' },
    { value: 'soy', label: 'Soy' },
    { value: 'none', label: 'Nothing to avoid', exclusive: true } ] },
  { kind: 'single', key: 'foodHandling', title: 'How do you handle food?', options: [
    { value: 'cook_most', label: 'Cook most meals' },
    { value: 'mix', label: 'Mix of cooking and takeout' },
    { value: 'mostly_takeout', label: 'Mostly takeout' },
    { value: 'someone_cooks', label: 'Someone cooks for me' } ] },
  { kind: 'single', key: 'weightTrend', title: 'Your weight over the last 6 months', options: [
    { value: 'gained', label: 'Gained' },
    { value: 'lost', label: 'Lost' },
    { value: 'same', label: 'Stayed about the same' },
    { value: 'bounced', label: 'Bounced up and down' } ] },
  { kind: 'single', key: 'alcohol', title: 'Alcohol', why: 'Real calories, and it blunts recovery. We would rather account for it than pretend.', options: [
    { value: 'none', label: 'Rarely or never' },
    { value: 'few', label: 'A few drinks a week' },
    { value: 'weekends', label: 'Mostly weekends, heavier' },
    { value: 'most_days', label: 'Most days' } ] },

  { kind: 'summary' },
];

export function renderOnboarding(mount, { onComplete }) {
  const answers = {
    injuries: { knees: false, lowerBack: false, shoulders: false, neck: false, hips: false, wrists: false, notes: '' },
    enjoys: [], health: [], avoids: [],
  };
  let i = 0;

  const visible = (s) => !s.when || s.when(answers);
  const isQuestion = (s) => !['intro', 'summary'].includes(s.kind);

  /* Branching means we cannot just add or subtract one — walk to the next step
   * whose `when` currently passes. */
  function step(from, dir) {
    let n = from + dir;
    while (n > 0 && n < STEPS.length - 1 && !visible(STEPS[n])) n += dir;
    return Math.max(0, Math.min(STEPS.length - 1, n));
  }
  const next = () => { i = step(i, 1); draw(); };
  const back = () => { i = step(i, -1); draw(); };

  const qTotal = () => STEPS.filter((s) => isQuestion(s) && visible(s)).length;
  const qIndex = () => STEPS.slice(0, i).filter((s) => isQuestion(s) && visible(s)).length;

  function draw() {
    const s = STEPS[i];
    mount.innerHTML = '';
    mount.scrollTop = 0;

    if (s.kind === 'intro') return mount.append(intro());
    if (s.kind === 'summary') return mount.append(summary());

    const pct = Math.round((qIndex() / Math.max(1, qTotal())) * 100);
    const head = h('div', { class: 'ob-head' }, [
      h('button', { class: 'ob-back', type: 'button', onClick: back, 'aria-label': 'Back' }, '‹'),
      h('div', { class: 'ob-progress' }, [h('span', { style: `transform:scaleX(${pct / 100})` })]),
      h('span', { class: 'ob-count' }, `${qIndex() + 1}/${qTotal()}`),
    ]);

    let body;
    if (s.kind === 'single') body = singleStep(s);
    else if (s.kind === 'multi') body = multiStep(s);
    else if (s.kind === 'number') body = numberStep(s);
    else if (s.kind === 'height') body = heightStep(s);
    else if (s.kind === 'injuries') body = injuriesStep(s);

    mount.append(h('section', { class: 'ob' }, [head, body]));
  }

  /* ---- step renderers ---- */
  function intro() {
    return h('section', { class: 'ob ob-center' }, [
      h('div', { class: 'ob-badge' }, '◇'),
      h('h1', {}, 'Let’s build your plan'),
      h('p', { class: 'muted' }, 'The questions a good trainer would ask on day one — your goal, your week, what has derailed you before, and how you actually recover. A few minutes, all taps.'),
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', onClick: next }, 'Start'),
    ]);
  }

  function stepHead(s) {
    return [h('h2', {}, s.title), s.why ? h('p', { class: 'muted' }, s.why) : null];
  }

  function singleStep(s) {
    const cards = s.options.map((o) =>
      h('button', {
        class: 'card-opt' + (answers[s.key] === o.value ? ' is-sel' : ''),
        type: 'button',
        onClick: () => { answers[s.key] = o.value; draw(); setTimeout(next, 160); },
      }, [h('span', {}, o.label), h('span', { class: 'card-chev' }, '›')])
    );
    return h('div', {}, [...stepHead(s), h('div', { class: 'card-list' }, cards)]);
  }

  function multiStep(s) {
    const picked = () => answers[s.key] || [];
    const cont = h('button', { class: 'btn btn-primary btn-lg', type: 'button', onClick: next }, 'Continue');

    const cards = s.options.map((o) =>
      h('button', {
        class: 'card-opt' + (picked().includes(o.value) ? ' is-sel' : ''),
        type: 'button',
        onClick: () => {
          const cur = new Set(picked());
          if (cur.has(o.value)) cur.delete(o.value);
          else {
            // "None of these" and a real answer cannot both be true.
            if (o.exclusive) cur.clear();
            else s.options.filter((x) => x.exclusive).forEach((x) => cur.delete(x.value));
            cur.add(o.value);
          }
          answers[s.key] = [...cur];
          draw();
        },
      }, [h('span', {}, o.label), h('span', { class: 'card-chev' }, picked().includes(o.value) ? '✓' : '')])
    );
    return h('div', {}, [...stepHead(s), h('div', { class: 'card-list' }, cards), cont]);
  }

  function numberStep(s) {
    const input = h('input', {
      class: 'num-input', type: 'number', inputmode: 'numeric',
      value: answers[s.key] ?? '', min: s.min, max: s.max, placeholder: '0',
      onInput: (e) => { answers[s.key] = e.target.value === '' ? undefined : Number(e.target.value); validate(); },
    });
    const err = h('p', { class: 'ob-err' }, '');
    const cont = h('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: 'true', onClick: next }, 'Continue');
    function validate() {
      const v = answers[s.key];
      const ok = typeof v === 'number' && v >= s.min && v <= s.max;
      err.textContent = v != null && !ok ? `Enter a value between ${s.min} and ${s.max}.` : '';
      if (ok) cont.removeAttribute('disabled'); else cont.setAttribute('disabled', 'true');
    }
    validate();
    return h('div', {}, [
      ...stepHead(s),
      h('div', { class: 'num-row' }, [input, h('span', { class: 'num-unit' }, s.unit)]),
      err, cont,
    ]);
  }

  function heightStep(s) {
    let ft = answers._ft, inch = answers._in;
    const sel = (val, max, on) => {
      const el = h('select', { class: 'num-input', onChange: (e) => on(Number(e.target.value)) });
      el.append(h('option', { value: '' }, '--'));
      for (let n = 0; n <= max; n++) el.append(h('option', { value: n, ...(val === n ? { selected: 'true' } : {}) }, String(n)));
      return el;
    };
    const cont = h('button', { class: 'btn btn-primary btn-lg', type: 'button', onClick: next }, 'Continue');
    const sync = () => {
      if (ft != null && inch != null) { answers[s.key] = ft * 12 + inch; cont.removeAttribute('disabled'); }
      else cont.setAttribute('disabled', 'true');
    };
    if (answers[s.key] == null) cont.setAttribute('disabled', 'true');
    return h('div', {}, [
      ...stepHead(s),
      h('div', { class: 'num-row' }, [
        sel(ft, 8, (v) => { ft = answers._ft = v; sync(); }), h('span', { class: 'num-unit' }, 'ft'),
        sel(inch, 11, (v) => { inch = answers._in = v; sync(); }), h('span', { class: 'num-unit' }, 'in'),
      ]),
      cont,
    ]);
  }

  const INJURY_SITES = [
    ['knees', 'Knees'], ['lowerBack', 'Lower back'], ['shoulders', 'Shoulders'],
    ['neck', 'Neck'], ['hips', 'Hips'], ['wrists', 'Wrists / elbows'],
  ];

  function injuriesStep(s) {
    const toggle = ([key, label]) =>
      h('button', {
        class: 'card-opt' + (answers.injuries[key] ? ' is-sel' : ''), type: 'button',
        onClick: (e) => {
          answers.injuries[key] = !answers.injuries[key];
          e.currentTarget.classList.toggle('is-sel');
          e.currentTarget.querySelector('.card-chev').textContent = answers.injuries[key] ? '✓' : '';
        },
      }, [h('span', {}, label), h('span', { class: 'card-chev' }, answers.injuries[key] ? '✓' : '')]);

    const notes = h('textarea', {
      class: 'ob-notes', rows: '2', placeholder: 'Anything else we should know (optional)',
      onInput: (e) => { answers.injuries.notes = e.target.value; },
    });
    notes.value = answers.injuries.notes || '';

    return h('div', {}, [
      ...stepHead(s),
      h('div', { class: 'card-list' }, INJURY_SITES.map(toggle)),
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

    const pace = t.pace;
    const paceLine = pace
      ? `${pace.toLoseLb} lb at about ${pace.perWeekLb} lb a week — roughly ${pace.weeks} weeks.`
      : null;

    return h('section', { class: 'ob' }, [
      h('div', { class: 'ob-badge ok' }, '✓'),
      h('h1', {}, 'Your plan is ready'),
      h('p', { class: 'muted' }, 'Daily targets tuned to protect muscle while the fat comes off. You can re-run this any time from the Plan tab.'),
      h('div', { class: 'macro-grid' }, [
        macro('Calories', t.calories, 'cal'), macro('Protein', t.protein, 'pro'),
        macro('Carbs', t.carbs, 'carb'), macro('Fat', t.fat, 'fat'),
      ]),
      h('p', { class: 'steps-note' }, `Daily steps: ${t.steps.min.toLocaleString()} to ${t.steps.max.toLocaleString()}`),
      paceLine ? h('p', { class: 'steps-note' }, paceLine) : null,
      pace && pace.behindStatedGoal
        ? h('p', { class: 'ob-callout' }, `That is longer than the ${pace.statedWeeks} weeks you had in mind. The timeline is the honest one — going faster means a steeper deficit, and that is where muscle and energy start going too.`)
        : null,
      h('div', { class: 'plan-split' }, [
        h('div', { class: 'plan-split-name' }, splitName),
        h('div', { class: 'day-chips' }, days.map((d) => h('span', { class: 'chip' }, d.name))),
      ]),
      ...(t.reasons || []).map((r) => h('p', { class: 'ob-callout' }, r)),
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', onClick: () => onComplete(profile) }, 'Start tracking'),
    ]);
  }

  draw();
}

function toProfile(a) {
  return {
    // body
    sex: a.sex, age: a.age, heightInches: a.heightInches, weightLb: a.weightLb, goalWeightLb: a.goalWeightLb,
    // goal
    goal: a.goal, motivation: a.motivation, timeline: a.timeline,
    // history + psychology
    history: a.history, exerciseNow: a.exerciseNow, enjoys: a.enjoys, derailer: a.derailer,
    liftingAttitude: a.liftingAttitude, confidence: a.confidence,
    // logistics
    trainingDays: a.trainingDays, sessionLength: a.sessionLength, equipment: a.equipment,
    // day + recovery
    dailyActivity: a.dailyActivity, sleep: a.sleep, stress: a.stress,
    // health (recorded, does not gate the plan)
    health: a.health, injuries: a.injuries,
    // female-specific
    lifeStage: a.lifeStage, postpartumCleared: a.postpartumCleared,
    // nutrition
    diet: a.diet, avoids: a.avoids, foodHandling: a.foodHandling,
    weightTrend: a.weightTrend, alcohol: a.alcohol,
    createdAt: new Date().toISOString(),
  };
}
