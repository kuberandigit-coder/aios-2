'use strict';

// lib/lens-keywords/gemma.js
//
// REQ-DM-2026-08-SAJE01 — LLM-assisted title + alt-text generation
// (weekly-automation prompt §32-36).
//
// SECURITY
//   The API key is read lazily from process.env inside a function, never
//   assigned to a module-level constant, never logged, never persisted, never
//   returned to the browser — same discipline as config.serpapiKey().
//   Precedence: GOOGLE_API_KEY_GLSK, then GEMINI_API_KEY.
//
// MODEL SELECTION — verified, never invented
//   The requirement names `gemma-4-31b-it` and `gemma-4-26b-a4b-it` as the
//   PREFERRED ids. They are treated as preferences to look for in the live
//   ListModels response, NOT as ids assumed to exist. If neither is present,
//   the best available Gemma model that genuinely supports generateContent is
//   chosen by score. If no Gemma model is available at all, generation falls
//   back to the deterministic script builders. No id is ever sent to the API
//   without first appearing in ListModels for this key.
//
// TRUST MODEL — the model's output is never trusted automatically
//   Every response goes through deterministic validation (JSON shape, char
//   count, brand exclusion, SKU leakage, unsupported facts, duplication,
//   emptiness). One corrective retry is permitted. A second failure falls
//   back to title.js / alt-text.js. Nothing may be padded with a fabricated
//   product fact to reach a character target.
//
// KNOWN LIMITATION (recorded, not hidden)
//   lib/feed/providers.js scoreGeminiModel() deliberately excludes Gemma
//   because "Gemma is not Gemini and generally lacks the structured-output
//   contract" — Gemma has no responseSchema/responseMimeType guarantee. That
//   is exactly why the parse+validate+fallback chain below is mandatory
//   rather than optional.

const { GEMMA_KEY_ENV, gemmaKey, GENERATION_SOURCE } = require('./config');
const titleBuilder = require('./title');
const altTextBuilder = require('./alt-text');
const { tokenize } = require('./keywords');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const PROMPT_VERSION = 'lens-keywords-copy-v1';

// Preferred ids, in order — looked FOR in ListModels, never assumed present.
const PREFERRED_MODELS = Object.freeze(['gemma-4-31b-it', 'gemma-4-26b-a4b-it']);

const MODEL_SOURCE = Object.freeze({
  'gemma-4-31b-it': GENERATION_SOURCE.GEMMA_4_31B,
  'gemma-4-26b-a4b-it': GENERATION_SOURCE.GEMMA_4_26B,
});

/** Which env var actually holds a key, in precedence order. Name only. */
function resolveKeyEnv() {
  for (const name of GEMMA_KEY_ENV) {
    if (gemmaKey(name)) return name;
  }
  return null;
}

async function fetchWithTimeout(url, opts, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, opts, { signal: ctl.signal }));
  } finally {
    clearTimeout(t);
  }
}

/** Rank a Gemma model. Non-Gemma and non-generative models are rejected (-1). */
function scoreGemmaModel(m) {
  const name = String(m.name || '').replace(/^models\//, '');
  const methods = m.supportedGenerationMethods || [];
  if (!methods.includes('generateContent')) return -1;
  if (!/^gemma/i.test(name)) return -1;
  if (/embedding|vision-only|tts|audio/i.test(name)) return -1;

  let s = 0;
  const gen = name.match(/gemma-(\d+)/i);
  if (gen) s += Math.min(parseInt(gen[1], 10), 9) * 10; // newer generation first
  if (/-it\b/i.test(name)) s += 8;                       // instruction-tuned
  if (/preview|exp|experimental/i.test(name)) s -= 15;
  const size = name.match(/-(\d+)b/i);
  if (size) s += Math.min(parseInt(size[1], 10), 40) / 10;
  return s;
}

/**
 * Live model discovery. Returns { available, model, source, models_available,
 * key_env, error } — never the key value itself.
 */
async function discoverModel() {
  const out = {
    available: false, model: null, source: null,
    models_available: [], key_env: null, error: null,
  };
  const keyEnv = resolveKeyEnv();
  if (!keyEnv) {
    out.error = `No generation key configured (looked for ${GEMMA_KEY_ENV.join(', ')}).`;
    return out;
  }
  out.key_env = keyEnv;

  try {
    const r = await fetchWithTimeout(
      `${GEMINI_BASE}/v1beta/models?key=${encodeURIComponent(gemmaKey(keyEnv))}&pageSize=200`,
      { headers: { 'Content-Type': 'application/json' } }, 15000);
    if (!r.ok) { out.error = `ListModels HTTP ${r.status}`; return out; } // never echoes the key
    const j = await r.json();
    const models = Array.isArray(j && j.models) ? j.models : [];
    out.models_available = models
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((n) => /^gemma/i.test(n));

    for (const preferred of PREFERRED_MODELS) {
      const hit = models.find((m) => String(m.name || '').replace(/^models\//, '') === preferred);
      if (hit && (hit.supportedGenerationMethods || []).includes('generateContent')) {
        out.available = true;
        out.model = preferred;
        out.source = MODEL_SOURCE[preferred];
        return out;
      }
    }

    let best = null; let bestScore = -1;
    models.forEach((m) => { const s = scoreGemmaModel(m); if (s > bestScore) { bestScore = s; best = m; } });
    if (best && bestScore >= 0) {
      out.available = true;
      out.model = String(best.name).replace(/^models\//, '');
      // An unlisted-but-valid Gemma model is still a Gemma generation; label it
      // by its closest declared source rather than inventing a new vocabulary.
      out.source = /-4-/.test(out.model) ? GENERATION_SOURCE.GEMMA_4_31B : GENERATION_SOURCE.GEMMA_4_26B;
      return out;
    }
    out.error = 'No generateContent-capable Gemma model is available to this key.';
    return out;
  } catch (e) {
    out.error = e && e.name === 'AbortError' ? 'ListModels timed out' : 'ListModels request failed';
    return out;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt — only VERIFIED evidence is ever sent.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Only MATCHED_FACT and NON_FACTUAL_SEARCH_TERM candidates may reach the
 * model. CONFLICT, UNVERIFIED_FACT and BRAND_EXCLUDED terms are withheld
 * entirely — a model cannot repeat a fact it was never shown.
 */
function safeEvidence(validated) {
  const usable = titleBuilder.usableTerms(validated || []);
  return {
    facts: usable.filter((c) => c.status === 'MATCHED_FACT').map((c) => ({ term: c.term, category: c.category })),
    search_terms: usable.filter((c) => c.status === 'NON_FACTUAL_SEARCH_TERM').map((c) => ({ term: c.term, category: c.category })),
    excluded_brands: (validated || []).filter((c) => c.status === 'BRAND_EXCLUDED').map((c) => c.term),
  };
}

function buildPrompt({ currentTitle, productType, validated, sku, correction }) {
  const ev = safeEvidence(validated);
  const rules = [
    `Write a product title of ${titleBuilder.MIN_LEN}-${titleBuilder.MAX_LEN} characters.`,
    'Use ONLY the supplied verified facts and search terms. Do not add any colour, material, size, wattage, finish or feature that is not listed.',
    'Never include a brand name, a competitor name, the SKU, or any internal code.',
    'Do not repeat the same word twice in the title.',
    'Write alt text that describes the product image using the same verified evidence.',
    'Respond with STRICT JSON only, no markdown fence, matching exactly: {"suggested_title":string,"suggested_alt_text":string,"rationale":string,"keywords_used":string[]}',
    'If the verified evidence is insufficient to reach the character range honestly, return your best honest shorter title. Never invent a fact to reach the length.',
  ];
  const body = {
    current_title: currentTitle || null,
    product_type: productType || null,
    verified_facts: ev.facts,
    verified_search_terms: ev.search_terms,
    forbidden_brand_terms: ev.excluded_brands,
    forbidden_sku: sku || null,
  };
  const text = [
    'You are writing e-commerce copy for a lighting retailer.',
    ...rules.map((r, i) => `${i + 1}. ${r}`),
    '',
    'EVIDENCE:',
    JSON.stringify(body, null, 2),
    correction ? `\nYOUR PREVIOUS ANSWER WAS REJECTED. Fix exactly this and answer again: ${correction}` : '',
  ].join('\n');
  return { text, evidence: ev };
}

function inputHash(promptText) {
  return require('crypto').createHash('sha256').update(promptText).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic validation — the model is never trusted automatically.
// ─────────────────────────────────────────────────────────────────────────────

function parseJson(raw) {
  if (!raw || !String(raw).trim()) return { ok: false, failure: 'EMPTY_OUTPUT' };
  let s = String(raw).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return { ok: false, failure: 'PARSE_FAILED' };
  try {
    return { ok: true, value: JSON.parse(s.slice(start, end + 1)) };
  } catch {
    return { ok: false, failure: 'PARSE_FAILED' };
  }
}

/**
 * Full deterministic validation. Returns { ok, failures[], correction }.
 * `correction` is the single instruction handed back to the model on the one
 * permitted retry.
 */
function validate(candidate, { validated, sku }) {
  const failures = [];
  const t = candidate && typeof candidate.suggested_title === 'string' ? candidate.suggested_title.trim() : '';
  const a = candidate && typeof candidate.suggested_alt_text === 'string' ? candidate.suggested_alt_text.trim() : '';

  if (!t) failures.push('EMPTY_TITLE');
  if (!a) failures.push('EMPTY_ALT_TEXT');

  if (t) {
    if (t.length < titleBuilder.MIN_LEN || t.length > titleBuilder.MAX_LEN) {
      failures.push(`CHARACTER_COUNT_${t.length}`);
    }
    const words = tokenize(t);
    if (new Set(words).size !== words.length) failures.push('DUPLICATE_WORDS');
    if (sku && t.toUpperCase().includes(String(sku).toUpperCase())) failures.push('SKU_LEAKED');
  }

  const forbidden = (validated || [])
    .filter((c) => c.status === 'BRAND_EXCLUDED' || c.status === 'CONFLICT' || c.status === 'UNVERIFIED_FACT')
    .map((c) => String(c.term).toLowerCase());
  const haystack = `${t} ${a}`.toLowerCase();
  const leaked = forbidden.filter((term) => term && haystack.includes(term));
  if (leaked.length) failures.push('UNSUPPORTED_OR_EXCLUDED_TERM');

  const correction = failures.length ? buildCorrection(failures, t) : null;
  return { ok: failures.length === 0, failures, correction };
}

function buildCorrection(failures, title) {
  const f = failures[0];
  if (f.startsWith('CHARACTER_COUNT')) {
    return title.length < titleBuilder.MIN_LEN
      ? `The title was only ${title.length} characters. Use MORE of the supplied verified terms (never invented ones) to reach ${titleBuilder.MIN_LEN}-${titleBuilder.MAX_LEN}.`
      : `The title was ${title.length} characters. Shorten it to ${titleBuilder.MIN_LEN}-${titleBuilder.MAX_LEN} by removing the least important supplied term.`;
  }
  if (f === 'DUPLICATE_WORDS') return 'The title repeated a word. Rewrite it with no repeated word.';
  if (f === 'SKU_LEAKED') return 'The title contained the internal SKU. Remove it entirely.';
  if (f === 'UNSUPPORTED_OR_EXCLUDED_TERM') return 'You used a brand name or an unverified fact. Use ONLY the supplied verified facts and search terms.';
  if (f === 'EMPTY_TITLE' || f === 'EMPTY_ALT_TEXT') return 'Both suggested_title and suggested_alt_text must be non-empty strings.';
  return 'Return strict JSON with the exact required keys.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation
// ─────────────────────────────────────────────────────────────────────────────

async function callModel(model, promptText) {
  const keyEnv = resolveKeyEnv();
  if (!keyEnv) return { ok: false, error: 'NO_KEY' };
  const r = await fetchWithTimeout(
    `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(gemmaKey(keyEnv))}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
    }, 30000);
  if (!r.ok) return { ok: false, error: `HTTP_${r.status}` }; // never echoes the key
  const j = await r.json();
  const text = j && j.candidates && j.candidates[0] && j.candidates[0].content
    && j.candidates[0].content.parts && j.candidates[0].content.parts[0]
    && j.candidates[0].content.parts[0].text;
  return { ok: true, text: text || '' };
}

/** Deterministic fallback — the existing script builders, unchanged. */
function scriptFallback({ currentTitle, currentAltText, productType, validated }, failureReason) {
  const t = titleBuilder.build({ currentTitle, productType, validated });
  const a = altTextBuilder.build({ currentAltText, productType, validated });
  return {
    generation_source: GENERATION_SOURCE.SCRIPT_FALLBACK,
    model_name: null,
    prompt_version: PROMPT_VERSION,
    input_hash: null,
    // TITLE_SAFE_FALLBACK means the model answered but failed validation twice
    // — a materially different story from "no model was reachable at all", so
    // the two are never collapsed into one status.
    validation_status: /^TITLE_SAFE_FALLBACK/.test(failureReason || '') ? 'TITLE_SAFE_FALLBACK' : 'SCRIPT_FALLBACK',
    validation_failures: failureReason ? [failureReason] : [],
    title: t.suggested_title,
    alt_text: a.suggested_alt_text,
    character_count: t.char_count || 0,
    rationale: t.reason || a.reason || 'Generated deterministically from validated evidence.',
    keywords_used: t.keywords_used || [],
    title_status: t.status,
    alt_text_status: a.status,
  };
}

/**
 * Generate a title + alt text for ONE product in a single combined call.
 * At most ONE corrective retry. Always resolves — a provider failure, a parse
 * failure or a second validation failure returns the script fallback rather
 * than throwing, so one product can never stall the weekly run.
 */
async function generateCopy(input, deps) {
  const d = deps || {};
  const discover = d.discoverModel || discoverModel;
  const call = d.callModel || callModel;

  const discovery = await discover();
  if (!discovery.available) {
    return scriptFallback(input, discovery.error || 'NO_GEMMA_MODEL_AVAILABLE');
  }

  let correction = null;
  let lastFailures = [];
  for (let attempt = 0; attempt < 2; attempt++) { // original + ONE corrective retry
    const prompt = buildPrompt(Object.assign({}, input, { correction }));
    let res;
    try {
      res = await call(discovery.model, prompt.text);
    } catch {
      return scriptFallback(input, 'PROVIDER_REQUEST_FAILED');
    }
    if (!res.ok) return scriptFallback(input, res.error || 'PROVIDER_ERROR');

    const parsed = parseJson(res.text);
    if (!parsed.ok) {
      lastFailures = [parsed.failure];
      correction = 'Return strict JSON only, with keys suggested_title, suggested_alt_text, rationale, keywords_used.';
      continue;
    }

    const check = validate(parsed.value, input);
    if (check.ok) {
      return {
        generation_source: discovery.source,
        model_name: discovery.model,
        prompt_version: PROMPT_VERSION,
        input_hash: inputHash(prompt.text),
        validation_status: 'PASSED',
        validation_failures: [],
        title: String(parsed.value.suggested_title).trim(),
        alt_text: String(parsed.value.suggested_alt_text).trim(),
        character_count: String(parsed.value.suggested_title).trim().length,
        rationale: typeof parsed.value.rationale === 'string' ? parsed.value.rationale : null,
        keywords_used: Array.isArray(parsed.value.keywords_used) ? parsed.value.keywords_used.map(String) : [],
        title_status: 'SUGGESTED',
        alt_text_status: 'SUGGESTED',
      };
    }
    lastFailures = check.failures;
    correction = check.correction;
  }

  return scriptFallback(input, `TITLE_SAFE_FALLBACK:${lastFailures.join(',')}`);
}

module.exports = {
  PROMPT_VERSION,
  PREFERRED_MODELS,
  MODEL_SOURCE,
  resolveKeyEnv,
  scoreGemmaModel,
  discoverModel,
  safeEvidence,
  buildPrompt,
  inputHash,
  parseJson,
  validate,
  buildCorrection,
  callModel,
  scriptFallback,
  generateCopy,
};
