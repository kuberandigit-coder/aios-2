// lib/feed/session.js
//
// Shared server-side session verification for the Thivajini Req5 (Feed
// Optimization) endpoints.
//
// WHY THIS EXISTS
//   ARCHITECTURE.md §10 finding 1 records the most important security gap in
//   this dashboard: "Most API routes do not enforce the authenticated session.
//   Static-page guards are not an authorization boundary." api/members-api.js
//   is one of those unprotected routes and it also sets
//   `Access-Control-Allow-Origin: *`.
//
//   This module is lifted verbatim in behaviour from the ONE route that does
//   it correctly today — api/staff-id-performance.js:44 `verifySession` — so
//   Req5 inherits the proven implementation rather than inventing a second
//   scheme. It is deliberately NOT placed under api/ (see lib/feed/README
//   note in ARCHITECTURE.md): every file under api/ becomes its own Vercel
//   Function, and this project is already at the 12-function Hobby ceiling.
//
// Cookie contract (api/auth.js):
//   name    : dm_session
//   value   : base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
//   secret  : process.env.SESSION_SECRET
//   payload : { username, role, staff_key, exp, ... }
//   expiry  : 12h, HttpOnly, SameSite=Lax, Secure outside development

'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'dm_session';

function parseCookies(req) {
  const header = req && req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

/**
 * Verify the dm_session cookie. Returns the session payload, or null.
 * Never throws — a misconfigured SESSION_SECRET must fail closed, not 500.
 */
function verifySession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const token = parseCookies(req)[COOKIE_NAME];
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  let expected;
  try {
    expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  } catch {
    return null;
  }

  // timingSafeEqual throws on length mismatch — compare lengths first.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

// Who may use the Thivajini feed workflow.
const ALLOWED_STAFF_KEYS = new Set(['thivajini']);

function isAllowed(session) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return ALLOWED_STAFF_KEYS.has(session.staff_key);
}

/**
 * Guard for Req5 endpoints.
 *
 * `write` endpoints ALWAYS require a session. Read endpoints require one too —
 * this feature exposes product cost/margin-adjacent evidence and staff notes,
 * so there is no reason to leave reads open.
 *
 * Returns the session on success. On failure it has already written the
 * response; the caller must simply return.
 */
function requireSession(req, res) {
  const session = verifySession(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'Unauthorised — sign in required.' });
    return null;
  }
  if (!isAllowed(session)) {
    res.status(403).json({ ok: false, error: 'Forbidden — not permitted for this dashboard.' });
    return null;
  }
  return session;
}

/**
 * Identity string stored in *_by columns. Never store the raw cookie.
 */
function actorOf(session) {
  if (!session) return 'unknown';
  return String(session.username || session.staff_key || 'unknown').slice(0, 120);
}

module.exports = {
  COOKIE_NAME,
  parseCookies,
  verifySession,
  requireSession,
  isAllowed,
  actorOf,
};
