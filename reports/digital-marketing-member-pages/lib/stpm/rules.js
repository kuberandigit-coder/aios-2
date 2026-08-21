'use strict';

// lib/stpm/rules.js
//
// REQ-DM-2026-08-MAHI01 — the six waste rules (§5), the three performance
// statuses (§6), and a deliberately CONSERVATIVE decision engine.
//
// THRESHOLDS ARE REPRODUCED EXACTLY AS WRITTEN. Comparisons are strict:
//   Clicks > 15        (16 fires, 15 does not)
//   Cost   > 10        (10.01 fires, 10.00 does not)
//   Impressions > 500  (501 is eligible, 500 is not)
//   CTR    < 0.5       (0.49 fires, 0.50 does not)
//   ROAS   < 1         (0.99 fires, 1.00 does not)
// Do not relax > to >= anywhere in this file.
//
// WHY THE DECISION ENGINE IS CONSERVATIVE
//   The requirement says "apply rule hierarchy" (Module 17) but never states the
//   order, and discovery found six real combinations with no defined answer —
//   e.g. a term that is `Working` on conversions but fails the ROAS rule, or a
//   historically profitable `Dropped` term that trips the high-clicks rule.
//   Inventing a precedence here would bury an unratified business decision in
//   code, which is exactly what BLOS governance forbids.
//
//   So this evaluator does two separate things:
//     1. records EVERY rule that fired, as structured evidence;
//     2. maps to a Decision only where the requirement is unambiguous.
//
//   Low CTR alone is the clearest example. The requirement's outcome for it is
//   "Review Search Intent" — a review instruction, not a negative. Since
//   `Review` is not an allowed Decision value, a low-CTR-only term stays
//   Decision = Keep with the waste reason attached and is flagged for staff
//   attention. That is a presentation choice, not a new threshold.
//
//   Nothing here ever sets Review Status. Automated recommendations stay
//   Pending until a human acts.

const {
  THRESHOLDS, DECISION, PERFORMANCE_STATUS, RULE_VERSION,
} = require('./config');
const intentModule = require('./intent');

// Stable rule identifiers so stored evidence survives wording changes.
const RULE = Object.freeze({
  HIGH_CLICKS_NO_CONV: 'high_clicks_no_conversion',
  HIGH_COST_NO_CONV: 'high_cost_no_conversion',
  LOW_CTR: 'low_ctr',
  POOR_ROAS: 'poor_roas',
  WRONG_INTENT: 'wrong_intent',
  INFORMATIONAL: 'informational_search',
});

const RULE_LABEL = Object.freeze({
  [RULE.HIGH_CLICKS_NO_CONV]: 'High clicks + no conversion',
  [RULE.HIGH_COST_NO_CONV]: 'High cost + no conversion',
  [RULE.LOW_CTR]: 'Low CTR',
  [RULE.POOR_ROAS]: 'Poor ROAS',
  [RULE.WRONG_INTENT]: 'Wrong intent',
  [RULE.INFORMATIONAL]: 'Informational search',
});

// Rules whose stated outcome is an explicit negative-keyword candidacy.
const NEGATIVE_RULES = new Set([
  RULE.HIGH_CLICKS_NO_CONV,
  RULE.HIGH_COST_NO_CONV,
  RULE.POOR_ROAS,
  RULE.WRONG_INTENT,
  RULE.INFORMATIONAL,
]);

/**
 * Performance Status (§6), from CURRENT and HISTORICAL conversions.
 * Separate field from Decision — neither may overwrite the other.
 */
function performanceStatus(currentConversions, historicalConversions) {
  const cur = Number(currentConversions) || 0;
  const hist = Number(historicalConversions) || 0;
  if (cur > 0) return PERFORMANCE_STATUS.WORKING;
  if (hist > 0) return PERFORMANCE_STATUS.DROPPED;
  return PERFORMANCE_STATUS.NO_CONVERSIONS;
}

/**
 * Evaluate the six waste rules against one aggregated term row.
 * Returns every rule that fired, each with the numbers that made it fire.
 *
 * `row` expects: clicks, impressions, cost, conversions, conversion_value,
 * ctr, roas, search_term_normalized.
 */
function evaluateWasteRules(row) {
  const fired = [];

  const clicks = Number(row.clicks) || 0;
  const impressions = Number(row.impressions) || 0;
  const conversions = Number(row.conversions) || 0;

  // cost / ctr / roas may legitimately be null (undefined metric). `null` must
  // never satisfy a threshold comparison, so each is guarded explicitly rather
  // than relying on JS coercing null to 0.
  const cost = row.cost === null || row.cost === undefined ? null : Number(row.cost);
  const ctr = row.ctr === null || row.ctr === undefined ? null : Number(row.ctr);
  const roas = row.roas === null || row.roas === undefined ? null : Number(row.roas);

  // Rule 1 — Clicks > 15 AND Conversions = 0
  if (clicks > THRESHOLDS.HIGH_CLICKS && conversions === 0) {
    fired.push({
      rule: RULE.HIGH_CLICKS_NO_CONV,
      label: RULE_LABEL[RULE.HIGH_CLICKS_NO_CONV],
      outcome: 'Strong Negative Candidate',
      evidence: { clicks, threshold: THRESHOLDS.HIGH_CLICKS, conversions },
      explain: `${clicks} clicks > threshold ${THRESHOLDS.HIGH_CLICKS}; conversions = 0`,
    });
  }

  // Rule 2 — Cost > EUR 10 AND Conversions = 0
  if (cost !== null && cost > THRESHOLDS.HIGH_COST && conversions === 0) {
    fired.push({
      rule: RULE.HIGH_COST_NO_CONV,
      label: RULE_LABEL[RULE.HIGH_COST_NO_CONV],
      outcome: 'Immediate Review / Negative Candidate',
      evidence: { cost, threshold: THRESHOLDS.HIGH_COST, conversions },
      explain: `€${cost} cost > threshold €${THRESHOLDS.HIGH_COST}; conversions = 0`,
    });
  }

  // Rule 3 — Impressions > 500 AND CTR < 0.5%
  if (impressions > THRESHOLDS.LOW_CTR_IMPRESSIONS && ctr !== null && ctr < THRESHOLDS.LOW_CTR_PCT) {
    fired.push({
      rule: RULE.LOW_CTR,
      label: RULE_LABEL[RULE.LOW_CTR],
      outcome: 'Review Search Intent',
      evidence: {
        impressions, impressions_threshold: THRESHOLDS.LOW_CTR_IMPRESSIONS,
        ctr, ctr_threshold: THRESHOLDS.LOW_CTR_PCT,
      },
      explain: `${impressions} impressions > ${THRESHOLDS.LOW_CTR_IMPRESSIONS}; CTR ${ctr}% < ${THRESHOLDS.LOW_CTR_PCT}%`,
    });
  }

  // Rule 4 — Conversions > 0 AND ROAS < 1
  if (conversions > 0 && roas !== null && roas < THRESHOLDS.POOR_ROAS) {
    fired.push({
      rule: RULE.POOR_ROAS,
      label: RULE_LABEL[RULE.POOR_ROAS],
      outcome: 'Reduce Traffic / Negative Candidate',
      evidence: { conversions, roas, threshold: THRESHOLDS.POOR_ROAS, cost, conversion_value: row.conversion_value },
      explain: `${conversions} conversions with ROAS ${roas} < ${THRESHOLDS.POOR_ROAS}`,
    });
  }

  // Rules 5 & 6 — intent, from the deterministic vocabulary module.
  const intent = intentModule.classify(row.search_term_normalized);
  if (intent.label === intentModule.LABEL.NON_PRODUCT) {
    fired.push({
      rule: RULE.WRONG_INTENT,
      label: RULE_LABEL[RULE.WRONG_INTENT],
      outcome: 'Negative Keyword',
      evidence: { matches: intent.matches, confidence: intent.confidence },
      explain: 'Search intent is not a product purchase: ' +
        intent.matches.filter((m) => m.type === intentModule.LABEL.NON_PRODUCT)
          .map((m) => `"${m.phrase}"`).join(', '),
    });
  } else if (intent.label === intentModule.LABEL.INFORMATIONAL) {
    fired.push({
      rule: RULE.INFORMATIONAL,
      label: RULE_LABEL[RULE.INFORMATIONAL],
      outcome: 'Negative Keyword',
      evidence: { matches: intent.matches, confidence: intent.confidence },
      explain: 'Informational search: ' +
        intent.matches.filter((m) => m.type === intentModule.LABEL.INFORMATIONAL)
          .map((m) => `"${m.phrase}"`).join(', '),
    });
  }

  return { fired, intent };
}

/**
 * Map fired rules + status + opportunity evidence to a final Decision.
 *
 * Decision is ALWAYS one of the three approved values. `Review` is never
 * emitted — the requirement's own sample table shows it, but its column
 * definition (§4) and the approved user direction both restrict Decision to
 * three values. The contradiction is recorded in the validation report.
 *
 * @param {object} args
 *   fired[]              — from evaluateWasteRules
 *   performance_status   — Working | Dropped | No Conversions
 *   opportunity          — { keyword_opportunity, opportunity_candidate, reason }
 */
function decide(args) {
  const fired = args.fired || [];
  const opportunity = args.opportunity || {};
  const firedIds = new Set(fired.map((f) => f.rule));

  const negativeFired = fired.filter((f) => NEGATIVE_RULES.has(f.rule));
  const lowCtrOnly = firedIds.has(RULE.LOW_CTR) && negativeFired.length === 0;

  const basis = {
    rule_version: RULE_VERSION,
    fired_rules: fired.map((f) => f.rule),
    negative_rules_fired: negativeFired.map((f) => f.rule),
    performance_status: args.performance_status || null,
    // Multi-rule precedence is NOT business-ratified. Flagged so the UI can
    // show a "multiple rules fired" hint and so a future precedence decision
    // can be re-derived from stored evidence without re-running.
    multiple_rules_fired: fired.length > 1,
    precedence_ratified: false,
  };

  // 1. A proven, unambiguous opportunity wins — it is the only outcome that
  //    tells the operator to ADD something rather than remove it.
  if (opportunity.keyword_opportunity === true) {
    basis.reason = 'Relevant/high-performing term proven not represented by current targeting evidence.';
    return {
      decision: DECISION.OPPORTUNITY,
      negative_keyword_recommended: false,
      decision_basis: basis,
    };
  }

  // 2. Any rule whose stated outcome is a negative candidacy.
  if (negativeFired.length > 0) {
    basis.reason = negativeFired.map((f) => f.label).join('; ');
    basis.negative_outcomes = negativeFired.map((f) => f.outcome);
    return {
      decision: DECISION.NEGATIVE,
      // Still only a RECOMMENDATION. Review Status stays Pending; nothing is
      // ever published to Google Ads.
      negative_keyword_recommended: true,
      decision_basis: basis,
    };
  }

  // 3. Low CTR on its own -> Keep + "Review Search Intent", flagged for staff.
  if (lowCtrOnly) {
    basis.reason = 'Low CTR only — flagged for search-intent review, not a negative recommendation.';
    basis.needs_attention = true;
    return {
      decision: DECISION.KEEP,
      negative_keyword_recommended: false,
      decision_basis: basis,
    };
  }

  // 4. Everything else keeps. An unproven opportunity is surfaced as a
  //    candidate for manual validation rather than asserted as an opportunity.
  basis.reason = opportunity.opportunity_candidate
    ? 'Opportunity candidate — manual validation required.'
    : 'No waste rule fired.';
  if (opportunity.opportunity_candidate) basis.needs_attention = true;

  return {
    decision: DECISION.KEEP,
    negative_keyword_recommended: false,
    decision_basis: basis,
  };
}

/** Short human-readable summary of fired rules, for the table's Waste Reason cell. */
function wasteReasonSummary(fired) {
  if (!fired || fired.length === 0) return null;
  return fired.map((f) => f.label).join('; ');
}

module.exports = {
  RULE,
  RULE_LABEL,
  NEGATIVE_RULES,
  performanceStatus,
  evaluateWasteRules,
  decide,
  wasteReasonSummary,
};
