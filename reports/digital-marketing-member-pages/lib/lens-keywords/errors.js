'use strict';

// lib/lens-keywords/errors.js
//
// Staff-safe error mapping. Copied in shape from lib/feed/req5.js's err()/
// staffMessage() — technical detail is logged server-side and returned as
// `detail` for diagnostics; the `error` field is always safe to render.
// Never leaks: DILAIKSHAN_NEON_DB missing, ECONNREFUSED, Postgres stack
// traces, SERP_API_1/2 undefined, raw provider JSON.

const { ERRORS } = require('./config');

const SETUP_MESSAGE = 'Automation Keyword Finder setup is temporarily unavailable. Please contact the technical team.';
const CREDITS_MESSAGE = 'Google search credits are currently unavailable. Please try again later or contact the technical team.';

const CONFIG_CODES = [
  ERRORS.LEDSONE_MISSING,
  ERRORS.APP_MISSING,
  ERRORS.MIGRATION_MISSING,
];

const STAFF_MESSAGE = {
  [ERRORS.LEDSONE_MISSING]: SETUP_MESSAGE,
  [ERRORS.APP_MISSING]: SETUP_MESSAGE,
  [ERRORS.MIGRATION_MISSING]: SETUP_MESSAGE,
  [ERRORS.SERPAPI_NOT_CONFIGURED]: CREDITS_MESSAGE,
  [ERRORS.INSUFFICIENT_QUOTA]: CREDITS_MESSAGE,
  LENS_RUN_NOT_FOUND: 'That run could not be found.',
  LENS_RESULT_NOT_FOUND: 'That result could not be found.',
  LENS_PRODUCTS_NOT_FOUND: null, // message is already staff-safe at the throw site
  LENS_PRODUCTS_NOT_READY: null,
};

const SQLSTATE_RE = /^[0-9A-Z]{5}$/;
const DB_FAILURE_MESSAGE =
  'Something went wrong saving that. Please try again, or contact the technical team if it keeps happening.';

function staffMessage(code, thrownMessage, technical) {
  if (STAFF_MESSAGE[code]) return STAFF_MESSAGE[code];
  if (STAFF_MESSAGE[code] === null && thrownMessage) return thrownMessage; // already safe
  if (code && SQLSTATE_RE.test(String(code))) return DB_FAILURE_MESSAGE;
  if (thrownMessage && thrownMessage.length <= 200) return thrownMessage;
  return 'Something went wrong completing that action. Please try again, or contact the technical team if it keeps happening.';
}

function respond(res, err, context) {
  const status = (err && err.status) || 500;
  const code = (err && err.code) || null;
  const technical = (err && err.message) || 'unknown error';
  const isConfig = CONFIG_CODES.includes(code);

  console.error(`[lens-keywords/${context}] ${code || 'ERROR'}: ${technical}`);

  return res.status(isConfig ? 503 : status).json({
    ok: false,
    code,
    error: staffMessage(code, technical, technical),
    detail: technical,
    setup_issue: isConfig,
  });
}

module.exports = { CONFIG_CODES, STAFF_MESSAGE, staffMessage, respond, SETUP_MESSAGE, CREDITS_MESSAGE };
