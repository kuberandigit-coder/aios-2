'use strict';

// lib/lens-keywords/attributes.js
//
// Stage 8 — Product Attribute Validation. Pure logic over a keyword
// candidate and the product's Component SOT attribute snapshot (captured at
// run creation from configurator.components_sot_* — see sql.js). No
// database call here; the snapshot is what makes a stored run reproducible.
//
// STATUS VOCABULARY (governing prompt §29) — exactly these five, no others:
//   MATCHED_FACT           — a factual claim that agrees with the SOT value
//   CONFLICT                — a factual claim that DISAGREES with the SOT value
//   UNVERIFIED_FACT          — a factual-shaped claim with no SOT row to check
//                              against (governing prompt §30 — 2.2%-4.5%
//                              catalogue coverage is proven, not hidden)
//   NON_FACTUAL_SEARCH_TERM   — product type / style / search-intent language,
//                              usable without a factual check
//   BRAND_EXCLUDED             — a detected competitor brand token

const STATUS = Object.freeze({
  MATCHED_FACT: 'MATCHED_FACT',
  CONFLICT: 'CONFLICT',
  UNVERIFIED_FACT: 'UNVERIFIED_FACT',
  NON_FACTUAL_SEARCH_TERM: 'NON_FACTUAL_SEARCH_TERM',
  BRAND_EXCLUDED: 'BRAND_EXCLUDED',
});

// Categories that never represent a factual product claim — always allowed
// as search-intent language, never checked against the SOT.
const NON_FACTUAL_CATEGORIES = new Set([
  'Product Type', 'Style / Aesthetic', 'Other Relevant Search Term',
]);

// Categories that DO represent a factual claim and must be checked.
const FACTUAL_CATEGORIES = new Set([
  'Material / Finish', 'Size / Dimension', 'Feature / Modifier',
]);

/**
 * Validate one keyword candidate against a product's Component SOT snapshot.
 * `sotRows`: [{ key, label, value }] as returned by sql.getAttributes().
 */
function validateOne(candidate, sotRows) {
  if (candidate.is_brand) {
    return { status: STATUS.BRAND_EXCLUDED, actual_value: null, reason: 'Detected as a competitor brand token — never used as a product fact.' };
  }
  if (NON_FACTUAL_CATEGORIES.has(candidate.category)) {
    return { status: STATUS.NON_FACTUAL_SEARCH_TERM, actual_value: null, reason: 'Product type / style / search-intent language — not a factual claim.' };
  }
  if (!FACTUAL_CATEGORIES.has(candidate.category)) {
    // Unclassified categories are treated conservatively as unverified
    // rather than silently allowed.
    return { status: STATUS.UNVERIFIED_FACT, actual_value: null, reason: 'Could not be classified as factual or non-factual with the available evidence.' };
  }

  const rows = Array.isArray(sotRows) ? sotRows : [];
  if (!rows.length) {
    return { status: STATUS.UNVERIFIED_FACT, actual_value: null, reason: 'No Component SOT row exists for this SKU — this is a known, proven catalogue-coverage gap (2.2%-4.5%), not an error.' };
  }

  const termTokens = candidate.term.split(' ');
  const haystack = rows.map((r) => String(r.value || '').toLowerCase());
  const matchIdx = haystack.findIndex((v) => termTokens.some((t) => v.includes(t)));

  if (matchIdx !== -1) {
    return { status: STATUS.MATCHED_FACT, actual_value: rows[matchIdx].value, reason: `Agrees with Component SOT ${rows[matchIdx].label || rows[matchIdx].key}.` };
  }

  // The SOT has rows for this SKU but none support this claim — check
  // whether there is a SAME-DIMENSION row that actively disagrees (a real
  // conflict) vs. simply nothing on that dimension (unverified).
  const sameDimension = rows.filter((r) => dimensionMatches(candidate.category, r.key || r.label));
  if (sameDimension.length) {
    return { status: STATUS.CONFLICT, actual_value: sameDimension[0].value, reason: `Component SOT records ${sameDimension[0].label || sameDimension[0].key} = "${sameDimension[0].value}", which this term does not match.` };
  }
  return { status: STATUS.UNVERIFIED_FACT, actual_value: null, reason: 'Component SOT has no row for this attribute dimension on this SKU.' };
}

const DIMENSION_KEYS = {
  'Material / Finish': ['material', 'finish', 'colour', 'color'],
  'Size / Dimension': ['width', 'height', 'diameter', 'dimension', 'size'],
  'Feature / Modifier': ['dimmable', 'ip_rating', 'wattage', 'voltage'],
};

function dimensionMatches(category, keyOrLabel) {
  const keys = DIMENSION_KEYS[category] || [];
  const s = String(keyOrLabel || '').toLowerCase();
  return keys.some((k) => s.includes(k));
}

/** Validate a whole list of candidates in one pass. */
function validateAll(candidates, sotRows) {
  return candidates.map((c) => Object.assign({}, c, validateOne(c, sotRows)));
}

module.exports = { STATUS, NON_FACTUAL_CATEGORIES, FACTUAL_CATEGORIES, validateOne, validateAll };
