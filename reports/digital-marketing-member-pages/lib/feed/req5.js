// lib/feed/req5.js
//
// Thivajini Req5 — Ledsone.fr Feed Optimization.
// Routed from api/members-api.js as ?member=thivajini&type=req5-*
//
// Reads:  Ledsone DB (DATABASE_URL)       — operational truth, read-only.
// Writes: application Neon DB (AUTH_DATABASE_URL) — workflow/history only.
//         NEON_DATABASE_URL is the SEMrush/GEO database and is NOT used here.
//
// EVERY endpoint here requires a verified dm_session. Page guards are not an
// authorization boundary (ARCHITECTURE.md §10 finding 1).

'use strict';

const sql = require('./sql');
const repo = require('./repo');
const promptLib = require('./prompt');
const validate = require('./validate');
const providers = require('./providers');
const { requireSession, actorOf } = require('./session');
const notes = require('./notes');
const columns = require('./columns');
const gate = require('./gate');
const cycleLib = require('./cycle');
const crypto = require('node:crypto');

const GENERATION_WINDOW_DAYS = 30;
const BASELINE_WINDOW_DAYS = 30;

/**
 * REQ5 DATABASE BOUNDARY — Ledsone side.
 *
 * Operational reads use DATABASE_URL and NOTHING ELSE. No fallback to Neon:
 * silently reading product truth from the workflow database would be worse
 * than a clear failure.
 */
function ledsoneClient() {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    const e = new Error(
      'REQ5_LEDSONE_DATABASE_URL_MISSING — Req5 operational reads require DATABASE_URL. ' +
      'It will NOT fall back to the application database.');
    e.code = 'REQ5_LEDSONE_DATABASE_URL_MISSING';
    throw e;
  }
  // Lazy require: keeps the module graph importable (and unit-testable)
  // without node_modules present.
  const { Client } = require('pg');
  return new Client({
    connectionString: cs,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
    statement_timeout: 55000,
  });
}

/**
 * Configuration/setup failures are 503 and are NEVER shown raw to staff.
 * `error` carries the staff message; `detail` carries the technical text for
 * the Diagnostics panel and the server log (§21).
 */
const CONFIG_CODES = [
  'MIGRATION_NOT_APPLIED',
  'REQ5_APP_DATABASE_URL_MISSING',
  'REQ5_LEDSONE_DATABASE_URL_MISSING',
  'REQ5_APP_TARGET_IS_LEDSONE',
];

const SETUP_MESSAGE = 'Feed Optimization setup is unavailable. Please contact the technical team.';

const STAFF_MESSAGE = {
  MIGRATION_NOT_APPLIED: SETUP_MESSAGE,
  REQ5_APP_DATABASE_URL_MISSING: SETUP_MESSAGE,
  REQ5_APP_TARGET_IS_LEDSONE: SETUP_MESSAGE,
  REQ5_LEDSONE_DATABASE_URL_MISSING: SETUP_MESSAGE,
};

/**
 * A PostgreSQL SQLSTATE is five characters of [0-9A-Z] — 42P10, 23503, 42P01.
 * Any error carrying one is a DATABASE fault, and its message is written for a
 * DBA, not for Thivajini. "there is no unique or exclusion constraint matching
 * the ON CONFLICT specification" is 76 characters, so a naive length check let
 * it straight through to the browser. It never should have.
 */
const SQLSTATE_RE = /^[0-9A-Z]{5}$/;

const DB_FAILURE_MESSAGE =
  'Something went wrong saving that. Please try again, or contact the technical team if it keeps happening.';

function staffMessage(code, technical) {
  if (STAFF_MESSAGE[code]) return STAFF_MESSAGE[code];
  if (code && SQLSTATE_RE.test(String(code))) return DB_FAILURE_MESSAGE;
  // Anything unmapped is a genuine runtime failure — keep it, but keep it short.
  return technical && technical.length <= 200
    ? technical
    : 'Something went wrong completing that action. Please try again, or contact the technical team if it keeps happening.';
}

function err(res, e) {
  const technical = (e && e.message) || 'unknown error';
  const code = (e && e.code) || null;
  const status = CONFIG_CODES.includes(code) ? 503 : 500;
  // Technical detail is logged server-side regardless of what staff sees.
  console.error('[req5]', code || 'ERROR', technical);
  return res.status(status).json({
    ok: false,
    code,
    error: staffMessage(code, technical),
    detail: technical,
    setup_issue: CONFIG_CODES.includes(code),
  });
}

function body(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { return {}; } }
  return b;
}

// Freshness + gap vocabulary live in ./notes (dependency-free, unit-tested).
const termsFreshness = notes.termsFreshness;

// ═══════════════════════════ READ ENDPOINTS ═══════════════════════════════

async function handleCandidates(req, res) {
  const client = ledsoneClient();
  try {
    await client.connect();
    const cutoffs = await sql.getSourceCutoffs(client);
    const to = cutoffs.ads_perf || sql.isoDate(new Date());
    const from = sql.addDays(to, -(GENERATION_WINDOW_DAYS - 1));
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);

    let candidates = await sql.getCandidates(client, { from, to, limit });
    candidates = await sql.attachSpecs(client, candidates);
    candidates = await sql.attachStock(client, candidates);
    candidates = await sql.attachShopifyConversions(client, candidates, { from, to });

    const today = sql.isoDate(new Date());
    const freshness = termsFreshness(cutoffs, today);

    // Priority Tier — the workbook formula, verbatim (Daily Requirement §3.2).
    // Its first branch keys on Feed Eligible = "Check". Ours is UNKNOWN, which
    // is NOT "Check" and NOT "Y" — so we expose the tier plus the caveat
    // rather than silently mapping UNKNOWN onto a known branch.
    candidates.forEach((c) => {
      const ctr = c.perf_30d.ctr;
      c.priority_tier = ctr < 0.01 ? 'Tier 1 - High Priority'
                      : ctr < 0.02 ? 'Tier 2 - Medium'
                      : 'Tier 3 - Monitor';
      c.priority_tier_caveat =
        'Feed Gate is Needs Check for France, so the workbook branch "Tier 0 - Fix Feed First" cannot be evaluated.';
      c.batch_status = 'Not started';

      // Staff-facing Feed Gate + data quality. `feed_eligible` is retained as
      // the internal neutral state; the UI reads `feed_gate` only (sections 9 and 10).
      c.feed_gate = gate.fromLegacy(c.feed_eligible);
      c.data_quality = gate.dataQuality(c, { termsStale: freshness.status === 'STALE' });
      c.draft_only = c.feed_gate.blocks_push;
    });

    return res.status(200).json({
      ok: true,
      window: { from, to, days: GENERATION_WINDOW_DAYS },
      source_cutoffs: cutoffs,
      terms_freshness: freshness,
      identity: {
        ads_account_id: String(sql.FR.ADS_ACCOUNT_ID),
        merchant_id: String(sql.FR.MERCHANT_ID),
        shopify_sub_source: sql.FR.SHOPIFY_SUB_SOURCE,
        shopify_site: sql.FR.SHOPIFY_SITE,
        campaigns: sql.FR.CAMPAIGNS.map(String),
      },
      known_gaps: KNOWN_GAPS,
      count: candidates.length,
      products: candidates,
    });
  } catch (e) {
    return err(res, e);
  } finally {
    await client.end().catch(() => {});
  }
}

async function handleProductEvidence(req, res) {
  const itemId = String(req.query.item || '').trim();
  if (!itemId) return res.status(400).json({ ok: false, error: 'item required' });

  const client = ledsoneClient();
  try {
    await client.connect();
    const cutoffs = await sql.getSourceCutoffs(client);
    const to = cutoffs.ads_perf || sql.isoDate(new Date());
    const from = sql.addDays(to, -(GENERATION_WINDOW_DAYS - 1));

    let candidates = await sql.getCandidates(client, { from, to, limit: 500 });
    const product = candidates.find((c) => c.item_id === itemId);
    if (!product) return res.status(404).json({ ok: false, error: 'Item not found in the current window' });

    await sql.attachSpecs(client, [product]);
    await sql.attachStock(client, [product]);
    await sql.attachShopifyConversions(client, [product], { from, to });

    const organic = product.handle
      ? await sql.getOrganicTerms(client, { handle: product.handle, from, to, limit: 25 })
      : [];

    const baseline = await sql.getItemPerformance(client, { itemId, from, to });

    const freshness = termsFreshness(cutoffs, sql.isoDate(new Date()));
    product.feed_gate = gate.fromLegacy(product.feed_eligible);
    product.data_quality = gate.dataQuality(product, { termsStale: freshness.status === 'STALE' });
    product.specs_summary = (product.specs && product.specs.length)
      ? null
      : 'No verified technical specifications available';

    return res.status(200).json({
      ok: true,
      product,
      baseline,
      organic_evidence: organic,
      organic_note: notes.ORGANIC_NOTE,
      source_cutoffs: cutoffs,
      terms_freshness: freshness,
    });
  } catch (e) {
    return err(res, e);
  } finally {
    await client.end().catch(() => {});
  }
}

async function handleSearchTerms(req, res) {
  const client = ledsoneClient();
  try {
    await client.connect();
    const cutoffs = await sql.getSourceCutoffs(client);
    const today = sql.isoDate(new Date());
    const freshness = termsFreshness(cutoffs, today);

    // Default window: 180 days back from the LATEST AVAILABLE term date, not
    // from today. A trailing-30-day window from today returns nothing at all
    // (Addendum B §BC.1: 0 converting terms), which would look like a bug.
    const anchor = freshness.latest || today;
    const days = Math.min(parseInt(req.query.days, 10) || 180, 400);
    const from = req.query.from || sql.addDays(anchor, -(days - 1));
    const to = req.query.to || anchor;
    const minConv = req.query.converting === '0' ? 0 : 0.0001;

    const terms = await sql.getPaidSearchTerms(client, {
      from, to, minConversions: minConv, limit: 400,
    });

    return res.status(200).json({
      ok: true,
      window: { from, to, anchored_on: anchor, anchor_note:
        'Window is anchored on the LATEST AVAILABLE FR search-term date, not on today.' },
      terms_freshness: freshness,
      conflict_note: CONFLICT_NOTE,
      attribution_note: notes.ATTRIBUTION_NOTE,
      count: terms.length,
      terms,
    });
  } catch (e) {
    return err(res, e);
  } finally {
    await client.end().catch(() => {});
  }
}

async function handleHistory(req, res) {
  try {
    const itemId = req.query.item ? String(req.query.item) : null;
    const [generations, selections, snapshots] = await Promise.all([
      repo.listGenerations({ batchId: req.query.batch || null, itemId, limit: 100 }),
      repo.listSelections({ itemId, limit: 200 }),
      repo.listPerfSnapshots({ itemId, limit: 200 }),
    ]);
    const withVariants = [];
    for (const g of generations.slice(0, 40)) {
      withVariants.push({
        ...g,
        variants: await repo.listVariants(g.generation_id),
        attempts: await repo.listAttempts(g.generation_id),
      });
    }
    return res.status(200).json({
      ok: true,
      generations: withVariants,
      selections,
      performance_snapshots: snapshots,
      verdict_note: VERDICT_NOTE,
    });
  } catch (e) {
    return err(res, e);
  }
}

async function handleTelemetry(req, res) {
  try {
    const [status, models, telemetry] = await Promise.all([
      repo.migrationStatus().catch((e) => ({ applied: false, error: e.message })),
      repo.latestProviderModels().catch(() => []),
      repo.providerTelemetry({ sinceHours: 168 }).catch(() => []),
    ]);
    return res.status(200).json({
      ok: true,
      migration: status,
      provider_priority: ['local_primary', 'gemini_key_1', 'gemini_key_2'],
      provider_models: models,
      telemetry,
      observed_usage: {
        local_primary: providers.observedUsage('local_primary'),
        gemini_key_1: providers.observedUsage('gemini_key_1'),
        gemini_key_2: providers.observedUsage('gemini_key_2'),
      },
      usage_note: 'APPLICATION OBSERVED USAGE ONLY — per serverless instance. Does not represent total Google Cloud project usage.',
      quota_note: QUOTA_NOTE,
      db_boundary: {
        operational_reads: { variable: 'DATABASE_URL', present: !!process.env.DATABASE_URL },
        workflow_history: { variable: 'AUTH_DATABASE_URL', present: !!process.env.AUTH_DATABASE_URL },
        note: 'Req5 uses these two variables only. No implicit fallback to FEED_TRACKER_DB_URL or DATABASE_URL. NEON_DATABASE_URL is the SEMrush/GEO database and is not used by Req5.',
      },
      env_present: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        AUTH_DATABASE_URL: !!process.env.AUTH_DATABASE_URL,
        LOCAL_LLM_URL: !!process.env.LOCAL_LLM_URL,
        LOCAL_LLM_API: !!process.env.LOCAL_LLM_API,
        LOCAL_LLM_MODEL: !!process.env.LOCAL_LLM_MODEL,
        GEMINI_API_KEY_1: !!process.env.GEMINI_API_KEY_1,
        GEMINI_API_KEY_2: !!process.env.GEMINI_API_KEY_2,
        GEMINI_MODEL: !!process.env.GEMINI_MODEL,
      },
    });
  } catch (e) {
    return err(res, e);
  }
}

/** Probe providers WITHOUT generating. Safe to call from the UI. */
async function handleProviderStatus(req, res) {
  try {
    const local = await providers.discoverLocal();
    const g1 = await providers.discoverGemini('gemini_key_1');
    const g2 = await providers.discoverGemini('gemini_key_2');
    const strip = (d) => ({ ...d, models_available: (d.models_available || []).slice(0, 25) });
    return res.status(200).json({
      ok: true,
      priority: ['local_primary', 'gemini_key_1', 'gemini_key_2'],
      local: strip(local),
      gemini_key_1: strip(g1),
      gemini_key_2: strip(g2),
      quota_note: QUOTA_NOTE,
    });
  } catch (e) {
    return err(res, e);
  }
}

// ═══════════════════════════ WRITE ENDPOINTS ══════════════════════════════

async function handleCreateBatch(req, res, session) {
  const client = ledsoneClient();
  try {
    await client.connect();
    const cutoffs = await sql.getSourceCutoffs(client);
    const batch = await repo.createBatch({
      createdBy: actorOf(session),
      notes: body(req).notes || null,
      cutoffs,
    });
    return res.status(200).json({ ok: true, batch });
  } catch (e) {
    return err(res, e);
  } finally {
    await client.end().catch(() => {});
  }
}

async function handleSaveTermSelection(req, res, session) {
  const b = body(req);
  if (!b.batch_id) return res.status(400).json({ ok: false, error: 'batch_id required' });
  if (!Array.isArray(b.terms)) return res.status(400).json({ ok: false, error: 'terms[] required' });
  try {
    const saved = await repo.saveTermSelections({
      batchId: b.batch_id,
      itemId: b.item_id || null,
      terms: b.terms.map((t) => ({
        ...t,
        freshness_status: t.freshness_status || 'STALE',
        mapping_level: t.mapping_level || 'CAMPAIGN',
        mapping_confidence: t.mapping_confidence || 'LOW',
        metrics_snapshot: {
          impressions: t.impressions, clicks: t.clicks,
          conversions: t.conversions, conversion_value: t.conversion_value,
          conversion_rate: t.conversion_rate,
          source_tables: t.source_tables, category_label: t.category_label,
        },
      })),
      selectedBy: actorOf(session),
    });
    return res.status(200).json({ ok: true, saved: saved.length, selections: saved });
  } catch (e) {
    return err(res, e);
  }
}


/**
 * THE GENERATION CORE — steps 3 and 5-8 for ONE product.
 *
 * Extracted so the manual endpoint and the one-button Optimization Cycle run
 * byte-identical logic. Anything that changes here changes for both; they can
 * never drift apart.
 *
 * The caller owns the Ledsone client and the evidence gathering, because the
 * cycle already has both in hand by the time it gets here.
 */
async function generateForProduct(opts) {
  const {
    client, product, candidates, cutoffs, from, to, freshness,
    batchId, itemId, actor, includeOrganic,
  } = opts;

  const organic = (includeOrganic && product.handle)
    ? await sql.getOrganicTerms(client, { handle: product.handle, from, to, limit: 15 })
    : [];

  const selectedTerms = await repo.getTermSelections({ batchId, itemId });
  const baseline = await sql.getItemPerformance(client, { itemId, from, to });

  const evidence = {
    item_id: product.item_id,
    sku: product.sku,
    brand: product.brand,
    price_eur: product.price_eur,
    product_type: product.product_type,
    google_product_category: product.google_product_category,
    current_title: product.current_title,
    current_description: product.current_description,
    specs: product.specs,
    stock_status: product.stock.status,
    feed_eligible_status: product.feed_eligible.status,
    selected_terms: selectedTerms.map((t) => ({
      search_term: t.search_term,
      category_label: t.category_label,
      impressions: t.metrics_snapshot && t.metrics_snapshot.impressions,
      clicks: t.metrics_snapshot && t.metrics_snapshot.clicks,
      conversions: t.metrics_snapshot && t.metrics_snapshot.conversions,
      conversion_value: t.metrics_snapshot && t.metrics_snapshot.conversion_value,
      source_min_date: t.source_min_date ? String(t.source_min_date).slice(0, 10) : null,
      source_max_date: t.source_max_date ? String(t.source_max_date).slice(0, 10) : null,
      mapping_level: t.mapping_level,
    })),
    terms_are_stale: freshness.status === 'STALE',
    terms_freshness_note: freshness.note,
    organic_terms: organic,
    baseline: { ...baseline, period_start: from, period_end: to },
    image_metadata: product.image_link ? { url: product.image_link } : null,
  };

  const conf = validate.evidenceConfidence(evidence);
  const prompt = promptLib.buildPrompt(evidence);
  const iterationNo = await repo.nextIteration(itemId);

  const generation = await repo.createGeneration({
    batchId, itemId,
    shopifyProductId: product.shopify_product_id,
    shopifyVariantId: product.shopify_variant_id,
    sku: product.sku,
    iterationNo,
    inputSnapshot: evidence,
    missingEvidence: product.missing_evidence,
    selectedTermsSnapshot: evidence.selected_terms,
    organicSupportSnapshot: organic.length ? organic : null,
    feedEligibleStatus: product.feed_eligible.status,
    feedEligibleSource: product.feed_eligible.source,
    promptVersion: prompt.promptVersion,
    promptHash: prompt.promptHash,
    templateVersion: prompt.templateVersion,
    generationStatus: 'RUNNING',
    evidenceConfidence: conf.level,
    evidenceConfidenceReasons: conf.reasons,
    isDraftOnly: gate.fromLegacy(product.feed_eligible).blocks_push,
    createdBy: actor,
  });

  const ctx = {
    specs: product.specs,
    selectedTerms: evidence.selected_terms,
    otherSkus: candidates.filter((c) => c.item_id !== itemId).map((c) => c.sku).filter(Boolean).slice(0, 300),
  };

  const chain = await runProviderChain({
    prompt, evidence, ctx, generationId: generation.generation_id,
  });

  const savedVariants = [];
  if (chain.winner) {
    const parsed = chain.winner.attempt.parsed_response;
    const vr = chain.winner.validation;
    for (const label of ['A', 'B']) {
      const src = label === 'A' ? parsed.variant_a : parsed.variant_b;
      const vres = label === 'A' ? vr.variantA : vr.variantB;
      savedVariants.push(await repo.saveVariant({
        generationId: generation.generation_id,
        attemptId: chain.winner.attemptRow.attempt_id,
        label,
        title: src.title,
        titleCharCount: vres.title_char_count,
        description: src.description,
        suggestedGpc: parsed.suggested_google_product_category || null,
        convertingTermsUsed: src.converting_terms_used || [],
        uncertainClaims: parsed.uncertain_or_unsupported_claims || [],
        validationStatus: vres.status,
        validationDetails: vres,
      }));
    }
    await repo.finishGeneration({
      generationId: generation.generation_id,
      status: 'SUCCESS',
      selectedAttemptId: chain.winner.attemptRow.attempt_id,
    });
  } else {
    await repo.finishGeneration({
      generationId: generation.generation_id,
      status: chain.terminalStatus || 'FAILED',
    });
  }

  // STEP 3 - immutable baseline, so monitoring has something to compare to.
  await repo.savePerfSnapshot({
    generationId: generation.generation_id,
    itemId, iterationNo,
    snapshotType: 'BASELINE',
    periodStart: from, periodEnd: to,
    impressions: baseline.impressions, clicks: baseline.clicks, ctr: baseline.ctr,
    gadsConversions: baseline.conversions, conversionValue: baseline.conversion_value,
    conversionRate: baseline.conversion_rate,
    shopifyOrders: product.shopify_conversions && product.shopify_conversions.orders,
    shopifyLines: product.shopify_conversions && product.shopify_conversions.lines,
    shopifyUnits: product.shopify_conversions && product.shopify_conversions.units,
    shopifyGrainNote: product.shopify_conversions && product.shopify_conversions.grain_note,
    sourceMaxDate: baseline.source_max_date,
    sourceRefs: { source_cutoffs: cutoffs, campaigns: sql.FR.CAMPAIGNS.map(String) },
  });

  const attempts = chain.attempts || [];
  return {
    generationId: generation.generation_id,
    iterationNo,
    winner: chain.winner || null,
    winnerAlias: chain.winner ? chain.winner.attemptRow.provider_alias : null,
    winnerModel: chain.winner ? chain.winner.attemptRow.model : null,
    terminalStatus: chain.terminalStatus || null,
    variants: savedVariants,
    validation: chain.winner ? chain.winner.validation : chain.lastValidation,
    evidenceConfidence: conf,
    prompt: { version: prompt.promptVersion, hash: prompt.promptHash, template: prompt.templateVersion },
    attempts,
    attemptSummary: attempts.map((a) => a.provider_alias + ':' + a.status),
    llmCalls: attempts.length,
    geminiCalls: attempts.filter((a) => String(a.provider_alias || '').startsWith('gemini')).length,
    reason: chain.winner ? null : (chain.lastValidation && chain.lastValidation.summary) || null,
  };
}

/**
 * The generation endpoint. ONE logical request per product.
 * Providers are tried in priority order and a later provider is only reached
 * when the previous one FAILED.
 */
async function handleGenerate(req, res, session) {
  const b = body(req);
  const itemId = String(b.item_id || '').trim();
  const batchId = b.batch_id;
  if (!itemId) return res.status(400).json({ ok: false, error: 'item_id required' });
  if (!batchId) return res.status(400).json({ ok: false, error: 'batch_id required' });

  const client = ledsoneClient();
  try {
    await client.connect();

    const cutoffs = await sql.getSourceCutoffs(client);
    const to = cutoffs.ads_perf || sql.isoDate(new Date());
    const from = sql.addDays(to, -(GENERATION_WINDOW_DAYS - 1));

    const candidates = await sql.getCandidates(client, { from, to, limit: 500 });
    const product = candidates.find((c) => c.item_id === itemId);
    if (!product) return res.status(404).json({ ok: false, error: 'Item not found in the current window' });

    await sql.attachSpecs(client, [product]);
    await sql.attachStock(client, [product]);
    await sql.attachShopifyConversions(client, [product], { from, to });

    const freshness = termsFreshness(cutoffs, sql.isoDate(new Date()));

    // Same core the Optimization Cycle runs. One implementation, so a manual
    // run and a cycle run can never diverge.
    const gen = await generateForProduct({
      client, product, candidates, cutoffs, from, to, freshness,
      batchId, itemId, actor: actorOf(session),
      includeOrganic: !!b.include_organic,
    });

    const feedGate = gate.fromLegacy(product.feed_eligible);
    return res.status(200).json({
      ok: true,
      generation_id: gen.generationId,
      iteration_no: gen.iterationNo,
      status: gen.winner ? 'SUCCESS' : (gen.terminalStatus || 'FAILED'),
      feed_gate: feedGate,
      draft_only: feedGate.blocks_push,
      draft_only_reason: feedGate.blocks_push
        ? 'Feed Gate is Check Required — draft only. Production upload is blocked.' : null,
      evidence_confidence: gen.evidenceConfidence,
      prompt: gen.prompt,
      attempts: gen.attempts,
      variants: gen.variants,
      validation: gen.validation,
      terms_freshness: freshness,
      attribution_note: notes.ATTRIBUTION_NOTE,
      known_gaps: KNOWN_GAPS,
    });
  } catch (e) {
    return err(res, e);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Local → Gemini 1 → Gemini 2, stopping at the first VALID response.
 * Every attempt is persisted, including failures.
 */
async function runProviderChain({ prompt, evidence, ctx, generationId }) {
  const attempts = [];
  let seq = 0;
  let lastValidation = null;
  let quotaExhaustedCount = 0;

  const plan = [
    { kind: 'local', alias: 'local_primary' },
    { kind: 'gemini', alias: 'gemini_key_1' },
    { kind: 'gemini', alias: 'gemini_key_2' },
  ];

  for (const step of plan) {
    seq += 1;
    let attempt;

    if (step.kind === 'local') {
      const disc = await providers.discoverLocal();
      if (!disc.configured || !disc.reachable) {
        attempt = {
          provider: 'local', provider_alias: 'local_primary',
          status: disc.configured ? 'CONNECTION_FAILED' : 'NOT_CONFIGURED',
          fallback_reason: disc.error || 'local provider unavailable',
          started_at: new Date().toISOString(), ended_at: new Date().toISOString(),
          latency_ms: 0, quota_limit_source: 'UNKNOWN',
        };
      } else {
        const est = providers.estimateTokens(prompt.system + '\n' + prompt.user);
        const budget = providers.checkContextBudget({
          inputTokens: est, method: 'ESTIMATED',
          inputContextLimit: disc.input_context_limit, outputReserve: 2048,
        });
        if (budget.limitKnown && !budget.fits) {
          attempt = {
            provider: 'local', provider_alias: 'local_primary', model: disc.model,
            status: 'CONTEXT_EXCEEDED',
            fallback_reason: `prompt ${est} tokens exceeds local budget ${budget.limit - budget.reserved}`,
            input_tokens: est, token_count_method: 'ESTIMATED',
            context_input_limit: budget.limit, context_limit_source: disc.context_limit_source,
            started_at: new Date().toISOString(), ended_at: new Date().toISOString(), latency_ms: 0,
          };
        } else {
          attempt = await providers.callLocal(prompt, {
            model: disc.model, protocol: disc.protocol,
            contextLimitSource: disc.context_limit_source,
          });
          attempt.context_input_limit = disc.input_context_limit || null;
          attempt.context_utilization_pct = budget.utilizationPct;
        }
      }
    } else {
      const disc = await providers.discoverGemini(step.alias);
      if (!disc.configured || !disc.reachable || !disc.model) {
        attempt = {
          provider: 'gemini', provider_alias: step.alias,
          status: disc.configured ? 'CONNECTION_FAILED' : 'NOT_CONFIGURED',
          fallback_reason: disc.error || 'gemini provider unavailable',
          started_at: new Date().toISOString(), ended_at: new Date().toISOString(),
          latency_ms: 0, quota_limit_source: 'UNKNOWN',
        };
      } else {
        // Prefer the provider's exact count; fall back to an estimate.
        let inputTokens = await providers.geminiCountTokens(step.alias, disc.model, prompt);
        let method = 'ACTUAL';
        if (inputTokens == null) {
          inputTokens = providers.estimateTokens(prompt.system + '\n' + prompt.user);
          method = 'ESTIMATED';
        }
        const budget = providers.checkContextBudget({
          inputTokens, method,
          inputContextLimit: disc.input_context_limit, outputReserve: 2048,
        });
        if (budget.limitKnown && !budget.fits) {
          attempt = {
            provider: 'gemini', provider_alias: step.alias, model: disc.model,
            status: 'CONTEXT_EXCEEDED',
            fallback_reason: `prompt ${inputTokens} tokens exceeds budget ${budget.limit - budget.reserved}`,
            input_tokens: inputTokens, token_count_method: method,
            context_input_limit: budget.limit, context_limit_source: disc.context_limit_source,
            started_at: new Date().toISOString(), ended_at: new Date().toISOString(), latency_ms: 0,
          };
        } else {
          attempt = await providers.callGemini(step.alias, prompt, {
            model: disc.model,
            schema: prompt.schema,
            inputContextLimit: disc.input_context_limit,
            outputTokenLimit: disc.output_token_limit,
            contextLimitSource: disc.context_limit_source,
            maxOutputTokens: 2048,
            visionSkipReason: 'image URL supplied as evidence metadata; inline image fetch not enabled in this deliverable',
          });
        }
      }
    }

    // ---- validate --------------------------------------------------------
    let validation = null;
    if (attempt.status === 'SUCCESS' && attempt.parsed_response) {
      validation = validate.validateResponse(attempt.parsed_response, ctx);
      attempt.validation_result = validation;
      attempt.response_evidence_confidence = validate.evidenceConfidence(evidence).level;
      if (validation.status !== 'PASS') {
        attempt.status = 'VALIDATION_FAILED';
        attempt.fallback_reason = 'output validation failed: ' +
          [...validation.errors,
           ...(validation.variantA ? validation.variantA.errors : []),
           ...(validation.variantB ? validation.variantB.errors : [])].slice(0, 5).join(' | ');
      }
      lastValidation = validation;
    }

    const attemptRow = await repo.recordAttempt(generationId, seq, attempt);
    attempts.push({
      seq, provider: attempt.provider, provider_alias: attempt.provider_alias,
      model: attempt.model || null, status: attempt.status,
      fallback_reason: attempt.fallback_reason || null,
      latency_ms: attempt.latency_ms || null,
      input_tokens: attempt.input_tokens ?? null,
      output_tokens: attempt.output_tokens ?? null,
      token_count_method: attempt.token_count_method || null,
      context_input_limit: attempt.context_input_limit ?? null,
      context_utilization_pct: attempt.context_utilization_pct ?? null,
      context_limit_source: attempt.context_limit_source || 'UNKNOWN',
      quota_limit_source: attempt.quota_limit_source || 'UNKNOWN',
      retry_after_seconds: attempt.retry_after_seconds ?? null,
      vision_used: attempt.vision_used === true,
      validation: validation ? { status: validation.status } : null,
    });

    if (attempt.status === 'SUCCESS' && validation && validation.status === 'PASS') {
      // STOP. Never call a later provider merely to compare prose — that
      // would spend free-tier quota for no business gain.
      return { winner: { attempt, attemptRow, validation }, attempts, lastValidation };
    }

    if (attempt.status === 'QUOTA_EXHAUSTED' || attempt.status === 'RATE_LIMITED') {
      quotaExhaustedCount += 1;
      // Gemini quota is commonly PROJECT-level: two keys in one project share
      // it. After both Gemini aliases report exhaustion we return a retryable
      // state rather than hammering the provider.
      if (step.alias === 'gemini_key_2' || quotaExhaustedCount >= 2) {
        return { winner: null, attempts, lastValidation, terminalStatus: 'QUOTA_EXHAUSTED' };
      }
    }
  }

  return { winner: null, attempts, lastValidation, terminalStatus: 'FAILED' };
}

async function handleSelectVariant(req, res, session) {
  const b = body(req);
  if (!b.generation_id || !b.item_id) {
    return res.status(400).json({ ok: false, error: 'generation_id and item_id required' });
  }
  try {
    const variants = await repo.listVariants(b.generation_id);
    const chosen = variants.find((v) => v.variant_label === b.variant_label);
    if (b.variant_label && !chosen) {
      return res.status(400).json({ ok: false, error: 'variant_label not found for this generation' });
    }
    const gens = await repo.listGenerations({ itemId: b.item_id, limit: 1 });
    const iterationNo = b.iteration_no || (gens[0] ? gens[0].iteration_no : 1);

    // Push stays blocked. UNKNOWN eligibility is never reinterpreted as Y.
    const eligibility = gens[0] ? gens[0].feed_eligible_status : 'UNKNOWN';
    const pushState = 'NOT_READY';
    const pushBlocked = eligibility !== 'Y'
      ? notes.PUSH_BLOCKED_UNVERIFIED
      : notes.PUSH_BLOCKED_NO_TARGET;

    const selection = await repo.addSelection({
      generationId: b.generation_id,
      itemId: b.item_id,
      iterationNo,
      selectedVariantId: chosen ? chosen.variant_id : null,
      selectedVariantLabel: b.variant_label || null,
      changeMade: b.change_made || (b.variant_label ? `Selected variant ${b.variant_label}` : null),
      reason: b.reason || null,
      resultSummary: b.result_summary || 'Pending — test window not started',
      reviewer: b.reviewer || actorOf(session),
      reviewStatus: b.review_status || 'PENDING',
      nextAction: b.next_action || null,
      pushState,
      pushBlockedReason: pushBlocked,
      testStartDate: b.test_start_date || null,
      selectedBy: actorOf(session),
    });
    return res.status(200).json({ ok: true, selection, push_blocked_reason: pushBlocked });
  } catch (e) {
    return err(res, e);
  }
}

async function handleCapturePerformance(req, res, session) {
  const b = body(req);
  const itemId = String(b.item_id || '').trim();
  if (!itemId) return res.status(400).json({ ok: false, error: 'item_id required' });
  if (!b.period_start || !b.period_end) {
    return res.status(400).json({ ok: false, error: 'period_start and period_end required' });
  }
  const client = ledsoneClient();
  try {
    await client.connect();
    const perf = await sql.getItemPerformance(client, {
      itemId, from: b.period_start, to: b.period_end,
    });
    const shop = await sql.getItemShopifyConversions(client, {
      variantId: b.shopify_variant_id || null,
      productId: b.shopify_product_id || null,
      from: b.period_start, to: b.period_end,
    });
    const snap = await repo.savePerfSnapshot({
      generationId: b.generation_id || null,
      selectionId: b.selection_id || null,
      itemId,
      iterationNo: b.iteration_no || null,
      snapshotType: b.snapshot_type === 'BASELINE' ? 'BASELINE' : 'POST_CHANGE',
      periodStart: b.period_start, periodEnd: b.period_end,
      impressions: perf.impressions, clicks: perf.clicks, ctr: perf.ctr,
      gadsConversions: perf.conversions, conversionValue: perf.conversion_value,
      conversionRate: perf.conversion_rate,
      shopifyOrders: shop.orders, shopifyLines: shop.lines, shopifyUnits: shop.units,
      shopifyGrainNote: 'orders/lines/units all stored; business definition not chosen',
      sourceMaxDate: perf.source_max_date,
      sourceRefs: { captured_by: actorOf(session) },
    });
    return res.status(200).json({ ok: true, snapshot: snap, verdict_note: VERDICT_NOTE });
  } catch (e) {
    return err(res, e);
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── gap vocabulary surfaced to the UI (single source: ./notes) ─────────────
const KNOWN_GAPS   = notes.KNOWN_GAPS;
const CONFLICT_NOTE = notes.CONFLICT_NOTE;
const VERDICT_NOTE  = notes.VERDICT_NOTE;
const QUOTA_NOTE    = notes.QUOTA_NOTE;

// ═══════════════ EXPORT / MONITORING / PUSH-PREVIEW ═══════════════════════

/** Column catalogue for the CSV modal. Getter functions are never exposed. */
async function handleExportColumns(req, res) {
  return res.status(200).json({ ok: true, ...columns.catalogue() });
}

function todayIso() { return new Date().toISOString().slice(0, 10); }
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function dayOf(v) {
  if (!v) return null;
  return typeof v === 'string' ? v.slice(0, 10) : new Date(v).toISOString().slice(0, 10);
}

/**
 * Build a CSV for the operator-SELECTED products/variants only, and record
 * both the export event and a monitoring plan.
 *
 * Column keys are validated against the server-side whitelist, so a tampered
 * request cannot widen the export beyond what the operator was offered.
 */
async function handleExport(req, res, session) {
  const b = body(req);
  const selections = Array.isArray(b.selections) ? b.selections : [];
  if (!selections.length) {
    return res.status(400).json({ ok: false, error: 'selections[] required (one entry per product to export)' });
  }

  const col = columns.resolveColumns(b.columns);
  if (!col.ok) return res.status(400).json({ ok: false, error: col.error, rejected_columns: col.rejected });

  // DEFERRED is the normal path: downloading a file changes nothing anywhere,
  // so no baseline is captured and no monitoring plan is created. Monitoring
  // starts later, by an explicit human action carrying the real go-live date.
  const MODES = ['TODAY', 'CUSTOM', 'DEFERRED'];
  const mode = MODES.indexOf(b.monitoring_start_mode) >= 0 ? b.monitoring_start_mode : 'DEFERRED';
  const today = todayIso();
  const deferred = mode === 'DEFERRED';
  const monitoringStart = deferred ? null
    : (mode === 'CUSTOM' ? String(b.monitoring_start_date || '') : today);
  if (!deferred && !DATE_RE.test(monitoringStart)) {
    return res.status(400).json({ ok: false, error: 'monitoring_start_date must be YYYY-MM-DD when monitoring_start_mode is CUSTOM' });
  }
  const isFuture = !deferred && monitoringStart > today;

  const client = ledsoneClient();
  try {
    await client.connect();

    const rows = [];
    const generationIds = [];
    const itemIds = [];
    const variantIds = [];
    const baselineSnapshotIds = [];
    const plansToCreate = [];

    for (const sel of selections) {
      const gen = (await repo.listGenerations({ itemId: sel.item_id, limit: 50 }))
        .find((g) => g.generation_id === sel.generation_id);
      if (!gen) continue;

      const vars = await repo.listVariants(gen.generation_id);
      const variant = vars.find((v) => v.variant_label === sel.variant_label) || vars[0];
      if (!variant) continue;

      const attempts = await repo.listAttempts(gen.generation_id);
      const winner = attempts.find((a) => a.attempt_id === gen.selected_attempt_id)
        || attempts[attempts.length - 1] || null;

      const snap = gen.input_snapshot || {};
      const product = {
        item_id: gen.item_id,
        shopify_product_id: gen.shopify_product_id,
        shopify_variant_id: gen.shopify_variant_id,
        sku: gen.sku,
        product_type: snap.product_type,
        current_title: snap.current_title,
        current_description: snap.current_description,
        google_product_category: snap.google_product_category,
        image_link: snap.image_metadata && snap.image_metadata.url,
        price_eur: snap.price_eur,
        shopify_conversions: snap.shopify_conversions || null,
      };

      // BASELINE = the 30 days ending immediately BEFORE monitoring starts.
      // For a future start date we do NOT fabricate a baseline.
      let baseline = null;
      let baselineStart = null;
      let baselineEnd = null;
      let baselineSnapshotId = null;
      if (!isFuture && !deferred) {
        baselineEnd = sql.addDays(monitoringStart, -1);
        baselineStart = sql.addDays(baselineEnd, -(BASELINE_WINDOW_DAYS - 1));
        baseline = await sql.getItemPerformance(client, {
          itemId: gen.item_id, from: baselineStart, to: baselineEnd,
        });
        const shop = await sql.getItemShopifyConversions(client, {
          variantId: gen.shopify_variant_id, productId: gen.shopify_product_id,
          from: baselineStart, to: baselineEnd,
        });
        const saved = await repo.savePerfSnapshot({
          generationId: gen.generation_id, itemId: gen.item_id,
          iterationNo: gen.iteration_no, snapshotType: 'BASELINE',
          periodStart: baselineStart, periodEnd: baselineEnd,
          impressions: baseline.impressions, clicks: baseline.clicks, ctr: baseline.ctr,
          gadsConversions: baseline.conversions, conversionValue: baseline.conversion_value,
          conversionRate: baseline.conversion_rate,
          shopifyOrders: shop.orders, shopifyLines: shop.lines, shopifyUnits: shop.units,
          shopifyGrainNote: 'orders/lines/units all stored; business definition not chosen',
          sourceMaxDate: baseline.source_max_date,
          sourceRefs: { captured_for: 'EXPORT_BASELINE', monitoring_start: monitoringStart },
        });
        baselineSnapshotId = saved.snapshot_id;
        baselineSnapshotIds.push(saved.snapshot_id);
      }

      rows.push({
        product, generation: gen, variant, attempt: winner,
        baseline: baseline ? Object.assign({}, baseline, { gads_conversions: baseline.conversions }) : null,
        selection: sel.selection || null,
        monitoringStartDate: monitoringStart,
        searchTermLatest: (snap.terms_freshness_note || '').replace(/^.*is /, '').split(' ')[0] || null,
      });
      generationIds.push(gen.generation_id);
      itemIds.push(gen.item_id);
      variantIds.push(variant.variant_id);
      plansToCreate.push({ gen, variant, baselineStart, baselineEnd, baselineSnapshotId });
    }

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'No matching generations found for the selected products' });
    }

    const csv = columns.buildCsv(col.columns, rows);
    const sha = crypto.createHash('sha256').update(csv, 'utf8').digest('hex');

    // A DOWNLOAD IS NOT A GO-LIVE.
    const changeStatus = deferred ? 'DOWNLOADED_NOT_LIVE'
      : isFuture ? 'SCHEDULED' : 'AWAITING_MANUAL_GO_LIVE';

    const exportRow = await repo.createExport({
      batchId: b.batch_id || null,
      cycleId: b.cycle_id || null,
      generationIds, itemIds, variantIds,
      selectedColumns: col.columns,
      rowCount: rows.length,
      contentSha256: sha,
      monitoringStartDate: monitoringStart,
      monitoringStartMode: mode,
      changeMethod: 'CSV_DOWNLOAD',
      changeStatus,
      baselineSnapshotIds,
      notes: b.notes || null,
      generatedBy: actorOf(session),
    });

    // No monitoring plan for a deferred download. Nothing is live yet.
    const plans = [];
    for (const p of (deferred ? [] : plansToCreate)) {
      plans.push(await repo.createMonitoring({
        exportId: exportRow.export_id,
        generationId: p.gen.generation_id,
        itemId: p.gen.item_id,
        selectedVariantId: p.variant.variant_id,
        selectedVariantLabel: p.variant.variant_label,
        changeMethod: 'CSV_DOWNLOAD',
        intendedGoLiveDate: monitoringStart,
        monitoringStartDate: monitoringStart,
        baselinePeriodStart: p.baselineStart,
        baselinePeriodEnd: p.baselineEnd,
        minimumTestDays: 14,
        status: changeStatus === 'SCHEDULED' ? 'SCHEDULED' : 'AWAITING_MANUAL_GO_LIVE',
        baselineSnapshotId: p.baselineSnapshotId,
        monitoringStartReason: b.monitoring_reason || null,
        createdBy: actorOf(session),
      }));
    }

    return res.status(200).json({
      ok: true,
      csv,
      filename: 'thivajini-feed-optimization-' + today + '.csv',
      export: exportRow,
      monitoring_plans: plans,
      columns: col.columns,
      rejected_columns: col.rejected,
      row_count: rows.length,
      content_sha256: sha,
      monitoring_started: !deferred,
      baseline_note: deferred
        ? 'No baseline was captured. Monitoring has not started, so there is nothing yet to measure from.'
        : isFuture
          ? 'Monitoring start is in the future — status SCHEDULED. No baseline was fabricated; it is captured when the window opens.'
          : 'Baseline captured for the 30 days ending ' + sql.addDays(monitoringStart, -1) + ' (immediately before monitoring starts).',
      go_live_note: 'Downloading a CSV does NOT change the feed. Upload it to Merchant Center, then press Start Monitoring so measurement runs from the real go-live date.',
      minimum_verdict_note: 'Minimum meaningful verdict: 14 days after monitoring starts.',
    });
  } catch (e) {
    return err(res, e);
  } finally {
    await client.end().catch(() => {});
  }
}


/**
 * START MONITORING — the explicit human step after a manual upload.
 *
 * This is deliberately NOT a side effect of downloading a file. Monitoring
 * only begins when a person confirms the change actually went live, and says
 * on which date, because the baseline window is defined relative to that date.
 */
async function handleMonitoringStart(req, res, session) {
  const b = body(req);
  const selections = Array.isArray(b.selections) ? b.selections : [];
  if (!selections.length) {
    return res.status(400).json({ ok: false, error: 'selections[] required' });
  }
  const goLive = String(b.actual_go_live_date || '').slice(0, 10);
  if (!DATE_RE.test(goLive)) {
    return res.status(400).json({ ok: false, error: 'actual_go_live_date must be YYYY-MM-DD' });
  }
  const today = todayIso();
  if (goLive > today) {
    return res.status(400).json({
      ok: false,
      error: 'The go-live date cannot be in the future. Start monitoring once the change is actually live.',
    });
  }

  const actor = actorOf(session);
  const client = ledsoneClient();
  try {
    await client.connect();

    // BASELINE = the 30 days ending immediately BEFORE the real go-live date.
    const baselineEnd = sql.addDays(goLive, -1);
    const baselineStart = sql.addDays(baselineEnd, -(BASELINE_WINDOW_DAYS - 1));

    const started = [];
    for (const sel of selections) {
      const gen = (await repo.listGenerations({ itemId: sel.item_id, limit: 50 }))
        .find((g) => g.generation_id === sel.generation_id);
      if (!gen) continue;
      const vars = await repo.listVariants(gen.generation_id);
      const variant = vars.find((v) => v.variant_label === sel.variant_label) || vars[0];
      if (!variant) continue;

      const perf = await sql.getItemPerformance(client, {
        itemId: gen.item_id, from: baselineStart, to: baselineEnd,
      });
      const shop = await sql.getItemShopifyConversions(client, {
        variantId: gen.shopify_variant_id, productId: gen.shopify_product_id,
        from: baselineStart, to: baselineEnd,
      });
      const snap = await repo.savePerfSnapshot({
        generationId: gen.generation_id, itemId: gen.item_id,
        iterationNo: gen.iteration_no, snapshotType: 'BASELINE',
        periodStart: baselineStart, periodEnd: baselineEnd,
        impressions: perf.impressions, clicks: perf.clicks, ctr: perf.ctr,
        gadsConversions: perf.conversions, conversionValue: perf.conversion_value,
        conversionRate: perf.conversion_rate,
        shopifyOrders: shop.orders, shopifyLines: shop.lines, shopifyUnits: shop.units,
        shopifyGrainNote: 'orders/lines/units all stored; business definition not chosen',
        sourceMaxDate: perf.source_max_date,
        sourceRefs: { captured_for: 'MONITORING_START', go_live: goLive },
      });

      const plan = await repo.createMonitoring({
        exportId: b.export_id || null,
        generationId: gen.generation_id,
        itemId: gen.item_id,
        selectedVariantId: variant.variant_id,
        selectedVariantLabel: variant.variant_label,
        changeMethod: 'CSV_DOWNLOAD',
        intendedGoLiveDate: goLive,
        monitoringStartDate: goLive,
        baselinePeriodStart: baselineStart,
        baselinePeriodEnd: baselineEnd,
        minimumTestDays: 14,
        status: 'AWAITING_MANUAL_GO_LIVE',
        baselineSnapshotId: snap.snapshot_id,
        monitoringStartReason: b.reason || 'Confirmed uploaded and live by staff',
        createdBy: actor,
      });

      // The person just told us it is live, on this date. Record that as the
      // confirmation, so the plan moves straight to LIVE_TESTING.
      const live = await repo.confirmMonitoringLive({
        monitoringId: plan.monitoring_id,
        actualGoLiveDate: goLive,
        confirmedBy: actor,
      });
      if (b.cycle_id) {
        await repo.query(
          'UPDATE public.thivajini_feed_monitoring SET cycle_id = $2 WHERE monitoring_id = $1',
          [plan.monitoring_id, b.cycle_id]);
      }
      started.push(live || plan);
    }

    if (!started.length) {
      return res.status(404).json({ ok: false, error: 'No matching generated products were found to monitor.' });
    }
    return res.status(200).json({
      ok: true,
      started: started.length,
      actual_go_live_date: goLive,
      baseline_period: { from: baselineStart, to: baselineEnd },
      plans: started,
      verdict_note: 'A meaningful verdict needs at least 14 days of live data.',
    });
  } catch (e) {
    return err(res, e);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Explicit human confirmation that a change actually went live. */
async function handleConfirmLive(req, res, session) {
  const b = body(req);
  if (!b.monitoring_id) return res.status(400).json({ ok: false, error: 'monitoring_id required' });
  const date = b.actual_go_live_date || todayIso();
  if (!DATE_RE.test(date)) {
    return res.status(400).json({ ok: false, error: 'actual_go_live_date must be YYYY-MM-DD' });
  }
  try {
    const row = await repo.confirmMonitoringLive({
      monitoringId: b.monitoring_id, actualGoLiveDate: date, confirmedBy: actorOf(session),
    });
    if (!row) return res.status(404).json({ ok: false, error: 'monitoring plan not found' });
    return res.status(200).json({ ok: true, monitoring: row });
  } catch (e) { return err(res, e); }
}

/**
 * Monitoring board. Opportunistically opens SCHEDULED plans whose window has
 * arrived and captures their baseline — no cron job is introduced for this.
 */
async function handleMonitoring(req, res) {
  const client = ledsoneClient();
  try {
    await client.connect();
    const today = todayIso();

    for (const due of await repo.dueMonitoring(today)) {
      try {
        const end = sql.addDays(dayOf(due.monitoring_start_date), -1);
        const start = sql.addDays(end, -(BASELINE_WINDOW_DAYS - 1));
        const perf = await sql.getItemPerformance(client, { itemId: due.item_id, from: start, to: end });
        const snap = await repo.savePerfSnapshot({
          generationId: due.generation_id, itemId: due.item_id,
          snapshotType: 'BASELINE', periodStart: start, periodEnd: end,
          impressions: perf.impressions, clicks: perf.clicks, ctr: perf.ctr,
          gadsConversions: perf.conversions, conversionValue: perf.conversion_value,
          conversionRate: perf.conversion_rate, sourceMaxDate: perf.source_max_date,
          sourceRefs: { captured_for: 'SCHEDULED_MONITORING_OPENED' },
        });
        await repo.updateMonitoring({
          monitoringId: due.monitoring_id,
          status: 'AWAITING_MANUAL_GO_LIVE',
          baselineSnapshotId: snap.snapshot_id,
        });
      } catch (e) { /* one bad plan must not break the whole board */ }
    }

    const plans = await repo.listMonitoring({ itemId: req.query.item || null });
    const allSnaps = await repo.listPerfSnapshots({ itemId: req.query.item || null, limit: 400 });
    const enriched = [];

    for (const m of plans) {
      const liveFrom = dayOf(m.actual_go_live_date);
      // Days Live as an INTEGER count — the documented workbook display defect
      // (a valid day count rendered as a date) corrected here.
      const daysLive = liveFrom
        ? Math.max(0, Math.round((Date.parse(today) - Date.parse(liveFrom)) / 86400000))
        : null;

      let post = null;
      if (liveFrom && daysLive !== null && daysLive >= 1) {
        post = await sql.getItemPerformance(client, { itemId: m.item_id, from: liveFrom, to: today });
      }
      const base = m.baseline_snapshot_id
        ? allSnaps.find((s) => s.snapshot_id === m.baseline_snapshot_id) || null
        : null;

      const minDays = m.minimum_test_days || 14;
      let verdict = 'Awaiting go-live confirmation';
      if (daysLive !== null) {
        if (daysLive < minDays) {
          verdict = 'Too Early - Keep Testing';
        } else if (base && post) {
          const b0 = Number(base.conversion_rate) || 0;
          const n0 = Number(post.conversion_rate) || 0;
          // The workbook rule is unchanged (>= +10% Scale, >= -10% Monitor).
          // The comparison is made numerically robust because binary floats
          // put 0.10 * 1.1 at 0.11000000000000001, which would misclassify a
          // product sitting EXACTLY on the +10% threshold as "Monitor".
          const atLeast = (value, threshold) =>
            value > threshold || Math.abs(value - threshold) < 1e-9;
          verdict = b0 === 0 ? 'Monitor - Inconclusive (no baseline conversion rate)'
            : atLeast(n0, b0 * 1.1) ? 'Scale - Keep New Copy'
              : atLeast(n0, b0 * 0.9) ? 'Monitor - Inconclusive'
                : 'Revert - Re-generate';
        } else {
          verdict = 'Monitor - Inconclusive';
        }
      }

      enriched.push(Object.assign({}, m, {
        days_live: daysLive,
        baseline: base,
        post_change: post,
        raw_ctr_change: base && post ? Number(post.ctr) - Number(base.ctr || 0) : null,
        raw_conv_rate_change: base && post ? Number(post.conversion_rate) - Number(base.conversion_rate || 0) : null,
        verdict,
      }));
    }

    return res.status(200).json({
      ok: true,
      today,
      plans: enriched,
      verdict_note: notes.VERDICT_NOTE,
      attribution_adjusted_verdict: 'not implemented / awaiting approved business logic',
      go_live_note: 'A CSV download does not set go-live. actual_go_live_date is set only by an explicit human confirmation.',
    });
  } catch (e) {
    return err(res, e);
  } finally {
    await client.end().catch(() => {});
  }
}

async function handleExportHistory(req, res) {
  try {
    return res.status(200).json({
      ok: true,
      exports: await repo.listExports({ batchId: req.query.batch || null }),
    });
  } catch (e) { return err(res, e); }
}

/**
 * The single server-side authority on whether a Merchant push may run.
 * Returns { state, reasons[] }. In this deliverable it can never permit a push.
 */
function pushGate(gen, variant) {
  const reasons = [];
  if (process.env.MERCHANT_PUSH_ENABLED !== 'true') {
    reasons.push('Production push feature gate is off (MERCHANT_PUSH_ENABLED is not "true").');
  }
  reasons.push('Merchant API access for account 5551466539 is not configured — see the Merchant Push Feasibility report.');
  if (!gen || gen.feed_eligible_status !== 'Y') {
    reasons.push('Feed Gate is not Eligible - ' + gate.CHECK_REASON + '.');
  }
  if (!variant || variant.validation_status !== 'PASS') {
    reasons.push('Selected variant has not passed validation.');
  }
  return { state: reasons.length ? 'BLOCKED' : 'PREVIEW_ONLY', reasons };
}

/**
 * READ-ONLY Merchant push preview: the exact diff a FUTURE approved write
 * would make. Performs no write and issues no Merchant API call.
 */
async function handlePushPreview(req, res) {
  const genId = String(req.query.generation || '').trim();
  const label = String(req.query.variant || '').trim();
  if (!genId) return res.status(400).json({ ok: false, error: 'generation required' });

  try {
    const gens = await repo.listGenerations({ limit: 200 });
    const gen = gens.find((g) => g.generation_id === genId);
    if (!gen) return res.status(404).json({ ok: false, error: 'generation not found' });

    const vars = await repo.listVariants(genId);
    const variant = vars.find((v) => v.variant_label === label) || vars[0];
    if (!variant) return res.status(404).json({ ok: false, error: 'variant not found' });

    const snap = gen.input_snapshot || {};
    const gate = pushGate(gen, variant);

    return res.status(200).json({
      ok: true,
      preview: {
        merchant_account_id: String(sql.FR.MERCHANT_ID),
        item_id: gen.item_id,
        offer_id: gen.item_id,
        product_input_resource: 'UNRESOLVED — requires a live Merchant API dataSources lookup',
        product_resource: 'UNRESOLVED — requires a live Merchant API products.get',
        data_source: 'UNRESOLVED — see the Merchant Push Feasibility report',
        content_language: 'fr',
        feed_label: snap.feed_label || 'UNRESOLVED',
        changes: [
          { field: 'title', before: snap.current_title || null, after: variant.title_fr },
          { field: 'description', before: snap.current_description || null, after: variant.description_fr },
        ],
        unchanged_fields: ['price', 'availability', 'image_link', 'gtin', 'mpn',
          'google_product_category', 'product_type', 'shipping', 'tax', 'identifiers'],
        feed_eligible_status: gen.feed_eligible_status,
        is_draft_only: gen.is_draft_only,
        generation_id: gen.generation_id,
        variant_label: variant.variant_label,
        validation_status: variant.validation_status,
        operator: gen.created_by,
      },
      push_state: gate.state,
      push_allowed: false,
      blocked_reasons: gate.reasons,
      note: 'READ-ONLY preview. No Merchant API call was made and no product was modified.',
    });
  } catch (e) { return err(res, e); }
}

/**
 * Deliberately always refuses. The route exists so that a client-side attempt
 * meets a server refusal rather than a 404 that invites a workaround.
 */
async function handlePushExecute(req, res) {
  return res.status(403).json({
    ok: false,
    push_state: 'BLOCKED',
    error: 'Production Merchant push is disabled. It requires a reviewed feasibility report and separate written approval.',
    reasons: pushGate(null, null).reasons,
  });
}

// ═══════════════════════════ ROUTER ═══════════════════════════════════════


// ═══════════════════════════ OPTIMIZATION CYCLE ════════════════════════════
//
// One durable, resumable run over N products. Every collaborator is injected
// so lib/feed/cycle.js never requires this file back.

const CYCLE_CREATE_FAILED =
  "We couldn't start this optimization cycle. Please try again or contact the technical team.";

const cycleDeps = {
  repo, sql, gate, ledsoneClient, termsFreshness, generateForProduct,
};

async function handleCycleCreate(req, res, session) {
  const b = body(req);
  try {
    const out = await cycleLib.createCycle(cycleDeps, {
      createdBy: actorOf(session),
      settings: {
        product_count: b.product_count,
        priority_tier: b.priority_tier || null,
        allow_draft_for_check: b.allow_draft_for_check === true,
      },
      idempotencyKey: b.idempotency_key ? String(b.idempotency_key).slice(0, 120) : null,
      itemIds: Array.isArray(b.item_ids) ? b.item_ids : null,
    });
    return res.status(200).json({ ok: true, reused: out.reused, cycle: cycleLib.publicCycle(out.cycle) });
  } catch (e) {
    if (e && e.code === 'CYCLE_NO_CANDIDATES') {
      return res.status(400).json({ ok: false, code: e.code, error: e.message });
    }
    // Cycle creation gets its own sentence: the staff member pressed one button
    // and needs to know that button did not work, not what a constraint is.
    console.error('[req5] cycle-create', (e && e.code) || 'ERROR', (e && e.message) || '');
    return res.status(500).json({
      ok: false,
      code: (e && e.code) || null,
      error: CYCLE_CREATE_FAILED,
      detail: (e && e.message) || 'unknown error',
    });
  }
}

async function handleCycleAdvance(req, res, session) {
  const b = body(req);
  const cycleId = String(b.cycle_id || '').trim();
  if (!cycleId) return res.status(400).json({ ok: false, error: 'cycle_id required' });
  try {
    const step = await cycleLib.advanceCycle(cycleDeps, { cycleId, actor: actorOf(session) });
    const status = await cycleLib.getStatus(cycleDeps, cycleId);
    return res.status(200).json({ ok: true, ...step, ...status });
  } catch (e) {
    if (e && e.code === 'CYCLE_NOT_FOUND') return res.status(404).json({ ok: false, error: e.message });
    return err(res, e);
  }
}

async function handleCycleStatus(req, res) {
  const cycleId = String(req.query.cycle || '').trim();
  if (!cycleId) return res.status(400).json({ ok: false, error: 'cycle required' });
  try {
    return res.status(200).json({ ok: true, ...(await cycleLib.getStatus(cycleDeps, cycleId)) });
  } catch (e) {
    if (e && e.code === 'CYCLE_NOT_FOUND') return res.status(404).json({ ok: false, error: e.message });
    return err(res, e);
  }
}

async function handleCycleReport(req, res) {
  const cycleId = String(req.query.cycle || '').trim();
  if (!cycleId) return res.status(400).json({ ok: false, error: 'cycle required' });
  try {
    const out = await cycleLib.getReport(cycleDeps, cycleId);
    return res.status(200).json({ ok: true, ...out, known_gaps: KNOWN_GAPS });
  } catch (e) {
    if (e && e.code === 'CYCLE_NOT_FOUND') return res.status(404).json({ ok: false, error: e.message });
    return err(res, e);
  }
}

async function handleCycleDetail(req, res) {
  const cycleId = String(req.query.cycle || '').trim();
  if (!cycleId) return res.status(400).json({ ok: false, error: 'cycle required' });
  try {
    return res.status(200).json({ ok: true, ...(await cycleLib.getDetail(cycleDeps, cycleId)) });
  } catch (e) {
    if (e && e.code === 'CYCLE_NOT_FOUND') return res.status(404).json({ ok: false, error: e.message });
    return err(res, e);
  }
}

async function handleCycleHistory(req, res) {
  try {
    const cycles = await cycleLib.listCycles(cycleDeps, req.query.limit);
    return res.status(200).json({ ok: true, cycles });
  } catch (e) { return err(res, e); }
}

async function handleCycleSelect(req, res) {
  const b = body(req);
  if (!b.cycle_id || !b.item_id) {
    return res.status(400).json({ ok: false, error: 'cycle_id and item_id required' });
  }
  try {
    const row = await cycleLib.selectVariant(cycleDeps, {
      cycleId: b.cycle_id, itemId: b.item_id,
      variantLabel: b.variant_label, excluded: b.excluded,
    });
    if (!row) return res.status(404).json({ ok: false, error: 'Product not found in this cycle.' });
    return res.status(200).json({
      ok: true,
      item_id: row.item_id,
      selected_variant: row.selected_variant,
      excluded_from_export: row.excluded_from_export,
    });
  } catch (e) { return err(res, e); }
}

const READ_TYPES = new Set([
  'req5-candidates', 'req5-product', 'req5-search-terms',
  'req5-history', 'req5-telemetry', 'req5-provider-status',
  'req5-export-columns', 'req5-export-history', 'req5-monitoring', 'req5-push-preview',
  'req5-cycle-status', 'req5-cycle-report', 'req5-cycle-detail', 'req5-cycle-history',
]);
const WRITE_TYPES = new Set([
  'req5-create-batch', 'req5-save-terms', 'req5-generate',
  'req5-select', 'req5-capture-performance',
  'req5-export', 'req5-confirm-live', 'req5-push-execute',
  'req5-cycle-create', 'req5-cycle-advance', 'req5-cycle-select',
  'req5-monitoring-start',
]);

async function handleReq5(req, res, type) {
  // Session is enforced for reads AND writes.
  const session = requireSession(req, res);
  if (!session) return undefined;

  if (WRITE_TYPES.has(type)) {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'POST required for this operation' });
    }
    // Wildcard CORS is unsafe for state-changing calls. Restrict to same-origin.
    res.setHeader('Access-Control-Allow-Origin', 'null');
    res.setHeader('Vary', 'Origin');
  }

  switch (type) {
    case 'req5-candidates':          return handleCandidates(req, res);
    case 'req5-product':             return handleProductEvidence(req, res);
    case 'req5-search-terms':        return handleSearchTerms(req, res);
    case 'req5-history':             return handleHistory(req, res);
    case 'req5-telemetry':           return handleTelemetry(req, res);
    case 'req5-provider-status':     return handleProviderStatus(req, res);
    case 'req5-create-batch':        return handleCreateBatch(req, res, session);
    case 'req5-save-terms':          return handleSaveTermSelection(req, res, session);
    case 'req5-generate':            return handleGenerate(req, res, session);
    case 'req5-select':              return handleSelectVariant(req, res, session);
    case 'req5-capture-performance': return handleCapturePerformance(req, res, session);
    case 'req5-export-columns':      return handleExportColumns(req, res);
    case 'req5-export':              return handleExport(req, res, session);
    case 'req5-export-history':      return handleExportHistory(req, res);
    case 'req5-monitoring':          return handleMonitoring(req, res);
    case 'req5-confirm-live':        return handleConfirmLive(req, res, session);
    case 'req5-push-preview':        return handlePushPreview(req, res);
    case 'req5-push-execute':        return handlePushExecute(req, res);
    // ── Optimization Cycle ───────────────────────────────────────────────
    case 'req5-cycle-create':        return handleCycleCreate(req, res, session);
    case 'req5-cycle-advance':       return handleCycleAdvance(req, res, session);
    case 'req5-cycle-status':        return handleCycleStatus(req, res);
    case 'req5-cycle-report':        return handleCycleReport(req, res);
    case 'req5-cycle-detail':        return handleCycleDetail(req, res);
    case 'req5-cycle-history':       return handleCycleHistory(req, res);
    case 'req5-cycle-select':        return handleCycleSelect(req, res);
    case 'req5-monitoring-start':    return handleMonitoringStart(req, res, session);
    default:
      return res.status(400).json({ ok: false, error: `Unknown Req5 type: ${type}` });
  }
}

module.exports = {
  handleReq5, READ_TYPES, WRITE_TYPES,
  runProviderChain, termsFreshness, pushGate,
  KNOWN_GAPS, CONFLICT_NOTE, VERDICT_NOTE, QUOTA_NOTE,
  // test-only seam: lets the boundary suite assert the staff-facing error shape
  __err: err, __staffMessage: staffMessage, CONFIG_CODES, CYCLE_CREATE_FAILED,
  generateForProduct, cycleDeps,
};
