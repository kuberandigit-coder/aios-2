'use strict';

// lib/lens-keywords/keywords.js
//
// Stage 4 (Phase 01 Common Keyword Finder) and Stage 5 (Keyword Category /
// Frequency Analysis) — pure, dependency-free text logic. No database, no
// network. Every lexicon below is a visible, editable array — never a hidden
// heuristic — because these are exactly the kind of business-tunable values
// the company's own governance model (BLOS) says must not live invisibly in
// code (08_SKILLS/Daily Skills/Instruction/skill file rules.md §4).
//
// FREQUENCY DEFINITION (governing prompt §18, §36 note 4): distinct-
// competitor-title/document frequency — the number of DIFFERENT included
// competitor titles a phrase appears in, never raw in-title occurrence
// count. A title repeating a word five times counts once.

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'of', 'in', 'on', 'to', 'by',
  'is', 'are', 'this', 'that', 'from', 'at', 'as', 'it', 'its', 'be', 'new',
]);

// Editable lexicons — categorisation is transparent keyword matching, not a
// black-box score. Extend these arrays as real evidence is observed.
const LEXICON = {
  material_finish: [
    'brass', 'copper', 'chrome', 'nickel', 'bronze', 'steel', 'iron', 'wood',
    'wooden', 'glass', 'ceramic', 'fabric', 'rattan', 'wicker', 'marble',
    'gold', 'silver', 'black', 'white', 'matt', 'matte', 'gloss', 'glossy',
    'brushed', 'antique', 'satin', 'polished',
  ],
  style_aesthetic: [
    'modern', 'vintage', 'industrial', 'rustic', 'minimalist', 'traditional',
    'contemporary', 'retro', 'scandinavian', 'farmhouse', 'bohemian', 'boho',
    'art', 'deco', 'classic', 'elegant',
  ],
  feature_modifier: [
    'dimmable', 'adjustable', 'waterproof', 'led', 'smart', 'remote',
    'battery', 'rechargeable', 'wireless', 'outdoor', 'indoor', 'ip65',
    'ip44', 'multi', 'colour', 'color', 'changing', 'foldable', 'portable',
  ],
  product_type_hints: [
    'lamp', 'light', 'lights', 'pendant', 'chandelier', 'sconce', 'lantern',
    'bulb', 'fixture', 'shade', 'ceiling', 'wall', 'table', 'floor', 'string',
  ],
};

const SIZE_DIMENSION_RE = /\b\d+(\.\d+)?\s?(cm|mm|m|inch|in|ft|w|watt|w\/watt)\b/i;

/**
 * Normalize text: lowercase, strip punctuation/possessives, collapse
 * whitespace. Deliberately conservative — does not stem or destroy
 * meaningful multi-word phrases.
 */
function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['’]s\b/g, '')        // possessives
    .replace(/[^a-z0-9\s-]/g, ' ')  // punctuation (keep hyphens: "multi-colour")
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s) {
  return normalizeText(s).split(' ').filter(Boolean);
}

/** Unigrams, bigrams, trigrams — stopword-only unigrams are dropped, but a
 *  stopword INSIDE a multi-word phrase is kept (never mangles a real phrase
 *  like "pack of 2"). */
function extractPhrases(text) {
  const tokens = tokenize(text);
  const phrases = new Set();
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const slice = tokens.slice(i, i + n);
      if (n === 1 && STOPWORDS.has(slice[0])) continue;
      if (n === 1 && slice[0].length <= 2) continue; // drop noise like "w", "2"
      phrases.add(slice.join(' '));
    }
  }
  return [...phrases];
}

/**
 * Build keyword candidates from a set of INCLUDED competitor documents.
 * `docs`: [{ text, source_name, url }] — one entry per competitor result
 * (title/H3 primarily; callers may also pass image_alt/snippet text as
 * separate documents, per governing prompt §18).
 *
 * Returns candidates sorted by title_frequency desc, each carrying its
 * example sources (evidence, not a black box).
 */
function buildCandidates(docs, opts) {
  const o = opts || {};
  const totalDocs = docs.filter((d) => d.text && d.text.trim()).length;
  const byPhrase = new Map(); // phrase -> { docIds:Set, sources:[] }

  docs.forEach((d, idx) => {
    if (!d.text || !d.text.trim()) return;
    const phrases = new Set(extractPhrases(d.text)); // de-dup WITHIN this one document first
    phrases.forEach((p) => {
      if (!byPhrase.has(p)) byPhrase.set(p, { docIds: new Set(), sources: [] });
      const entry = byPhrase.get(p);
      entry.docIds.add(idx);
      if (entry.sources.length < 5) entry.sources.push({ source_name: d.source_name || null, url: d.url || null });
    });
  });

  const currentTitleTokens = new Set(tokenize(o.currentTitle || ''));
  const brandTokens = brandTokensFromDocs(docs, o.ownBrand);

  const candidates = [...byPhrase.entries()].map(([term, entry]) => {
    const freq = entry.docIds.size;
    return {
      term,
      normalized_term: term,
      title_frequency: freq,
      title_frequency_pct: totalDocs ? Math.round((freq / totalDocs) * 10000) / 100 : null,
      in_current_title: currentTitleTokens.has(term) || (term.includes(' ') && (o.currentTitle || '').toLowerCase().includes(term)),
      is_brand: brandTokens.has(term),
      category: categorize(term, { brandTokens }),
      example_sources: entry.sources,
    };
  });

  candidates.sort((a, b) => b.title_frequency - a.title_frequency || a.term.localeCompare(b.term));
  return candidates;
}

/**
 * Brand-token detection (governing prompt §20): a domain/source-name token
 * that also appears verbatim as a title token is treated as a candidate
 * brand — evidence-based, not a maintained hardcoded brand list. The
 * business's own brand (if supplied) is always excluded from this set so it
 * is never flagged as a competitor brand.
 */
function brandTokensFromDocs(docs, ownBrand) {
  const own = ownBrand ? normalizeText(ownBrand) : null;
  const out = new Set();
  docs.forEach((d) => {
    if (!d.source_name) return;
    const domainTokens = tokenize(String(d.source_name).replace(/\.(com|co\.uk|net|org|de|fr)$/i, ''));
    domainTokens.forEach((t) => {
      if (t.length > 2 && t !== own && d.text && tokenize(d.text).includes(t)) out.add(t);
    });
  });
  return out;
}

/** Transparent, lexicon-based categorisation — see LEXICON above. */
function categorize(term, ctx) {
  const c = ctx || {};
  if (c.brandTokens && term.split(' ').some((t) => c.brandTokens.has(t))) return 'Brand Naming Pattern';
  if (SIZE_DIMENSION_RE.test(term)) return 'Size / Dimension';
  const tokens = term.split(' ');
  if (tokens.some((t) => LEXICON.material_finish.includes(t))) return 'Material / Finish';
  if (tokens.some((t) => LEXICON.style_aesthetic.includes(t))) return 'Style / Aesthetic';
  if (tokens.some((t) => LEXICON.feature_modifier.includes(t))) return 'Feature / Modifier';
  if (tokens.some((t) => LEXICON.product_type_hints.includes(t))) return 'Product Type';
  return 'Other Relevant Search Term';
}

/** Top-N candidates, excluding brand terms from consideration for the
 *  business-facing Top list (they are still stored, flagged is_brand=true —
 *  governing prompt §5 note: "brand names should be excluded; only naming
 *  patterns are noted"). */
function topN(candidates, n) {
  return candidates.filter((c) => !c.is_brand).slice(0, n || 10).map((c, i) => Object.assign({}, c, { rank: i + 1 }));
}

module.exports = {
  STOPWORDS, LEXICON, SIZE_DIMENSION_RE,
  normalizeText, tokenize, extractPhrases,
  buildCandidates, brandTokensFromDocs, categorize, topN,
};
