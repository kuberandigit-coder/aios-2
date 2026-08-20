// lib/feed/providers.js
//
// LLM provider routing for Feed Optimization.
//
//   PRIORITY:  local  →  gemini_key_1  →  gemini_key_2
//
// DESIGN RULES ENFORCED HERE
//   * ONE logical generation request per product. Later providers are only
//     called when an earlier one FAILED — never to "compare prose". That
//     would burn a free-tier quota for nothing.
//   * Secrets never leave this module. Providers are identified downstream by
//     ALIAS only (`local_primary`, `gemini_key_1`, `gemini_key_2`). No key,
//     no Authorization header and no key-bearing URL is ever returned, logged
//     or persisted.
//   * No invented quota numbers. A limit is recorded only when the provider or
//     a human supplied it; otherwise it stays null with
//     quota_limit_source = 'UNKNOWN'.
//   * Gemini quota is commonly PROJECT-level, so two keys from one project do
//     NOT double the allowance. We therefore allow at most ONE immediate
//     key-2 fallback and then surface a retryable state instead of looping.

'use strict';

const { PROMPT_VERSION } = require('./prompt');

// ─── environment variable NAMES (values are never read into logs) ───────────
const ENV = {
  LOCAL_URL:    'LOCAL_LLM_URL',
  LOCAL_API:    'LOCAL_LLM_API',    // the user's existing name — do NOT rename
  LOCAL_MODEL:  'LOCAL_LLM_MODEL',  // conditional; only if discovery fails
  GEMINI_KEY_1: 'GEMINI_API_KEY_1',
  GEMINI_KEY_2: 'GEMINI_API_KEY_2',
  GEMINI_MODEL: 'GEMINI_MODEL',     // conditional; only if selection fails
  TIMEOUT_MS:   'FEED_LLM_TIMEOUT_MS',
};

const DEFAULT_TIMEOUT_MS = 55000; // stays under members-api maxDuration
const GEMINI_BASE = 'https://generativelanguage.googleapis.com';

// ─── application-observed usage buckets ─────────────────────────────────────
// Per warm Vercel instance only. Explicitly NOT a view of total project usage.
const usage = new Map(); // alias -> { minuteKey, reqMinute, tokMinute, dayKey, reqDay, tokDay }

function bucketFor(alias, now = Date.now()) {
  const minuteKey = Math.floor(now / 60000);
  const dayKey = new Date(now).toISOString().slice(0, 10);
  let b = usage.get(alias);
  if (!b) { b = { minuteKey, reqMinute: 0, tokMinute: 0, dayKey, reqDay: 0, tokDay: 0 }; usage.set(alias, b); }
  if (b.minuteKey !== minuteKey) { b.minuteKey = minuteKey; b.reqMinute = 0; b.tokMinute = 0; }
  if (b.dayKey !== dayKey) { b.dayKey = dayKey; b.reqDay = 0; b.tokDay = 0; }
  return b;
}

function recordUsage(alias, inputTokens, now = Date.now()) {
  const b = bucketFor(alias, now);
  b.reqMinute += 1; b.reqDay += 1;
  b.tokMinute += (inputTokens || 0); b.tokDay += (inputTokens || 0);
  return { ...b };
}

function observedUsage(alias) {
  const b = bucketFor(alias);
  return {
    observed_requests_minute: b.reqMinute,
    observed_input_tokens_minute: b.tokMinute,
    observed_requests_day: b.reqDay,
    note: 'application observed usage (this serverless instance only)',
  };
}

function resetUsage() { usage.clear(); }

// ─── token estimation ───────────────────────────────────────────────────────
// Used ONLY when the provider exposes no counting endpoint. Any attempt using
// this is stamped token_count_method = 'ESTIMATED'.
function estimateTokens(text) {
  const s = String(text || '');
  if (!s) return 0;
  // ~3.6 chars/token is a reasonable French+JSON heuristic; deliberately
  // conservative (over-estimates) so the budget check errs toward safety.
  return Math.ceil(s.length / 3.6);
}

// ─── fetch with timeout ─────────────────────────────────────────────────────
async function fetchWithTimeout(url, options, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

function timeoutMs() {
  const v = parseInt(process.env[ENV.TIMEOUT_MS], 10);
  return Number.isFinite(v) && v > 1000 ? v : DEFAULT_TIMEOUT_MS;
}

/** Classify an error into the attempt-status vocabulary of the migration. */
function classifyError(err, httpStatus) {
  if (httpStatus === 401 || httpStatus === 403) return 'AUTH_FAILED';
  if (httpStatus === 429) return 'RATE_LIMITED';
  if (httpStatus && httpStatus >= 500) return 'PROVIDER_5XX';
  const m = String((err && err.message) || '').toLowerCase();
  if (m.includes('abort') || m.includes('timeout')) return 'TIMEOUT';
  if (m.includes('econnrefused') || m.includes('enotfound') || m.includes('fetch failed') ||
      m.includes('network') || m.includes('eai_again')) return 'CONNECTION_FAILED';
  return 'ERROR';
}

function statusClass(code) {
  if (!code) return null;
  return `${Math.floor(code / 100)}xx`;
}

/** Pull JSON out of a response that may be fenced or have prose around it. */
function extractJson(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch { /* continue */ }
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* continue */ } }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch { /* continue */ }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
//
// The protocol exposed by LOCAL_LLM_URL is NOT assumed. `discoverLocal()`
// probes the two shapes that self-hosted servers overwhelmingly use and
// records which one answered:
//     OpenAI-compatible : GET {base}/v1/models      → { data:[{id,...}] }
//     Ollama            : GET {base}/api/tags       → { models:[{name,...}] }
// If neither answers, we report NOT_CONFIGURED and ask for LOCAL_LLM_MODEL at
// the manual gate rather than guessing.

function localBase() {
  const raw = process.env[ENV.LOCAL_URL];
  if (!raw) return null;
  return String(raw).replace(/\/+$/, '');
}

function localHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const key = process.env[ENV.LOCAL_API];
  if (key) h.Authorization = `Bearer ${key}`; // never logged, never returned
  return h;
}

async function discoverLocal() {
  const base = localBase();
  const out = {
    provider: 'local',
    provider_alias: 'local_primary',
    configured: !!base,
    reachable: false,
    protocol: null,
    model: null,
    models_available: [],
    supports_text: true,
    supports_vision: null,
    supports_structured_json: null,
    input_context_limit: null,
    output_token_limit: null,
    context_limit_source: 'UNKNOWN',
    known_rpm: null, known_tpm: null, known_rpd: null,
    quota_basis: 'UNKNOWN',
    limit_source: 'UNKNOWN',
    error: null,
  };
  if (!base) { out.error = `${ENV.LOCAL_URL} not set`; return out; }

  const configuredModel = process.env[ENV.LOCAL_MODEL] || null;

  // 1) OpenAI-compatible
  try {
    const r = await fetchWithTimeout(`${base}/v1/models`, { headers: localHeaders() }, 10000);
    if (r.ok) {
      const j = await r.json();
      const ids = Array.isArray(j && j.data) ? j.data.map((m) => m && m.id).filter(Boolean) : [];
      if (ids.length) {
        out.reachable = true;
        out.protocol = 'openai-compatible';
        out.models_available = ids;
        out.model = configuredModel && ids.includes(configuredModel) ? configuredModel : ids[0];
        // /v1/models does not report context length. Honest: UNKNOWN.
        out.context_limit_source = 'UNKNOWN';
        out.supports_structured_json = null; // probed at call time
        return out;
      }
    } else if (r.status === 401 || r.status === 403) {
      out.error = `local auth rejected (HTTP ${r.status}) — check ${ENV.LOCAL_API}`;
      return out;
    }
  } catch (e) {
    out.error = classifyError(e);
  }

  // 2) Ollama
  try {
    const r = await fetchWithTimeout(`${base}/api/tags`, { headers: localHeaders() }, 10000);
    if (r.ok) {
      const j = await r.json();
      const names = Array.isArray(j && j.models) ? j.models.map((m) => m && m.name).filter(Boolean) : [];
      if (names.length) {
        out.reachable = true;
        out.protocol = 'ollama';
        out.models_available = names;
        out.model = configuredModel && names.includes(configuredModel) ? configuredModel : names[0];
        out.context_limit_source = 'UNKNOWN';
        return out;
      }
    }
  } catch (e) {
    if (!out.error) out.error = classifyError(e);
  }

  if (!out.reachable && !out.error) out.error = 'no recognised model endpoint at LOCAL_LLM_URL';
  return out;
}

async function callLocal(prompt, opts) {
  const base = localBase();
  const started = Date.now();
  const attempt = {
    provider: 'local',
    provider_alias: 'local_primary',
    model: (opts && opts.model) || null,
    started_at: new Date(started).toISOString(),
    status: 'ERROR',
    token_count_method: 'ESTIMATED',
    context_limit_source: (opts && opts.contextLimitSource) || 'UNKNOWN',
    quota_limit_source: 'UNKNOWN',
    configured_rpm: null, configured_tpm: null, configured_rpd: null,
    vision_used: false,
    vision_skip_reason: null,
  };

  if (!base) {
    attempt.status = 'NOT_CONFIGURED';
    attempt.fallback_reason = `${ENV.LOCAL_URL} not set`;
    attempt.ended_at = new Date().toISOString();
    attempt.latency_ms = Date.now() - started;
    return attempt;
  }

  const protocol = (opts && opts.protocol) || 'openai-compatible';
  const estIn = estimateTokens(prompt.system + '\n' + prompt.user);

  // Local vision support is unknown until proven. We do NOT fail the local
  // provider merely because it cannot take an image — verified structured
  // evidence is sufficient for safe copy.
  attempt.vision_used = false;
  attempt.vision_skip_reason = 'local vision capability unproven; structured evidence sufficient';

  let url, body;
  if (protocol === 'ollama') {
    url = `${base}/api/chat`;
    body = {
      model: attempt.model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    };
  } else {
    url = `${base}/v1/chat/completions`;
    body = {
      model: attempt.model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    };
  }

  let httpStatus = null;
  try {
    const r = await fetchWithTimeout(url, {
      method: 'POST', headers: localHeaders(), body: JSON.stringify(body),
    }, timeoutMs());
    httpStatus = r.status;
    attempt.http_status = httpStatus;
    attempt.http_status_class = statusClass(httpStatus);

    if (!r.ok) {
      attempt.status = classifyError(null, httpStatus);
      const retry = r.headers.get('retry-after');
      if (retry) attempt.retry_after_seconds = parseInt(retry, 10) || null;
      attempt.fallback_reason = `local HTTP ${httpStatus}`;
      attempt.ended_at = new Date().toISOString();
      attempt.latency_ms = Date.now() - started;
      recordUsage('local_primary', estIn);
      return attempt;
    }

    const j = await r.json();
    const text = protocol === 'ollama'
      ? (j && j.message && j.message.content)
      : (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);

    // Some servers report real token counts; prefer them over the estimate.
    const u = j && (j.usage || {});
    if (u && (u.prompt_tokens != null || u.eval_count != null)) {
      attempt.input_tokens  = u.prompt_tokens ?? j.prompt_eval_count ?? null;
      attempt.output_tokens = u.completion_tokens ?? j.eval_count ?? null;
      const summed = (attempt.input_tokens || 0) + (attempt.output_tokens || 0);
      attempt.total_tokens  = u.total_tokens ?? (summed > 0 ? summed : null);
      if (attempt.input_tokens != null) attempt.token_count_method = 'ACTUAL';
    } else {
      attempt.input_tokens = estIn;
      attempt.output_tokens = estimateTokens(text);
      attempt.total_tokens = attempt.input_tokens + attempt.output_tokens;
    }

    const parsed = extractJson(text);
    if (!parsed) {
      attempt.status = 'PARSE_FAILED';
      attempt.fallback_reason = 'local returned non-parseable structured output';
      attempt.raw_response = { text_preview: String(text || '').slice(0, 2000) };
    } else {
      attempt.status = 'SUCCESS';
      attempt.parsed_response = parsed;
      attempt.raw_response = { usage: u || null };
    }
  } catch (e) {
    attempt.status = classifyError(e, httpStatus);
    attempt.fallback_reason = `local ${attempt.status}`;
    attempt.input_tokens = estIn;
  }

  const bucket = recordUsage('local_primary', attempt.input_tokens || estIn);
  attempt.observed_requests_minute = bucket.reqMinute;
  attempt.observed_input_tokens_minute = bucket.tokMinute;
  attempt.observed_requests_day = bucket.reqDay;
  attempt.ended_at = new Date().toISOString();
  attempt.latency_ms = Date.now() - started;
  return attempt;
}

// ═══════════════════════════════════════════════════════════════════════════
// GEMINI
// ═══════════════════════════════════════════════════════════════════════════

const GEMINI_ALIASES = [
  { alias: 'gemini_key_1', envName: ENV.GEMINI_KEY_1 },
  { alias: 'gemini_key_2', envName: ENV.GEMINI_KEY_2 },
];

function geminiKey(alias) {
  const entry = GEMINI_ALIASES.find((a) => a.alias === alias);
  return entry ? process.env[entry.envName] : null;
}

/**
 * Score a Gemini model for this job. We do NOT hardcode a model name from old
 * project documentation — a prior project in this tree recorded that
 * "gamma 4" resolved to the `gemma-*` family, and that models must be verified
 * against live ListModels rather than inferred. We list what the key can
 * actually see and pick by capability.
 */
function scoreGeminiModel(m) {
  const name = String(m.name || '').replace(/^models\//, '');
  const methods = m.supportedGenerationMethods || [];
  if (!methods.includes('generateContent')) return -1;
  // Exclude non-generative / embedding / TTS / image-out families.
  if (/embedding|aqa|imagen|veo|tts|audio/i.test(name)) return -1;
  // Gemma is not Gemini and generally lacks the structured-output contract.
  if (/^gemma/i.test(name)) return -1;

  let s = 0;
  if (/flash/i.test(name)) s += 30;        // free-tier friendly, fast
  if (/pro/i.test(name)) s += 18;
  if (/lite/i.test(name)) s += 6;
  if (/preview|exp|experimental/i.test(name)) s -= 25; // prefer stable
  if (/latest/i.test(name)) s += 4;
  const ctx = m.inputTokenLimit || 0;
  if (ctx >= 1000000) s += 12; else if (ctx >= 200000) s += 8; else if (ctx >= 30000) s += 4;
  // Prefer a higher generation number when present (3.x > 2.x > 1.x)
  const gen = name.match(/gemini-(\d+)/i);
  if (gen) s += Math.min(parseInt(gen[1], 10), 9) * 2;
  return s;
}

async function discoverGemini(alias) {
  const out = {
    provider: 'gemini',
    provider_alias: alias,
    configured: false,
    reachable: false,
    model: null,
    models_available: [],
    supports_text: true,
    supports_vision: null,
    supports_structured_json: true, // responseSchema is a documented capability
    input_context_limit: null,
    output_token_limit: null,
    context_limit_source: 'UNKNOWN',
    known_rpm: null, known_tpm: null, known_rpd: null,
    // Two keys in ONE project share quota. Until the account confirms the
    // project relationship this stays UNKNOWN and must not be assumed.
    quota_basis: 'UNKNOWN',
    limit_source: 'UNKNOWN',
    error: null,
  };

  const key = geminiKey(alias);
  if (!key) { out.error = `${(GEMINI_ALIASES.find((a) => a.alias === alias) || {}).envName} not set`; return out; }
  out.configured = true;

  try {
    const r = await fetchWithTimeout(
      `${GEMINI_BASE}/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`,
      { headers: { 'Content-Type': 'application/json' } }, 15000);
    if (!r.ok) {
      out.error = `ListModels HTTP ${r.status}`;          // no key echoed
      if (r.status === 429) out.error = 'ListModels rate limited (429)';
      return out;
    }
    const j = await r.json();
    const models = Array.isArray(j && j.models) ? j.models : [];
    out.reachable = true;
    out.models_available = models.map((m) => String(m.name || '').replace(/^models\//, ''));

    const configured = process.env[ENV.GEMINI_MODEL];
    if (configured) {
      const hit = models.find((m) => String(m.name || '').replace(/^models\//, '') === configured);
      if (!hit) {
        out.error = `${ENV.GEMINI_MODEL}="${configured}" not available to this key`;
        return out;
      }
      if (!(hit.supportedGenerationMethods || []).includes('generateContent')) {
        out.error = `${ENV.GEMINI_MODEL}="${configured}" does not support generateContent`;
        return out;
      }
      out.model = configured;
      out.input_context_limit = hit.inputTokenLimit || null;
      out.output_token_limit = hit.outputTokenLimit || null;
      out.context_limit_source = hit.inputTokenLimit ? 'API' : 'UNKNOWN';
      return out;
    }

    let best = null; let bestScore = -1;
    models.forEach((m) => {
      const s = scoreGeminiModel(m);
      if (s > bestScore) { bestScore = s; best = m; }
    });
    if (!best || bestScore < 0) {
      out.error = 'no generateContent-capable Gemini model available to this key';
      return out;
    }
    out.model = String(best.name).replace(/^models\//, '');
    out.input_context_limit = best.inputTokenLimit || null;
    out.output_token_limit = best.outputTokenLimit || null;
    out.context_limit_source = best.inputTokenLimit ? 'API' : 'UNKNOWN';
    out.raw_metadata = {
      displayName: best.displayName, description: best.description,
      supportedGenerationMethods: best.supportedGenerationMethods,
      version: best.version,
    };
    return out;
  } catch (e) {
    out.error = classifyError(e);
    return out;
  }
}

/** Exact prompt token count from the provider. */
async function geminiCountTokens(alias, model, prompt) {
  const key = geminiKey(alias);
  if (!key || !model) return null;
  try {
    const r = await fetchWithTimeout(
      `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:countTokens?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          systemInstruction: { parts: [{ text: prompt.system }] },
        }),
      }, 15000);
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j.totalTokens === 'number' ? j.totalTokens : null;
  } catch { return null; }
}

async function callGemini(alias, prompt, opts) {
  const started = Date.now();
  const model = opts && opts.model;
  const attempt = {
    provider: 'gemini',
    provider_alias: alias,
    model: model || null,
    started_at: new Date(started).toISOString(),
    status: 'ERROR',
    token_count_method: 'ESTIMATED',
    context_input_limit: (opts && opts.inputContextLimit) || null,
    output_token_limit: (opts && opts.outputTokenLimit) || null,
    context_limit_source: (opts && opts.contextLimitSource) || 'UNKNOWN',
    // Never fabricated. Populated only from a 429 payload or human config.
    configured_rpm: (opts && opts.configuredRpm) ?? null,
    configured_tpm: (opts && opts.configuredTpm) ?? null,
    configured_rpd: (opts && opts.configuredRpd) ?? null,
    quota_limit_source: (opts && opts.quotaLimitSource) || 'UNKNOWN',
    vision_used: false,
    vision_skip_reason: null,
  };

  const key = geminiKey(alias);
  if (!key) {
    attempt.status = 'NOT_CONFIGURED';
    attempt.fallback_reason = `${(GEMINI_ALIASES.find((a) => a.alias === alias) || {}).envName} not set`;
    attempt.ended_at = new Date().toISOString();
    attempt.latency_ms = Date.now() - started;
    return attempt;
  }
  if (!model) {
    attempt.status = 'NOT_CONFIGURED';
    attempt.fallback_reason = 'no Gemini model resolved (discovery failed)';
    attempt.ended_at = new Date().toISOString();
    attempt.latency_ms = Date.now() - started;
    return attempt;
  }

  const parts = [{ text: prompt.user }];
  if (opts && opts.imageInlineData) {
    parts.push({ inlineData: opts.imageInlineData });
    attempt.vision_used = true;
  } else {
    attempt.vision_skip_reason = (opts && opts.visionSkipReason) || 'no image supplied';
  }

  const body = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: prompt.system }] },
    generationConfig: {
      temperature: 0.7,
      // Current structured-output mechanism (not the legacy free-text contract)
      responseMimeType: 'application/json',
      responseSchema: opts && opts.schema ? opts.schema : undefined,
      maxOutputTokens: (opts && opts.maxOutputTokens) || 2048,
    },
  };

  let httpStatus = null;
  try {
    const r = await fetchWithTimeout(
      `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      timeoutMs());
    httpStatus = r.status;
    attempt.http_status = httpStatus;
    attempt.http_status_class = statusClass(httpStatus);
    attempt.provider_request_id = r.headers.get('x-request-id') || null;

    const retryHeader = r.headers.get('retry-after');
    if (retryHeader) attempt.retry_after_seconds = parseInt(retryHeader, 10) || null;

    const j = await r.json().catch(() => null);

    if (!r.ok) {
      attempt.status = httpStatus === 429 ? 'RATE_LIMITED' : classifyError(null, httpStatus);
      const errObj = j && j.error;
      if (errObj) {
        attempt.quota_error_type = errObj.status || null;
        attempt.fallback_reason = `gemini ${errObj.status || httpStatus}: ${String(errObj.message || '').slice(0, 300)}`;
        if (errObj.status === 'RESOURCE_EXHAUSTED') attempt.status = 'QUOTA_EXHAUSTED';
        // A 429 payload sometimes carries the REAL limit. That is the only
        // place we ever learn a number — record it, never guess it.
        const details = Array.isArray(errObj.details) ? errObj.details : [];
        const quotaFailure = details.find((d) => String(d['@type'] || '').includes('QuotaFailure'));
        if (quotaFailure) {
          attempt.raw_response = { quotaFailure };
          attempt.quota_limit_source = 'API';
        }
        const retryInfo = details.find((d) => String(d['@type'] || '').includes('RetryInfo'));
        if (retryInfo && retryInfo.retryDelay) {
          const secs = parseInt(String(retryInfo.retryDelay).replace(/[^0-9]/g, ''), 10);
          if (Number.isFinite(secs)) attempt.retry_after_seconds = secs;
        }
      } else {
        attempt.fallback_reason = `gemini HTTP ${httpStatus}`;
      }
      const bkt = recordUsage(alias, 0);
      attempt.observed_requests_minute = bkt.reqMinute;
      attempt.observed_requests_day = bkt.reqDay;
      attempt.ended_at = new Date().toISOString();
      attempt.latency_ms = Date.now() - started;
      return attempt;
    }

    // Safety / block handling
    const cand = j && j.candidates && j.candidates[0];
    const blockReason = (j && j.promptFeedback && j.promptFeedback.blockReason) ||
                        (cand && cand.finishReason === 'SAFETY' ? 'SAFETY' : null);
    if (blockReason) {
      attempt.status = 'SAFETY_BLOCKED';
      attempt.safety_block_reason = String(blockReason);
      attempt.fallback_reason = `gemini safety block: ${blockReason}`;
    }

    const um = (j && j.usageMetadata) || {};
    attempt.input_tokens   = um.promptTokenCount ?? null;
    attempt.output_tokens  = um.candidatesTokenCount ?? null;
    attempt.total_tokens   = um.totalTokenCount ?? null;
    attempt.cached_tokens  = um.cachedContentTokenCount ?? null;
    attempt.thinking_tokens = um.thoughtsTokenCount ?? null;
    if (attempt.input_tokens != null) attempt.token_count_method = 'ACTUAL';

    if (attempt.context_input_limit && attempt.input_tokens) {
      attempt.context_utilization_pct =
        Math.round((attempt.input_tokens / attempt.context_input_limit) * 10000) / 100;
    }

    if (!blockReason) {
      const text = cand && cand.content && cand.content.parts
        ? cand.content.parts.map((p) => p.text || '').join('')
        : '';
      const parsed = extractJson(text);
      if (!parsed) {
        attempt.status = 'PARSE_FAILED';
        attempt.fallback_reason = 'gemini returned non-parseable structured output';
        attempt.raw_response = { text_preview: String(text || '').slice(0, 2000), usageMetadata: um };
      } else {
        attempt.status = 'SUCCESS';
        attempt.parsed_response = parsed;
        attempt.raw_response = { usageMetadata: um, finishReason: cand && cand.finishReason };
      }
    }
  } catch (e) {
    attempt.status = classifyError(e, httpStatus);
    attempt.fallback_reason = `gemini ${attempt.status}`;
  }

  const bkt = recordUsage(alias, attempt.input_tokens || 0);
  attempt.observed_requests_minute = bkt.reqMinute;
  attempt.observed_input_tokens_minute = bkt.tokMinute;
  attempt.observed_requests_day = bkt.reqDay;
  attempt.ended_at = new Date().toISOString();
  attempt.latency_ms = Date.now() - started;
  return attempt;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT BUDGET
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify the request fits. Returns { fits, inputTokens, method, reserved,
 * limit, utilizationPct, omitted:[] }.
 *
 * When the limit is UNKNOWN we do NOT block the call — we record
 * context_limit_source = 'UNKNOWN' and let the provider be the authority.
 * Silently truncating verified product evidence would be worse than a
 * provider-side error.
 */
function checkContextBudget({ inputTokens, method, inputContextLimit, outputReserve }) {
  const reserve = outputReserve || 2048;
  if (!inputContextLimit) {
    return {
      fits: true, inputTokens, method, reserved: reserve,
      limit: null, utilizationPct: null, limitKnown: false, omitted: [],
    };
  }
  const budget = inputContextLimit - reserve;
  return {
    fits: inputTokens <= budget,
    inputTokens, method, reserved: reserve,
    limit: inputContextLimit,
    utilizationPct: Math.round((inputTokens / inputContextLimit) * 10000) / 100,
    limitKnown: true,
    omitted: [],
  };
}

/**
 * Evidence-shedding order, used ONLY when the prompt genuinely does not fit.
 * Least valuable is dropped first; verified specs are never dropped.
 *   keep 1 verified specs → 2 selected terms → 3 current copy
 *        → 4 baseline → 5 image metadata → 6 organic support
 */
const SHED_ORDER = ['organic_terms', 'image_metadata', 'baseline', 'current_description'];

function shedEvidence(evidence) {
  const e = { ...evidence };
  const omitted = [];
  for (const field of SHED_ORDER) {
    if (e[field] !== undefined && e[field] !== null &&
        !(Array.isArray(e[field]) && e[field].length === 0)) {
      e[field] = Array.isArray(e[field]) ? [] : null;
      omitted.push(field);
      break; // shed one layer at a time; caller re-measures
    }
  }
  return { evidence: e, omitted, exhausted: omitted.length === 0 };
}

module.exports = {
  ENV,
  GEMINI_ALIASES,
  DEFAULT_TIMEOUT_MS,
  estimateTokens,
  classifyError,
  statusClass,
  extractJson,
  discoverLocal,
  callLocal,
  discoverGemini,
  geminiCountTokens,
  callGemini,
  checkContextBudget,
  shedEvidence,
  SHED_ORDER,
  recordUsage,
  observedUsage,
  resetUsage,
  bucketFor,
};
