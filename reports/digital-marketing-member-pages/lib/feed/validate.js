// lib/feed/validate.js
//
// Output validation for generated Feed Optimization variants.
//
// PRINCIPLE
//   Structured-output syntax is NOT validation. A provider can return a
//   perfectly-shaped JSON object that invents a wattage. Every value is
//   re-checked here against the evidence that was actually supplied.
//
//   A variant with any MANDATORY failure can never become the selected
//   result — the caller must fall through to the next provider.

'use strict';

const { PROHIBITED_PROMO_TERMS, SUPPORTED_SPEC_KEYS } = require('./prompt');

const TITLE_MAX_CHARS = 150; // requirement §3.3: "strictly under 150 characters"
const DESC_MIN_SENTENCES = 2;
const DESC_MAX_SENTENCES = 5;

/** Unicode-aware length — [...str] counts code points, not UTF-16 units. */
function charCount(s) {
  return [...String(s || '')].length;
}

function normalise(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip diacritics so "réduction" and "reduction" both match. */
function deaccent(s) {
  return normalise(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Heuristic language check.
 *
 * POSTURE: this must catch "the model answered in English". It must NOT police
 * style. Many perfectly good French GMC titles are pure noun phrases with no
 * function words and no accents — e.g. "Luminaire Suspension Cuivre Design
 * Industriel". Rejecting those would fail a valid variant and push the chain
 * onto the next provider, spending free-tier quota for nothing.
 *
 * So we require POSITIVE evidence of English before rejecting, rather than
 * treating "no French evidence" as failure.
 */
const FRENCH_MARKERS = [
  ' le ', ' la ', ' les ', ' un ', ' une ', ' des ', ' du ', ' de ', ' et ',
  ' pour ', ' avec ', ' dans ', ' sur ', ' votre ', ' vos ', ' ce ', ' cette ',
  ' est ', ' sont ', ' plus ', ' sans ', ' aux ', ' au ', ' en ', ' son ', ' sa ',
];
// English function words that essentially never appear in French copy.
const ENGLISH_FUNCTION = [
  ' the ', ' and ', ' with ', ' your ', ' this ', ' for the ', ' is ', ' are ',
  ' of the ', ' from ', ' which ', ' that ', ' our ',
];
// Unambiguous English lighting vocabulary. Words that are also French
// (pendant, vintage, design, metal, industriel, modern/moderne) are excluded
// on purpose — they would produce false rejections.
const ENGLISH_CONTENT = [
  'light', 'lights', 'lighting', 'lamp', 'ceiling', 'wall', 'black', 'white',
  'indoor', 'outdoor', 'kitchen', 'bedroom', 'bulb', 'holder', 'shade',
  'hanging', 'adjustable', 'living',
];

function looksFrench(text) {
  const t = normalise(text);
  if (!t) return false;
  const padded = ' ' + t + ' ';
  const fr = FRENCH_MARKERS.filter((m) => padded.includes(m)).length;
  const enFn = ENGLISH_FUNCTION.filter((m) => padded.includes(m)).length;
  const enContent = ENGLISH_CONTENT.filter((w) => padded.includes(' ' + w + ' ')).length;
  const en = enFn + enContent;
  const hasAccents = /[àâäçéèêëîïôöùûüÿœæ]/i.test(text);

  // Clear English: English signals present, no French accents, and English
  // signals at least match French ones.
  if (en > 0 && en >= fr && !hasAccents) return false;
  // Strongly English even where an accent slipped in.
  if (en > fr && en >= 2) return false;
  // Otherwise accept. The prompt already constrains output language, and a
  // false rejection is more costly than a lenient pass here.
  return true;
}

function countSentences(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  const parts = t.split(/[.!?…]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean);
  return parts.length;
}

function findProhibited(text) {
  const t = ' ' + deaccent(text) + ' ';
  return PROHIBITED_PROMO_TERMS
    .filter((term) => t.includes(' ' + deaccent(term) + ' ') || t.includes(deaccent(term) + ' '))
    .slice(0, 10);
}

/**
 * Technical-claim detection.
 *
 * We look for concrete technical patterns (wattage, Kelvin, sockets, IP codes,
 * lumens, voltage) in the generated copy and require each to be backed by a
 * verified spec value. Addendum B §BL: 95.5% of ad-active FR SKUs have NO
 * verified spec at all, so for most products ANY such claim is a rejection.
 */
const TECH_PATTERNS = [
  { key: 'wattage_w',      re: /\b(\d{1,4})\s?(w|watts?)\b/gi,               label: 'wattage' },
  { key: 'colour_temp_k',  re: /\b(\d{3,5})\s?k\b/gi,                        label: 'colour temperature (Kelvin)' },
  { key: 'lumens_lm',      re: /\b(\d{2,6})\s?(lm|lumens?)\b/gi,             label: 'lumens' },
  { key: 'voltage_rating_v', re: /\b(\d{1,3})\s?(v|volts?)\b/gi,             label: 'voltage' },
  { key: 'ip_rating',      re: /\bip\s?-?\s?(\d{2})\b/gi,                    label: 'IP rating' },
  { key: '__socket__',     re: /\b(gu\s?-?\s?10|e\s?-?\s?27|e\s?-?\s?14|b\s?-?\s?22|mr\s?-?\s?16|g\s?-?\s?9)\b/gi, label: 'socket/cap type' },
  { key: 'cap_dimmable',   re: /\b(dimmable|variateur|gradable)\b/gi,        label: 'dimmability' },
];

function specValueStrings(specs) {
  const out = new Set();
  (specs || []).forEach((s) => {
    if (!s || !SUPPORTED_SPEC_KEYS.includes(s.key)) return;
    if (s.value === null || s.value === undefined || s.value === '') return;
    out.add(deaccent(String(s.value)));
  });
  return out;
}

function specKeysPresent(specs) {
  const out = new Set();
  (specs || []).forEach((s) => {
    if (s && SUPPORTED_SPEC_KEYS.includes(s.key) && s.value !== null && s.value !== '') out.add(s.key);
  });
  return out;
}

/**
 * Returns [{ label, matched, key, supported:boolean }]
 * A claim is supported only when the SAME attribute exists in the verified
 * specs AND the literal value appears among the verified values.
 */
function detectTechnicalClaims(text, specs) {
  const values = specValueStrings(specs);
  const keys = specKeysPresent(specs);
  const found = [];
  TECH_PATTERNS.forEach(({ key, re, label }) => {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(String(text || ''))) !== null) {
      const matched = m[0];
      const numeric = deaccent(m[1] || matched);
      let supported = false;
      if (key === '__socket__') {
        // Addendum B §BL: there is NO socket attribute in the Component SOT.
        // Therefore a socket claim can never be evidence-backed from Ledsone DB.
        supported = false;
      } else if (key === 'cap_dimmable') {
        supported = keys.has('cap_dimmable') &&
          [...values].some((v) => ['true', 'yes', 'y', '1', 'oui'].includes(v));
      } else {
        supported = keys.has(key) && [...values].some((v) => v.includes(numeric));
      }
      found.push({ label, key, matched, supported });
      if (m.index === rx.lastIndex) rx.lastIndex++;
    }
  });
  return found;
}

/**
 * Validate a single variant.
 * `ctx` = { specs, selectedTerms:[{search_term}], otherTitle }
 */
function validateVariant(variant, ctx) {
  const errors = [];   // MANDATORY — block acceptance
  const warnings = []; // advisory — surfaced but do not block

  const v = variant || {};
  const title = v.title;
  const description = v.description;
  const termsUsed = Array.isArray(v.converting_terms_used) ? v.converting_terms_used : [];

  // ---- structure --------------------------------------------------------
  if (!title || typeof title !== 'string' || !title.trim()) errors.push('TITLE_MISSING');
  if (!description || typeof description !== 'string' || !description.trim()) errors.push('DESCRIPTION_MISSING');
  if (!Array.isArray(v.converting_terms_used)) errors.push('CONVERTING_TERMS_USED_NOT_ARRAY');
  if (errors.length) {
    return { status: 'FAIL', errors, warnings, title_char_count: charCount(title) };
  }

  // ---- title ------------------------------------------------------------
  const tLen = charCount(title);
  if (tLen >= TITLE_MAX_CHARS) errors.push(`TITLE_TOO_LONG:${tLen}>=${TITLE_MAX_CHARS}`);
  if (!looksFrench(title)) errors.push('TITLE_NOT_FRENCH');
  const titlePromo = findProhibited(title);
  if (titlePromo.length) errors.push('TITLE_PROMOTIONAL:' + titlePromo.join(','));

  // ---- description ------------------------------------------------------
  if (!looksFrench(description)) errors.push('DESCRIPTION_NOT_FRENCH');
  const sentences = countSentences(description);
  if (sentences < DESC_MIN_SENTENCES || sentences > DESC_MAX_SENTENCES) {
    warnings.push(`DESCRIPTION_SENTENCE_COUNT:${sentences}(expected ${DESC_MIN_SENTENCES}-${DESC_MAX_SENTENCES})`);
  }
  const descPromo = findProhibited(description);
  if (descPromo.length) errors.push('DESCRIPTION_PROMOTIONAL:' + descPromo.join(','));

  // ---- unsupported technical claims (MANDATORY) -------------------------
  const claims = detectTechnicalClaims(title + ' \n ' + description, ctx && ctx.specs);
  const unsupported = claims.filter((c) => !c.supported);
  if (unsupported.length) {
    const uniq = [...new Set(unsupported.map((c) => `${c.label}:${c.matched.trim()}`))].slice(0, 8);
    errors.push('UNSUPPORTED_TECHNICAL_CLAIM:' + uniq.join(' | '));
  }

  // ---- converting terms must come from the supplied evidence ------------
  const allowed = new Set((ctx && ctx.selectedTerms ? ctx.selectedTerms : [])
    .map((t) => deaccent(t.search_term || t.category_label || '')));
  const invented = termsUsed
    .map((t) => ({ raw: t, norm: deaccent(t) }))
    .filter((t) => t.norm && !allowed.has(t.norm))
    // tolerate a term that is a substring of / contains an allowed term
    .filter((t) => ![...allowed].some((a) => a.includes(t.norm) || t.norm.includes(a)));
  if (invented.length) {
    errors.push('CONVERTING_TERM_NOT_IN_EVIDENCE:' + invented.map((t) => t.raw).slice(0, 6).join(' | '));
  }

  return {
    status: errors.length ? 'FAIL' : 'PASS',
    errors,
    warnings,
    title_char_count: tLen,
    sentence_count: sentences,
    technical_claims: claims,
  };
}

/**
 * Validate a whole parsed response (both variants + top-level fields).
 * Returns { status, variantA, variantB, errors, warnings }
 */
function validateResponse(parsed, ctx) {
  const errors = [];
  const warnings = [];
  const p = parsed || {};

  if (!p.variant_a) errors.push('VARIANT_A_MISSING');
  if (!p.variant_b) errors.push('VARIANT_B_MISSING');
  if (typeof p.suggested_google_product_category !== 'string' || !p.suggested_google_product_category.trim()) {
    warnings.push('SUGGESTED_GPC_MISSING');
  }

  // Requirement: an accepted response must declare no unsupported claims.
  const uncertain = Array.isArray(p.uncertain_or_unsupported_claims)
    ? p.uncertain_or_unsupported_claims.filter((x) => x && String(x).trim())
    : [];
  if (!Array.isArray(p.uncertain_or_unsupported_claims)) warnings.push('UNCERTAIN_CLAIMS_NOT_ARRAY');
  if (uncertain.length) {
    errors.push('MODEL_DECLARED_UNSUPPORTED_CLAIMS:' + uncertain.slice(0, 5).join(' | '));
  }

  if (errors.length && (!p.variant_a || !p.variant_b)) {
    return { status: 'FAIL', errors, warnings, variantA: null, variantB: null };
  }

  const variantA = validateVariant(p.variant_a, ctx);
  const variantB = validateVariant(p.variant_b, ctx);

  // A and B must meaningfully differ — otherwise there is nothing to split-test.
  const ta = normalise(p.variant_a && p.variant_a.title);
  const tb = normalise(p.variant_b && p.variant_b.title);
  if (ta && tb && ta === tb) errors.push('VARIANTS_IDENTICAL_TITLE');

  // ---- product identity contamination -----------------------------------
  // Reject copy that names a DIFFERENT sku/item id than the one requested.
  if (ctx && ctx.otherSkus && ctx.otherSkus.length) {
    const blob = deaccent([p.variant_a && p.variant_a.title, p.variant_a && p.variant_a.description,
      p.variant_b && p.variant_b.title, p.variant_b && p.variant_b.description].join(' '));
    const leaked = ctx.otherSkus
      .filter((s) => s && String(s).length >= 5)
      .filter((s) => blob.includes(deaccent(s)))
      .slice(0, 5);
    if (leaked.length) errors.push('CROSS_PRODUCT_CONTAMINATION:' + leaked.join(','));
  }

  const status = (errors.length || variantA.status === 'FAIL' || variantB.status === 'FAIL')
    ? 'FAIL' : 'PASS';

  return { status, errors, warnings, variantA, variantB, uncertain_claims: uncertain };
}

/**
 * Deterministic evidence confidence. Explicitly NOT model self-confidence and
 * NOT a probability — a category with stated reasons.
 */
function evidenceConfidence(evidence) {
  const e = evidence || {};
  const reasons = [];
  let score = 0;

  const specCount = (e.specs || []).filter((s) => s && s.value).length;
  if (specCount > 0) { score += 2; reasons.push(`verified_specs_available:${specCount}`); }
  else reasons.push('no_verified_specs (95.5% of FR ad-active SKUs have none)');

  if (e.current_title) { score += 1; reasons.push('current_title_available'); }
  else reasons.push('current_title_missing');

  if (e.current_description) { score += 1; reasons.push('current_description_available'); }
  else reasons.push('current_description_missing');

  const termCount = (e.selected_terms || []).length;
  if (termCount >= 3) { score += 2; reasons.push(`selected_paid_terms:${termCount}`); }
  else if (termCount > 0) { score += 1; reasons.push(`few_selected_paid_terms:${termCount}`); }
  else reasons.push('no_selected_paid_terms');

  if (e.terms_are_stale) reasons.push('paid_search_evidence_STALE');
  else if (termCount) { score += 1; reasons.push('paid_search_evidence_current'); }

  if (e.google_product_category) { score += 1; reasons.push('gpc_available'); }
  else reasons.push('gpc_missing');

  if (e.stock_status && e.stock_status !== 'UNKNOWN') { score += 1; reasons.push(`stock_known:${e.stock_status}`); }
  else reasons.push('stock_uncertain');

  // Always true for this workflow — recorded so the reason list is honest.
  reasons.push('exact_search_term_to_product_attribution_unavailable');

  if (e.feed_eligible_status !== 'Y') reasons.push('feed_eligibility_not_verified');

  let level = 'LOW';
  if (score >= 7) level = 'HIGH';
  else if (score >= 4) level = 'MEDIUM';

  return { level, score, reasons };
}

module.exports = {
  TITLE_MAX_CHARS,
  charCount,
  normalise,
  deaccent,
  looksFrench,
  countSentences,
  findProhibited,
  detectTechnicalClaims,
  validateVariant,
  validateResponse,
  evidenceConfidence,
};
