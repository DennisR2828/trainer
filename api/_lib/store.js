/* Vercel Blob as the datastore.
 *
 * Layout (all private):
 *   users/<sha256(email)>.json   { id, email, name, passwordHash, createdAt }
 *   data/<userId>.json           the user's full app snapshot + updatedAt
 *
 * Blob is object storage, not a database — there are no queries. Every read is
 * a direct get by a key we can compute, which is why users are addressed by a
 * hash of their email rather than found by scanning.
 */

import { get, put, del } from '@vercel/blob';

const ACCESS = 'private';

export async function readJson(pathname) {
  try {
    // useCdnCache:false costs latency but guarantees read-after-write. Serving a
    // stale user record would mean a just-changed password still accepting the
    // old one, so correctness wins here.
    const res = await get(pathname, { access: ACCESS, useCdnCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return JSON.parse(await new Response(res.stream).text());
  } catch (err) {
    if (err?.name === 'BlobNotFoundError' || /not found/i.test(err?.message || '')) return null;
    throw err;
  }
}

export async function writeJson(pathname, value) {
  await put(pathname, JSON.stringify(value), {
    access: ACCESS,
    addRandomSuffix: false, // keys must be stable and computable
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export async function removeJson(pathname) {
  try {
    await del(pathname);
  } catch {
    /* already gone */
  }
}

export const userPath = (emailHash) => `users/${emailHash}.json`;
export const dataPath = (userId) => `data/${userId}.json`;
/* Reverse index. Users are addressed by email hash, but a session only carries
 * the user id, so this maps id -> email hash. Without it there is no way to
 * resolve a session back to an account short of listing the whole store. */
export const userIdPath = (userId) => `userids/${userId}.json`;

/* ---- helpers shared by the route handlers ---- */

export function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  // Auth responses must never be cached by the browser, a proxy, or our own SW.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.end(JSON.stringify(body));
}

export function readBody(req) {
  // Vercel parses JSON bodies for us, but be tolerant of a raw string.
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

/* Wraps a handler so an unexpected throw becomes a 500 instead of leaking a
 * stack trace to the client. */
export function guard(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[api] unhandled error:', err);
      sendJson(res, 500, { error: 'Something went wrong on our end.' });
    }
  };
}
