/* Day-log data helpers, layered on db.js. A "day" record:
 *   { date, workout:{ dayName, focus, cardio, note, exercises:[{name,targetSets,targetReps,sets:[{weight,reps}]}] }|null,
 *     food:[{id,name,calories,protein}], steps, bodyweight, updatedAt }
 * Un-logged days are materialized from the plan's scheduled day but not saved
 * until the user actually logs something (avoids empty rows for every date). */

import { getDay, saveDay, getDays, getPlan, todayKey } from './db.js';
import { num } from './ui.js';

export const dateFromKey = (key) => new Date(key + 'T00:00:00');

// Monday-indexed: training days fall on the first weekdays, rest after.
export function scheduledDay(plan, date) {
  if (!plan || !plan.days) return null;
  const p = (date.getDay() + 6) % 7;
  const d = plan.days[p];
  return d && d.exercises && d.exercises.length ? d : null;
}

export const isTrainingDay = (plan, dateKey) => !!scheduledDay(plan, dateFromKey(dateKey));

function freshDay(dateKey, plan) {
  const sched = scheduledDay(plan, dateFromKey(dateKey));
  return {
    date: dateKey,
    workout: sched ? {
      dayName: sched.name, focus: sched.focus || '', cardio: sched.cardio || null, note: sched.note || null,
      exercises: sched.exercises.map((e) => ({ name: e.name, targetSets: e.sets, targetReps: e.reps, sets: [] })),
    } : null,
    food: [], steps: null, bodyweight: null, _new: true,
  };
}

function ensureShape(day) {
  day.food = day.food || [];
  if (day.workout) day.workout.exercises = (day.workout.exercises || []).map((e) => ({ ...e, sets: e.sets || [] }));
  return day;
}

export async function loadDay(dateKey, plan) {
  const existing = await getDay(dateKey);
  if (existing) return ensureShape(existing);
  return freshDay(dateKey, plan || (await getPlan()));
}

export function persistDay(day) {
  delete day._new;
  day.updatedAt = new Date().toISOString();
  return saveDay(day);
}

export function foodTotals(day) {
  return (day.food || []).reduce(
    (t, f) => ({ calories: t.calories + num(f.calories), protein: t.protein + num(f.protein) }),
    { calories: 0, protein: 0 }
  );
}

export function dayStatus(day, targets) {
  const totals = foodTotals(day);
  // "did the workout" = any exercise checked off (or cardio done), with a
  // fallback to older set-based logs so past days still count.
  const workoutLogged = !!day.workout && (
    day.workout.exercises.some((e) => e.done || (e.sets || []).some((s) => num(s.reps) > 0)) ||
    !!day.workout.cardioDone
  );
  const dietLogged = (day.food || []).length > 0;
  const onTarget = dietLogged && !!targets &&
    totals.protein >= targets.protein * 0.9 &&
    totals.calories <= targets.calories * 1.05;
  return { totals, workoutLogged, dietLogged, onTarget };
}

export const uid = () =>
  (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'f' + Date.now() + Math.round(Math.random() * 1e6));

/* ---- progress (step 7) ---- */

// log a weigh-in onto a day record (creating it if needed)
export async function logBodyweight(dateKey, lb) {
  const plan = await getPlan();
  const day = await loadDay(dateKey, plan);
  day.bodyweight = lb;
  return persistDay(day);
}

// chronological weigh-ins, seeded with the profile's starting weight
export async function bodyweightSeries(profile) {
  const rows = await getDays();
  const pts = rows
    .filter((d) => typeof d.bodyweight === 'number' && d.bodyweight > 0)
    .map((d) => ({ date: d.date, lb: d.bodyweight }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (profile && profile.weightLb) {
    const startDate = (profile.createdAt || '').slice(0, 10) || (pts[0] && pts[0].date);
    if (startDate && (!pts.length || startDate < pts[0].date)) {
      pts.unshift({ date: startDate, lb: profile.weightLb, start: true });
    }
  }
  return pts;
}

// Monday-start week (7 date keys) containing the given date
export function weekKeys(dateKey = todayKey()) {
  const d = dateFromKey(dateKey);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return todayKey(x);
  });
}
