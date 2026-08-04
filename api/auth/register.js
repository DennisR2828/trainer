/* POST /api/auth/register  { email, password, name, code } -> { token, user }
 *
 * Gated by SIGNUP_CODE. The app is on a public URL, so without a gate anyone
 * who found it could create an account. */

import { hashPassword, emailKey, normalizeEmail, newUserId, signSession, safeEqual, SESSION_TTL_MS } from '../_lib/auth.js';
import { readJson, writeJson, userPath, userIdPath, sendJson, readBody, guard } from '../_lib/store.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export default guard(async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  const { email, password, name, code } = readBody(req);

  const expectedCode = process.env.SIGNUP_CODE;
  if (!expectedCode) return sendJson(res, 500, { error: 'Signups are not configured.' });
  // Case- and whitespace-insensitive: it's a short code typed by hand on a
  // phone, and a capital letter should not read as "wrong code".
  const norm = (s) => String(s || '').trim().toLowerCase();
  if (!safeEqual(norm(code), norm(expectedCode))) {
    return sendJson(res, 403, { error: 'That signup code is not right.' });
  }

  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized)) return sendJson(res, 400, { error: 'Enter a valid email address.' });
  if (String(password || '').length < MIN_PASSWORD) {
    return sendJson(res, 400, { error: `Password must be at least ${MIN_PASSWORD} characters.` });
  }

  const key = emailKey(normalized);
  if (await readJson(userPath(key))) {
    return sendJson(res, 409, { error: 'An account already exists for that email.' });
  }

  const user = {
    id: newUserId(),
    email: normalized,
    name: String(name || '').trim() || normalized.split('@')[0],
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await writeJson(userPath(key), user);
  await writeJson(userIdPath(user.id), { emailHash: key });

  return sendJson(res, 201, {
    token: signSession(user.id),
    expiresIn: SESSION_TTL_MS,
    user: { id: user.id, email: user.email, name: user.name },
  });
});
