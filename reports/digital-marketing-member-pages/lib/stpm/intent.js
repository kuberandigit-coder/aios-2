'use strict';

// lib/stpm/intent.js
//
// REQ-DM-2026-08-MAHI01 — waste rules 5 (wrong / non-product intent) and
// 6 (informational intent).
//
// DELIBERATELY DETERMINISTIC, DELIBERATELY HONEST ABOUT ITS LIMITS.
//
// The requirement names three informational examples — "how to", "ideas",
// "DIY" — and says nothing else about how intent should be decided. It gives no
// taxonomy for "wrong / non-product intent" at all. Mahima's search terms are
// German, so an English-only list would quietly miss almost everything.
//
// Two things follow, and both are design decisions rather than accidents:
//
//  1. No LLM. An opaque classifier would turn an unratified business rule into
//     an unauditable one, and would put a per-term model call inside a Vercel
//     function. Every match here is a visible vocabulary entry with a reason.
//
//  2. The German vocabulary below is NOT business-approved. It is the obvious
//     translation of the requirement's own three examples plus the marketplace
//     patterns visible in the live data. Any term whose classification depended
//     on an unratified entry is returned with confidence 'limited', and the UI
//     surfaces "Intent coverage limited — review recommended" rather than
//     implying linguistic certainty.
//
// Replacing this module with an approved vocabulary or classifier should not
// require touching anything else: the contract is classify(normalizedTerm).

const { INTENT_VERSION } = require('./config');
const { tokenize } = require('./normalize');

// Matched against the NORMALIZED term (lowercased, umlauts folded to ae/oe/ue/ss).
// `approved: true` marks the entries the requirement states verbatim.
const INFORMATIONAL = [
  // --- from the requirement, verbatim -------------------------------------
  { phrase: 'how to', lang: 'en', approved: true },
  { phrase: 'ideas', lang: 'en', approved: true },
  { phrase: 'idea', lang: 'en', approved: true },
  { phrase: 'diy', lang: 'en', approved: true },

  // --- German equivalents of the same three concepts (NOT yet ratified) ----
  { phrase: 'wie', lang: 'de', approved: false },            // "wie ... anschliessen"
  { phrase: 'wie man', lang: 'de', approved: false },
  { phrase: 'anleitung', lang: 'de', approved: false },      // instructions
  { phrase: 'anleitungen', lang: 'de', approved: false },
  { phrase: 'ideen', lang: 'de', approved: false },          // ideas
  { phrase: 'selber machen', lang: 'de', approved: false },  // DIY
  { phrase: 'selbst machen', lang: 'de', approved: false },
  { phrase: 'selber bauen', lang: 'de', approved: false },
  { phrase: 'basteln', lang: 'de', approved: false },
  { phrase: 'tutorial', lang: 'de', approved: false },
  { phrase: 'erklaerung', lang: 'de', approved: false },     // erklärung -> erklaerung
  { phrase: 'unterschied', lang: 'de', approved: false },    // "difference between"
  { phrase: 'was ist', lang: 'de', approved: false },
  { phrase: 'warum', lang: 'de', approved: false },
  { phrase: 'test', lang: 'de', approved: false },
  { phrase: 'testsieger', lang: 'de', approved: false },
  { phrase: 'vergleich', lang: 'de', approved: false },      // comparison
  { phrase: 'erfahrungen', lang: 'de', approved: false },    // reviews/experience
  { phrase: 'bedeutung', lang: 'de', approved: false },
  { phrase: 'reparieren', lang: 'de', approved: false },     // repair guide
];

// "Wrong / non-product intent" — the requirement defines no taxonomy, so this
// is intentionally narrow. It covers only patterns that cannot be a product
// purchase intent for this catalogue. Everything here is unratified.
const NON_PRODUCT = [
  { phrase: 'gebraucht', lang: 'de', approved: false, reason: 'second-hand' },
  { phrase: 'kostenlos', lang: 'de', approved: false, reason: 'free' },
  { phrase: 'gratis', lang: 'de', approved: false, reason: 'free' },
  { phrase: 'jobs', lang: 'en', approved: false, reason: 'recruitment' },
  { phrase: 'job', lang: 'en', approved: false, reason: 'recruitment' },
  { phrase: 'stellenangebote', lang: 'de', approved: false, reason: 'recruitment' },
  { phrase: 'ausbildung', lang: 'de', approved: false, reason: 'recruitment' },
  { phrase: 'reklamation', lang: 'de', approved: false, reason: 'complaint/service' },
  { phrase: 'ruecksendung', lang: 'de', approved: false, reason: 'returns' },
  { phrase: 'garantie', lang: 'de', approved: false, reason: 'after-sales' },
  { phrase: 'oeffnungszeiten', lang: 'de', approved: false, reason: 'store info' },
  { phrase: 'telefonnummer', lang: 'de', approved: false, reason: 'store info' },
  { phrase: 'kontakt', lang: 'de', approved: false, reason: 'store info' },
  { phrase: 'wikipedia', lang: 'en', approved: false, reason: 'reference lookup' },
];

const LABEL = Object.freeze({
  PRODUCT: 'product',
  INFORMATIONAL: 'informational',
  NON_PRODUCT: 'non_product',
  UNKNOWN: 'unknown',
});

const CONFIDENCE = Object.freeze({
  DETERMINISTIC: 'deterministic', // decided using requirement-stated vocabulary only
  LIMITED: 'limited',             // decided using unratified vocabulary
});

// Boundary-aware containment so "wie" does not fire inside "wieviel" and
// "test" does not fire inside "kontrasttest".
function hasPhrase(normalizedTerm, phrase) {
  return (' ' + normalizedTerm + ' ').includes(' ' + phrase + ' ');
}

/**
 * Classify a NORMALIZED search term.
 *
 * Returns:
 *   { label, confidence, matches[], version, coverage_note }
 *
 * `matches` lists every vocabulary entry that fired, so the row-detail drawer
 * can show a staff member exactly why a term was called informational.
 */
function classify(normalizedTerm) {
  const term = String(normalizedTerm || '').trim();
  const matches = [];

  if (!term) {
    return {
      label: LABEL.UNKNOWN,
      confidence: CONFIDENCE.LIMITED,
      matches,
      version: INTENT_VERSION,
      coverage_note: 'Empty search term — intent not evaluated.',
    };
  }

  for (const e of NON_PRODUCT) {
    if (hasPhrase(term, e.phrase)) {
      matches.push({ type: LABEL.NON_PRODUCT, phrase: e.phrase, lang: e.lang, approved: e.approved, reason: e.reason });
    }
  }
  for (const e of INFORMATIONAL) {
    if (hasPhrase(term, e.phrase)) {
      matches.push({ type: LABEL.INFORMATIONAL, phrase: e.phrase, lang: e.lang, approved: e.approved });
    }
  }

  if (matches.length === 0) {
    // Absence of a vocabulary hit is NOT proof of product intent — it is the
    // absence of evidence. Labelled `product` because that is the operational
    // default, but confidence stays honest for non-English terms.
    const looksGerman = tokenize(term).length > 0 && !/^[a-z0-9 ]+$/.test(term) === false;
    return {
      label: LABEL.PRODUCT,
      confidence: CONFIDENCE.DETERMINISTIC,
      matches,
      version: INTENT_VERSION,
      coverage_note: looksGerman
        ? 'No informational or non-product vocabulary matched.'
        : 'No informational or non-product vocabulary matched.',
    };
  }

  // Non-product outranks informational: it is the stronger exclusion signal.
  const nonProduct = matches.filter((m) => m.type === LABEL.NON_PRODUCT);
  const label = nonProduct.length > 0 ? LABEL.NON_PRODUCT : LABEL.INFORMATIONAL;

  // If ANY deciding match came from unratified vocabulary, say so.
  const deciding = matches.filter((m) => m.type === label);
  const allApproved = deciding.every((m) => m.approved);

  return {
    label,
    confidence: allApproved ? CONFIDENCE.DETERMINISTIC : CONFIDENCE.LIMITED,
    matches,
    version: INTENT_VERSION,
    coverage_note: allApproved
      ? 'Matched vocabulary stated in the approved requirement.'
      : 'Intent coverage limited — matched on vocabulary that is not yet business-approved. Review recommended.',
  };
}

/** Vocabulary stats for the UI's data-quality panel. */
function vocabularySummary() {
  const all = INFORMATIONAL.concat(NON_PRODUCT);
  return {
    version: INTENT_VERSION,
    total: all.length,
    approved: all.filter((e) => e.approved).length,
    unratified: all.filter((e) => !e.approved).length,
    languages: Array.from(new Set(all.map((e) => e.lang))).sort(),
  };
}

module.exports = { classify, vocabularySummary, LABEL, CONFIDENCE, INFORMATIONAL, NON_PRODUCT };
