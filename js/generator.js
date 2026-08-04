/* The trainer brain: calories/macros + the training split.
 *
 * generatePlan(profile) -> { targets, splitName, days, notes, generatedAt }
 *
 * TUNING NOTES — reconciling the spec's formula prose with its own reference output.
 * Reference user: Male, 26, 6'0" (72 in), 257 lb, mostly sitting, 5x/week.
 * Spec says the expected output is ≈ 2150 cal / 210 P / 200 C / 60 F.
 * Two places where the prose and that reference disagree, resolved toward the
 * reference (it is the stated acceptance check) — both are one-line constants:
 *   • Fat: prose says ~0.35 g/lb (→ ~90 g for the reference user), but the
 *     reference output is 60 g (≈ 0.24 g/lb). We use 0.24 to match the target.
 *   • Calories land ~2240 with the 1.3 sitting multiplier and a 600 deficit.
 * Protein 0.82 g/lb → 210 g for the reference user (within the 0.8–1.0 band).
 *
 * WHAT SEX ACTUALLY CHANGES. Until now it changed one constant in the BMR
 * formula and nothing else — the workout builder never even received it, so men
 * and women got byte-identical splits. It now also sets rest intervals and
 * nudges volume, because that is what the evidence actually supports. It does
 * NOT change exercise selection: the movement patterns are the same for
 * everyone. There is deliberately no menstrual-cycle periodization here —
 * current evidence shows no effect of cycle phase on strength performance or
 * adaptation, so programming around it would be inventing precision we do not
 * have.
 */

import { pickTemplate, applyEquipment, applyInjuries, applyRest, scaleVolume, trimToSession, applyLifeStage } from './exercises.js';

const ACTIVITY_MULT = { sitting: 1.3, feet_some: 1.45, feet_lot: 1.6, demanding: 1.75 };
const FAT_LOSS_DEFICIT = 600;
const RECOMP_DEFICIT   = 250;
const PROTEIN_G_PER_LB = 0.82;
const PROTEIN_G_PER_LB_50PLUS = 0.9;  // anabolic resistance rises with age
const FAT_G_PER_LB     = 0.24;
const MIN_CALORIES     = { male: 1500, female: 1200 };
const STEP_GOAL        = { min: 8000, max: 10000 };

const round5  = (n) => Math.round(n / 5) * 5;
const round10 = (n) => Math.round(n / 10) * 10;
const lbToKg  = (lb) => lb / 2.20462;
const inToCm  = (inch) => inch * 2.54;
const clamp   = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* Life stages where a steep deficit is the wrong tool. Under-eating against a
 * training load is what drives low energy availability, and its first casualties
 * are menstrual function and bone density. */
const NO_STEEP_DEFICIT = ['irregular', 'postpartum'];

/* ---- calories + macros ---- */
export function computeTargets(profile) {
  const {
    sex = 'male', age, heightInches, weightLb, goal = 'lose_fat',
    dailyActivity = 'sitting', sleep, stress, lifeStage,
  } = profile;

  const kg = lbToKg(weightLb);
  const cm = inToCm(heightInches);
  const bmr = sex === 'female'
    ? 10 * kg + 6.25 * cm - 5 * age - 161
    : 10 * kg + 6.25 * cm - 5 * age + 5;

  const tdee = bmr * (ACTIVITY_MULT[dailyActivity] || 1.3);

  let deficit;
  if (goal === 'lose_fat') deficit = FAT_LOSS_DEFICIT;
  else if (goal === 'lose_build') deficit = RECOMP_DEFICIT;
  else deficit = 0;                         // build / strength / health ≈ maintenance

  const reasons = [];
  if (lifeStage === 'pregnant' && deficit > 0) {
    deficit = 0;
    reasons.push('Set to maintenance rather than a deficit. Calorie targets in pregnancy are a conversation for your provider, not an app.');
  } else if (NO_STEEP_DEFICIT.includes(lifeStage) && deficit > RECOMP_DEFICIT) {
    deficit = RECOMP_DEFICIT;
    reasons.push('Using a gentler deficit. A steep one against irregular cycles or early postpartum recovery is how energy availability gets too low, and bone density pays for it.');
  }
  if ((sleep === 'lt5' || stress === 'very_high') && deficit > RECOMP_DEFICIT) {
    deficit = RECOMP_DEFICIT;
    reasons.push('Eased the deficit because short sleep and high stress make a steep one hard to hold, and harder to recover from.');
  }

  let calories = Math.max(tdee - deficit, MIN_CALORIES[sex] || 1500);

  const proteinPerLb = age >= 50 ? PROTEIN_G_PER_LB_50PLUS : PROTEIN_G_PER_LB;
  const protein = round5(proteinPerLb * weightLb);
  const fat     = round5(FAT_G_PER_LB * weightLb);
  const carbs   = Math.max(0, round5((calories - protein * 4 - fat * 9) / 4));

  return {
    calories: round10(calories),
    protein, carbs, fat,
    steps: { ...STEP_GOAL },
    pace: estimatePace(profile, tdee, calories),
    reasons,
    _debug: { bmr: Math.round(bmr), tdee: Math.round(tdee), deficit: Math.round(tdee - calories) },
  };
}

/* How long the stated goal weight actually takes at this deficit, so a
 * three-month timeline on a forty-pound goal gets said out loud instead of
 * quietly disappointing someone in month four. */
function estimatePace(profile, tdee, calories) {
  const toLose = (profile.weightLb || 0) - (profile.goalWeightLb || 0);
  const dailyDeficit = tdee - calories;
  if (toLose <= 0 || dailyDeficit < 50) return null;

  const weeks = Math.round((toLose * 3500) / (dailyDeficit * 7));
  const stated = { '3mo': 13, '6mo': 26, '1yr': 52 }[profile.timeline];
  return {
    toLoseLb: Math.round(toLose),
    weeks,
    perWeekLb: Math.round((dailyDeficit * 7 / 3500) * 10) / 10,
    behindStatedGoal: stated ? weeks > stated * 1.15 : false,
    statedWeeks: stated || null,
  };
}

/* ---- training volume ----
 * One multiplier carrying training age, recovery, and sex. Everything here is a
 * modest nudge; none of it changes which exercises you do. */
function volumeFactor(profile) {
  let f = 1;

  if (profile.exerciseNow === 'none') f -= 0.25;        // starting from zero
  else if (profile.exerciseNow === '1-2') f -= 0.1;
  else if (profile.exerciseNow === '5plus') f += 0.1;

  if (profile.sleep === 'lt5') f -= 0.2;                // you adapt to what you recover from
  else if (profile.sleep === '5-6') f -= 0.1;
  if (profile.stress === 'very_high') f -= 0.15;
  else if (profile.stress === 'high') f -= 0.05;

  if (profile.sex === 'female') f += 0.1;               // higher volume tolerated at a given relative load

  return clamp(f, 0.6, 1.25);
}

/* Confidence is the single strongest predictor of whether someone actually
 * trains. A four-day plan finished beats a six-day plan abandoned, so low
 * confidence buys a smaller plan rather than a lecture. */
const DAY_DOWNGRADE = { every: '5-6', '5-6': '3-4', '3-4': '1-2', '1-2': '1-2' };

function effectiveTrainingDays(profile) {
  const stated = profile.trainingDays || '3-4';
  const shaky = profile.confidence === 'not_very' || profile.confidence === 'unsure';
  return shaky ? (DAY_DOWNGRADE[stated] || stated) : stated;
}

/* ---- split ---- */
export function buildSplit(profile) {
  const { equipment = 'full_gym', injuries = {}, sex = 'male', sessionLength, lifeStage, postpartumCleared } = profile;

  const days = effectiveTrainingDays(profile);
  const { splitName, days: template } = pickTemplate(days);

  // Order matters: equipment first (it can turn a machine move into a free-weight
  // one), then injuries so they always win, then life stage, then trim, then
  // volume and rest on whatever survived.
  let out = applyEquipment(template, equipment);
  out = applyInjuries(out, injuries, equipment);
  out = applyLifeStage(out, lifeStage, postpartumCleared);
  out = trimToSession(out, sessionLength);
  out = scaleVolume(out, volumeFactor(profile));
  out = applyRest(out, sex);

  return { splitName, days: out, downgradedDays: days !== (profile.trainingDays || '3-4') };
}

/* ---- plan-level notes: things worth saying once, in plain language ---- */
function planNotes(profile) {
  const notes = [];

  if (profile.liftingAttitude === 'bulky' || profile.liftingAttitude === 'light') {
    notes.push('Lifting heavy will not make you bulky — that takes deliberate effort over years. Challenging weight in the 8–12 rep range is what builds the lean, defined look, and light weight for high reps is the slow road to it.');
  }
  if (profile.confidence === 'not_very' || profile.confidence === 'unsure') {
    notes.push('We sized this down from what you picked. Finishing a smaller week beats abandoning a bigger one, and you can raise it any time from the Plan tab.');
  }
  if (profile.lifeStage === 'peri' || profile.lifeStage === 'post_meno') {
    notes.push('Keeping the heavy compound lifts in deliberately. Loading bone is the part of training that matters most as estrogen drops, and it is the part most often dropped.');
  }
  if (profile.lifeStage === 'postpartum' && profile.postpartumCleared !== 'yes') {
    notes.push('Core and impact work starts gentle until you are cleared. If anything leaks, bulges, or feels like pressure, that is the signal to back off and ask a pelvic floor PT.');
  }
  if (profile.derailer === 'busy') {
    notes.push('You said time is what gets you. Every session here is trimmed to fit the length you picked, and a short session done beats a full one skipped.');
  }
  if (profile.derailer === 'injury') {
    notes.push('You said injuries stopped you before. Anything you flagged is already swapped out, and every exercise can be replaced from the Today tab.');
  }
  return notes;
}

/* ---- full plan ---- */
export function generatePlan(profile) {
  const targets = computeTargets(profile);
  const { splitName, days } = buildSplit(profile);
  return { targets, splitName, days, notes: planNotes(profile), generatedAt: new Date().toISOString() };
}
