// lib/feed/gate.js
//
// FEED GATE + DATA-QUALITY vocabulary.
//
// Two jobs, both pure functions with no I/O so they are directly unit-testable
// and shared byte-for-byte between the API and the UI:
//
//   1. feedGate()      internal eligibility state -> staff-facing Feed Gate
//   2. classifyGaps()  missing evidence -> blocking / push-blocking / informational
//
// WHY THIS EXISTS
//   The UI must never show staff the word "UNKNOWN". A source gap is not an
//   application failure (requirement §26). The internal neutral state is still
//   UNKNOWN/CHECK, but it renders as "Needs Check" with the reason preserved.
//
// NO INVENTED RULE
//   Eligible is asserted ONLY from a real source value, or from an explicitly
//   approved documented rule. It is never derived from stock, from presence in
//   the Merchant feed, from Ads activity, from GPC or from specs.
//   See 03_DISCOVERY Addendum B §BF: the Ledsone DB has no France Merchant
//   eligibility source, so the honest answer today is CHECK.

'use strict';

const GATE = {
  ELIGIBLE: 'ELIGIBLE',
  CHECK: 'CHECK',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
};

const GATE_SOURCE = {
  SOURCE: 'SOURCE',                               // a real stored eligibility value
  DERIVED_APPROVED_RULE: 'DERIVED_APPROVED_RULE', // an approved, cited business rule
  UNVERIFIED: 'UNVERIFIED',                       // no source, no approved rule
};

const CHECK_REASON =
  'Merchant eligibility status unavailable in current Ledsone DB';

const CHECK_TOOLTIP =
  'Merchant eligibility status is not available from the current Ledsone DB. ' +
  'Review before production use.';

/**
 * Build the staff-facing Feed Gate.
 *
 * @param {object} input
 * @param {string|null} input.sourceValue  Raw eligibility value IF a real source
 *                                         supplies one ("Y" / "N"). Today this is
 *                                         always null for FR.
 * @param {string|null} input.sourceName   Where sourceValue came from. Required
 *                                         whenever sourceValue is present.
 * @param {string|null} input.approvedRule Citation for an approved derived rule.
 *                                         Set ONLY when a documented business
 *                                         rule exists.
 * @param {string|null} input.context      Non-deciding context, e.g. feed label.
 */
function feedGate(input) {
  const inp = input || {};
  const reasons = [];
  let status = GATE.CHECK;
  let source = GATE_SOURCE.UNVERIFIED;

  const raw = inp.sourceValue == null ? null : String(inp.sourceValue).trim().toUpperCase();

  if (raw === 'Y' || raw === 'N') {
    status = raw === 'Y' ? GATE.ELIGIBLE : GATE.NOT_ELIGIBLE;
    source = inp.approvedRule ? GATE_SOURCE.DERIVED_APPROVED_RULE : GATE_SOURCE.SOURCE;
    reasons.push(inp.approvedRule
      ? 'Approved rule: ' + inp.approvedRule
      : 'Source value ' + raw + ' from ' + (inp.sourceName || 'an unnamed source'));
  } else {
    // Anything else — including the workbook value "Check", a blank, or the
    // internal neutral UNKNOWN — stays CHECK. We never promote it.
    if (raw && raw !== 'CHECK' && raw !== 'UNKNOWN') {
      reasons.push('Unrecognised eligibility value "' + raw + '" — treated as needing review');
    }
    reasons.push(CHECK_REASON);
  }

  if (inp.context) reasons.push(inp.context);

  const display =
    status === GATE.ELIGIBLE ? 'Eligible — Y'
      : status === GATE.NOT_ELIGIBLE ? 'Not Eligible — N'
        : 'Needs Check';

  const badge =
    status === GATE.ELIGIBLE ? 'green'
      : status === GATE.NOT_ELIGIBLE ? 'red'
        : 'amber';

  const tooltip =
    status === GATE.CHECK ? CHECK_TOOLTIP
      : status === GATE.ELIGIBLE ? 'Confirmed eligible for the France Merchant feed.'
        : 'Confirmed NOT eligible for the France Merchant feed.';

  return {
    status, source, reasons, display, badge, tooltip,
    // Only ELIGIBLE clears the production-push gate.
    blocks_push: status !== GATE.ELIGIBLE,
  };
}

/**
 * Legacy internal shape -> Feed Gate. One conversion point, so the old
 * {status:'UNKNOWN'|'Y'|'N', source, note} object never leaks to the UI.
 */
function fromLegacy(legacy) {
  const l = legacy || {};
  const raw = l.status == null ? null : String(l.status).toUpperCase();
  const known = raw === 'Y' || raw === 'N';
  return feedGate({
    sourceValue: known ? raw : null,
    sourceName: known ? (l.source || null) : null,
    approvedRule: null,
    context: l.note || null,
  });
}

// ───────────────────────────── DATA QUALITY ────────────────────────────────

/** Internal field name -> the sentence a staff member should read. */
const FIELD_LABEL = {
  sku: 'SKU unavailable',
  verified_technical_specs: 'Technical specifications unavailable',
  technical_specs: 'Technical specifications unavailable',
  google_product_category: 'Google Product Category unavailable',
  current_description: 'Current description unavailable',
  current_title: 'Current title unavailable',
  product_type: 'Product type unavailable',
  image_link: 'Product image unavailable',
  price_eur: 'Price unavailable',
  merchant_feed_row: 'Merchant feed row unavailable',
  feed_eligible: 'Feed eligibility needs review',
  fresh_paid_terms: 'Fresh paid search terms unavailable',
  paid_terms: 'No paid converting search terms available',
  product_identity: 'Product could not be matched to a Shopify France listing',
  mpn: 'MPN unavailable',
  item_group_id: 'Item group ID unavailable',
  keyword_planner: 'Keyword Planner data unavailable',
  intent_type: 'Search intent classification unavailable',
  exact_attribution: 'Exact search-term to product attribution unavailable',
};

function labelFor(field) {
  const known = FIELD_LABEL[field];
  if (known) return known;
  return String(field).split('_').join(' ') + ' unavailable';
}

const SEVERITY = {
  GENERATION_BLOCKING: 'GENERATION_BLOCKING',
  PUSH_BLOCKING: 'PUSH_BLOCKING',
  INFORMATIONAL: 'INFORMATIONAL',
};

// Fields that are merely informative: their absence changes neither whether a
// draft can be written nor whether it could be pushed.
const INFORMATIONAL_FIELDS = new Set([
  'mpn', 'item_group_id', 'keyword_planner', 'intent_type',
  'exact_attribution', 'image_link', 'price_eur', 'merchant_feed_row',
  'product_type', 'google_product_category', 'sku',
  'verified_technical_specs', 'technical_specs', 'fresh_paid_terms',
]);

/**
 * Classify every known gap for one product.
 *
 * @param {object} product candidate/product evidence object
 * @param {object} [opts]  { hasPaidTerms:boolean, termsStale:boolean }
 */
function classifyGaps(product, opts) {
  const p = product || {};
  const o = opts || {};
  const missing = Array.isArray(p.missing_evidence) ? p.missing_evidence.slice() : [];
  const out = { blocking: [], push_blocking: [], informational: [] };
  const seen = new Set();

  const add = (bucket, field, detail) => {
    if (seen.has(field)) return;
    seen.add(field);
    out[bucket].push({ field, label: labelFor(field), detail: detail || null });
  };

  // ── generation-blocking ──────────────────────────────────────────────────
  if (!p.item_id || (!p.shopify_variant_id && !p.shopify_product_id)) {
    add('blocking', 'product_identity',
      'Without a resolved Shopify France listing there is no safe product evidence to write from.');
  }
  if (!p.current_title && !p.current_description) {
    add('blocking', 'current_title',
      'Neither a current title nor a current description exists, so generated copy would be invented.');
  }
  if (o.hasPaidTerms === false) {
    add('blocking', 'paid_terms',
      'Generation is evidence-led: it needs at least one paid converting search term.');
  }

  // ── production-push blocking ─────────────────────────────────────────────
  const gate = p.feed_gate || (p.feed_eligible ? fromLegacy(p.feed_eligible) : null);
  if (gate && gate.blocks_push) {
    add('push_blocking', 'feed_eligible',
      gate.status === GATE.CHECK
        ? CHECK_TOOLTIP
        : 'This item is recorded as not eligible for the France Merchant feed.');
  }

  // ── informational ────────────────────────────────────────────────────────
  if (!(p.specs && p.specs.length)) {
    add('informational', 'verified_technical_specs',
      'Generated copy will be restricted to confirmed product information.');
  }
  if (o.termsStale) {
    add('informational', 'fresh_paid_terms',
      'The newest FR paid search-term data is older than the latest 30 days.');
  }
  for (const f of missing) {
    if (seen.has(f)) continue;
    add(INFORMATIONAL_FIELDS.has(f) ? 'informational' : 'blocking', f, null);
  }

  return out;
}

/**
 * Roll the gap classification up into ONE badge for the product row.
 *
 *   Missing critical data (red) — generation cannot safely proceed
 *   Partial (amber)             — generation can proceed, push cannot
 *   Complete (green)            — nothing outstanding
 */
function dataQuality(product, opts) {
  const gaps = classifyGaps(product, opts);
  const blocking = gaps.blocking.length;
  const pushBlocking = gaps.push_blocking.length;
  const info = gaps.informational.length;

  let level, badge, label, summary;
  if (blocking > 0) {
    level = 'MISSING_CRITICAL'; badge = 'red'; label = 'Missing critical data';
    summary = 'This product cannot be generated safely yet.';
  } else if (pushBlocking > 0) {
    level = 'PARTIAL'; badge = 'amber'; label = 'Partial';
    summary = 'You can generate a draft, but this product is not ready for production push.';
  } else if (info > 0) {
    level = 'PARTIAL'; badge = 'amber'; label = 'Partial';
    summary = 'You can generate a draft. Some supporting detail is unavailable.';
  } else {
    level = 'COMPLETE'; badge = 'green'; label = 'Complete';
    summary = 'All expected evidence is available.';
  }

  return {
    level, badge, label, summary,
    can_generate: blocking === 0,
    can_push: blocking === 0 && pushBlocking === 0,
    counts: { blocking, push_blocking: pushBlocking, informational: info },
    gaps,
  };
}

module.exports = {
  GATE, GATE_SOURCE,
  CHECK_REASON, CHECK_TOOLTIP,
  feedGate, fromLegacy,
  FIELD_LABEL, labelFor, SEVERITY,
  classifyGaps, dataQuality,
};
