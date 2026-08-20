// lib/feed/sql.js
//
// READ-ONLY access to the Ledsone operational database for Req5.
// Ledsone DB stays the source of truth for product / PPC / order / feed data.
// Nothing here writes, and nothing here is copied into Neon except as a frozen
// evidence snapshot attached to a generation.
//
// Every identifier below was proven live in the discovery + Addendum B audit.
// All queries are parameterised; no user input is concatenated into SQL.

'use strict';

// ─── verified Ledsone France identity (discovery §G, Addendum B §BG) ────────
const FR = {
  ADS_ACCOUNT_ID: 1266953046,        // google_ads.accounts — "LEDSone FR", EUR
  MERCHANT_ID: 5551466539,           // shared UK/FR merchant; is_active=true on FR only
  SHOPIFY_SUB_SOURCE: 233,           // order_management.sub_source — 'jedsz8-km' / LEDSone FR
  SHOPIFY_SITE: 'France',            // listings.shopify_listings.site
  GSC_SITE_URL: 'https://ledsone.fr/',
  FRANCE_WAREHOUSE: 2,               // inventory.warehouse — 'France1'
  // Thivajini's three PMax campaigns (campaign_name carries her name)
  CAMPAIGNS: [23103582865, 23533025729, 23405519670],
};

// The id ladder. product_item_id arrives in two shapes:
//   shopify_ZZ_<productId>_<variantId>   → part 3 = product, part 4 = variant
//   bare numeric                          → either a variant id or a product id
// Proven: 979/979 ad-active items resolve to a Shopify FR listing.
const VKEY = `CASE WHEN pp.product_item_id ILIKE 'shopify\\_%'
                   THEN SPLIT_PART(LOWER(pp.product_item_id),'_',4)
                   ELSE LOWER(pp.product_item_id) END`;
const PKEY = `CASE WHEN pp.product_item_id ILIKE 'shopify\\_%'
                   THEN SPLIT_PART(LOWER(pp.product_item_id),'_',3)
                   ELSE LOWER(pp.product_item_id) END`;

function isoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/** Latest date we actually have Ads performance for the FR campaigns. */
async function getAdsCutoff(client) {
  const { rows } = await client.query(
    `SELECT MAX(date)::text AS max_date
       FROM google_ads.product_performance
      WHERE campaign_id = ANY($1::bigint[])`, [FR.CAMPAIGNS]);
  return (rows[0] && rows[0].max_date) || null;
}

/**
 * Source cutoffs for every input the workflow depends on.
 * These are stamped onto the batch so a historical generation always carries
 * proof of how stale its inputs were.
 */
async function getSourceCutoffs(client) {
  const { rows } = await client.query(`
    SELECT
      (SELECT MAX(date)::text FROM google_ads.product_performance
        WHERE campaign_id = ANY($1::bigint[]))                        AS ads_perf,
      (SELECT MAX(date)::text FROM google_ads.pmax_campaign_search_term_data
        WHERE campaign_id = ANY($1::bigint[]))                        AS pmax_terms,
      (SELECT MAX(date)::text FROM google_ads.campaign_search_term_data
        WHERE campaign_id = ANY($1::bigint[]))                        AS conv_terms,
      (SELECT MAX(o.order_date)::text FROM order_management.orders o
        WHERE o.sub_source_id = $2)                                   AS shopify_orders,
      (SELECT MAX(date)::text FROM google_search_console.query_page
        WHERE site_url = $3 AND search_type = 'web')                  AS gsc,
      (SELECT MAX(updated_at)::text FROM listings.shopify_listings
        WHERE site = $4)                                              AS shopify_listings
  `, [FR.CAMPAIGNS, FR.SHOPIFY_SUB_SOURCE, FR.GSC_SITE_URL, FR.SHOPIFY_SITE]);
  return rows[0] || {};
}

/**
 * Candidate products: everything that actually served in the trailing window,
 * with all resolvable evidence and an explicit list of what is missing.
 */
async function getCandidates(client, { from, to, limit = 300 }) {
  const { rows } = await client.query(`
    WITH pp AS (
      SELECT pp.product_item_id,
             ${VKEY} AS vkey,
             ${PKEY} AS pkey,
             SUM(pp.impressions)::bigint      AS impressions,
             SUM(pp.clicks)::bigint           AS clicks,
             SUM(pp.conversions)::numeric     AS conversions,
             SUM(pp.conversion_value)::numeric AS conversion_value,
             SUM(pp.cost)::numeric            AS cost
        FROM google_ads.product_performance pp
       WHERE pp.campaign_id = ANY($1::bigint[])
         AND pp.date BETWEEN $2::date AND $3::date
         AND pp.product_item_id <> ''
       GROUP BY 1,2,3
    ),
    child AS (
      SELECT s.item_id, s.sku, s.title, s.price, s.main_image_url,
             s.product_type, s.quantity, s.status, s.listing_url, s.shopify_handle
        FROM listings.shopify_listings s
       WHERE s.site = $4 AND s.is_parent = 0
    ),
    parent AS (
      SELECT s.item_id, s.title, s.product_description, s.product_type,
             s.main_image_url, s.price, s.shopify_handle
        FROM listings.shopify_listings s
       WHERE s.site = $4 AND s.is_parent = 1
    ),
    mp AS (
      SELECT LOWER(m.product_id) AS lp,
             SPLIT_PART(LOWER(m.product_id),'_',3) AS pk,
             SPLIT_PART(LOWER(m.product_id),'_',4) AS vk,
             m.title, m.description, m.image_link, m.price, m.currency,
             m.product_types, m.product_category, m.availability, m.brand,
             m.feed_label,
             ROW_NUMBER() OVER (
               PARTITION BY LOWER(m.product_id)
               ORDER BY CASE m.feed_label WHEN 'FR' THEN 0
                                          WHEN 'EUR_16475062347' THEN 1 ELSE 2 END
             ) AS rn
        FROM google_ads.merchant_products m
       WHERE m.merchant_id = $5
    )
    SELECT pp.product_item_id, pp.vkey, pp.pkey,
           pp.impressions, pp.clicks, pp.conversions, pp.conversion_value, pp.cost,
           c.sku            AS child_sku,
           c.title          AS child_title,
           c.price          AS child_price,
           c.main_image_url AS child_image,
           c.product_type   AS child_product_type,
           c.quantity       AS child_quantity,
           c.status         AS child_status,
           c.shopify_handle AS child_handle,
           p.item_id            AS parent_item_id,
           p.product_description AS parent_description,
           p.shopify_handle     AS parent_handle,
           p.title              AS parent_title,
           m.title          AS gmc_title,
           m.description    AS gmc_description,
           m.image_link     AS gmc_image,
           m.price          AS gmc_price,
           m.currency       AS gmc_currency,
           m.product_types  AS gmc_product_type,
           m.product_category AS gmc_gpc,
           m.availability   AS gmc_availability,
           m.brand          AS gmc_brand,
           m.feed_label     AS gmc_feed_label
      FROM pp
      LEFT JOIN child  c ON c.item_id = pp.vkey
      LEFT JOIN parent p ON p.item_id = pp.pkey
      LEFT JOIN mp     m ON m.rn = 1
                        AND (m.lp = LOWER(pp.product_item_id) OR m.vk = pp.vkey OR m.pk = pp.pkey)
     ORDER BY pp.impressions DESC
     LIMIT $6
  `, [FR.CAMPAIGNS, from, to, FR.SHOPIFY_SITE, FR.MERCHANT_ID, limit]);

  return rows.map(shapeCandidate);
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

function shapeCandidate(r) {
  const impressions = num(r.impressions);
  const clicks = num(r.clicks);
  const conversions = num(r.conversions);
  const conversionValue = num(r.conversion_value);

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const convRate = clicks > 0 ? conversions / clicks : 0;

  const title = r.gmc_title || r.child_title || r.parent_title || null;
  const description = r.gmc_description || r.parent_description || null;
  const productType = r.gmc_product_type || r.child_product_type || null;
  const image = r.gmc_image || r.child_image || null;
  const price = r.gmc_price != null ? Number(r.gmc_price)
              : (r.child_price != null ? Number(r.child_price) : null);

  // ---- Feed Eligible ----------------------------------------------------
  // Addendum B §BH: Ledsone DB has NO France Merchant eligibility source.
  // google_ads.ad_group_products (the only eligibility-shaped table) holds
  // 0 FR rows and is ad-group scoped, so PMax products can never appear.
  // We therefore report UNKNOWN and name the reason. We do NOT derive Y from
  // presence-in-feed or from stock.
  const feedEligible = {
    status: 'UNKNOWN',
    source: 'NOT_AVAILABLE_IN_LEDSONE_DB',
    note: r.gmc_feed_label
      ? `Present in Merchant feed (label ${r.gmc_feed_label}) — presence is NOT approval status.`
      : 'No current Merchant feed row for this item.',
  };

  // ---- stock ------------------------------------------------------------
  // Four sources answer four different questions (Addendum B §BI). We report
  // what each says and do not collapse them into a single invented verdict.
  const stock = {
    gmc_availability: r.gmc_availability || null,
    shopify_quantity: r.child_quantity != null ? Number(r.child_quantity) : null,
    shopify_status: r.child_status || null,
    france_local_units: null,   // filled by attachStock()
    uk_global_units: null,
    status: 'UNKNOWN',
    source: 'PENDING',
  };
  if (r.gmc_availability) {
    stock.status = /in stock/i.test(r.gmc_availability) ? 'IN_STOCK' : 'OUT_OF_STOCK';
    stock.source = 'merchant_products.availability (what Google is told)';
  } else if (r.child_quantity != null) {
    stock.status = Number(r.child_quantity) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';
    stock.source = 'listings.shopify_listings.quantity';
  }

  const missing = [];
  if (!title) missing.push('current_title');
  if (!description) missing.push('current_description');
  if (!productType) missing.push('product_type');
  if (!r.gmc_gpc) missing.push('google_product_category');
  if (!image) missing.push('image_link');
  if (price == null) missing.push('price_eur');
  if (!r.child_sku) missing.push('sku');
  if (!r.gmc_title) missing.push('merchant_feed_row');

  return {
    item_id: r.product_item_id,
    shopify_variant_id: r.vkey || null,
    shopify_product_id: r.parent_item_id || r.pkey || null,
    sku: r.child_sku || null,
    handle: r.parent_handle || r.child_handle || null,
    current_title: title,
    current_description: description,
    product_type: productType,
    google_product_category: r.gmc_gpc || null,
    gpc_format: r.gmc_gpc ? (/^[0-9]+$/.test(String(r.gmc_gpc)) ? 'NUMERIC_GMC_ID' : 'TEXT_PATH') : null,
    image_link: image,
    price_eur: price,
    currency: r.gmc_currency || 'EUR',
    brand: r.gmc_brand || null,
    feed_label: r.gmc_feed_label || null,
    perf_30d: {
      impressions, clicks,
      ctr: Math.round(ctr * 1000000) / 1000000,
      conversions: Math.round(conversions * 10000) / 10000,
      conversion_value: Math.round(conversionValue * 100) / 100,
      conversion_rate: Math.round(convRate * 1000000) / 1000000,
      cost: Math.round(num(r.cost) * 100) / 100,
    },
    feed_eligible: feedEligible,
    stock,
    specs: [],            // attachSpecs()
    shopify_conversions: null, // attachShopifyConversions()
    missing_evidence: missing,
  };
}

/** Verified technical specs from the Component SOT, by child SKU. */
async function attachSpecs(client, candidates) {
  const skus = [...new Set(candidates.map((c) => c.sku).filter(Boolean))];
  if (!skus.length) return candidates;

  const { rows } = await client.query(`
    SELECT c.sku, a.key, a.label, v.value
      FROM configurator.components_sot_skus c
      JOIN configurator.components_sot_attribute_values v ON v.sot_sku_id = c.id
      JOIN configurator.components_sot_attributes a       ON a.id = v.attribute_id
     WHERE c.sku = ANY($1::text[])
       AND v.value IS NOT NULL AND v.value <> ''
  `, [skus]);

  const bySku = new Map();
  rows.forEach((r) => {
    if (!bySku.has(r.sku)) bySku.set(r.sku, []);
    bySku.get(r.sku).push({ key: r.key, label: r.label, value: r.value });
  });

  candidates.forEach((c) => {
    c.specs = (c.sku && bySku.get(c.sku)) || [];
    c.specs_source = c.specs.length
      ? 'configurator.components_sot_* (verified)'
      : 'NONE — no Component SOT row for this SKU';
    if (!c.specs.length) c.missing_evidence.push('verified_technical_specs');
  });
  return candidates;
}

/** France-local and UK/global stock, by child SKU. */
async function attachStock(client, candidates) {
  const skus = [...new Set(candidates.map((c) => c.sku).filter(Boolean))];
  if (!skus.length) return candidates;

  const { rows } = await client.query(`
    SELECT p.sku,
           SUM(CASE WHEN ps.warehouse = $2 THEN ps.quantity ELSE 0 END)::bigint AS france_units,
           MAX(CASE WHEN l.warehouse_location = 'UK' THEN l.stock ELSE NULL END)::bigint AS uk_units
      FROM inventory.products p
      LEFT JOIN inventory.physical_product_stock ps ON ps.inventory = p.id
      LEFT JOIN inventory.local_inventory_current_stock_location_wise l ON l.inventory_id = p.id
     WHERE p.sku = ANY($1::text[])
     GROUP BY p.sku
  `, [skus, FR.FRANCE_WAREHOUSE]);

  const bySku = new Map(rows.map((r) => [r.sku, r]));
  candidates.forEach((c) => {
    const r = c.sku && bySku.get(c.sku);
    if (r) {
      c.stock.france_local_units = r.france_units != null ? Number(r.france_units) : null;
      c.stock.uk_global_units = r.uk_units != null ? Number(r.uk_units) : null;
    }
    if (c.stock.status === 'UNKNOWN') c.missing_evidence.push('stock_status');
  });
  return candidates;
}

/**
 * Shopify actual conversions. All three grains are returned because the
 * business has not chosen one (Addendum B §BM: 81 orders / 111 lines /
 * 197 units over the same 30 days).
 */
async function attachShopifyConversions(client, candidates, { from, to }) {
  const variantIds = [...new Set(candidates.map((c) => c.shopify_variant_id).filter(Boolean))];
  const productIds = [...new Set(candidates.map((c) => c.shopify_product_id).filter(Boolean))];
  if (!variantIds.length && !productIds.length) return candidates;

  const { rows } = await client.query(`
    SELECT ii.variant_id, ii.product_id,
           COUNT(DISTINCT o.id)::int AS orders,
           COUNT(*)::int             AS lines,
           SUM(COALESCE(NULLIF(ii.item_quantity,'')::numeric,0)) AS units
      FROM order_management.orders o
      JOIN order_management.order_item_info ii ON ii.order_id = o.id
     WHERE o.sub_source_id = $1
       AND o.order_date::date BETWEEN $2::date AND $3::date
       AND o.status = 'Completed'
       AND (ii.variant_id = ANY($4::text[]) OR ii.product_id = ANY($5::text[]))
     GROUP BY ii.variant_id, ii.product_id
  `, [FR.SHOPIFY_SUB_SOURCE, from, to, variantIds, productIds]);

  const byVariant = new Map();
  const byProduct = new Map();
  rows.forEach((r) => {
    if (r.variant_id) byVariant.set(String(r.variant_id), r);
    if (r.product_id) byProduct.set(String(r.product_id), r);
  });

  candidates.forEach((c) => {
    const v = c.shopify_variant_id && byVariant.get(String(c.shopify_variant_id));
    const p = c.shopify_product_id && byProduct.get(String(c.shopify_product_id));
    const hit = v || p;
    c.shopify_conversions = {
      matched_on: v ? 'variant_id' : (p ? 'product_id' : null),
      orders: hit ? Number(hit.orders) : 0,
      lines: hit ? Number(hit.lines) : 0,
      units: hit ? Number(hit.units) : 0,
      status_filter: "orders.status = 'Completed'",
      grain_note: 'Three valid grains exist and diverge (~2.4x). Business definition not yet chosen.',
    };
  });
  return candidates;
}

/**
 * Paid converting search terms for the FR account.
 *
 * Deduped on (campaign_id, date, search_term) with an explicit, declared
 * precedence, because the two tables OVERLAP AND DISAGREE (Addendum B §BD:
 * 4,873 common keys, 100 disagreeing, conversions 8.00 vs 3.00). We do NOT
 * silently pick a winner — `source_table` is returned per row and the caller
 * surfaces the conflict.
 *
 * `campaign_search_term_data` is preferred ONLY because it is the sole table
 * carrying `insight_id`, which is what yields the search-category label. That
 * is a traceability reason, not a claim of correctness.
 */
async function getPaidSearchTerms(client, { from, to, minConversions = 0, limit = 400 }) {
  const { rows } = await client.query(`
    WITH unioned AS (
      SELECT 1 AS pref, 'campaign_search_term_data' AS source_table,
             s.campaign_id, s.date, s.search_term,
             s.impressions, s.clicks, s.conversions, s.conversions_value,
             i.category_label
        FROM google_ads.campaign_search_term_data s
        LEFT JOIN google_ads.campaign_search_term_insights i
               ON i.insight_id = s.insight_id AND i.campaign_id = s.campaign_id
       WHERE s.campaign_id = ANY($1::bigint[])
         AND s.date BETWEEN $2::date AND $3::date
      UNION ALL
      SELECT 2, 'pmax_campaign_search_term_data',
             p.campaign_id, p.date, p.search_term,
             p.impressions, p.clicks, p.conversions, p.conversions_value,
             NULL
        FROM google_ads.pmax_campaign_search_term_data p
       WHERE p.campaign_id = ANY($1::bigint[])
         AND p.date BETWEEN $2::date AND $3::date
    ),
    deduped AS (
      SELECT DISTINCT ON (campaign_id, date, search_term) *
        FROM unioned
       ORDER BY campaign_id, date, search_term, pref
    )
    SELECT search_term,
           MIN(category_label) FILTER (WHERE category_label IS NOT NULL) AS category_label,
           string_agg(DISTINCT campaign_id::text, ',')  AS campaign_ids,
           string_agg(DISTINCT source_table, ',')       AS source_tables,
           SUM(impressions)::bigint                     AS impressions,
           SUM(clicks)::bigint                          AS clicks,
           SUM(conversions)::numeric                    AS conversions,
           SUM(conversions_value)::numeric              AS conversion_value,
           MIN(date)::text                              AS source_min_date,
           MAX(date)::text                              AS source_max_date
      FROM deduped
     GROUP BY search_term
    HAVING SUM(conversions) >= $4::numeric
     ORDER BY SUM(conversions) DESC, SUM(clicks) DESC
     LIMIT $5
  `, [FR.CAMPAIGNS, from, to, minConversions, limit]);

  return rows.map((r) => {
    const clicks = num(r.clicks);
    const conversions = num(r.conversions);
    return {
      search_term: r.search_term,
      category_label: r.category_label || null,
      campaign_ids: r.campaign_ids,
      source_tables: r.source_tables,
      source_table: r.source_tables && r.source_tables.includes(',')
        ? 'BOTH (overlapping — see conflict note)'
        : r.source_tables,
      impressions: num(r.impressions),
      clicks,
      conversions: Math.round(conversions * 10000) / 10000,
      conversion_value: Math.round(num(r.conversion_value) * 100) / 100,
      conversion_rate: clicks > 0 ? Math.round((conversions / clicks) * 1000000) / 1000000 : 0,
      source_min_date: r.source_min_date,
      source_max_date: r.source_max_date,
      // Addendum B item 25/26 — never claim exact product attribution.
      mapping_level: r.category_label ? 'SEARCH_CATEGORY' : 'CAMPAIGN',
      mapping_confidence: r.category_label ? 'MEDIUM' : 'LOW',
      mapping_note: r.category_label
        ? 'Attributed to a Google search CATEGORY, not to this individual product.'
        : 'Attributed at CAMPAIGN level only. Not tied to any product or product type.',
    };
  });
}

/**
 * ORGANIC supporting evidence (Google Search Console).
 * Structurally separate from paid terms and carries NO conversion metric.
 * Must never be merged into the converting-terms evidence.
 */
async function getOrganicTerms(client, { handle, from, to, limit = 25 }) {
  if (!handle) return [];
  const { rows } = await client.query(`
    SELECT q.query,
           SUM(q.impressions)::bigint AS impressions,
           SUM(q.clicks)::bigint      AS clicks,
           MIN(q.date)::text          AS source_min_date,
           MAX(q.date)::text          AS source_max_date
      FROM google_search_console.query_page q
     WHERE q.site_url = $1
       AND q.search_type = 'web'
       AND q.date BETWEEN $2::date AND $3::date
       AND q.page LIKE '%/products/' || $4 || '%'
     GROUP BY q.query
     ORDER BY SUM(q.impressions) DESC
     LIMIT $5
  `, [FR.GSC_SITE_URL, from, to, handle, limit]);

  return rows.map((r) => ({
    query: r.query,
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    source_min_date: r.source_min_date,
    source_max_date: r.source_max_date,
    evidence_type: 'ORGANIC_GSC',
    note: 'Organic Google Search. No conversion metric exists. Not a paid converting term.',
  }));
}

/** Ads performance for an item over an arbitrary window (baseline/post-change). */
async function getItemPerformance(client, { itemId, from, to }) {
  const { rows } = await client.query(`
    SELECT SUM(impressions)::bigint       AS impressions,
           SUM(clicks)::bigint            AS clicks,
           SUM(conversions)::numeric      AS conversions,
           SUM(conversion_value)::numeric AS conversion_value,
           MAX(date)::text                AS source_max_date
      FROM google_ads.product_performance
     WHERE campaign_id = ANY($1::bigint[])
       AND product_item_id = $2
       AND date BETWEEN $3::date AND $4::date
  `, [FR.CAMPAIGNS, itemId, from, to]);

  const r = rows[0] || {};
  const impressions = num(r.impressions);
  const clicks = num(r.clicks);
  const conversions = num(r.conversions);
  return {
    period_start: from,
    period_end: to,
    impressions, clicks,
    ctr: impressions > 0 ? Math.round((clicks / impressions) * 1000000) / 1000000 : 0,
    conversions: Math.round(conversions * 10000) / 10000,
    conversion_value: Math.round(num(r.conversion_value) * 100) / 100,
    conversion_rate: clicks > 0 ? Math.round((conversions / clicks) * 1000000) / 1000000 : 0,
    source_max_date: r.source_max_date || null,
  };
}

/** Shopify conversions for one item over an arbitrary window. */
async function getItemShopifyConversions(client, { variantId, productId, from, to }) {
  const { rows } = await client.query(`
    SELECT COUNT(DISTINCT o.id)::int AS orders,
           COUNT(*)::int             AS lines,
           COALESCE(SUM(COALESCE(NULLIF(ii.item_quantity,'')::numeric,0)),0) AS units,
           MAX(o.order_date)::text   AS source_max_date
      FROM order_management.orders o
      JOIN order_management.order_item_info ii ON ii.order_id = o.id
     WHERE o.sub_source_id = $1
       AND o.order_date::date BETWEEN $2::date AND $3::date
       AND o.status = 'Completed'
       AND (($4::text IS NOT NULL AND ii.variant_id = $4::text)
         OR ($5::text IS NOT NULL AND ii.product_id = $5::text))
  `, [FR.SHOPIFY_SUB_SOURCE, from, to, variantId || null, productId || null]);
  const r = rows[0] || {};
  return {
    orders: Number(r.orders || 0),
    lines: Number(r.lines || 0),
    units: Number(r.units || 0),
    source_max_date: r.source_max_date || null,
  };
}

module.exports = {
  FR, VKEY, PKEY,
  isoDate, addDays,
  getAdsCutoff, getSourceCutoffs,
  getCandidates, attachSpecs, attachStock, attachShopifyConversions,
  getPaidSearchTerms, getOrganicTerms,
  getItemPerformance, getItemShopifyConversions,
  shapeCandidate,
};
