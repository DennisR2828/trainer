/* GET /api/auth/me -> { user }
 *
 * Used on boot to decide whether a stored token is still good. Verifying the
 * signature would be enough to trust the user id, but resolving the account
 * too means a deleted user's token stops working immediately. */

import { sessionFromRequest } from '../_lib/auth.js';
import { readJson, userPath, userIdPath, sendJson, guard } from '../_lib/store.js';

export default guard(async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });

  const session = sessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: 'Not signed in.' });

  const index = await readJson(userIdPath(session.userId));
  const user = index?.emailHash ? await readJson(userPath(index.emailHash)) : null;
  if (!user) return sendJson(res, 401, { error: 'Not signed in.' });

  return sendJson(res, 200, {
    user: { id: user.id, email: user.email, name: user.name },
    expiresAt: session.expiresAt,
  });
});
