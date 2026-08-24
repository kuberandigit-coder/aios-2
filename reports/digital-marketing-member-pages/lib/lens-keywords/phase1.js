'use strict';

// lib/lens-keywords/phase1.js
//
// Durable Phase 1 orchestration: Same SKU -> Google Lens visual search ->
// competitor result capture. State-machine pattern copied from
// lib/feed/cycle.js (the proven precedent): advanceRun() claims ONE product
// with FOR UPDATE SKIP LOCKED, does ONE unit of work, writes the result, and
// returns. The browser calls advance repeatedly. A refresh, a double click or
// a platform retry all converge on the same rows and never repeat a search
// that already ran.
//
// DEPENDENCY INJECTION — same reasoning as lib/feed/cycle.js: every
// collaborator (repo, quota, serpapi, sql, normalize, ledsoneClient) arrives
// in `deps`, so this module requires nothing at the top level from its own
// siblings' *implementations* and is unit-testable without a database or
// network. router.js calls realDeps() to get the production wiring.
//
// CREDIT-SAFE RETRY POLICY (governing prompt §15) — implemented exactly:
//   TIMEOUT             -> one retry, same key slot, same params
//   RATE_LIMITED /
//   QUOTA_EXHAUSTED      -> switch to the other configured slot ONCE;
//                           if none available, fail this product only
//   INVALID_PARAMS        -> treated as an application/provider defect;
//                            never automatically burns the second key
//   NO_VISUAL_MATCHES      -> stored as-is; never calls another Lens type
//   run-level idempotency  -> a double click / refresh never triggers a new
//                            set of provider calls (createRun + advanceRun
//                            are both safe to call repeatedly)

const cfgModule = require('./config');
const { RUN_STATE, PRODUCT_STATE, MAX_PRODUCTS_PER_RUN, SEARCHES_PER_PRODUCT, ERRORS, RUN_TERMINAL } = cfgModule;

/** Production wiring. Tests pass their own fakes instead of calling this. */
function realDeps() {
  return {
    cfg: cfgModule,
    sql: require('./sql'),
    repo: require('./repo'),
    quota: require('./quota'),
    serpapi: require('./serpapi'),
    normalize: require('./normalize'),
    cache: require('./cache'),
    competitorFilter: require('./competitor-filter'),
    ledsoneClient: () => {
      const cs = cfgModule.ledsoneUrl();
      const { Client } = require('pg');
      return new Client({
        connectionString: cs,
        ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 15000,
        statement_timeout: 55000,
      });
    },
  };
}

// ═══════════════════════════ 1. CREATE ═════════════════════════════════════

/**
 * Create a Phase 1 run.
 *
 * IDEMPOTENT: the same idempotency key always returns the SAME run — no new
 * quota check, no new Ledsone read, no new provider call.
 *
 * VALIDATION ORDER MATTERS: product-count bounds are checked BEFORE any
 * Ledsone connection or quota call, so a rejected request never opens a
 * database connection or spends a (free) Account API call for nothing.
 */
async function createRun(deps, { createdBy, skus, country: country_, language: language_, idempotencyKey }) {
  if (idempotencyKey) {
    const existing = await deps.repo.findRunByIdempotencyKey(idempotencyKey);
    if (existing) return { run: existing, reused: true };
  }

  const uniqueSkus = Array.from(new Set((skus || []).map(String).map((s) => s.trim()).filter(Boolean)));
  if (uniqueSkus.length === 0) {
    const e = new Error('Select at least one product to run.');
    e.status = 400; e.code = ERRORS.NO_PRODUCTS; throw e;
  }
  if (uniqueSkus.length > MAX_PRODUCTS_PER_RUN) {
    const e = new Error(`You can process up to ${MAX_PRODUCTS_PER_RUN} products in one run.`);
    e.status = 400; e.code = ERRORS.TOO_MANY_PRODUCTS; throw e;
  }

  // ── resolve + snapshot product evidence from Ledsone (read-only) ─────────
  const client = deps.ledsoneClient();
  let snapshots = [];
  try {
    await client.connect();
    const rows = await deps.sql.getProductsBySku(client, uniqueSkus);
    const bySku = new Map(rows.map((r) => [String(r.sku), r]));

    const notFound = uniqueSkus.filter((s) => !bySku.has(s));
    if (notFound.length) {
      const e = new Error(`These products could not be found: ${notFound.join(', ')}.`);
      e.status = 400; e.code = 'LENS_PRODUCTS_NOT_FOUND'; throw e;
    }

    const notReady = [];
    for (const s of uniqueSkus) {
      const dq = deps.sql.classifyDataQuality(bySku.get(s));
      if (!dq.selectable) notReady.push(`${s} (${dq.reason})`);
    }
    if (notReady.length) {
      const e = new Error(`These products are not ready for a Lens search: ${notReady.join('; ')}.`);
      e.status = 400; e.code = 'LENS_PRODUCTS_NOT_READY'; throw e;
    }

    for (const s of uniqueSkus) {
      const row = bySku.get(s);
      const attrs = await deps.sql.getAttributes(client, { sku: row.sku, mappedSku: row.mapped_sku, parentSku: row.parent_sku });
      snapshots.push({
        sku: row.sku,
        mapped_sku: row.mapped_sku,
        product_item_id: row.item_id,
        product_title_snapshot: row.title,
        product_url_snapshot: row.listing_url,
        image_url_snapshot: row.main_image_url,
        product_type_snapshot: row.product_type,
        attribute_snapshot: attrs,
        source_identity: { source_table: 'listings.shopify_listings', join_column: 'sku', is_parent: !!row.is_parent },
      });
    }
  } finally {
    await client.end().catch(() => {});
  }

  // ── quota check BEFORE creating any run row (credit-safe by construction) ──
  //
  // `needed` counts only the products that would actually SPEND a search. A
  // product whose Lens fingerprint is still fresh in the 28-day evidence cache
  // costs nothing, and must not be able to block a run that the account can
  // comfortably afford — otherwise the cache would save credit while still
  // gating on the un-cached price.
  const accountStatuses = await deps.quota.checkAllAccounts();
  const available = deps.quota.totalUsableCredits(accountStatuses);
  const country = country_ || cfgModule.LENS_DEFAULTS.COUNTRY;
  const language = language_ || cfgModule.LENS_DEFAULTS.LANGUAGE;
  const needed = await countUncachedSearches(deps, snapshots, { country, language });

  const anyConfigured = accountStatuses.some((a) => a.configured);
  if (!anyConfigured) {
    const e = new Error('Google search credits are currently unavailable. Please contact the technical team.');
    e.status = 503; e.code = ERRORS.SERPAPI_NOT_CONFIGURED;
    e.detail = 'Neither SERP_API_1 nor SERP_API_2 is configured.';
    throw e;
  }
  // The reserve is withheld from AUTOMATIC consumption only. It is applied
  // whenever the cache module is wired in (i.e. the automatic workflow);
  // older direct callers keep the previous unreserved behaviour.
  const reserve = deps.cache ? (cfgModule.QUOTA_RESERVE || 0) : 0;
  const spendable = Math.max(0, available - reserve);
  if (needed > spendable) {
    const e = new Error(
      `Not enough search credits remaining (${spendable} spendable of ${available}) for ${needed} live search${needed === 1 ? '' : 'es'}.`
    );
    e.status = 400; e.code = ERRORS.INSUFFICIENT_QUOTA;
    e.detail = { available, spendable, reserve, needed, accounts: accountStatuses.map(publicQuota) };
    throw e;
  }

  const { run, reused } = await deps.repo.createRun({
    createdBy, country, language,
    requestedProductCount: snapshots.length, idempotencyKey,
  });
  if (reused) return { run, reused: true };

  await deps.repo.addRunProducts(run.run_id, snapshots);
  await deps.repo.saveQuotaSnapshot(run.run_id, accountStatuses, 'BEFORE_RUN');
  await deps.repo.setRunFields(run.run_id, { status: RUN_STATE.SEARCHING_PRODUCTS });

  return { run: await deps.repo.getRun(run.run_id), reused: false };
}

/**
 * How many of these products would genuinely spend a SerpAPI search. A fresh
 * cache hit costs nothing. Falls back to "all of them" when the cache is not
 * wired in, which is the safe (never under-estimating) direction.
 */
async function countUncachedSearches(deps, snapshots, { country, language }) {
  const perProduct = SEARCHES_PER_PRODUCT;
  if (!deps.cache || !deps.repo.getSearchCache) return snapshots.length * perProduct;
  const fingerprints = snapshots.map((s) => deps.cache.lensFingerprint({
    imageUrl: s.image_url_snapshot, country, language,
  }));
  const plan = await deps.cache.planSpend(deps.repo, fingerprints);
  return plan.live_searches * perProduct;
}

function publicQuota(a) {
  return {
    key_slot: a.key_slot, configured: a.configured, reachable: a.reachable,
    plan_name: a.plan_name, total_searches_left: a.total_searches_left,
    this_month_usage: a.this_month_usage, error_safe: a.error_safe,
  };
}

// ═══════════════════════════ 2. ADVANCE ════════════════════════════════════

/** Do ONE unit of work (one product, one Lens search) and return. */
async function advanceRun(deps, runId) {
  const run = await deps.repo.getRun(runId);
  if (!run) { const e = new Error('Run not found.'); e.status = 404; e.code = 'LENS_RUN_NOT_FOUND'; throw e; }
  if (RUN_TERMINAL.includes(run.status)) {
    return { done: true, status: run.status, counts: await deps.repo.recount(runId) };
  }

  const claimed = await deps.repo.claimNextProduct(runId);
  if (!claimed) {
    const counts = await deps.repo.recount(runId);
    if (counts.pending > 0) return { done: false, status: run.status, counts, waiting_on_other_worker: true };
    return finishRun(deps, runId, counts);
  }

  try {
    const outcome = await runOneProduct(deps, run, claimed);
    await deps.repo.completeProduct(claimed.run_product_id, outcome);
    if (outcome.results && outcome.results.length) {
      await deps.repo.insertCompetitorResults(runId, claimed.run_product_id, outcome.results);
    }
  } catch (e) {
    // ONE product failing must never kill the run.
    await deps.repo.completeProduct(claimed.run_product_id, {
      state: PRODUCT_STATE.FAILED,
      error_code: e.code || 'LENS_PRODUCT_ERROR',
      error_detail_safe: 'Something went wrong processing this product.',
    });
  }

  const counts = await deps.repo.recount(runId);
  if (counts.pending === 0) return finishRun(deps, runId, counts);
  await deps.repo.setRunFields(runId, { status: RUN_STATE.SEARCHING_PRODUCTS });
  return { done: false, status: RUN_STATE.SEARCHING_PRODUCTS, counts };
}

async function finishRun(deps, runId, counts) {
  const status = counts.success === 0 && counts.total > 0 && counts.failed === counts.total
    ? RUN_STATE.FAILED
    : (counts.no_match + counts.failed + counts.missing_image) > 0
      ? RUN_STATE.COMPLETED_WITH_WARNINGS
      : RUN_STATE.COMPLETED;
  await deps.repo.setRunFields(runId, { status, status_detail: null, completed_at: new Date() });
  return { done: true, status, counts };
}

/**
 * Process ONE claimed product: resolve the key slot, call SerpAPI with the
 * credit-safe retry policy, normalize the response, mark self/duplicate
 * results. Returns the fields repo.completeProduct expects, plus `results`.
 */
async function runOneProduct(deps, run, cp) {
  if (!cp.image_url_snapshot) {
    return { state: PRODUCT_STATE.MISSING_IMAGE, error_code: 'LENS_MISSING_IMAGE', error_detail_safe: 'No product image was available.', results: [] };
  }

  // ── 28-day search evidence cache, checked BEFORE spending any credit ──────
  // A fresh hit for this exact (engine, image, country, language) fingerprint
  // costs zero SerpAPI searches. A changed image produces a different
  // fingerprint and is therefore re-searched automatically.
  const fingerprint = deps.cache && deps.cache.lensFingerprint({
    imageUrl: cp.image_url_snapshot, country: run.country, language: run.language,
  });
  if (fingerprint && deps.repo.getSearchCache) {
    const hit = await deps.cache.lookup(deps.repo, fingerprint);
    if (hit.hit) {
      const cached = Array.isArray(hit.results) ? hit.results : [];
      await deps.repo.incrementRunCounter(run.run_id, 'cached_searches_used', 1).catch(() => {});
      if (!cached.length) {
        return { state: PRODUCT_STATE.NO_VISUAL_MATCHES, provider: 'SERPAPI_CACHE', result_count: 0, results: [], from_cache: true };
      }
      return {
        state: PRODUCT_STATE.SUCCESS,
        provider: 'SERPAPI_CACHE',
        result_count: cached.length,
        results: await decideCompetitors(deps, cp, cached),
        from_cache: true,
      };
    }
  }

  const slot = await resolveKeySlot(deps, run.run_id);
  if (!slot) {
    return { state: PRODUCT_STATE.FAILED, error_code: ERRORS.INSUFFICIENT_QUOTA, error_detail_safe: 'Search credits ran out during this run.', results: [] };
  }

  let attempt = await callWithRetry(deps, { imageUrl: cp.image_url_snapshot, keySlot: slot, country: run.country, language: run.language }, run.run_id, cp.run_product_id);

  // RATE_LIMITED / QUOTA_EXHAUSTED -> try the other slot ONCE.
  if (attempt.status === 'RATE_LIMITED' || attempt.status === 'QUOTA_EXHAUSTED') {
    const other = deps.quota.otherSlot(slot);
    if (other) {
      attempt = await callWithRetry(deps, { imageUrl: cp.image_url_snapshot, keySlot: other, country: run.country, language: run.language }, run.run_id, cp.run_product_id);
    }
  }

  await deps.repo.insertProviderAttempt(run.run_id, cp.run_product_id, attempt);

  if (attempt.status === 'SUCCESS') {
    const normalized = attempt.visual_matches.map(deps.normalize.normalizeMatch);
    const marked = deps.normalize.markSelfAndDuplicates(normalized, cp.product_url_snapshot);
    const decided = await decideCompetitors(deps, cp, marked);
    if (fingerprint && deps.cache && deps.repo.putSearchCache) {
      await deps.cache.store(deps.repo, { fingerprint, engine: 'google_lens', keySlot: attempt.key_slot, results: marked }).catch(() => {});
    }
    return {
      state: PRODUCT_STATE.SUCCESS,
      provider: 'SERPAPI',
      provider_search_id: attempt.search_id,
      result_count: decided.length,
      results: decided,
    };
  }
  if (attempt.status === 'NO_VISUAL_MATCHES') {
    if (fingerprint && deps.cache && deps.repo.putSearchCache) {
      await deps.cache.store(deps.repo, { fingerprint, engine: 'google_lens', keySlot: attempt.key_slot, results: [] }).catch(() => {});
    }
    return { state: PRODUCT_STATE.NO_VISUAL_MATCHES, provider: 'SERPAPI', provider_search_id: attempt.search_id, result_count: 0, results: [] };
  }
  return {
    state: PRODUCT_STATE.FAILED,
    provider: 'SERPAPI',
    provider_search_id: attempt.search_id,
    error_code: attempt.error_code || attempt.status,
    error_detail_safe: attempt.error_detail_safe || 'The search provider could not be reached.',
    results: [],
  };
}

/**
 * Attach the automatic include/exclude decision to every match BEFORE it is
 * persisted (weekly-automation prompt §14). This replaces the previous
 * NEEDS_REVIEW-by-default human gate: nothing in the normal path waits for a
 * person. If the filter is not wired in (older callers/tests), results are
 * stored exactly as before.
 */
async function decideCompetitors(deps, cp, results) {
  if (!deps.competitorFilter) return results;
  const ownFacts = [cp.product_type_snapshot, cp.product_title_snapshot]
    .concat((cp.attribute_snapshot || []).map((a) => a && a.value))
    .filter(Boolean)
    .map(String);
  const { decided } = deps.competitorFilter.decideAll(results, cp, { ownFacts });
  return decided;
}

/** One TIMEOUT retry, same slot, same params — nothing else auto-retries. */
async function callWithRetry(deps, params, runId, runProductId) {
  const first = await deps.serpapi.searchLens(params);
  if (first.status !== 'TIMEOUT') return first;
  await deps.repo.insertProviderAttempt(runId, runProductId, first);
  return deps.serpapi.searchLens(params);
}

/**
 * Decide which key slot the NEXT search in this run should use.
 * First search of the run: whichever slot has the strongest balance
 * (a fresh, free Account API check). Later searches: keep using the slot the
 * run has been using, unless its most recent attempt was RATE_LIMITED /
 * QUOTA_EXHAUSTED, in which case switch to the other configured slot.
 */
async function resolveKeySlot(deps, runId) {
  const last = await deps.repo.getLastAttemptForRun(runId);
  if (!last) {
    const statuses = await deps.quota.checkAllAccounts();
    return deps.quota.selectStartingSlot(statuses);
  }
  if (last.status === 'RATE_LIMITED' || last.status === 'QUOTA_EXHAUSTED') {
    return deps.quota.otherSlot(last.key_slot);
  }
  return last.key_slot;
}

module.exports = {
  realDeps, createRun, advanceRun, finishRun, runOneProduct, resolveKeySlot, publicQuota,
  decideCompetitors, countUncachedSearches,
};
