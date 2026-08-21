'use strict';

// lib/stpm/targeting.js
//
// REQ-DM-2026-08-MAHI01 — Keyword Opportunity evidence (requirement Module 18).
//
// WHY THIS IS DELIBERATELY CAUTIOUS
//   The requirement defines a Keyword Opportunity as a relevant / high-performing
//   search term that is "not currently targeted". For an ordinary Search campaign
//   that is a keyword lookup. Mahima has NO Search campaigns — the group is 12
//   Performance Max + 4 Shopping, and neither type uses keyword targeting. So
//   `google_ads.keywords` is empty for Mahima BY DESIGN, not because data is
//   missing.
//
//   The naive reading — "no keyword row exists, therefore every converting term
//   is an opportunity" — would label essentially every term an opportunity and
//   make the column worthless. The full-LEDSONE audit showed targeting really is
//   knowable here, but at PRODUCT level, from three independent sources:
//     * asset_group_listing_group_filters — declared PMax targeting rules
//     * ad_group_products                 — Shopping product targeting (+ is_excluded)
//     * product_performance               — which products actually served
//   plus asset_group_signals.search_theme_text as the PMax "theme" hint.
//
//   Mapping a SEARCH TERM onto that product-level notion is a business-semantic
//   decision that has not been ratified. So this module:
//     * collects the evidence and records it;
//     * sets `opportunity_candidate` when a term looks promising;
//     * sets the final `keyword_opportunity` flag ONLY when the evidence is
//       deterministic — the term performs AND is demonstrably not represented by
//       any available targeting evidence AND we could map it to a real product.
//   Anything short of that stays Decision = Keep with
//   "Opportunity candidate — manual validation required".

const { normalizeText, containsPhrase } = require('./normalize');

/**
 * Index the targeting evidence once per run.
 *
 * @param {Array} rows from sql.fetchTargetingEvidence(): { kind, value }
 * @param {Array<string>} servedProductKeys from sql.fetchServedProducts()
 */
function buildTargetingIndex(rows, servedProductKeys) {
  const searchThemes = [];
  const listingGroupTypes = [];

  for (const r of rows || []) {
    const v = normalizeText(r.value);
    if (!v) continue;
    if (r.kind === 'search_theme') searchThemes.push(v);
    else if (r.kind === 'listing_group_type') listingGroupTypes.push(v);
  }

  return {
    searchThemes: Array.from(new Set(searchThemes)),
    listingGroupTypes: Array.from(new Set(listingGroupTypes)),
    servedProducts: new Set((servedProductKeys || []).map(String)),
    counts: {
      search_themes: new Set(searchThemes).size,
      listing_group_types: new Set(listingGroupTypes).size,
      served_products: new Set((servedProductKeys || []).map(String)).size,
    },
    // Recorded so the UI can explain WHY keyword evidence is absent rather than
    // implying the data failed to load.
    keyword_targeting_available: false,
    keyword_targeting_note:
      'Mahima runs Performance Max and Shopping campaigns, which do not use keyword targeting. ' +
      'Targeting is evaluated from product and search-theme evidence instead.',
  };
}

/**
 * Is this term already represented by existing targeting evidence?
 * Returns the matching evidence, or null.
 */
function coveredByTargeting(normalizedTerm, index) {
  if (!normalizedTerm || !index) return null;

  // A search theme covers the term if either contains the other as a whole
  // phrase — "lampenschirm" covers "lampenschirm kupfer" in intent terms, and a
  // theme longer than the term is also a match.
  for (const theme of index.searchThemes) {
    if (containsPhrase(normalizedTerm, theme) || containsPhrase(theme, normalizedTerm)) {
      return { kind: 'search_theme', value: theme };
    }
  }
  for (const t of index.listingGroupTypes) {
    if (containsPhrase(normalizedTerm, t) || containsPhrase(t, normalizedTerm)) {
      return { kind: 'listing_group_type', value: t };
    }
  }
  return null;
}

/**
 * Evaluate opportunity status for one term.
 *
 * @param {object} a
 *   row               — aggregated term row (clicks, conversions, roas, ...)
 *   normalizedTerm    — normalized search term
 *   index             — buildTargetingIndex result
 *   match             — matching.matchTerm result (may be a No Match)
 *   intentLabel       — from intent.classify
 *
 * Returns { keyword_opportunity, opportunity_candidate, opportunity_reason,
 *           targeting_evidence }
 */
function evaluateOpportunity(a) {
  const row = a.row || {};
  const index = a.index;
  const match = a.match || {};
  const term = a.normalizedTerm;

  const conversions = Number(row.conversions) || 0;
  const clicks = Number(row.clicks) || 0;
  const roas = row.roas === null || row.roas === undefined ? null : Number(row.roas);

  const covered = coveredByTargeting(term, index);
  const productMatched = !!match.product_id;
  const productServed = productMatched && index && index.servedProducts.has(String(match.product_id));

  const evidence = {
    covered_by: covered,
    product_matched: productMatched,
    product_id: match.product_id || null,
    product_already_serving: productServed,
    keyword_targeting_available: index ? index.keyword_targeting_available : false,
    keyword_targeting_note: index ? index.keyword_targeting_note : null,
    search_themes_checked: index ? index.counts.search_themes : 0,
    listing_group_types_checked: index ? index.counts.listing_group_types : 0,
    served_products_checked: index ? index.counts.served_products : 0,
    semantics_ratified: false,
  };

  // Non-product intent can never be an opportunity, whatever it earned.
  if (a.intentLabel === 'non_product' || a.intentLabel === 'informational') {
    return {
      keyword_opportunity: false,
      opportunity_candidate: false,
      opportunity_reason: null,
      targeting_evidence: evidence,
    };
  }

  // "Relevant / high-performing" — the requirement gives no threshold, so the
  // only non-arbitrary reading is the evidence the requirement itself relies on
  // elsewhere: the term converted.
  const performing = conversions > 0;
  if (!performing) {
    return {
      keyword_opportunity: false,
      opportunity_candidate: false,
      opportunity_reason: null,
      targeting_evidence: evidence,
    };
  }

  if (covered) {
    return {
      keyword_opportunity: false,
      opportunity_candidate: false,
      opportunity_reason:
        `Already represented by an existing ${covered.kind === 'search_theme' ? 'search theme' : 'product-group target'}: "${covered.value}".`,
      targeting_evidence: evidence,
    };
  }

  // Deterministic opportunity: it converted, nothing in the available targeting
  // evidence represents it, and we can point at the product it should sit
  // against. Without the product we cannot prove the gap, only suspect it.
  if (productMatched && !productServed) {
    return {
      keyword_opportunity: true,
      opportunity_candidate: true,
      opportunity_reason:
        `Converted ${round2(conversions)} time${conversions === 1 ? '' : 's'}` +
        (roas !== null ? ` at ROAS ${round2(roas)}` : '') +
        `, is not covered by any current search theme or product-group target, ` +
        `and maps to a product that did not serve in this period.`,
      targeting_evidence: evidence,
    };
  }

  // Converted and uncovered, but we cannot prove the targeting gap — surface it
  // for a human instead of asserting it.
  return {
    keyword_opportunity: false,
    opportunity_candidate: true,
    opportunity_reason:
      `Converted ${round2(conversions)} time${conversions === 1 ? '' : 's'} from ${clicks} click${clicks === 1 ? '' : 's'} ` +
      `and is not covered by any current search theme or product-group target. ` +
      (productMatched
        ? 'The matched product already serves in these campaigns, so this may already be covered.'
        : 'No Shopify product could be matched, so the targeting gap cannot be confirmed automatically.'),
    targeting_evidence: evidence,
  };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = { buildTargetingIndex, coveredByTargeting, evaluateOpportunity };
