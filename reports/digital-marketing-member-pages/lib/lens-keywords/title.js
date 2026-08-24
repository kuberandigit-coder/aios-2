'use strict';

// lib/lens-keywords/title.js
//
// Stage 9 — Final Product Title. Deterministic, evidence-only composition —
// never an LLM call, so the same evidence always produces the same title and
// nothing here can fabricate a product fact "to reach 50 characters"
// (governing prompt §31, explicit prohibition).
//
// Pattern: [Primary Attribute] + [Product Type] + [Key Feature] + [Finish or
// Variant]. Target 50-70 characters. No internal SKU/model/store tags, no
// competitor brand, no CONFLICT/UNVERIFIED_FACT term.

const MIN_LEN = 50;
const MAX_LEN = 70;

/**
 * `validated`: candidates already run through attributes.validateAll().
 * Only MATCHED_FACT and NON_FACTUAL_SEARCH_TERM terms are ever usable here —
 * CONFLICT, UNVERIFIED_FACT and BRAND_EXCLUDED never reach a title.
 */
function usableTerms(validated) {
  return validated.filter((c) => c.status === 'MATCHED_FACT' || c.status === 'NON_FACTUAL_SEARCH_TERM');
}

function titleCase(s) {
  return String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());
}

function build({ currentTitle, productType, validated }) {
  const usable = usableTerms(validated);

  const productTypeTerm =
    usable.find((c) => c.category === 'Product Type')?.term ||
    (productType ? productType : null);

  const primaryAttribute = usable.find((c) =>
    c.category === 'Material / Finish' && c.status === 'MATCHED_FACT' && c.term !== productTypeTerm
  );

  const keyFeature = usable.find((c) =>
    (c.category === 'Feature / Modifier' || c.category === 'Style / Aesthetic') &&
    c.term !== primaryAttribute?.term && c.term !== productTypeTerm
  );

  const finishVariant = usable.find((c) =>
    c.category === 'Material / Finish' && c.status === 'MATCHED_FACT' &&
    c.term !== primaryAttribute?.term && c.term !== productTypeTerm
  );

  const parts = [primaryAttribute?.term, productTypeTerm, keyFeature?.term, finishVariant?.term]
    .filter(Boolean)
    .map(titleCase);

  let suggested = [...new Set(parts)].join(' '); // de-dupe repeated words across slots

  let status = 'SUGGESTED';
  if (!suggested) {
    return {
      status: 'NEEDS_REVIEW', suggested_title: null, char_count: 0,
      keywords_used: [], reason: 'No safe, evidence-backed terms were available to build a title.',
    };
  }

  if (suggested.length > MAX_LEN) {
    suggested = suggested.slice(0, MAX_LEN).replace(/\s+\S*$/, ''); // trim at a word boundary
  }
  if (suggested.length < MIN_LEN) {
    status = 'NEEDS_REVIEW'; // never pad with fabricated words — surface the gap instead
  }

  const keywordsUsed = [primaryAttribute, { term: productTypeTerm }, keyFeature, finishVariant]
    .filter((c) => c && c.term)
    .map((c) => c.term);

  return {
    status,
    current_title: currentTitle || null,
    suggested_title: suggested,
    char_count: suggested.length,
    keywords_used: keywordsUsed,
    reason: status === 'NEEDS_REVIEW' ? `Best safe proposal is only ${suggested.length} characters — insufficient validated evidence to safely reach ${MIN_LEN}.` : null,
  };
}

module.exports = { MIN_LEN, MAX_LEN, usableTerms, build };
