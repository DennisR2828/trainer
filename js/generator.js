/* The trainer brain (§2b calories/macros, §2c split).
 *
 * generatePlan(profile) -> { targets, splitName, days, generatedAt }
 *
 * TUNING NOTES — reconciling §2b's formula prose with its own reference output.
 * Reference user: Male, 26, 6'0" (72 in), 257 lb, mostly sitting, 5x/week.
 * §2b says the expected output is ≈ 2150 cal / 210 P / 200 C / 60 F.
 * Two places where the prose and that reference disagree, resolved toward the
 * reference (it is the stated acceptance check) — both are one-line constants:
 *   • Fat: prose says ~0.35 g/lb (→ ~90 g for the reference user), but the
 *     reference output is 60 g (≈ 0.24 g/lb). We use 0.24 to match the target.
 *   • Calories land ~2240 with the 1.3 sitting multiplier and a 600 deficit
 *     (≈ 4% above 2150). Nudge SITTING_MULT toward 1.25 or the deficit toward
 *     690 to land exactly on 2150. Left faithful to §2b's stated numbers.
 * Protein 0.82 g/lb → 210 g for the reference user (within §2b's 0.8–1.0 band).
 */

import { pickTemplate, applyEquipment, applyInjuries } from './exercises.js';

const ACTIVITY_MULT = { sitting: 1.3, feet_some: 1.45, feet_lot: 1.6, demanding: 1.75 };
const FAT_LOSS_DEFICIT = 600;     // §2b: TDEE − 500..600 for fat loss
const RECOMP_DEFICIT   = 250;     // §2b: TDEE − 200..maintenance for build/recomp
const PROTEIN_G_PER_LB = 0.82;    // §2b: 0.8–1.0 g/lb of current bodyweight
const FAT_G_PER_LB     = 0.24;    // see TUNING NOTES (prose says 0.35; reference says 60 g)
const MIN_CALORIES     = { male: 1500, female: 1200 };
const STEP_GOAL        = { min: 8000, max: 10000 };

const round5  = (n) => Math.round(n / 5) * 5;
const round10 = (n) => Math.round(n / 10) * 10;
const lbToKg  = (lb) => lb / 2.20462;
const inToCm  = (inch) => inch * 2.54;

/* ---- §2b: calories + macros ---- */
export function computeTargets(profile) {
  const { sex = 'male', age, heightInches, weightLb, goal = 'lose_fat', dailyActivity = 'sitting' } = profile;

  const kg = lbToKg(weightLb);
  const cm = inToCm(heightInches);
  const bmr = sex === 'female'
    ? 10 * kg + 6.25 * cm - 5 * age - 161
    : 10 * kg + 6.25 * cm - 5 * age + 5;

  const tdee = bmr * (ACTIVITY_MULT[dailyActivity] || 1.3);

  let calories;
  if (goal === 'lose_fat')        calories = tdee - FAT_LOSS_DEFICIT;
  else if (goal === 'lose_build') calories = tdee - RECOMP_DEFICIT;
  else                            calories = tdee;            // build / general health ≈ maintenance
  calories = Math.max(calories, MIN_CALORIES[sex] || 1500);

  const protein = round5(PROTEIN_G_PER_LB * weightLb);
  const fat     = round5(FAT_G_PER_LB * weightLb);
  const carbs   = Math.max(0, round5((calories - protein * 4 - fat * 9) / 4));

  return {
    calories: round10(calories),
    protein, carbs, fat,
    steps: { ...STEP_GOAL },
    // surfaced so the Plan screen can show its work
    _debug: { bmr: Math.round(bmr), tdee: Math.round(tdee) },
  };
}

/* ---- §2c: split, filtered by equipment + injuries, with cardio baked in ---- */
export function buildSplit(profile) {
  const { trainingDays = '5-6', equipment = 'full_gym', injuries = {} } = profile;
  const { splitName, days } = pickTemplate(trainingDays);
  const filtered = applyInjuries(applyEquipment(days, equipment), injuries, equipment);
  return { splitName, days: filtered };
}

/* ---- full plan ---- */
export function generatePlan(profile) {
  const targets = computeTargets(profile);
  const { splitName, days } = buildSplit(profile);
  return { targets, splitName, days, generatedAt: new Date().toISOString() };
}
