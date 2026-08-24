'use strict';

// lib/lens-keywords/eligibility.js
//
// REQ-DM-2026-08-SAJE01 — automatic product completeness scoring & selection
// (weekly-automation prompt §7-8). Deterministic and testable: no LLM
// judgment anywhere in this file.
//
// Two-step process:
//   1. Mandatory eligibility gate — a product missing any REQUIRED field is
//      excluded outright, regardless of score. Never substitutes another
//      product's data to pass the gate (governing rule carried over from
//      sql.classifyDataQuality).
//   2. 100-point completeness score (SELECTION_WEIGHTS) — ranks the products
//      that DID pass the gate, so the top MAX_PRODUCTS_PER_RUN are chosen
//      transparently instead of by first-come-first-served order.

const { SELECTION_WEIGHTS, MAX_PRODUCTS_PER_RUN } = require('./config');

function isPlaceholderTitle(title) {
  if (!title) return true;
  const t = String(title).trim();
  if (t.length < 8) return true;
  if (!/[a-zA-Z]{3,}/.test(t)) return true; // must contain a real word, not just codes/numbers
  if (/^(untitled|no title|n\/a|test|placeholder)$/i.test(t)) return true;
  return false;
}

function isValidUrl(u) {
  if (!u) return false;
  try {
    const parsed = new URL(String(u));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const isValidImageUrl = isValidUrl;

/**
 * Mandatory gate: a product missing any of these is excluded outright, never
 * scored, never padded in to reach the target count. `reasons` is always
 * populated so the UI's Selection Reason column can show exactly why.
 */
function gateProduct(p) {
  const reasons = [];
  const hasSku = !!(p && p.sku && String(p.sku).trim());
  const hasImage = isValidImageUrl(p && p.main_image_url);
  const hasTitle = !isPlaceholderTitle(p && p.title);
  const hasUrl = isValidUrl(p && p.listing_url);

  if (!hasSku) reasons.push('No resolvable SKU on record (Shopify parent/child data gap).');
  if (!hasImage) reasons.push('No valid product image URL on record.');
  if (!hasTitle) reasons.push('No meaningful product title on record.');
  if (!hasUrl) reasons.push('No valid product URL on record.');

  return { eligible: hasSku && hasImage && hasTitle && hasUrl, reasons };
}

/**
 * 100-point completeness score for a product that already passed the gate.
 * `hasAttributeEvidence` / `hasAdsEvidence` come from a bulk lookup the
 * caller does once for the whole candidate set (sql.getAttributeCoverage, a
 * bulk existing-Ads-activity check) — never one query per product.
 */
function scoreProduct(p, { hasAttributeEvidence, hasAdsEvidence } = {}) {
  const w = SELECTION_WEIGHTS;
  const breakdown = {
    same_sku_identity: (p && p.sku && p.item_id) ? w.SAME_SKU_IDENTITY : 0,
    valid_image: isValidImageUrl(p && p.main_image_url) ? w.VALID_IMAGE : 0,
    meaningful_title: !isPlaceholderTitle(p && p.title) ? w.MEANINGFUL_TITLE : 0,
    valid_url: isValidUrl(p && p.listing_url) ? w.VALID_URL : 0,
    attribute_evidence: hasAttributeEvidence ? w.ATTRIBUTE_EVIDENCE : 0,
    existing_ads_evidence: hasAdsEvidence ? w.EXISTING_ADS_EVIDENCE : 0,
  };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score, breakdown };
}

function buildSelectionReason(score, breakdown, gate) {
  if (gate) return gate.reasons.join(' ');
  const missing = [];
  if (breakdown.attribute_evidence === 0) missing.push('no Component SOT attribute evidence');
  if (breakdown.existing_ads_evidence === 0) missing.push('no existing Google Ads keyword evidence');
  const base = `Completeness score ${score}/100.`;
  return missing.length ? `${base} Missing: ${missing.join(', ')}.` : `${base} Full evidence coverage.`;
}

/**
 * Evaluate every candidate product, gate the ineligible ones out, score the
 * rest, and select the top `max` (default MAX_PRODUCTS_PER_RUN) by score —
 * ties broken by SKU ascending so the outcome is fully deterministic and
 * reproducible across runs. NEVER pads with an ineligible product to reach
 * the target count — if fewer than `max` qualify, fewer than `max` are
 * selected, and the true counts are reported (§8: "Eligible products: 67 ->
 * Automatically selected: 50 -> Excluded due to missing required product
 * data: 23").
 */
function evaluateAndSelect(products, { attributeCoverage, adsEvidence, max } = {}) {
  const limit = Number.isFinite(max) ? max : MAX_PRODUCTS_PER_RUN;
  const attrSet = attributeCoverage || new Set();
  const adsSet = adsEvidence || new Set();

  const evaluated = (products || []).map((p) => {
    const gate = gateProduct(p);
    if (!gate.eligible) {
      return {
        sku: p.sku || null, product: p, eligible: false, auto_selected: false,
        score: 0, breakdown: null,
        selection_reason: buildSelectionReason(0, null, gate),
      };
    }
    const hasAttributeEvidence = attrSet.has(p.sku);
    const hasAdsEvidence = adsSet.has(p.sku) || adsSet.has(p.item_id);
    const { score, breakdown } = scoreProduct(p, { hasAttributeEvidence, hasAdsEvidence });
    return {
      sku: p.sku, product: p, eligible: true, auto_selected: false,
      score, breakdown,
      selection_reason: buildSelectionReason(score, breakdown, null),
    };
  });

  const eligible = evaluated.filter((e) => e.eligible);
  const ineligible = evaluated.filter((e) => !e.eligible);

  eligible.sort((a, b) => (b.score - a.score) || String(a.sku).localeCompare(String(b.sku)));

  const selected = eligible.slice(0, limit);
  const excludedForCapacity = eligible.slice(limit);
  selected.forEach((e) => { e.auto_selected = true; });
  excludedForCapacity.forEach((e) => {
    e.selection_reason = `${e.selection_reason} Not selected — ranked below the top ${limit} by completeness score.`;
  });

  return {
    total_candidates: (products || []).length,
    eligible_count: eligible.length,
    selected_count: selected.length,
    excluded_capacity_count: excludedForCapacity.length,
    excluded_ineligible_count: ineligible.length,
    selected,
    excluded_capacity: excludedForCapacity,
    excluded_ineligible: ineligible,
    all: evaluated,
  };
}

module.exports = {
  isPlaceholderTitle,
  isValidUrl,
  isValidImageUrl,
  gateProduct,
  scoreProduct,
  evaluateAndSelect,
};
