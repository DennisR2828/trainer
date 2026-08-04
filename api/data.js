/* GET  /api/data -> { data, updatedAt }   pull this user's snapshot
 * PUT  /api/data  { data }                push this user's snapshot
 *
 * The blob key comes from the verified session, never from the request body,
 * so there is no way to address another user's data by crafting a payload.
 * That is the whole isolation model — keep it that way.
 */

import { sessionFromRequest } from './_lib/auth.js';
import { readJson, writeJson, dataPath, sendJson, readBody, guard } from './_lib/store.js';

const MAX_BYTES = 5 * 1024 * 1024;

export default guard(async function handler(req, res) {
  const session = sessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: 'Not signed in.' });

  const path = dataPath(session.userId);

  if (req.method === 'GET') {
    const stored = await readJson(path);
    return sendJson(res, 200, {
      data: stored?.data ?? null,
      updatedAt: stored?.updatedAt ?? null,
    });
  }

  if (req.method === 'PUT') {
    const { data } = readBody(req);
    if (data == null || typeof data !== 'object') {
      return sendJson(res, 400, { error: 'Expected a data object.' });
    }

    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_BYTES) {
      return sendJson(res, 413, { error: 'That backup is too large to sync.' });
    }

    const updatedAt = new Date().toISOString();
    await writeJson(path, { userId: session.userId, updatedAt, data });
    return sendJson(res, 200, { ok: true, updatedAt });
  }

  return sendJson(res, 405, { error: 'Method not allowed.' });
});
