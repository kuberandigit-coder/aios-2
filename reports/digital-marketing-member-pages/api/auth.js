// DM Dashboard authentication — role-based login.
// Backed by a dedicated Neon Postgres (AUTH_DATABASE_URL), separate from the
// read-only ledsone business DB used elsewhere in this project.
// Actions (via ?action= or JSON body { action }):
//   POST action=login   { username, password } -> sets httpOnly session cookie
//   GET  action=session  -> returns current session user (or 401)
//   POST action=logout   -> clears session cookie
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const COOKIE_NAME = 'dm_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.AUTH_DATABASE_URL;
    if (!connectionString) {
      throw new Error('Server not configured: AUTH_DATABASE_URL missing');
    }
    pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 8000 });
  }
  return pool;
}

function getSessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('Server not configured: SESSION_SECRET missing');
  return s;
}

// ---------- signed session token (HMAC, no external JWT dependency) ----------
function sign(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (!data || !data.exp || Date.now() > data.exp) return null;
  return data;
}

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function setSessionCookie(res, token, maxAgeMs) {
  const secure = process.env.NODE_ENV !== 'development';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// staff_key -> the page each role lands on after login. Every non-admin
// account is locked to exactly this one page (enforced client-side by each
// page's own guard script, which checks staff_key/role against this same
// list of names) — no shared home.html/index.html directory access.
const ROLE_LANDING = {
  muguntha: 'pages/muguntha.html',
  jefri: 'pages/jefri.html',
  dilaksi: 'pages/dilaksi.html',
  kamsi: 'pages/kamsi.html',
  mahima: 'pages/mahima.html',
  thasitha: 'pages/thasitha.html',
  sukirtha: 'pages/sukirtha.html',
  sonya: 'pages/sonya.html',
  sajeepan: 'pages/sajeepan.html',
  theekshy: 'pages/theekshy.html',
  thivajini: 'pages/thivajini.html',
  hetheesha: 'pages/hetheesha.html',
  jakshan: 'pages/jakshan.html',
};

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); }
    });
  });
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const username = (body.username || '').toString().trim().toLowerCase();
  const password = (body.password || '').toString();
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  const db = getPool();
  const { rows } = await db.query('SELECT id, username, password_hash, role, staff_key, display_name FROM users WHERE username = $1', [username]);
  const user = rows[0];

  // Constant-shape response timing: still run a bcrypt compare even on
  // unknown username, against a dummy hash, so username enumeration can't
  // be inferred from response latency.
  const hashToCheck = user ? user.password_hash : '$2b$12$rXGPgN/MUmTIk8PKEhedGeAhKNtUFmepdjpisGY6F.5E1XhjPoX4O';
  const ok = await bcrypt.compare(password, hashToCheck);

  if (!user || !ok) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  const token = sign({
    uid: user.id,
    username: user.username,
    role: user.role,
    staff_key: user.staff_key,
    exp: Date.now() + SESSION_TTL_MS,
  });
  setSessionCookie(res, token, SESSION_TTL_MS);

  db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]).catch(() => {});

  const redirect = ROLE_LANDING[user.staff_key] || null;
  return res.status(200).json({
    success: true,
    user: { username: user.username, role: user.role, staff_key: user.staff_key, display_name: user.display_name },
    redirect,
  });
}

async function handleSession(req, res) {
  const cookies = parseCookies(req);
  const session = verify(cookies[COOKIE_NAME]);
  if (!session) return res.status(401).json({ success: false, error: 'Not authenticated.' });
  return res.status(200).json({
    success: true,
    user: { username: session.username, role: session.role, staff_key: session.staff_key },
  });
}

function handleLogout(req, res) {
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query && req.query.action) || '';
  try {
    if (action === 'login' && req.method === 'POST') return await handleLogin(req, res);
    if (action === 'session' && req.method === 'GET') return await handleSession(req, res);
    if (action === 'logout' && req.method === 'POST') return handleLogout(req, res);
    return res.status(400).json({ success: false, error: 'Unknown action or wrong HTTP method.' });
  } catch (err) {
    console.error('auth.js error:', err);
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
};

module.exports.verify = verify;
module.exports.COOKIE_NAME = COOKIE_NAME;
