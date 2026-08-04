/* Talks to /api. The only module that knows the session token exists.
 *
 * The token lives in localStorage when "keep me signed in" is checked and in
 * sessionStorage otherwise — sessionStorage is dropped when the app is closed,
 * which is what makes the sign-in-every-time option actually mean something.
 */

const TOKEN_KEY = 'trainer.token';
const USER_KEY = 'trainer.user';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/* Distinguishes "the server said no" from "there is no server right now".
 * The app stays fully usable offline, so callers need to tell these apart. */
export class OfflineError extends Error {
  constructor() {
    super('You appear to be offline.');
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;

export function getCachedUser() {
  const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function storeSession({ token, user }, remember) {
  const keep = remember ? localStorage : sessionStorage;
  const drop = remember ? sessionStorage : localStorage;
  drop.removeItem(TOKEN_KEY); drop.removeItem(USER_KEY);
  keep.setItem(TOKEN_KEY, token);
  keep.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function clearSession() {
  for (const s of [localStorage, sessionStorage]) {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
  }
}

async function call(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new OfflineError();
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    throw new ApiError(payload?.error || `Request failed (${res.status}).`, res.status);
  }
  return payload;
}

/* ---- auth ---- */
export async function register({ email, password, name, code }, remember = true) {
  const out = await call('/api/auth/register', {
    method: 'POST', auth: false, body: { email, password, name, code },
  });
  return storeSession(out, remember);
}

export async function login({ email, password }, remember = true) {
  const out = await call('/api/auth/login', {
    method: 'POST', auth: false, body: { email, password },
  });
  return storeSession(out, remember);
}

export const fetchMe = () => call('/api/auth/me').then((r) => r.user);

/* ---- data sync ---- */
export const pullData = () => call('/api/data');
export const pushData = (data) => call('/api/data', { method: 'PUT', body: { data } });
