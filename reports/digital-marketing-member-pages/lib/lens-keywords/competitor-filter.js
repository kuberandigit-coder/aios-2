'use strict';

// lib/lens-keywords/competitor-filter.js
//
// REQ-DM-2026-08-SAJE01 — automatic competitor inclusion/exclusion
// (weekly-automation prompt §14-16). This REPLACES the previous
// human-approval gate. Every decision here is deterministic arithmetic over
// data SerpAPI actually returned; nothing is an LLM judgment, so every
// outcome is reproducible and unit-testable.
//
// Decision order is deliberate — hard disqualifications are checked BEFORE
// the relevance score, so a self-result or a duplicate can never be admitted
// by scoring well.

const {
  RELEVANCE_WEIGHTS, RELEVANCE_THRESHOLD, MAX_COMPETITORS_PER_PRODUCT, AUTO_DECISION,
} = require('./config');
const { tokenize, LEXICON, STOPWORDS } = require('./keywords');

// Attribute families with a small, mutually-exclusive controlled vocabulary.
// A competitor asserting a DIFFERENT value from the same family than our own
// product's proven value is an attribute conflict — it is a different product,
// not a competing listing of the same one.
const CONFLICT_FAMILIES = Object.freeze({
  material_finish: LEXICON.material_finish,
  product_type: LEXICON.product_type_hints,
});

function contentTokens(text) {
  return new Set(tokenize(text).filter((t) => t.length > 2 && !STOPWORDS.has(t)));
}

function overlapRatio(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach((t) => { if (b.has(t)) shared += 1; });
  return shared / Math.min(a.size, b.size);
}

/** 0..1 — rank 1 scores 1.0 and decays linearly across the returned set. */
function rankScore(rank, totalResults) {
  if (!Number.isFinite(rank) || rank < 1) return 0;
  const span = Math.max(Number(totalResults) || 0, 10);
  return Math.max(0, 1 - (rank - 1) / span);
}

/** 0..1 — how much of the stored evidence shape this result actually filled. */
function completenessScore(r) {
  const fields = [r.title, r.url, r.image_src, r.source_name];
  return fields.filter((f) => f && String(f).trim()).length / fields.length;
}

/**
 * Detect an attribute conflict between our product's proven attribute values
 * and the competitor title. Conservative by design: a conflict is only
 * reported when our side has a KNOWN value from a controlled family and the
 * competitor asserts a different value from that same family while never
 * mentioning ours. Unknown-vs-anything is never a conflict.
 */
function detectAttributeConflict(competitorTitle, ownFacts) {
  const compTokens = contentTokens(competitorTitle);
  const ownTokens = contentTokens((ownFacts || []).join(' '));
  for (const vocabulary of Object.values(CONFLICT_FAMILIES)) {
    const ourValues = vocabulary.filter((v) => ownTokens.has(v));
    if (!ourValues.length) continue; // we have no proven value in this family
    const theirValues = vocabulary.filter((v) => compTokens.has(v));
    if (!theirValues.length) continue; // they assert nothing in this family
    const agrees = theirValues.some((v) => ourValues.includes(v));
    if (!agrees) {
      return { conflict: true, ours: ourValues[0], theirs: theirValues[0] };
    }
  }
  return { conflict: false };
}

/**
 * Score one competitor result 0-100 against the source product.
 * `ownFacts` is the list of verified attribute value strings for our product
 * (Component SOT values plus product_type) — never guessed text.
 */
function scoreCompetitor(result, product, { totalResults, ownFacts } = {}) {
  const w = RELEVANCE_WEIGHTS;
  const ownTitleTokens = contentTokens(product && product.product_title_snapshot);
  const ownTypeTokens = contentTokens(product && product.product_type_snapshot);
  const compTokens = contentTokens(result && result.title);

  const parts = {
    lens_rank: rankScore(result && result.rank, totalResults),
    product_type_overlap: ownTypeTokens.size ? overlapRatio(ownTypeTokens, compTokens)
      // No product_type on record — fall back to the lexicon's product-type
      // hints found in BOTH titles, rather than silently scoring 0 or 1.
      : overlapRatio(
        new Set([...ownTitleTokens].filter((t) => LEXICON.product_type_hints.includes(t))),
        new Set([...compTokens].filter((t) => LEXICON.product_type_hints.includes(t)))
      ),
    title_token_overlap: overlapRatio(ownTitleTokens, compTokens),
    attribute_compatibility: detectAttributeConflict(result && result.title, ownFacts).conflict ? 0 : 1,
    result_completeness: completenessScore(result || {}),
  };

  const score = Math.round(100 * (
    parts.lens_rank * w.LENS_RANK
    + parts.product_type_overlap * w.PRODUCT_TYPE_OVERLAP
    + parts.title_token_overlap * w.TITLE_TOKEN_OVERLAP
    + parts.attribute_compatibility * w.ATTRIBUTE_COMPATIBILITY
    + parts.result_completeness * w.RESULT_COMPLETENESS
  ));

  return { score, parts };
}

/**
 * Decide one competitor result. Hard disqualifications first, then the score
 * threshold. Always returns decision_reasons[] so the UI can show WHY without
 * the reader having to trust the number.
 */
function decideOne(result, product, ctx) {
  const reasons = [];

  if (result.is_self_result) {
    reasons.push('This result is our own listing surfacing in the visual match set, not competitor evidence.');
    return { auto_decision: AUTO_DECISION.EXCLUDED_SELF, auto_score: null, decision_reasons: reasons };
  }
  if (result.is_duplicate) {
    reasons.push('Same canonical destination URL and title as an earlier result in this match set.');
    return { auto_decision: AUTO_DECISION.EXCLUDED_DUPLICATE, auto_score: null, decision_reasons: reasons };
  }
  if (!result.title || !String(result.title).trim() || !result.url) {
    reasons.push('Google Lens returned no usable title or destination URL for this match.');
    return { auto_decision: AUTO_DECISION.EXCLUDED_MISSING_DATA, auto_score: null, decision_reasons: reasons };
  }

  const conflict = detectAttributeConflict(result.title, ctx && ctx.ownFacts);
  const { score, parts } = scoreCompetitor(result, product, ctx);

  if (conflict.conflict) {
    reasons.push(`Attribute conflict: our product is "${conflict.ours}" but this listing is "${conflict.theirs}".`);
    return { auto_decision: AUTO_DECISION.EXCLUDED_ATTRIBUTE_CONFLICT, auto_score: score, decision_reasons: reasons };
  }

  if (score < RELEVANCE_THRESHOLD) {
    reasons.push(`Relevance score ${score}/100 is below the ${RELEVANCE_THRESHOLD} threshold.`);
    if (parts.product_type_overlap === 0) reasons.push('No product-type overlap with our listing.');
    if (parts.title_token_overlap === 0) reasons.push('No meaningful title term shared with our listing.');
    return { auto_decision: AUTO_DECISION.EXCLUDED_IRRELEVANT, auto_score: score, decision_reasons: reasons };
  }

  reasons.push(`Relevance score ${score}/100 (Lens rank ${result.rank}, product-type and title overlap present).`);
  return { auto_decision: AUTO_DECISION.INCLUDED, auto_score: score, decision_reasons: reasons };
}

/**
 * Decide a product's whole Lens match set.
 *
 * Applies the per-result rules, then caps the accepted set at
 * MAX_COMPETITORS_PER_PRODUCT best-scoring results. The lower bound of the
 * 10-15 target band is NOT enforced — a product with only a handful of
 * genuinely relevant matches keeps only those, rather than admitting
 * irrelevant results to hit a number.
 */
function decideAll(results, product, { ownFacts } = {}) {
  const list = results || [];
  const ctx = { totalResults: list.length, ownFacts: ownFacts || [] };

  const decided = list.map((r) => Object.assign({}, r, decideOne(r, product, ctx)));

  const included = decided
    .filter((d) => d.auto_decision === AUTO_DECISION.INCLUDED)
    .sort((a, b) => (b.auto_score - a.auto_score) || (a.rank - b.rank));

  included.slice(MAX_COMPETITORS_PER_PRODUCT).forEach((d) => {
    d.auto_decision = AUTO_DECISION.EXCLUDED_IRRELEVANT;
    d.decision_reasons = d.decision_reasons.concat(
      [`Ranked below the top ${MAX_COMPETITORS_PER_PRODUCT} competitors for this product by relevance score.`]
    );
  });

  const accepted = decided.filter((d) => d.auto_decision === AUTO_DECISION.INCLUDED);
  const summary = decided.reduce((acc, d) => {
    acc[d.auto_decision] = (acc[d.auto_decision] || 0) + 1;
    return acc;
  }, {});

  return { decided, accepted_count: accepted.length, summary };
}

module.exports = {
  CONFLICT_FAMILIES,
  contentTokens,
  overlapRatio,
  rankScore,
  completenessScore,
  detectAttributeConflict,
  scoreCompetitor,
  decideOne,
  decideAll,
};
