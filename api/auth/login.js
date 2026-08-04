/* POST /api/auth/login  { email, password } -> { token, user } */

import { verifyPassword, emailKey, normalizeEmail, signSession, hashPassword, SESSION_TTL_MS } from '../_lib/auth.js';
import { readJson, userPath, sendJson, readBody, guard } from '../_lib/store.js';

/* Cost of one scrypt hash, burned when the email doesn't exist so that a
 * missing account and a wrong password take the same time. Without this, reply
 * latency alone tells an attacker which emails are registered. */
const DUMMY_PASSWORD = 'not-a-real-password-timing-equalizer';

export default guard(async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });

  const { email, password } = readBody(req);
  const normalized = normalizeEmail(email);
  const user = await readJson(userPath(emailKey(normalized)));

  if (!user) {
    await hashPassword(DUMMY_PASSWORD);
    return sendJson(res, 401, { error: 'Email or password is incorrect.' });
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return sendJson(res, 401, { error: 'Email or password is incorrect.' });
  }

  return sendJson(res, 200, {
    token: signSession(user.id),
    expiresIn: SESSION_TTL_MS,
    user: { id: user.id, email: user.email, name: user.name },
  });
});
