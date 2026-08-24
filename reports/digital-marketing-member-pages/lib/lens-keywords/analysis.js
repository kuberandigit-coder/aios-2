'use strict';

// lib/lens-keywords/analysis.js
//
// Stages 4-12 orchestration — the analysis pipeline that runs AFTER the Lens
// search phase (phase1.js) has finished and staff have reviewed competitors.
//
// WHY THIS IS A SEPARATE STATE MACHINE FROM phase1.js
//   Stage 3 requires a HUMAN decision (Include/Exclude) before Stage 4 can
//   correctly run "using only INCLUDED competitor results" (governing prompt
//   §18). Auto-chaining straight from Lens completion into keyword
//   extraction would either run on zero reviewed evidence or force review to
//   happen inside a single unbroken request — neither is correct. Staff
//   explicitly trigger analysis once ready; advanceAnalysis() is then called
//   repeatedly exactly like phase1.advanceRun(), one (product, stage) unit of
//   work per call (governing prompt §46).
//
// CREDIT-SAFE: only phase2_google / phase2_images / phase2_shopping spend a
// SerpAPI search (governing prompt §21 cap: 3 Phase 2 requests/product,
// never repeated once stored). planner spends at most ONE Google Ads API
// call per product, for the single Phase 1 primary keyword only — this cap
// is a deliberate, LOGGED scope decision (not a silent truncation): Stage 26
// says "preserve the relation" for each product's seed, and bounding to one
// seed keeps a 15-product run's Planner cost proportional and predictable.
// Every other stage is local computation over already-stored evidence.

const cfg = require('./config');
const { ANALYSIS_STAGES, ANALYSIS_DONE, ANALYSIS_STATE, ANALYSIS_TERMINAL } = cfg;

function realDeps() {
  const phase1 = require('./phase1');
  return Object.assign(phase1.realDeps(), {
    keywords: require('./keywords'),
    attributes: require('./attributes'),
    title: require('./title'),
    altText: require('./alt-text'),
    gemma: require('./gemma'),
    finalOutput: require('./final-output'),
    googleAds: require('./google-ads'),
    keywordPlannerApi: require('./keyword-planner'),
    keywordPlanner: { getSuggestions: require('./keyword-planner').getSuggestions },
  });
}

// ═══════════════════════════ START ═════════════════════════════════════════

/**
 * Begin (or resume) the analysis pipeline for a run. Only callable once the
 * Lens phase is terminal. Idempotent: calling it again on an already-started
 * run is a harmless no-op.
 */
async function startAnalysis(deps, runId) {
  const run = await deps.repo.getRun(runId);
  if (!run) { const e = new Error('Run not found.'); e.status = 404; e.code = 'LENS_RUN_NOT_FOUND'; throw e; }
  if (!cfg.RUN_TERMINAL.includes(run.status)) {
    const e = new Error('Complete the Lens search phase before starting keyword analysis.');
    e.status = 400; e.code = cfg.ERRORS.ANALYSIS_NOT_READY; throw e;
  }
  if (run.analysis_status && ANALYSIS_TERMINAL.includes(run.analysis_status)) {
    return { run: await deps.repo.getRun(runId), already_started: true };
  }
  if (!run.analysis_status) {
    await deps.repo.initAnalysisStages(runId, ANALYSIS_STAGES[0]);
    await deps.repo.setAnalysisFields(runId, {
      analysis_status: ANALYSIS_STATE.IN_PROGRESS, analysis_started_at: new Date(),
    });
  }
  return { run: await deps.repo.getRun(runId), already_started: false };
}

// ═══════════════════════════ ADVANCE ═══════════════════════════════════════

async function advanceAnalysis(deps, runId) {
  const run = await deps.repo.getRun(runId);
  if (!run) { const e = new Error('Run not found.'); e.status = 404; e.code = 'LENS_RUN_NOT_FOUND'; throw e; }
  if (!run.analysis_status || ANALYSIS_TERMINAL.includes(run.analysis_status)) {
    return { done: true, status: run.analysis_status, counts: await deps.repo.recountAnalysis(runId) };
  }

  const claimed = await deps.repo.claimNextAnalysisStage(runId);
  if (!claimed) {
    const counts = await deps.repo.recountAnalysis(runId);
    if (counts.pending > 0) return { done: false, status: run.analysis_status, counts, waiting_on_other_worker: true };
    return finishAnalysis(deps, runId, counts);
  }

  const stage = claimed.analysis_stage;
  try {
    const outcome = await runStage(deps, run, claimed, stage);
    const idx = ANALYSIS_STAGES.indexOf(stage);
    const nextStage = idx >= 0 && idx < ANALYSIS_STAGES.length - 1 ? ANALYSIS_STAGES[idx + 1] : ANALYSIS_DONE;
    await deps.repo.advanceProductAnalysisStage(claimed.run_product_id, nextStage, outcome.detail || null);
  } catch (e) {
    // ONE product's ONE stage failing must never kill the run. Release the
    // claim and mark the stage complete-with-error so the pipeline moves on
    // rather than looping forever on the same failing step.
    const idx = ANALYSIS_STAGES.indexOf(stage);
    const nextStage = idx >= 0 && idx < ANALYSIS_STAGES.length - 1 ? ANALYSIS_STAGES[idx + 1] : ANALYSIS_DONE;
    await deps.repo.advanceProductAnalysisStage(claimed.run_product_id, nextStage, `ERROR: ${stage} failed`);
  }

  const counts = await deps.repo.recountAnalysis(runId);
  if (counts.pending === 0) return finishAnalysis(deps, runId, counts);
  return { done: false, status: ANALYSIS_STATE.IN_PROGRESS, counts };
}

async function finishAnalysis(deps, runId, counts) {
  const status = ANALYSIS_STATE.COMPLETED; // per-stage errors are recorded, not escalated to a hard FAILED run
  await deps.repo.setAnalysisFields(runId, { analysis_status: status, analysis_completed_at: new Date() });
  return { done: true, status, counts };
}

// ═══════════════════════════ STAGE IMPLEMENTATIONS ═════════════════════════

async function runStage(deps, run, cp, stage) {
  switch (stage) {
    case 'keyword_analysis': return stageKeywordAnalysis(deps, run, cp);
    case 'phase2_google': return stagePhase2(deps, run, cp, 'google');
    case 'phase2_images': return stagePhase2(deps, run, cp, 'google_images');
    case 'phase2_shopping': return stagePhase2(deps, run, cp, 'google_shopping');
    case 'phase2_keyword_analysis': return stagePhase2KeywordAnalysis(deps, run, cp);
    case 'attribute_validation': return stageAttributeValidation(deps, run, cp);
    case 'planner': return stagePlanner(deps, run, cp);
    case 'title_alt_build': return stageTitleAltBuild(deps, run, cp);
    case 'final_output': return stageFinalOutput(deps, run, cp);
    default: return { detail: `Unknown stage ${stage}` };
  }
}

/** Stage 4/5 — Phase 1 candidates from INCLUDED competitor results only. */
async function stageKeywordAnalysis(deps, run, cp) {
  const included = await deps.repo.getIncludedCompetitorResults(cp.run_product_id);
  const docs = [];
  included.forEach((r) => {
    if (r.h3_heading) docs.push({ text: r.h3_heading, source_name: r.displayed_domain, url: r.url });
    if (r.image_alt) docs.push({ text: r.image_alt, source_name: r.displayed_domain, url: r.url });
  });

  const candidates = deps.keywords.buildCandidates(docs, { currentTitle: cp.product_title_snapshot });
  const top = deps.keywords.topN(candidates, 10);
  await deps.repo.saveCandidates(run.run_id, cp.run_product_id, 'PHASE1', candidates);

  const primary = top[0] || candidates.find((c) => !c.is_brand) || null;
  if (primary) await deps.repo.setProductPrimaryKeyword(cp.run_product_id, primary.term);

  return {
    detail: included.length
      ? `${candidates.length} candidates from ${included.length} included result(s)`
      : 'No included competitor results yet — 0 candidates (review Stage 3 results to improve this)',
  };
}

/** Stage 6 — one Phase 2 SerpAPI search using the Phase 1 primary keyword. */
async function stagePhase2(deps, run, cp, engine) {
  const seed = cp.phase1_primary_keyword;
  if (!seed) {
    return { detail: 'No Phase 1 primary keyword available — Phase 2 search skipped for this product.' };
  }

  // 28-day cache first — a Phase 2 search is re-spent only when the product's
  // Phase 1 primary keyword itself changed (that changes the fingerprint).
  const fingerprint = deps.cache && deps.cache.phase2Fingerprint({
    engine, query: seed, country: run.country, language: run.language,
  });
  if (fingerprint && deps.repo.getSearchCache) {
    const hit = await deps.cache.lookup(deps.repo, fingerprint);
    if (hit.hit) {
      const cached = Array.isArray(hit.results) ? hit.results : [];
      await deps.repo.incrementRunCounter(run.run_id, 'cached_searches_used', 1).catch(() => {});
      if (cached.length) await deps.repo.savePhase2Results(run.run_id, cp.run_product_id, cached);
      return { detail: `${engine}: ${cached.length} result(s) reused from the 28-day search cache (0 credits spent)` };
    }
  }

  const slot = await require('./phase1').resolveKeySlot(deps, run.run_id);
  if (!slot) {
    return { detail: 'Search credits ran out — Phase 2 search skipped for this product.' };
  }

  const caller = engine === 'google' ? deps.serpapi.searchGoogle
    : engine === 'google_images' ? deps.serpapi.searchGoogleImages
    : deps.serpapi.searchGoogleShopping;

  const attempt = await caller({ query: seed, keySlot: slot, country: run.country, language: run.language });
  await deps.repo.insertProviderAttempt(run.run_id, cp.run_product_id, attempt);
  if (attempt.status === 'SUCCESS' || attempt.status === 'NO_VISUAL_MATCHES') {
    await deps.repo.incrementRunCounter(run.run_id, 'phase2_searches_used', 1);
  }

  if (attempt.status !== 'SUCCESS') {
    return { detail: `${engine}: ${attempt.status}` };
  }

  const normalized = attempt.results.map((item) => Object.assign({ engine, seed_keyword: seed }, deps.normalize.normalizePhase2(engine, item)));
  await deps.repo.savePhase2Results(run.run_id, cp.run_product_id, normalized);
  if (fingerprint && deps.cache && deps.repo.putSearchCache) {
    await deps.cache.store(deps.repo, { fingerprint, engine, keySlot: slot, results: normalized }).catch(() => {});
  }
  return { detail: `${engine}: ${normalized.length} result(s)` };
}

/** Stage 6/22 — candidates extracted from all three Phase 2 engines. */
async function stagePhase2KeywordAnalysis(deps, run, cp) {
  const results = await deps.repo.getPhase2Results(cp.run_product_id);
  const docs = results
    .filter((r) => r.title)
    .map((r) => ({ text: r.title, source_name: r.displayed_domain, url: r.url }));

  const candidates = deps.keywords.buildCandidates(docs, { currentTitle: cp.product_title_snapshot });
  await deps.repo.saveCandidates(run.run_id, cp.run_product_id, 'PHASE2', candidates);
  return { detail: `${candidates.length} Phase 2 candidates from ${results.length} result(s)` };
}

/** Stage 8 — validate Phase 1 + Phase 2 candidates against the Component SOT snapshot. */
async function stageAttributeValidation(deps, run, cp) {
  const phase1 = await deps.repo.getCandidates(cp.run_product_id, 'PHASE1');
  const phase2 = await deps.repo.getCandidates(cp.run_product_id, 'PHASE2');
  const sotRows = cp.attribute_snapshot || [];

  const validated1 = deps.attributes.validateAll(phase1, sotRows);
  const validated2 = deps.attributes.validateAll(phase2, sotRows);

  const rows = [...validated1, ...validated2].map((c) => ({
    keyword_id: c.keyword_id || null, term: c.term, category: c.category,
    status: c.status, actual_value: c.actual_value, reason: c.reason,
  }));
  await deps.repo.saveAttributeValidations(run.run_id, cp.run_product_id, rows);
  return { detail: `${rows.length} terms validated` };
}

/**
 * Stage 7 — Keyword Planner, capped to the Phase 1 primary keyword only
 * (see module header for why). google-ads.js evidence is fetched here too
 * (cheap, Ledsone read-only) and stored alongside for the final output step.
 */
async function stagePlanner(deps, run, cp) {
  const seed = cp.phase1_primary_keyword;
  if (!seed) return { detail: 'No Phase 1 primary keyword — Planner skipped for this product.' };

  const result = await deps.keywordPlanner.getSuggestions(deps, {
    seedKeyword: seed, country: run.country, language: run.language,
    runId: run.run_id, runProductId: cp.run_product_id,
  });
  if (result.status !== 'BLOCKED_CONFIG_REQUIRED' && result.status !== 'CACHED') {
    await deps.repo.incrementRunCounter(run.run_id, 'planner_calls_used', 1);
  }
  return { detail: `Planner: ${result.status}` };
}

/**
 * Stage 9/10 — title + alt text.
 *
 * Gemma 4 writes them in ONE combined call from VERIFIED evidence only, then
 * deterministic validation decides whether the output is usable. A model
 * failure, a parse failure or two validation failures fall back to the
 * unchanged deterministic builders (title.js / alt-text.js). The generation
 * evidence — source, model, prompt version, input hash, validation status —
 * is persisted either way, and never the API key.
 */
async function stageTitleAltBuild(deps, run, cp) {
  const phase1 = await deps.repo.getCandidates(cp.run_product_id, 'PHASE1');
  const phase2 = await deps.repo.getCandidates(cp.run_product_id, 'PHASE2');
  const validations = await deps.repo.getAttributeValidations(cp.run_product_id);
  const byTerm = new Map(validations.map((v) => [v.term, v]));
  const validated = [...phase1, ...phase2].map((c) => Object.assign({}, c, {
    status: (byTerm.get(c.term) || {}).status || 'UNVERIFIED_FACT',
  }));

  const input = {
    currentTitle: cp.product_title_snapshot,
    currentAltText: null,
    productType: cp.product_type_snapshot,
    sku: cp.sku,
    validated,
  };

  const generated = deps.gemma
    ? await deps.gemma.generateCopy(input)
    : deps.gemma_disabled_fallback || null;

  const result = generated || Object.assign(
    { generation_source: cfg.GENERATION_SOURCE.SCRIPT_FALLBACK, validation_status: 'SCRIPT_ONLY' },
    scriptOnly(deps, input)
  );

  await deps.repo.upsertFinalTitle(run.run_id, cp.run_product_id, {
    current_title: cp.product_title_snapshot || null,
    suggested_title: result.title,
    char_count: result.character_count || 0,
    keywords_used: result.keywords_used || [],
    status: result.title_status || (result.title ? 'SUGGESTED' : 'NEEDS_REVIEW'),
  });
  await deps.repo.upsertFinalAltText(run.run_id, cp.run_product_id, {
    current_alt_text: null,
    suggested_alt_text: result.alt_text,
    keywords_used: result.keywords_used || [],
    status: result.alt_text_status || (result.alt_text ? 'SUGGESTED' : 'NEEDS_REVIEW'),
  });

  if (deps.repo.saveGeneration) {
    await deps.repo.saveGeneration(run.run_id, cp.run_product_id, result);
  }

  return { detail: `title=${result.generation_source} (${result.validation_status}), ${result.character_count || 0} chars` };
}

function scriptOnly(deps, input) {
  const t = deps.title.build(input);
  const a = deps.altText.build(input);
  return {
    title: t.suggested_title, alt_text: a.suggested_alt_text,
    character_count: t.char_count || 0, keywords_used: t.keywords_used || [],
    title_status: t.status, alt_text_status: a.status,
    validation_failures: [], rationale: t.reason || null,
  };
}

/** Stage 11/12 — final deduplicated Ads keyword output. */
async function stageFinalOutput(deps, run, cp) {
  const phase1 = await deps.repo.getCandidates(cp.run_product_id, 'PHASE1');
  const phase2 = await deps.repo.getCandidates(cp.run_product_id, 'PHASE2');
  const validations = await deps.repo.getAttributeValidations(cp.run_product_id);
  const byTerm = new Map(validations.map((v) => [v.term, v]));
  const attach = (c) => Object.assign({}, c, { status: (byTerm.get(c.term) || {}).status || 'UNVERIFIED_FACT' });

  const planner = await deps.repo.getPlannerSuggestionsForRunProduct(cp.run_product_id);
  const finalTitle = await deps.repo.getFinalTitle(cp.run_product_id);

  const client = deps.ledsoneClient();
  let existingEvidence = {};
  try {
    await client.connect();
    const allTerms = [...phase1, ...phase2].map((c) => c.term);
    existingEvidence = await deps.googleAds.findExistingEvidence(client, allTerms);
  } finally {
    await client.end().catch(() => {});
  }

  const rows = deps.finalOutput.build({
    phase1Validated: phase1.map(attach), phase2Validated: phase2.map(attach),
    plannerSuggestions: planner, titleKeywords: (finalTitle && finalTitle.keywords_used) || [],
    existingAdsEvidence: existingEvidence,
  });
  await deps.repo.saveFinalAdsKeywords(run.run_id, cp.run_product_id, rows);
  return { detail: `${rows.length} final keyword(s)` };
}

module.exports = { realDeps, startAnalysis, advanceAnalysis, finishAnalysis, runStage };
