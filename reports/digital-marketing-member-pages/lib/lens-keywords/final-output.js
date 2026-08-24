'use strict';

// lib/lens-keywords/final-output.js
//
// Stage 11 — Final Google Ads Keyword Output. Combines and deduplicates:
//   validated Phase 1 keywords + validated Phase 2 keywords +
//   Planner suggestions + safe final-title keywords
// excluding BRAND_EXCLUDED / CONFLICT / UNVERIFIED_FACT terms, and keeping
// full provenance per keyword (governing prompt §33). Never launches a
// campaign — this produces a reviewable list only.

const { normalizeText } = require('./keywords');

/**
 * @param {object} p
 * @param {Array} p.phase1Validated   validated Phase 1 candidates (attributes.validateAll output)
 * @param {Array} p.phase2Validated   validated Phase 2 candidates (same shape)
 * @param {Array} p.plannerSuggestions rows from keyword-planner.getSuggestions()
 * @param {Array} p.titleKeywords     keywords_used from title.build()
 * @param {object} p.existingAdsEvidence normalized_term -> google-ads.js evidence
 */
function build({ phase1Validated, phase2Validated, plannerSuggestions, titleKeywords, existingAdsEvidence }) {
  const excludedStatuses = new Set(['BRAND_EXCLUDED', 'CONFLICT']);
  const byTerm = new Map();

  function upsert(term, source, extra) {
    const norm = normalizeText(term);
    if (!norm) return;
    if (!byTerm.has(norm)) {
      byTerm.set(norm, {
        keyword: term, normalized_keyword: norm, source,
        phase1_frequency: null, phase2_source: null, planner_metrics: null,
        existing_ads_evidence: (existingAdsEvidence && existingAdsEvidence[norm]) || null,
        attribute_status: null, final_status: 'INCLUDED', exclusion_reason: null,
      });
    }
    Object.assign(byTerm.get(norm), extra);
  }

  (phase1Validated || []).forEach((c) => {
    if (excludedStatuses.has(c.status)) return;
    upsert(c.term, 'PHASE1', { phase1_frequency: c.title_frequency, attribute_status: c.status });
  });

  (phase2Validated || []).forEach((c) => {
    if (excludedStatuses.has(c.status)) return;
    upsert(c.term, byTerm.has(normalizeText(c.term)) ? byTerm.get(normalizeText(c.term)).source : 'PHASE2',
      { phase2_source: c.category || 'Phase 2', attribute_status: c.status });
  });

  (plannerSuggestions || []).forEach((s) => {
    const term = s.matched_keyword || s.new_suggestion;
    if (!term) return;
    const existing = byTerm.get(normalizeText(term));
    upsert(term, existing ? existing.source : 'PLANNER', {
      planner_metrics: {
        avg_monthly_searches: s.avg_monthly_searches, competition: s.competition,
        competition_index: s.competition_index, low_top_of_page_bid: s.low_top_of_page_bid,
        high_top_of_page_bid: s.high_top_of_page_bid,
      },
    });
  });

  (titleKeywords || []).forEach((term) => {
    const existing = byTerm.get(normalizeText(term));
    upsert(term, existing ? existing.source : 'TITLE', {});
  });

  // Mark anything that carries a CONFLICT/UNVERIFIED_FACT attribute status
  // (possible if it entered via Planner/title after already being excluded
  // elsewhere) as excluded rather than silently keeping it.
  const rows = [...byTerm.values()];
  rows.forEach((r) => {
    if (r.attribute_status === 'UNVERIFIED_FACT') {
      r.final_status = 'EXCLUDED';
      r.exclusion_reason = 'Unverified product fact — excluded from final Ads output as a precaution.';
    }
  });

  return rows.sort((a, b) => (b.phase1_frequency || 0) - (a.phase1_frequency || 0));
}

/** Assembles the Stage 12 saved-output/reference report for one product. */
function buildReport({ runProduct, competitorResults, phase1Candidates, phase2Results, plannerSuggestions, attributeValidations, finalTitle, finalAltText, finalAdsKeywords }) {
  return {
    sku: runProduct.sku,
    product_title: runProduct.product_title_snapshot,
    product_image: runProduct.image_url_snapshot,
    product_url: runProduct.product_url_snapshot,
    competitor_evidence: competitorResults || [],
    phase1_keywords: phase1Candidates || [],
    phase2_results: phase2Results || [],
    planner_suggestions: plannerSuggestions || [],
    attribute_validation: attributeValidations || [],
    final_title: finalTitle || null,
    final_alt_text: finalAltText || null,
    final_ads_keywords: finalAdsKeywords || [],
    source_urls: [...new Set((competitorResults || []).map((r) => r.url).filter(Boolean))],
    generated_at: new Date().toISOString(),
  };
}

module.exports = { build, buildReport };
