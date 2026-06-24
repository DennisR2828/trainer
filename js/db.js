/* Local-first data layer (IndexedDB).
 *
 * Everything the app reads/writes goes through this module. Keep it this way:
 * when we add cloud sync (phase 2, Supabase) we replace the bodies of these
 * functions and the rest of the app does not change.
 *
 * Stores
 *   profile  keyPath "id"   singleton, id = "current"   (intake answers)
 *   plan     keyPath "id"   singleton, id = "current"   (generated targets + split)
 *   days     keyPath "date" one row per "YYYY-MM-DD"     (workout + food + steps + weight)
 *   meta     keyPath "key"  small app flags (onboarded, etc.)
 */

const DB_NAME = 'trainer';
const DB_VERSION = 1;

let _dbp = null;

function open() {
  if (_dbp) return _dbp;
  _dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('plan'))    db.createObjectStore('plan',    { keyPath: 'id' });
      if (!db.objectStoreNames.contains('days'))    db.createObjectStore('days',    { keyPath: 'date' });
      if (!db.objectStoreNames.contains('meta'))    db.createObjectStore('meta',    { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbp;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let out;
        Promise.resolve(fn(s)).then((r) => (out = r));
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const req2promise = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/* ---- generic helpers ---- */
const get    = (store, key) => tx(store, 'readonly',  (s) => req2promise(s.get(key)));
const getAll = (store)      => tx(store, 'readonly',  (s) => req2promise(s.getAll()));
const put    = (store, val) => tx(store, 'readwrite', (s) => req2promise(s.put(val)));
const del    = (store, key) => tx(store, 'readwrite', (s) => req2promise(s.delete(key)));

/* ---- profile ---- */
export const getProfile  = () => get('profile', 'current');
export const saveProfile = (p) => put('profile', { ...p, id: 'current', updatedAt: nowISO() });

/* ---- plan ---- */
export const getPlan  = () => get('plan', 'current');
export const savePlan = (plan) => put('plan', { ...plan, id: 'current' });

/* ---- day logs ---- */
export const getDay   = (date) => get('days', date);
export const getDays  = ()     => getAll('days');
export const saveDay  = (day)  => put('days', day);
export const deleteDay = (date) => del('days', date);

/* ---- meta flags ---- */
export const getFlag = (key) => get('meta', key).then((r) => (r ? r.value : undefined));
export const setFlag = (key, value) => put('meta', { key, value });

/* ---- lifecycle ---- */
export const isOnboarded = () => getFlag('onboarded').then(Boolean);
export async function resetAll() {
  await Promise.all([del('profile', 'current'), del('plan', 'current'), setFlag('onboarded', false)]);
}

/* ---- backup: export/import all local data to a portable JSON file ----
 * Local-first means the data lives only in this browser. These let the user
 * keep a copy and move it between devices/browsers. */
export async function exportAll() {
  const [profile, plan, days] = await Promise.all([getProfile(), getPlan(), getAll('days')]);
  const onboarded = await getFlag('onboarded');
  return { app: 'trainer', schema: 1, exportedAt: nowISO(), profile, plan, days, meta: { onboarded } };
}

export async function importAll(data) {
  if (!data || data.app !== 'trainer') throw new Error('That is not a Trainer backup file.');
  if (data.profile) await put('profile', { ...data.profile, id: 'current' });
  if (data.plan) await put('plan', { ...data.plan, id: 'current' });
  if (Array.isArray(data.days)) await Promise.all(data.days.filter((d) => d && d.date).map((d) => put('days', d)));
  await setFlag('onboarded', !!(data.meta && data.meta.onboarded) || !!data.profile);
}

/* ask the browser to keep our data (don't evict under storage pressure) */
export async function requestPersistence() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}

/* ---- utils shared across the app ---- */
export function nowISO() { return new Date().toISOString(); }
export function todayKey(d = new Date()) {
  // Local-date key "YYYY-MM-DD" (not UTC, so "today" matches the user's clock).
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}
