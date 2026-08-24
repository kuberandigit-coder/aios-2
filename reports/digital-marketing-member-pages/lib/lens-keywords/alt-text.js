'use strict';

// lib/lens-keywords/alt-text.js
//
// Stage 10 — Final Alt Text. Deterministic composition from validated
// evidence, describing the ACTUAL product image (governing prompt §32).
// Never copies competitor alt text verbatim; never adds an unverified
// colour/material/size/finish/feature.

const title = require('./title');

function build({ currentAltText, productType, validated }) {
  const usable = title.usableTerms(validated);

  const productTypeTerm = usable.find((c) => c.category === 'Product Type')?.term || productType || null;
  const descriptors = usable
    .filter((c) => c.term !== productTypeTerm && (c.status === 'MATCHED_FACT' || c.category === 'Style / Aesthetic'))
    .slice(0, 3)
    .map((c) => c.term);

  if (!productTypeTerm && !descriptors.length) {
    return {
      status: 'NEEDS_REVIEW', suggested_alt_text: null, keywords_used: [],
      reason: 'No safe, evidence-backed terms were available to describe this image.',
    };
  }

  const words = [...descriptors, productTypeTerm].filter(Boolean);
  const suggested = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    status: 'SUGGESTED',
    current_alt_text: currentAltText || null,
    suggested_alt_text: suggested,
    keywords_used: words,
    reason: null,
  };
}

module.exports = { build };
