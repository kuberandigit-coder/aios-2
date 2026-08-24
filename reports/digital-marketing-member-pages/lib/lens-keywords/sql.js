'use strict';

// lib/lens-keywords/sql.js
//
// READ-ONLY access to the Ledsone operational database for the Automation
// Keyword Finder. Ledsone stays the source of truth for SKU / title / image /
// URL / attribute data. Nothing here writes, and nothing here is copied into
// Neon except as a frozen per-run evidence snapshot (see repo.js).
//
// SAME-SKU IDENTITY — proven PARTIALLY on 2026-08-24 (discovery §I):
//   google_ads.product_performance.product_item_id (Sajeepan/UK campaigns)
//     -> listings.shopify_listings.item_id (site='UK')     [43% direct resolve
//                                                            on a 500-id sample]
// A live sample showed a parent/child SKU split: some item_id values resolve
// to a PARENT shopify_listings row (title/description/image present, sku
// NULL); others resolve to a CHILD row (sku present, title/description often
// blank/garbage). This module does NOT invent a bridge between them — a
// product missing either a usable SKU or a usable image is reported as such
// (see classifyDataQuality) and is never silently backfilled from another row.

const { SAJEEPAN } = require('./config');

function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/** Latest date Sajeepan's campaigns actually have product-level ad activity. */
async function getScopeCutoff(client) {
  const { rows } = await client.query(
    `SELECT MAX(pp.date)::text AS max_date
       FROM google_ads.product_performance pp
       JOIN google_ads.campaigns c ON c.campaign_id = pp.campaign_id
      WHERE c.group_name = $1`,
    [SAJEEPAN.GROUP_NAME]
  );
  return (rows[0] && rows[0].max_date) || null;
}

/**
 * Sajeepan's product scope: distinct Shopify item ids that actually served
 * an ad in Sajeepan's Google Ads campaigns within the trailing window,
 * resolved against the live UK Shopify catalogue.
 *
 * `q` is an optional case-insensitive search over sku / title / item_id.
 * Every row carries an explicit data_quality classification (see
 * classifyDataQuality) — the caller decides selectability from that, never
 * from silently filtering rows out here.
 */
async function searchScopedProducts(client, { from, to, q, limit = 60, offset = 0 }) {
  // Fixed positions $1-$4; the optional search term and limit/offset are
  // appended afterward so the placeholder numbers below never have to change.
  const params = [SAJEEPAN.GROUP_NAME, from, to, SAJEEPAN.SHOPIFY_SITE];

  let searchClause = '';
  if (q && String(q).trim()) {
    params.push(`%${String(q).trim().slice(0, 120)}%`);
    const p = params.length;
    searchClause = `AND (sl.title ILIKE $${p} OR sl.sku ILIKE $${p}
                         OR sl.mapped_sku ILIKE $${p} OR sl.item_id ILIKE $${p})`;
  }

  params.push(Math.min(Math.max(Number(limit) || 60, 1), 200));
  const limitParam = params.length;
  params.push(Math.max(Number(offset) || 0, 0));
  const offsetParam = params.length;

  const { rows } = await client.query(
    `WITH scope AS (
       SELECT DISTINCT pp.product_item_id
         FROM google_ads.product_performance pp
         JOIN google_ads.campaigns c ON c.campaign_id = pp.campaign_id
        WHERE c.group_name = $1
          AND pp.date BETWEEN $2::date AND $3::date
          AND pp.product_item_id IS NOT NULL AND pp.product_item_id <> ''
     )
     SELECT sl.id, sl.item_id, sl.sku, sl.mapped_sku, sl.parent_sku,
            sl.title, sl.product_description, sl.main_image_url,
            sl.listing_url, sl.shopify_handle, sl.product_type,
            sl.is_parent, sl.is_child, sl.status
       FROM scope s
       JOIN listings.shopify_listings sl
         ON sl.item_id = s.product_item_id AND sl.site = $4
      WHERE sl.status = 'active'
      ${searchClause}
      ORDER BY sl.title NULLS LAST, sl.id
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params
  );
  return rows;
}

/**
 * Same query as above, but exact-SKU-list lookup — used when creating a run
 * to take an immutable snapshot of exactly the products the staff selected.
 */
async function getProductsBySku(client, skus) {
  if (!Array.isArray(skus) || !skus.length) return [];
  const { rows } = await client.query(
    `SELECT sl.id, sl.item_id, sl.sku, sl.mapped_sku, sl.parent_sku,
            sl.title, sl.product_description, sl.main_image_url,
            sl.listing_url, sl.shopify_handle, sl.product_type,
            sl.is_parent, sl.is_child, sl.status
       FROM listings.shopify_listings sl
      WHERE sl.site = $1 AND sl.sku = ANY($2::text[])`,
    [SAJEEPAN.SHOPIFY_SITE, skus.map(String)]
  );
  return rows;
}

/**
 * Best-effort product-attribute lookup via the Component SOT.
 * Proven 2.2%-4.5% catalogue coverage (2026-08-13, not re-measured per SKU
 * here) — an empty result is expected and normal, never an error, and must
 * never be hidden from the caller.
 */
async function getAttributes(client, { sku, mappedSku, parentSku }) {
  const keys = [sku, mappedSku, parentSku].filter(Boolean).map((s) => String(s).toUpperCase().trim());
  if (!keys.length) return [];
  const { rows } = await client.query(
    `SELECT s.sku AS sot_sku, s.source_tab, a.key, a.label, v.value
       FROM configurator.components_sot_skus s
       JOIN configurator.components_sot_attribute_values v ON v.sot_sku_id = s.id
       JOIN configurator.components_sot_attributes a ON a.id = v.attribute_id
      WHERE upper(btrim(s.sku)) = ANY($1::text[])
        AND v.value IS NOT NULL AND btrim(v.value) <> ''
      ORDER BY a.sort_order`,
    [keys]
  );
  return rows;
}

/**
 * Classifies whether a resolved Shopify row is safe to run a Lens search
 * against. A product missing SKU or image is reported, never guessed around.
 */
function classifyDataQuality(row) {
  const hasSku = !!(row && row.sku && String(row.sku).trim());
  const hasImage = !!(row && row.main_image_url && String(row.main_image_url).trim());
  if (hasSku && hasImage) return { quality: 'READY', reason: null, selectable: true };
  if (!hasSku && !hasImage) {
    return { quality: 'MISSING_SKU_AND_IMAGE', reason: 'This listing has no SKU or image on record.', selectable: false };
  }
  if (!hasSku) {
    return { quality: 'MISSING_SKU', reason: 'This listing has no SKU on record (a known Shopify parent/child data gap).', selectable: false };
  }
  return { quality: 'MISSING_IMAGE', reason: 'This product has no image on record.', selectable: false };
}

/**
 * Every product in Sajeepan's live scope (no pagination), for eligibility
 * scoring / auto-selection (§7-8). Bounded at 2000 as a sanity ceiling, not a
 * business limit — Sajeepan's real scope is far smaller.
 */
async function getAllScopedProducts(client, { from, to }) {
  const { rows } = await client.query(
    `WITH scope AS (
       SELECT pp.product_item_id,
              MAX(pp.date) AS last_ad_date,
              SUM(pp.impressions) AS impressions_30d
         FROM google_ads.product_performance pp
         JOIN google_ads.campaigns c ON c.campaign_id = pp.campaign_id
        WHERE c.group_name = $1
          AND pp.date BETWEEN $2::date AND $3::date
          AND pp.product_item_id IS NOT NULL AND pp.product_item_id <> ''
        GROUP BY pp.product_item_id
     )
     SELECT sl.id, sl.item_id, sl.sku, sl.mapped_sku, sl.parent_sku,
            sl.title, sl.product_description, sl.main_image_url,
            sl.listing_url, sl.shopify_handle, sl.product_type,
            sl.is_parent, sl.is_child, sl.status,
            s.last_ad_date, s.impressions_30d
       FROM scope s
       JOIN listings.shopify_listings sl
         ON sl.item_id = s.product_item_id AND sl.site = $4
      WHERE sl.status = 'active'
      ORDER BY sl.sku NULLS LAST, sl.id
      LIMIT 2000`,
    [SAJEEPAN.GROUP_NAME, from, to, SAJEEPAN.SHOPIFY_SITE]
  );
  return rows;
}

/**
 * Bulk Component SOT coverage check — which of these SKUs (or their mapped/
 * parent SKU) have at least one populated attribute row. Returns a Set of the
 * INPUT sku strings (not the SOT sku) that have coverage, so the caller can
 * test membership directly against its own product rows.
 */
async function getAttributeCoverage(client, products) {
  const covered = new Set();
  const keyToSku = new Map(); // uppercased SOT-comparable key -> original input sku
  const keys = [];
  for (const p of products) {
    if (!p.sku) continue;
    [p.sku, p.mapped_sku, p.parent_sku].filter(Boolean).forEach((k) => {
      const up = String(k).toUpperCase().trim();
      keyToSku.set(up, p.sku);
      keys.push(up);
    });
  }
  if (!keys.length) return covered;
  const { rows } = await client.query(
    `SELECT DISTINCT upper(btrim(s.sku)) AS sot_key
       FROM configurator.components_sot_skus s
       JOIN configurator.components_sot_attribute_values v ON v.sot_sku_id = s.id
      WHERE upper(btrim(s.sku)) = ANY($1::text[])
        AND v.value IS NOT NULL AND btrim(v.value) <> ''`,
    [keys]
  );
  rows.forEach((r) => {
    const sku = keyToSku.get(r.sot_key);
    if (sku) covered.add(sku);
  });
  return covered;
}

module.exports = {
  isoDate,
  addDays,
  getScopeCutoff,
  searchScopedProducts,
  getAllScopedProducts,
  getProductsBySku,
  getAttributes,
  getAttributeCoverage,
  classifyDataQuality,
};
