'use strict';

// lib/lens-keywords/normalize.js
//
// Maps a raw SerpAPI visual_matches[] entry onto the requirement's exact
// field list, WITHOUT fabricating fields the provider did not return.
//
// Mapping (governing prompt §16, using the live-verified visual_matches shape
// { position, title, link, source, source_icon, thumbnail, image }):
//   position          -> rank
//   title             -> h3_heading AND title (both are populated — SerpAPI's
//                        "title" is the closest genuine equivalent of both a
//                        search-result heading and a result title; storing it
//                        twice keeps the requirement's two fields distinct
//                        without inventing two different strings)
//   link              -> url
//   source            -> cite / source_name
//   thumbnail (string) or image.link -> image_src
//   image_alt / emphasized_text / aria_label -> NULL (no genuine SerpAPI
//     equivalent documented for this engine — never faked from title)

const SAFE_RESULT_FIELDS = [
  'position', 'title', 'link', 'source', 'source_icon',
  'thumbnail', 'image', 'price', 'rating', 'reviews', 'in_stock', 'condition',
];

function safePayload(match) {
  const out = {};
  for (const f of SAFE_RESULT_FIELDS) {
    if (match && match[f] !== undefined) out[f] = match[f];
  }
  return out;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Normalize one SerpAPI visual_matches entry into the stored competitor-
 * result shape. Never throws on malformed input — returns nulls instead.
 */
function normalizeMatch(match) {
  const imageSrc = (typeof match.thumbnail === 'string' && match.thumbnail)
    || (match.image && typeof match.image.link === 'string' ? match.image.link : null)
    || null;

  return {
    rank: Number.isFinite(match.position) ? match.position : null,
    provider: 'SERPAPI',
    result_type: 'visual_matches',
    image_src: imageSrc,
    image_alt: null,        // not returned by this SerpAPI engine — never faked
    url: typeof match.link === 'string' ? match.link : null,
    h3_heading: typeof match.title === 'string' ? match.title : null,
    cite: typeof match.source === 'string' ? match.source : null,
    emphasized_text: null,  // not returned by this SerpAPI engine — never faked
    aria_label: null,       // not returned by this SerpAPI engine — never faked
    displayed_domain: typeof match.link === 'string' ? extractDomain(match.link) : null,
    title: typeof match.title === 'string' ? match.title : null,
    source_name: typeof match.source === 'string' ? match.source : null,
    safe_provider_payload: safePayload(match),
  };
}

/**
 * Mark self-results and technical duplicates on an already-normalized list.
 *
 * Self-result: the competitor URL points at the exact source product URL —
 * this is our own listing surfacing in the visual match set, not competitor
 * evidence (governing prompt §18).
 *
 * Duplicate: same canonical destination URL, or same URL+title pair. A
 * different merchant/offer at a different URL is NEVER removed automatically.
 */
function markSelfAndDuplicates(results, ownProductUrl) {
  const ownCanonical = canonicalUrl(ownProductUrl);
  const seen = new Map(); // canonical url|title -> first result

  return results.map((r) => {
    const out = { ...r };
    const canon = canonicalUrl(r.url);

    out.is_self_result = !!(ownCanonical && canon && canon === ownCanonical);

    const dupKey = canon ? `${canon}|${(r.title || '').trim().toLowerCase()}` : null;
    if (dupKey) {
      const first = seen.get(dupKey);
      if (first) {
        out.is_duplicate = true;
        out.duplicate_of_rank = first.rank;
      } else {
        out.is_duplicate = false;
        seen.set(dupKey, r);
      }
    } else {
      out.is_duplicate = false;
    }
    return out;
  });
}

function canonicalUrl(u) {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    parsed.hash = '';
    // Strip common tracking params so the same page with a different UTM
    // string is not treated as a distinct result.
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'gclid'].forEach((k) => parsed.searchParams.delete(k));
    let s = parsed.toString().replace(/\/$/, '').toLowerCase();
    s = s.replace(/^https?:\/\/(www\.)?/, '');
    return s;
  } catch {
    return String(u).trim().toLowerCase();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 normalizers — Google All / Images / Shopping (Stage 6).
// Same discipline as normalizeMatch: only genuinely-returned fields are
// populated (governing prompt §22), verified against live SerpAPI docs
// 2026-08-24, not guessed.
// ─────────────────────────────────────────────────────────────────────────────
const PHASE2_SAFE_FIELDS = {
  google: ['position', 'title', 'link', 'displayed_link', 'snippet', 'source'],
  google_images: ['position', 'title', 'thumbnail', 'original', 'link', 'source'],
  google_shopping: ['position', 'title', 'product_link', 'source', 'price', 'extracted_price', 'thumbnail', 'rating', 'reviews', 'product_id'],
};

function safePhase2Payload(engine, item) {
  const fields = PHASE2_SAFE_FIELDS[engine] || [];
  const out = {};
  for (const f of fields) if (item && item[f] !== undefined) out[f] = item[f];
  return out;
}

/** engine=google — organic_results entry. */
function normalizeOrganic(item) {
  return {
    engine: 'google',
    rank: Number.isFinite(item.position) ? item.position : null,
    title: typeof item.title === 'string' ? item.title : null,
    url: typeof item.link === 'string' ? item.link : null,
    displayed_domain: typeof item.link === 'string' ? extractDomain(item.link) : null,
    snippet: typeof item.snippet === 'string' ? item.snippet : null,
    image_src: null, price: null, rating: null, reviews: null,
    safe_provider_payload: safePhase2Payload('google', item),
  };
}

/** engine=google_images — images_results entry. */
function normalizeImage(item) {
  return {
    engine: 'google_images',
    rank: Number.isFinite(item.position) ? item.position : null,
    title: typeof item.title === 'string' ? item.title : null,
    url: typeof item.link === 'string' ? item.link : null,
    displayed_domain: typeof item.source === 'string' ? item.source : (typeof item.link === 'string' ? extractDomain(item.link) : null),
    snippet: null,
    image_src: (typeof item.original === 'string' && item.original) || (typeof item.thumbnail === 'string' ? item.thumbnail : null),
    price: null, rating: null, reviews: null,
    safe_provider_payload: safePhase2Payload('google_images', item),
  };
}

/** engine=google_shopping — shopping_results entry. */
function normalizeShopping(item) {
  return {
    engine: 'google_shopping',
    rank: Number.isFinite(item.position) ? item.position : null,
    title: typeof item.title === 'string' ? item.title : null,
    url: typeof item.product_link === 'string' ? item.product_link : null,
    displayed_domain: typeof item.source === 'string' ? item.source : null,
    snippet: null,
    image_src: typeof item.thumbnail === 'string' ? item.thumbnail : null,
    price: typeof item.price === 'string' ? item.price : (item.extracted_price != null ? String(item.extracted_price) : null),
    rating: item.rating != null ? String(item.rating) : null,
    reviews: item.reviews != null ? String(item.reviews) : null,
    safe_provider_payload: safePhase2Payload('google_shopping', item),
  };
}

const PHASE2_NORMALIZERS = {
  google: normalizeOrganic,
  google_images: normalizeImage,
  google_shopping: normalizeShopping,
};

/** Normalize a raw result item for the given Phase 2 engine. */
function normalizePhase2(engine, item) {
  const fn = PHASE2_NORMALIZERS[engine];
  return fn ? fn(item) : null;
}

module.exports = {
  SAFE_RESULT_FIELDS,
  safePayload,
  extractDomain,
  normalizeMatch,
  markSelfAndDuplicates,
  canonicalUrl,
  PHASE2_SAFE_FIELDS,
  normalizeOrganic,
  normalizeImage,
  normalizeShopping,
  normalizePhase2,
};
