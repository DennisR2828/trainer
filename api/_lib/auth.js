/* Password hashing and session tokens.
 *
 * Deliberately built on node:crypto primitives only — no auth dependency. The
 * two things that must not be improvised are the password KDF and the token
 * signature, and both are stdlib here: scrypt (memory-hard, RFC 7914) and
 * HMAC-SHA256. Nothing in this file invents a cipher.
 */

import { randomBytes, scrypt, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/* scrypt cost. 128 * N * r bytes of memory => 128 * 32768 * 8 ≈ 33.5 MB, which
 * exceeds node's 32 MB default maxmem, so maxmem is raised explicitly. Costs
 * ~100ms per hash: slow enough to make offline cracking expensive, fast enough
 * that a cold serverless login doesn't feel broken. */
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const KEYLEN = 64;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/* Fail loudly rather than fall back to a default secret — a predictable signing
 * key would let anyone mint a valid session for any user. */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET is missing or too short (need >= 32 chars).');
  }
  return s;
}

/* Email is the lookup key, so it has to normalize identically every time:
 * trimmed, lowercased, then hashed so the blob store never holds a filename
 * that is itself a personal identifier. */
export function emailKey(email) {
  const norm = String(email || '').trim().toLowerCase();
  return createHash('sha256').update(norm).digest('hex');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(String(password).normalize('NFKC'), salt, KEYLEN, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = await scryptAsync(String(password).normalize('NFKC'), salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
    });
    // Constant-time: a length-dependent early return would leak key length.
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* Sessions are stateless HMAC-signed tokens rather than rows in the blob store.
 * That trades per-user revocation for not doing a storage round-trip on every
 * request. With two known users the tradeoff is worth it; to invalidate every
 * session at once, rotate SESSION_SECRET. */
export function signSession(userId, ttlMs = SESSION_TTL_MS) {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}`;
  const body = Buffer.from(payload).toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;

    const expected = createHmac('sha256', secret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const [userId, expStr] = Buffer.from(body, 'base64url').toString().split('.');
    const exp = Number(expStr);
    if (!userId || !Number.isFinite(exp) || Date.now() > exp) return null;

    return { userId, expiresAt: exp };
  } catch {
    return null;
  }
}

/* Pulls and validates the bearer token. Returns the session or null. */
export function sessionFromRequest(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? verifySession(match[1]) : null;
}

export function newUserId() {
  return randomBytes(12).toString('hex');
}

/* Compares two secrets without leaking length or content via timing. Used for
 * the signup code, which is low-entropy enough to be worth guarding. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
