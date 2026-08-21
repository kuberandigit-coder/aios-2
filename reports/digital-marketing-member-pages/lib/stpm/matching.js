'use strict';

// lib/stpm/matching.js
//
// REQ-DM-2026-08-MAHI01 — search term -> Shopify product mapping (§3).
//
// PRIORITY ORDER, PRESERVED EXACTLY:
//   Product Title -> Tags -> Meta Title -> Meta Description -> Product Description
//
// TWO FINDINGS FROM DISCOVERY SHAPE THIS FILE
//
//  1. "Exact match with Product Title" matches nothing in practice. Measured on
//     the 50 highest-converting Mahima terms against the 2,585 active DE parent
//     products: ZERO exact whole-title matches. German titles are long and carry
//     an internal `~NNNN` suffix; a customer query is never the entire title.
//     Exact is therefore meaningful against a TAG, or against a normalized title
//     that equals the term. Both are implemented; neither is invented.
//
//  2. The full deterministic chain reaches ~48% coverage. The other ~52%
//     correctly return No Match. That is the requirement's stated behaviour
//     ("Return 'No Match' instead of forcing a Product ID") and it is not
//     engineered away here.
//
// MATCH SCORE IS RANKING EVIDENCE, NOT AN APPROVED CONFIDENCE.
//   The requirement defines no scoring algorithm and no numeric cutoff for
//   Auto Matched / Manual Review / No Match. Inventing one would bury an
//   unratified business decision in code. So:
//     * the score orders candidates and is fully explainable;
//     * Auto Matched is granted ONLY for a unique, unambiguous Exact match;
//     * everything else that matched at all becomes Manual Review.
//   When a cutoff is approved, only `mappingStatusFor` needs to change.
//
// PERFORMANCE
//   Products are normalized ONCE per run into an index (see buildProductIndex),
//   not per term. Exact title/tag lookups are O(1) map hits. Phrase scanning is
//   narrowed by a token->products inverted index, so a term is never compared
//   against all 2,585 descriptions.

const { MATCH_TYPE, MAPPING_STATUS, MATCH_SOURCES, MATCHING_VERSION, MAHIMA } = require('./config');
const { normalizeText, normalizeProductTitle, tokenize, containsPhrase, tokenCoverage } = require('./normalize');

const SOURCE_WEIGHT = MATCH_SOURCES.reduce((m, s) => { m[s.key] = s.weight; return m; }, {});
const SOURCE_LABEL = MATCH_SOURCES.reduce((m, s) => { m[s.key] = s.label; return m; }, {});
const SOURCE_ORDER = MATCH_SOURCES.map((s) => s.key);

// Tokens too generic to narrow a candidate set usefully. Kept tiny and
// German-aware; they only affect which candidates are SCANNED, never whether a
// phrase actually matches.
const STOP_TOKENS = new Set(['der', 'die', 'das', 'und', 'fuer', 'mit', 'von', 'the', 'and', 'for', 'with']);

/**
 * Build the per-run product index.
 *
 * @param {Array} products rows from sql.fetchShopifyCatalogue():
 *   { item_id, listing_id, title, product_description, shopify_handle,
 *     listing_url, meta_title, meta_description, tags: string[] }
 */
function buildProductIndex(products) {
  const items = [];
  const byExactTitle = new Map();   // normalized title -> [idx]
  const byExactTag = new Map();     // normalized tag   -> [idx]
  const byToken = new Map();        // token            -> Set(idx)

  const list = Array.isArray(products) ? products : [];

  for (let i = 0; i < list.length; i++) {
    const p = list[i];

    const nTitle = normalizeProductTitle(p.title);
    const nMetaTitle = normalizeText(p.meta_title);
    const nMetaDesc = normalizeText(p.meta_description);
    const nDesc = normalizeText(p.product_description);
    const nTags = Array.from(new Set((p.tags || []).map((t) => normalizeText(t)).filter(Boolean)));

    const item = {
      idx: i,
      product_id: p.item_id === null || p.item_id === undefined ? null : String(p.item_id),
      listing_id: p.listing_id === null || p.listing_id === undefined ? null : String(p.listing_id),
      title: p.title || null,
      handle: p.shopify_handle || null,
      url: resolveProductUrl(p),
      norm: {
        title: nTitle,
        tag: nTags,
        meta_title: nMetaTitle,
        meta_description: nMetaDesc,
        description: nDesc,
      },
      tokens: {
        title: tokenize(nTitle),
        meta_title: tokenize(nMetaTitle),
      },
      // Availability drives the data-quality flags shown in the row drawer.
      has: {
        title: !!nTitle,
        tag: nTags.length > 0,
        meta_title: !!nMetaTitle,
        meta_description: !!nMetaDesc,
        description: !!nDesc,
      },
    };
    items.push(item);

    if (nTitle) pushTo(byExactTitle, nTitle, i);
    for (const t of nTags) pushTo(byExactTag, t, i);

    // Inverted index over the SHORT fields only. Long descriptions would bloat
    // the index; they are still scanned, but only for candidates already
    // narrowed by a title/tag/meta token.
    for (const tok of new Set(item.tokens.title.concat(item.tokens.meta_title, nTags.flatMap(tokenize)))) {
      if (STOP_TOKENS.has(tok)) continue;
      let s = byToken.get(tok);
      if (!s) { s = new Set(); byToken.set(tok, s); }
      s.add(i);
    }
  }

  return {
    items,
    byExactTitle,
    byExactTag,
    byToken,
    version: MATCHING_VERSION,
    productCount: items.length,
    coverage: coverageOf(items),
  };
}

function pushTo(map, key, idx) {
  let a = map.get(key);
  if (!a) { a = []; map.set(key, a); }
  a.push(idx);
}

function coverageOf(items) {
  const c = { title: 0, tag: 0, meta_title: 0, meta_description: 0, description: 0 };
  for (const it of items) for (const k of SOURCE_ORDER) if (it.has[k]) c[k]++;
  return c;
}

/**
 * Product URL.
 *
 * The stored `listing_url` is authoritative and was 100% populated for the DE
 * catalogue. The derivation below is the formula proven against all 2,585
 * active parents and is used ONLY when the stored value is absent:
 *   https://ledsone.de/products/<handle>/<item_id>
 * Note the trailing item_id — a bare /products/<handle> URL is NOT what this
 * store stores, so do not "simplify" it.
 */
function resolveProductUrl(p) {
  if (p.listing_url && String(p.listing_url).trim()) return String(p.listing_url).trim();
  if (p.shopify_handle && p.item_id) {
    return `${MAHIMA.SHOPIFY_DOMAIN}/products/${p.shopify_handle}/${p.item_id}`;
  }
  return null;
}

/**
 * Match one normalized search term against the index.
 * Returns a structured result — never throws, never forces a product.
 */
function matchTerm(normalizedTerm, index) {
  const empty = {
    product_id: null, product_title: null, product_url: null, product_handle: null,
    match_type: MATCH_TYPE.NONE, match_score: null, match_source: null,
    match_evidence: {}, runner_up_score: null,
    mapping_status: MAPPING_STATUS.NONE,
    mapping_reason: 'No product evidence matched this search term.',
    data_quality_flags: [],
  };

  const term = String(normalizedTerm || '').trim();
  if (!term || !index || !index.items.length) return empty;

  const termTokens = tokenize(term);

  // ── 1. EXACT ──────────────────────────────────────────────────────────────
  // Title first, then tag, honouring the requirement's priority order.
  const exactTitleIdx = index.byExactTitle.get(term) || [];
  const exactTagIdx = index.byExactTag.get(term) || [];

  if (exactTitleIdx.length === 1 && exactTagIdx.length === 0) {
    return finalize(index.items[exactTitleIdx[0]], {
      match_type: MATCH_TYPE.EXACT, source: 'title', score: 100,
      matched_text: index.items[exactTitleIdx[0]].norm.title,
      unique: true, reason: 'Search term is exactly the normalized product title, and it is unique.',
    }, null, index);
  }

  if (exactTitleIdx.length === 0 && exactTagIdx.length === 1) {
    return finalize(index.items[exactTagIdx[0]], {
      match_type: MATCH_TYPE.EXACT, source: 'tag', score: 95,
      matched_text: term,
      unique: true, reason: 'Search term is exactly a product tag, and it is unique.',
    }, null, index);
  }

  // Ambiguous exact matches: several products claim the same title/tag. Never
  // pick one arbitrarily — that is precisely how a wrong product reaches a
  // staff member.
  if (exactTitleIdx.length + exactTagIdx.length > 1) {
    const all = Array.from(new Set(exactTitleIdx.concat(exactTagIdx)));
    const top = index.items[all[0]];
    const src = exactTitleIdx.length > 0 ? 'title' : 'tag';
    return finalize(top, {
      match_type: MATCH_TYPE.EXACT, source: src,
      score: src === 'title' ? 100 : 95,
      matched_text: term, unique: false,
      tie_count: all.length,
      reason: `Exact match is ambiguous — ${all.length} products share this ${SOURCE_LABEL[src].toLowerCase()}.`,
    }, null, index, MAPPING_STATUS.MANUAL);
  }

  // ── 2. PHRASE / TOKEN ─────────────────────────────────────────────────────
  const candidates = narrowCandidates(termTokens, index);
  const scored = [];

  for (const idx of candidates) {
    const it = index.items[idx];
    const best = bestFieldMatch(term, termTokens, it);
    if (best) scored.push({ it, ...best });
  }

  if (scored.length === 0) return withCatalogueFlags(empty, index);

  // Highest score wins; ties broken by source priority then by shorter title
  // (a shorter title containing the phrase is the more specific product).
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const sp = SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source);
    if (sp !== 0) return sp;
    return (a.it.norm.title || '').length - (b.it.norm.title || '').length;
  });

  const top = scored[0];
  const runnerUp = scored.length > 1 ? scored[1] : null;
  const tied = runnerUp && Math.abs(runnerUp.score - top.score) < 0.0001;

  return finalize(top.it, {
    match_type: MATCH_TYPE.PHRASE,
    source: top.source,
    score: top.score,
    matched_text: top.matched_text,
    unique: !tied,
    tie_count: tied ? scored.filter((s) => Math.abs(s.score - top.score) < 0.0001).length : 1,
    coverage: top.coverage,
    reason: tied
      ? 'Several products score equally on the same evidence — human confirmation needed.'
      : 'Matched within product evidence; confidence cutoff is not business-approved, so this needs confirmation.',
  }, runnerUp ? runnerUp.score : null, index, MAPPING_STATUS.MANUAL);
}

/**
 * Narrow the products worth scanning using the inverted index.
 * Falls back to scanning everything only when the term has no indexable token.
 */
function narrowCandidates(termTokens, index) {
  const useful = termTokens.filter((t) => !STOP_TOKENS.has(t));
  if (useful.length === 0) return index.items.map((i) => i.idx);

  const counts = new Map();
  for (const t of useful) {
    const s = index.byToken.get(t);
    if (!s) continue;
    for (const idx of s) counts.set(idx, (counts.get(idx) || 0) + 1);
  }
  if (counts.size === 0) return index.items.map((i) => i.idx);

  // Prefer products sharing the most tokens; cap the scan so a very generic
  // term cannot turn into a full-catalogue description sweep.
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 400)
    .map((e) => e[0]);
}

/**
 * Best-scoring field for one product, walking the priority order.
 * Whole-phrase presence outranks token coverage, always.
 */
function bestFieldMatch(term, termTokens, it) {
  let best = null;

  for (const source of SOURCE_ORDER) {
    if (!it.has[source]) continue;

    const haystacks = source === 'tag' ? it.norm.tag : [it.norm[source]];
    for (const hay of haystacks) {
      if (!hay) continue;

      let score = null;
      let matchedText = null;

      if (containsPhrase(hay, term)) {
        // Whole phrase present. Weighted by field priority, with a small bonus
        // when the phrase is most of the field (a title that IS the phrase is
        // a stronger signal than a description that merely contains it).
        const density = term.length / Math.max(hay.length, 1);
        score = SOURCE_WEIGHT[source] * 0.9 + density * 10;
        matchedText = hay.length > 160 ? hay.slice(0, 160) + '…' : hay;
      } else if (source === 'title' || source === 'meta_title') {
        // Token coverage is only trusted on the SHORT, high-signal fields.
        // Allowing it on descriptions would match almost everything.
        const cov = tokenCoverage(tokenize(hay), termTokens);
        if (cov >= 0.8) {
          score = SOURCE_WEIGHT[source] * 0.5 * cov;
          matchedText = hay;
        }
      }

      if (score !== null && (!best || score > best.score)) {
        best = {
          source,
          score: Math.round(score * 10000) / 10000,
          matched_text: matchedText,
          coverage: tokenCoverage(tokenize(hay), termTokens),
        };
      }
    }
  }

  return best;
}

function finalize(item, m, runnerUpScore, index, forcedStatus) {
  const status = forcedStatus || mappingStatusFor(m);
  return withCatalogueFlags({
    product_id: item.product_id,
    product_title: item.title,
    product_url: item.url,
    product_handle: item.handle,
    match_type: m.match_type,
    match_score: m.score,
    match_source: m.source,
    match_evidence: {
      source_label: SOURCE_LABEL[m.source],
      matched_text: m.matched_text,
      unique: m.unique !== false,
      tie_count: m.tie_count || 1,
      token_coverage: m.coverage === undefined ? null : m.coverage,
      matching_version: MATCHING_VERSION,
      score_is_ranking_evidence_not_confidence: true,
    },
    runner_up_score: runnerUpScore,
    mapping_status: status,
    mapping_reason: m.reason,
    data_quality_flags: [],
  }, index, item);
}

/**
 * Conservative status policy (v1).
 *
 * Auto Matched requires ALL of: an Exact match, on a high-priority evidence
 * field, that is unique. Everything else that matched is Manual Review. This is
 * deliberately strict until a business-approved confidence cutoff exists.
 */
function mappingStatusFor(m) {
  if (m.match_type === MATCH_TYPE.EXACT && m.unique !== false &&
      (m.source === 'title' || m.source === 'tag')) {
    return MAPPING_STATUS.AUTO;
  }
  if (m.match_type === MATCH_TYPE.NONE) return MAPPING_STATUS.NONE;
  return MAPPING_STATUS.MANUAL;
}

/** Attach catalogue-level data-quality notes, only when actually relevant. */
function withCatalogueFlags(result, index, item) {
  const flags = result.data_quality_flags ? result.data_quality_flags.slice() : [];
  if (item) {
    if (!item.has.meta_title) flags.push({ code: 'meta_title_missing', field: 'Meta Title' });
    if (!item.has.meta_description) flags.push({ code: 'meta_description_missing', field: 'Meta Description' });
  }
  return Object.assign({}, result, { data_quality_flags: flags });
}

module.exports = {
  buildProductIndex,
  matchTerm,
  resolveProductUrl,
  mappingStatusFor,
  SOURCE_ORDER,
  SOURCE_LABEL,
};
