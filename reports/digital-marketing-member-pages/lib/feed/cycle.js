// lib/feed/cycle.js
//
// ONE-BUTTON OPTIMIZATION CYCLE — durable orchestration.
//
// WHY A STATE MACHINE IN POSTGRES
//   A Vercel Function cannot hold a ten-product run in memory: it can be
//   frozen, retried or duplicated at any moment, and a 300 s synchronous
//   request would be one timeout away from losing the whole run. So the cycle
//   lives in the application Neon DB (AUTH_DATABASE_URL). `advance()` reads the
//   durable state, does ONE product, writes the result, and returns. The
//   browser calls advance repeatedly. A refresh, a double click or a platform
//   retry all converge on the same rows.
//
// SEQUENTIAL BY CONSTRUCTION
//   One product per advance() call means the provider chain is never fanned
//   out. Ten products can never become a ten-request Gemini burst.
//
// DEPENDENCY INJECTION
//   Every collaborator arrives in `deps` so this module requires nothing from
//   req5.js. That keeps the require graph acyclic (req5 -> cycle, never back)
//   and makes the state machine unit-testable without a database.

'use strict';

const gate = require('./gate');

// ── cycle states ───────────────────────────────────────────────────────────
const CYCLE = {
  CREATED: 'CREATED',
  PREPARING: 'PREPARING',
  EVALUATING_PRODUCTS: 'EVALUATING_PRODUCTS',
  FETCHING_SEARCH_EVIDENCE: 'FETCHING_SEARCH_EVIDENCE',
  GENERATING: 'GENERATING',
  VALIDATING: 'VALIDATING',
  BUILDING_REPORT: 'BUILDING_REPORT',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_WARNINGS: 'COMPLETED_WITH_WARNINGS',
  FAILED: 'FAILED',
};

const TERMINAL = [CYCLE.COMPLETED, CYCLE.COMPLETED_WITH_WARNINGS, CYCLE.FAILED];

// ── per-product states ─────────────────────────────────────────────────────
const PRODUCT = {
  WAITING: 'WAITING',
  RUNNING: 'RUNNING',
  GENERATED: 'GENERATED',
  CHECK_REQUIRED: 'CHECK_REQUIRED',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
};

/** Staff-facing outcome wording used in the final report. */
const RESULT = {
  GENERATED: 'Generated',
  SKIPPED_GATE: 'Skipped — Feed Gate',
  SKIPPED_EVIDENCE: 'Skipped — insufficient evidence',
  GENERATION_FAILED: 'Generation failed',
  VALIDATION_FAILED: 'Validation failed',
};

const DEFAULT_PRODUCT_COUNT = 10;   // the written workflow pulls 10 candidates
const TERMS_PER_PRODUCT = 5;

// ═══════════════════════════ helpers ═══════════════════════════════════════

function jsonOrNull(v) { return v == null ? null : JSON.stringify(v); }

async function logEvent(deps, cycleId, message, opts) {
  const o = opts || {};
  await deps.repo.query(
    `INSERT INTO public.thivajini_feed_cycle_event (cycle_id, level, item_id, message, detail)
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [cycleId, o.level || 'INFO', o.itemId || null, message, jsonOrNull(o.detail)]);
}

async function setCycle(deps, cycleId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await deps.repo.query(
    `UPDATE public.thivajini_feed_cycle SET ${sets} WHERE cycle_id = $1`,
    [cycleId, ...keys.map((k) => fields[k])]);
}

async function getCycleRow(deps, cycleId) {
  const { rows } = await deps.repo.query(
    'SELECT * FROM public.thivajini_feed_cycle WHERE cycle_id = $1', [cycleId]);
  return rows[0] || null;
}

async function getProducts(deps, cycleId) {
  const { rows } = await deps.repo.query(
    `SELECT * FROM public.thivajini_feed_cycle_product
      WHERE cycle_id = $1 ORDER BY seq`, [cycleId]);
  return rows;
}

async function recount(deps, cycleId) {
  const { rows } = await deps.repo.query(
    `SELECT
       count(*)                                                   AS total,
       count(*) FILTER (WHERE state = 'GENERATED')                AS generated,
       count(*) FILTER (WHERE state = 'CHECK_REQUIRED')           AS check_required,
       count(*) FILTER (WHERE state IN ('FAILED','VALIDATION_FAILED')) AS failed,
       count(*) FILTER (WHERE state = 'SKIPPED')                  AS skipped,
       count(*) FILTER (WHERE state IN ('WAITING','RUNNING'))     AS pending
     FROM public.thivajini_feed_cycle_product WHERE cycle_id = $1`, [cycleId]);
  const r = rows[0];
  const done = Number(r.total) - Number(r.pending);
  await setCycle(deps, cycleId, {
    products_total: Number(r.total),
    products_done: done,
    products_generated: Number(r.generated),
    products_check: Number(r.check_required),
    products_failed: Number(r.failed),
    products_skipped: Number(r.skipped),
  });
  return {
    total: Number(r.total), pending: Number(r.pending), done,
    generated: Number(r.generated), check_required: Number(r.check_required),
    failed: Number(r.failed), skipped: Number(r.skipped),
  };
}

// ═══════════════════════════ 1. CREATE ═════════════════════════════════════

/**
 * Create a cycle and enqueue its products.
 *
 * IDEMPOTENT. The same idempotency key always returns the SAME cycle, so a
 * double click, a browser refresh mid-request, or a Vercel retry can never
 * produce two cycles — and therefore never two sets of LLM calls.
 */
async function createCycle(deps, { createdBy, settings, idempotencyKey, itemIds }) {
  const s = settings || {};
  const count = Math.max(1, Math.min(Number(s.product_count) || DEFAULT_PRODUCT_COUNT, 25));

  if (idempotencyKey) {
    const { rows } = await deps.repo.query(
      'SELECT * FROM public.thivajini_feed_cycle WHERE idempotency_key = $1', [idempotencyKey]);
    if (rows[0]) return { cycle: rows[0], reused: true };
  }

  // A cycle owns a batch, so every existing per-batch table keeps working
  // exactly as before (term selections, generations, exports, monitoring).
  const client = deps.ledsoneClient();
  let cutoffs = {};
  let chosen = [];
  try {
    await client.connect();
    cutoffs = await deps.sql.getSourceCutoffs(client);
    const to = cutoffs.ads_perf || deps.sql.isoDate(new Date());
    const from = deps.sql.addDays(to, -29);

    let candidates = await deps.sql.getCandidates(client, { from, to, limit: 500 });
    candidates = await deps.sql.attachSpecs(client, candidates);
    candidates = await deps.sql.attachStock(client, candidates);

    // Reuse the EXISTING priority logic. No new business ranking is invented.
    candidates.forEach((c) => {
      const ctr = (c.perf_30d && c.perf_30d.ctr) || 0;
      c.priority_tier = ctr < 0.01 ? 'Tier 1 - High Priority'
        : ctr < 0.02 ? 'Tier 2 - Medium' : 'Tier 3 - Monitor';
    });

    if (Array.isArray(itemIds) && itemIds.length) {
      const want = new Set(itemIds.map(String));
      chosen = candidates.filter((c) => want.has(String(c.item_id))).slice(0, count);
    } else {
      let pool = candidates;
      if (s.priority_tier) pool = pool.filter((c) => c.priority_tier === s.priority_tier);
      // Existing order: worst CTR first is already Tier 1; within the pool keep
      // impressions-desc so the biggest wasted exposure is addressed first.
      pool = pool.slice().sort((a, b) =>
        ((b.perf_30d && b.perf_30d.impressions) || 0) - ((a.perf_30d && a.perf_30d.impressions) || 0));
      chosen = pool.slice(0, count);
    }
  } finally {
    await client.end().catch(() => {});
  }

  if (!chosen.length) {
    const e = new Error('No candidate products matched these settings.');
    e.code = 'CYCLE_NO_CANDIDATES';
    throw e;
  }

  const batch = await deps.repo.createBatch({
    createdBy,
    notes: 'Optimization Cycle',
    cutoffs: {
      ads_perf: cutoffs.ads_perf || null,
      pmax_terms: cutoffs.pmax_terms || null,
      conv_terms: cutoffs.conv_terms || null,
    },
  });

  const { rows } = await deps.repo.query(
    `INSERT INTO public.thivajini_feed_cycle
       (batch_id, created_by, status, settings, idempotency_key,
        ads_perf_cutoff, pmax_terms_cutoff, conventional_terms_cutoff,
        products_total, started_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6::date,$7::date,$8::date,$9, now())
     -- The unique index behind this is PARTIAL:
     --   CREATE UNIQUE INDEX … (idempotency_key) WHERE idempotency_key IS NOT NULL
     -- PostgreSQL will not infer a partial index from a bare conflict target, so
     -- the predicate has to be repeated here verbatim. Without it the statement
     -- fails with SQLSTATE 42P10 before a single row is written.
     ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [batch.batch_id, createdBy, CYCLE.PREPARING, JSON.stringify(s), idempotencyKey || null,
      cutoffs.ads_perf || null, cutoffs.pmax_terms || null, cutoffs.conv_terms || null,
      chosen.length]);

  if (!rows[0]) {
    // Lost the race against a concurrent identical request — return theirs.
    const again = await deps.repo.query(
      'SELECT * FROM public.thivajini_feed_cycle WHERE idempotency_key = $1', [idempotencyKey]);
    return { cycle: again.rows[0], reused: true };
  }
  const cycle = rows[0];

  for (let i = 0; i < chosen.length; i++) {
    await deps.repo.query(
      `INSERT INTO public.thivajini_feed_cycle_product (cycle_id, seq, item_id, state)
       VALUES ($1,$2,$3,'WAITING')
       ON CONFLICT (cycle_id, item_id) DO NOTHING`,
      [cycle.cycle_id, i + 1, chosen[i].item_id]);
  }

  await logEvent(deps, cycle.cycle_id, 'Cycle started', {
    detail: { products: chosen.length, settings: s, cutoffs },
  });
  await logEvent(deps, cycle.cycle_id,
    `${chosen.length} candidate product${chosen.length === 1 ? '' : 's'} selected`);

  return { cycle, reused: false };
}

// ═══════════════════════════ 2. ADVANCE ════════════════════════════════════

/**
 * Do ONE unit of work and return. Safe to call repeatedly and concurrently:
 * the claim below is a single atomic UPDATE, so two overlapping calls can
 * never pick the same product.
 */
async function advanceCycle(deps, { cycleId, actor }) {
  const cycle = await getCycleRow(deps, cycleId);
  if (!cycle) {
    const e = new Error('Cycle not found.'); e.code = 'CYCLE_NOT_FOUND'; throw e;
  }
  if (TERMINAL.includes(cycle.status)) {
    return { done: true, status: cycle.status, counts: await recount(deps, cycleId) };
  }

  // Atomically CLAIM the next waiting product. `FOR UPDATE SKIP LOCKED` means a
  // second concurrent advance() takes the next one instead of duplicating work.
  const claim = await deps.repo.query(
    `UPDATE public.thivajini_feed_cycle_product SET state = 'RUNNING', started_at = now()
      WHERE cycle_product_id = (
        SELECT cycle_product_id FROM public.thivajini_feed_cycle_product
         WHERE cycle_id = $1 AND state = 'WAITING'
         ORDER BY seq
         FOR UPDATE SKIP LOCKED
         LIMIT 1)
      RETURNING *`, [cycleId]);

  if (!claim.rows[0]) {
    // Nothing left to claim. Either others are still RUNNING, or we finish.
    const counts = await recount(deps, cycleId);
    if (counts.pending > 0) {
      return { done: false, status: cycle.status, counts, waiting_on_other_worker: true };
    }
    return finishCycle(deps, cycleId, counts);
  }

  const cp = claim.rows[0];
  await setCycle(deps, cycleId, { status: CYCLE.GENERATING, status_detail: cp.item_id });

  try {
    const outcome = await runProduct(deps, { cycle, cycleProduct: cp, actor });
    await deps.repo.query(
      `UPDATE public.thivajini_feed_cycle_product
          SET state=$2, state_detail=$3, gate_status=$4, gate_source=$5, gate_reasons=$6::jsonb,
              result_code=$7, result_note=$8, evidence_snapshot=$9::jsonb, data_quality=$10::jsonb,
              terms_count=$11, generation_id=$12, finished_at=now(), error_message=NULL
        WHERE cycle_product_id=$1`,
      [cp.cycle_product_id, outcome.state, outcome.stateDetail || null,
        outcome.gate ? outcome.gate.status : null,
        outcome.gate ? outcome.gate.source : null,
        jsonOrNull(outcome.gate ? outcome.gate.reasons : null),
        outcome.resultCode, outcome.resultNote || null,
        jsonOrNull(outcome.evidence), jsonOrNull(outcome.dataQuality),
        outcome.termsCount || 0, outcome.generationId || null]);

    if (outcome.llmCalls) {
      await deps.repo.query(
        `UPDATE public.thivajini_feed_cycle
            SET llm_calls = llm_calls + $2, gemini_calls = gemini_calls + $3
          WHERE cycle_id = $1`,
        [cycleId, outcome.llmCalls, outcome.geminiCalls || 0]);
    }
    await logEvent(deps, cycleId, outcome.event || outcome.resultCode,
      { itemId: cp.item_id, level: outcome.level || 'INFO', detail: outcome.eventDetail || null });
  } catch (e) {
    // ONE product failing must never kill the cycle.
    await deps.repo.query(
      `UPDATE public.thivajini_feed_cycle_product
          SET state='FAILED', result_code=$2, result_note=$3, error_message=$3, finished_at=now()
        WHERE cycle_product_id=$1`,
      [cp.cycle_product_id, RESULT.GENERATION_FAILED, String((e && e.message) || 'unknown error')]);
    await logEvent(deps, cycleId, 'Product failed', {
      itemId: cp.item_id, level: 'ERROR', detail: { message: String((e && e.message) || '') },
    });
  }

  const counts = await recount(deps, cycleId);
  if (counts.pending === 0) return finishCycle(deps, cycleId, counts);
  return { done: false, status: CYCLE.GENERATING, counts };
}

async function finishCycle(deps, cycleId, counts) {
  const warnings = counts.check_required + counts.failed + counts.skipped;
  const status = counts.generated === 0 && counts.total > 0 && counts.failed === counts.total
    ? CYCLE.FAILED
    : warnings > 0 ? CYCLE.COMPLETED_WITH_WARNINGS : CYCLE.COMPLETED;
  await setCycle(deps, cycleId, { status, status_detail: null, finished_at: new Date() });
  await logEvent(deps, cycleId, 'Final report created', { detail: counts });
  return { done: true, status, counts };
}

// ═══════════════════════════ 3. ONE PRODUCT ════════════════════════════════

/**
 * STEP 1 evidence -> STEP 2 gate -> STEP 3 baseline -> STEP 4 search evidence
 * -> STEP 5 prompt -> STEP 6 generate -> STEP 7 validate -> STEP 8 persist.
 *
 * Steps 5-8 are delegated to the SAME generation routine the manual endpoint
 * uses, so a cycle and a manual run cannot drift apart.
 */
async function runProduct(deps, { cycle, cycleProduct, actor }) {
  const itemId = cycleProduct.item_id;
  const settings = cycle.settings || {};
  const client = deps.ledsoneClient();

  try {
    await client.connect();

    // ── STEP 1: product evidence ────────────────────────────────────────
    const cutoffs = await deps.sql.getSourceCutoffs(client);
    const to = cutoffs.ads_perf || deps.sql.isoDate(new Date());
    const from = deps.sql.addDays(to, -29);

    const candidates = await deps.sql.getCandidates(client, { from, to, limit: 500 });
    const product = candidates.find((c) => String(c.item_id) === String(itemId));
    if (!product) {
      return {
        state: PRODUCT.SKIPPED, resultCode: RESULT.SKIPPED_EVIDENCE,
        resultNote: 'This product is no longer in the current 30-day Ads window.',
        event: 'Skipped — no longer in the current window', level: 'WARN',
      };
    }
    await deps.sql.attachSpecs(client, [product]);
    await deps.sql.attachStock(client, [product]);
    await deps.sql.attachShopifyConversions(client, [product], { from, to });

    const freshness = deps.termsFreshness(cutoffs, deps.sql.isoDate(new Date()));

    // ── STEP 2: Feed Gate ───────────────────────────────────────────────
    const feedGate = gate.fromLegacy(product.feed_eligible);
    const evidence = {
      item_id: product.item_id, sku: product.sku, brand: product.brand,
      price_eur: product.price_eur, product_type: product.product_type,
      google_product_category: product.google_product_category,
      current_title: product.current_title, current_description: product.current_description,
      image_link: product.image_link, specs: product.specs,
      stock: product.stock, perf_30d: product.perf_30d,
      shopify_conversions: product.shopify_conversions,
      missing_evidence: product.missing_evidence,
      feed_gate: feedGate,
    };

    // THE WRITTEN GATE. `Feed Eligible = Y` is required before an LLM call is
    // spent. Nothing here promotes CHECK to Y, and no eligibility rule is
    // invented. An operator may explicitly opt into draft-only generation for
    // CHECK products; that decision is recorded on the cycle, per product.
    const allowDraftForCheck = settings.allow_draft_for_check === true;
    if (feedGate.status !== gate.GATE.ELIGIBLE && !allowDraftForCheck) {
      const notEligible = feedGate.status === gate.GATE.NOT_ELIGIBLE;
      return {
        state: PRODUCT.CHECK_REQUIRED,
        gate: feedGate,
        evidence,
        dataQuality: gate.dataQuality(product, { hasPaidTerms: true, termsStale: freshness.status === 'STALE' }),
        resultCode: RESULT.SKIPPED_GATE,
        resultNote: notEligible
          ? 'Recorded as not eligible for the France Merchant feed.'
          : 'Feed eligibility requires check — no AI call was spent.',
        event: 'Skipped — Feed eligibility requires check',
        level: 'WARN',
        eventDetail: { gate_status: feedGate.status, gate_source: feedGate.source, reasons: feedGate.reasons },
      };
    }

    // ── STEP 4: search evidence (auto-selected, top converting) ─────────
    const allTerms = await deps.sql.getPaidSearchTerms(client, {
      from: deps.sql.addDays(to, -179), to, minConversions: 0, limit: 400,
    });
    const converting = allTerms
      .filter((t) => Number(t.conversions) > 0)
      .sort((a, b) => Number(b.conversions) - Number(a.conversions))
      .slice(0, TERMS_PER_PRODUCT);

    if (!converting.length) {
      return {
        state: PRODUCT.SKIPPED, gate: feedGate, evidence,
        dataQuality: gate.dataQuality(product, { hasPaidTerms: false, termsStale: freshness.status === 'STALE' }),
        resultCode: RESULT.SKIPPED_EVIDENCE,
        resultNote: 'No paid converting search terms are available, so there is no evidence to write from.',
        event: 'Skipped — no paid converting search evidence', level: 'WARN',
      };
    }

    await deps.repo.saveTermSelections({
      batchId: cycle.batch_id, itemId,
      selectedBy: actor,
      terms: converting.map((t) => ({
        ...t,
        freshness_status: freshness.status,
        metrics_snapshot: {
          impressions: t.impressions, clicks: t.clicks, conversions: t.conversions,
          conversion_value: t.conversion_value, conversion_rate: t.conversion_rate,
          source_tables: t.source_tables, category_label: t.category_label,
        },
      })),
    });

    // ── STEPS 3, 5-8: baseline + prompt + generate + validate + persist ──
    const gen = await deps.generateForProduct({
      client, product, candidates, cutoffs, from, to, freshness,
      batchId: cycle.batch_id, itemId, actor, includeOrganic: false,
    });

    const dataQuality = gate.dataQuality(product, {
      hasPaidTerms: true, termsStale: freshness.status === 'STALE',
    });

    if (!gen.winner) {
      const validationOnly = gen.terminalStatus === 'VALIDATION_FAILED';
      return {
        state: validationOnly ? PRODUCT.VALIDATION_FAILED : PRODUCT.FAILED,
        gate: feedGate, evidence, dataQuality,
        termsCount: converting.length,
        generationId: gen.generationId,
        resultCode: validationOnly ? RESULT.VALIDATION_FAILED : RESULT.GENERATION_FAILED,
        resultNote: gen.reason || 'No provider returned a valid pair of variants.',
        event: validationOnly ? 'Validation failed' : 'Generation failed',
        level: 'ERROR',
        llmCalls: gen.llmCalls, geminiCalls: gen.geminiCalls,
        eventDetail: { attempts: gen.attemptSummary },
      };
    }

    return {
      state: PRODUCT.GENERATED,
      gate: feedGate, evidence, dataQuality,
      termsCount: converting.length,
      generationId: gen.generationId,
      resultCode: RESULT.GENERATED,
      resultNote: feedGate.status === gate.GATE.ELIGIBLE
        ? null
        : 'Draft only — feed eligibility still requires check before upload.',
      event: 'Variants generated',
      llmCalls: gen.llmCalls, geminiCalls: gen.geminiCalls,
      eventDetail: { provider: gen.winnerAlias, model: gen.winnerModel, attempts: gen.attemptSummary },
    };
  } finally {
    await client.end().catch(() => {});
  }
}

// ═══════════════════════════ 4. READ MODELS ════════════════════════════════

async function getStatus(deps, cycleId) {
  const cycle = await getCycleRow(deps, cycleId);
  if (!cycle) { const e = new Error('Cycle not found.'); e.code = 'CYCLE_NOT_FOUND'; throw e; }
  const products = await getProducts(deps, cycleId);
  return {
    cycle: publicCycle(cycle),
    done: TERMINAL.includes(cycle.status),
    products: products.map((p) => ({
      item_id: p.item_id, seq: p.seq, state: p.state,
      result_code: p.result_code, result_note: p.result_note,
      gate_status: p.gate_status,
      title: p.evidence_snapshot ? p.evidence_snapshot.current_title : null,
    })),
  };
}

async function getReport(deps, cycleId) {
  const cycle = await getCycleRow(deps, cycleId);
  if (!cycle) { const e = new Error('Cycle not found.'); e.code = 'CYCLE_NOT_FOUND'; throw e; }
  const products = await getProducts(deps, cycleId);

  const rows = [];
  for (const p of products) {
    const ev = p.evidence_snapshot || {};
    let variants = [];
    if (p.generation_id) variants = await deps.repo.listVariants(p.generation_id);
    const sel = variants.find((v) => v.variant_label === p.selected_variant) || null;
    rows.push({
      item_id: p.item_id,
      sku: ev.sku || null,
      title: ev.current_title || null,
      current_description: ev.current_description || null,
      image_link: ev.image_link || null,
      product_type: ev.product_type || null,
      price_eur: ev.price_eur == null ? null : ev.price_eur,
      feed_gate: ev.feed_gate || (p.gate_status
        ? { status: p.gate_status, source: p.gate_source, reasons: p.gate_reasons || [] }
        : null),
      data_quality: p.data_quality || null,
      terms_count: p.terms_count,
      generation_id: p.generation_id,
      state: p.state,
      result_code: p.result_code,
      result_note: p.result_note,
      selected_variant: p.selected_variant,
      excluded_from_export: p.excluded_from_export,
      variants: variants.map((v) => ({
        variant_label: v.variant_label,
        title_fr: v.title_fr,
        title_char_count: v.title_char_count,
        description_fr: v.description_fr,
        suggested_gpc: v.suggested_gpc,
        converting_terms_used: v.converting_terms_used,
        validation_status: v.validation_status,
      })),
      selected: sel ? { title_fr: sel.title_fr, description_fr: sel.description_fr } : null,
    });
  }
  return { cycle: publicCycle(cycle), rows };
}

async function getDetail(deps, cycleId) {
  const report = await getReport(deps, cycleId);
  const { rows: events } = await deps.repo.query(
    `SELECT at, level, item_id, message, detail
       FROM public.thivajini_feed_cycle_event
      WHERE cycle_id = $1 ORDER BY event_id`, [cycleId]);

  // Attach the technical trail per product — this page IS the audit, so it
  // carries what the workflow screens deliberately leave out: the provider
  // attempts, the prompt identity, and the evidence the copy was written from.
  for (const r of report.rows) {
    r.attempts = r.generation_id ? await deps.repo.listAttempts(r.generation_id) : [];
    r.prompt = null;
    r.paid_terms = [];
    r.organic_terms = [];
    if (r.generation_id) {
      const { rows } = await deps.repo.query(
        `SELECT prompt_version, prompt_hash, template_version,
                selected_terms_snapshot, organic_support_snapshot,
                evidence_confidence, evidence_confidence_reasons
           FROM public.thivajini_feed_generation WHERE generation_id = $1`,
        [r.generation_id]);
      const g = rows[0];
      if (g) {
        r.prompt = {
          version: g.prompt_version,
          hash: g.prompt_hash,
          template: g.template_version,
          evidence_confidence: g.evidence_confidence,
          evidence_confidence_reasons: g.evidence_confidence_reasons || [],
        };
        // Paid converting terms and ORGANIC support are kept apart here for the
        // same reason they are apart everywhere else: organic has no conversion
        // metric and is never a paid converting term.
        r.paid_terms = g.selected_terms_snapshot || [];
        r.organic_terms = g.organic_support_snapshot || [];
      }
    }
  }
  return { ...report, events };
}

async function listCycles(deps, limit) {
  const { rows } = await deps.repo.query(
    `SELECT c.*,
            (SELECT count(*) FROM public.thivajini_feed_export e WHERE e.cycle_id = c.cycle_id) AS exports,
            (SELECT count(*) FROM public.thivajini_feed_monitoring m WHERE m.cycle_id = c.cycle_id) AS monitoring
       FROM public.thivajini_feed_cycle c
      ORDER BY c.created_at DESC LIMIT $1`, [Math.min(Number(limit) || 30, 100)]);
  return rows.map((r) => ({
    ...publicCycle(r),
    exports: Number(r.exports),
    monitoring: Number(r.monitoring),
  }));
}

/** Record the staff decision for one product's variant. */
async function selectVariant(deps, { cycleId, itemId, variantLabel, excluded }) {
  const sets = [];
  const vals = [cycleId, itemId];
  if (variantLabel !== undefined) { vals.push(variantLabel || null); sets.push(`selected_variant = $${vals.length}`); }
  if (excluded !== undefined) { vals.push(!!excluded); sets.push(`excluded_from_export = $${vals.length}`); }
  if (!sets.length) return null;
  const { rows } = await deps.repo.query(
    `UPDATE public.thivajini_feed_cycle_product SET ${sets.join(', ')}
      WHERE cycle_id = $1 AND item_id = $2 RETURNING *`, vals);
  return rows[0] || null;
}

function publicCycle(c) {
  return {
    cycle_id: c.cycle_id,
    cycle_no: c.cycle_no,
    batch_id: c.batch_id,
    created_by: c.created_by,
    created_at: c.created_at,
    started_at: c.started_at,
    finished_at: c.finished_at,
    status: c.status,
    status_detail: c.status_detail,
    settings: c.settings,
    source_cutoffs: {
      ads_perf: c.ads_perf_cutoff,
      pmax_terms: c.pmax_terms_cutoff,
      conventional_terms: c.conventional_terms_cutoff,
    },
    counts: {
      total: c.products_total, done: c.products_done,
      generated: c.products_generated, check_required: c.products_check,
      failed: c.products_failed, skipped: c.products_skipped,
    },
    llm_calls: c.llm_calls,
    gemini_calls: c.gemini_calls,
    error_message: c.error_message,
  };
}

module.exports = {
  CYCLE, PRODUCT, RESULT, TERMINAL,
  DEFAULT_PRODUCT_COUNT, TERMS_PER_PRODUCT,
  createCycle, advanceCycle, getStatus, getReport, getDetail, listCycles, selectVariant,
  publicCycle, finishCycle,
};
