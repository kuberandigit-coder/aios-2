// Merged GSC low-CTR endpoint — serves both UK (Kamsi) and DE (Sukirtha)
// via ?store=uk|de, to stay under the Vercel Hobby-plan 12-function cap.
// Per-store constants/logic below are unchanged copies of the two
// endpoints this replaces (gsc-low-ctr.js store=uk, gsc-sukirtha-low-ctr.js
// store=de) — behavior for existing callers is identical.
const crypto = require('crypto');

// ===== Merged from jefri/product-status.js (2026-07-22) =====
const jefriProductStatusHandlerModule = (function() {
// Jefri Requirement 1 — Product Status Labels (ledsone.de, Google Ads)
// Server-side only: reads DATABASE_URL (or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD)
// from env, never exposed to the client. Read-only queries only — no writes,
// no schema changes. Requires the `pg` npm package.
//
// Source tables (read-only PostgreSQL, discovered via information_schema/pg_catalog
// on 2026-07-20 — see evidence/jefri/2026-07-20_postgres-discovery.md):
//   google_ads.product_performance  — daily impressions/clicks/conversion_value/cost per product_item_id
//   google_ads.campaigns            — campaign_id -> account_id, used to scope to ledsone.de (account_id 9031058245)
//   google_ads.ad_group_products    — status (ELIGIBLE/DISAPPROVED/PENDING), scoped to Shopping/Search only (not PMax)
//   listings.shopify_listings       — sku, price, main_image_url, listing_url, channel='LEDSone DE' (NOT stock — see below)
//   listings.shopify_listings_parent_child_mapping — resolves parent-level item IDs to a representative child variant
//
// Current Stock (2026-07-20 change): fetched LIVE from the Shopify Admin
// GraphQL API on every request (ProductVariant.inventoryItem.inventoryLevels,
// summed "available" across locations) — NOT read from the Postgres
// listings.shopify_listings.quantity snapshot. Uses the same
// SHOPIFY_ADMIN_TOKEN env var as the Sukirtha DE endpoints, no new credential.
//
// Identifier note: google_ads.product_item_id is usually a raw Shopify product/variant ID,
// but for some PMax rows it is the full Merchant Center product_id format
// ("shopify_de_<parent>_<variant>") — the trailing segment is extracted to join
// listings.shopify_listings. The ORIGINAL product_item_id is still returned as
// "Product ID (Item ID)" for traceability with the Google Ads UI.

const { Pool } = require('pg');

// Short-TTL cache: this endpoint runs a Postgres query PLUS a live Shopify
// stock lookup (batched Admin GraphQL calls) on every request, which is slow
// (multiple seconds) and was being re-run on every tab switch / filter
// change even when nothing had changed. 60s is short enough to stay
// reasonably live, long enough to absorb repeat hits from the UI.
const JEFRI_CACHE = new Map();
const JEFRI_CACHE_TTL_MS = 60 * 1000;

let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString && !process.env.PGHOST) {
      throw new Error('Server not configured: DATABASE_URL (or PGHOST/PGUSER/PGPASSWORD) missing');
    }
    pool = new Pool({
      connectionString: connectionString || undefined,
      host: connectionString ? undefined : process.env.PGHOST,
      port: connectionString ? undefined : (process.env.PGPORT ? Number(process.env.PGPORT) : 5432),
      database: connectionString ? undefined : process.env.PGDATABASE,
      user: connectionString ? undefined : process.env.PGUSER,
      password: connectionString ? undefined : process.env.PGPASSWORD,
      // SSL was tested and confirmed NOT supported by this server (2026-07-20:
      // "The server does not support SSL connections") — using plain TCP per
      // the requirement's own documented fallback. Not a security downgrade
      // decision made casually; this is what the server itself requires.
      ssl: false,
      connectionTimeoutMillis: 8000,
      statement_timeout: 20000,
      max: 3,
    });
  }
  return pool;
}

const CHANNEL = 'LEDSone DE';   // listings.shopify_listings.channel for the DE store

// Jefri's 5 named campaigns (2026-07-20 — user-provided list, confirmed exact
// matches against google_ads.campaigns for account 9031058245, all ENABLED).
// The dashboard is scoped to ONLY these campaigns' products, not the whole
// ledsone.de account.
const JEFRI_CAMPAIGNS = [
  { id: '23141810147', name: 'Pmax | Jeff | Klarna | NEWALL | All Products | MCV | DE -16/10' },
  { id: '23411228109', name: 'Pmax | Jeff | Shoparize | ALL | All Products | MCV | DE-01/01/26' },
  { id: '22539594891', name: 'Shopping | Jeff | Shoptimised | AOVU15 | TROAS | DE -12/05' },
  { id: '23473840779', name: 'Pmax | Jeff | Shoparize | FTJ | FinetunedProducts | TROAS | DE-20.01' },
  { id: '23340277562', name: 'Pmax | Jeff | Shoparize | IT | Italy | TROAS | IT-08/12' },
];
const JEFRI_CAMPAIGN_IDS = JEFRI_CAMPAIGNS.map((c) => c.id);

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const QUERY = `
WITH latest AS (
  SELECT MAX(pp.date) AS max_date
  FROM google_ads.product_performance pp
  WHERE pp.campaign_id = ANY($1::bigint[])
),
range AS (
  SELECT
    COALESCE($2::date, (SELECT max_date FROM latest) - INTERVAL '89 days')::date AS start_date,
    COALESCE($3::date, (SELECT max_date FROM latest))::date AS end_date
),
perf AS (
  SELECT pp.product_item_id,
    array_agg(DISTINCT pp.campaign_id) AS campaign_ids,
    SUM(pp.impressions) AS impressions,
    SUM(pp.clicks) AS clicks,
    SUM(pp.conversion_value) AS conv_value,
    SUM(pp.cost) AS cost
  FROM google_ads.product_performance pp
  CROSS JOIN range r
  WHERE pp.campaign_id = ANY($1::bigint[])
    AND pp.date BETWEEN r.start_date AND r.end_date
  GROUP BY pp.product_item_id
),
-- "Currently in the campaign" filter: a product only counts as active if it
-- had performance data within the last 7 days, not just anytime in the
-- 90-day window. Products removed from a campaign's feed stop generating
-- performance rows entirely (confirmed empirically, e.g. a product last
-- seen 2026-05-25 while its campaign kept reporting through 2026-07-20),
-- so recent silence is a reliable signal of removal, matching what Google
-- Ads' own live Products report shows. The displayed metrics still cover
-- the full 90-day window - only the product LIST is scoped to "currently
-- active", per explicit user instruction (2026-07-20).
active_products AS (
  SELECT DISTINCT pp.product_item_id
  FROM google_ads.product_performance pp
  CROSS JOIN range r
  WHERE pp.campaign_id = ANY($1::bigint[])
    AND pp.date >= GREATEST(r.start_date, r.end_date - INTERVAL '6 days')
    AND pp.date <= r.end_date
),
resolved_ids AS (
  SELECT p.product_item_id,
    CASE WHEN p.product_item_id LIKE 'shopify\\_%'
         THEN split_part(p.product_item_id, '_', array_length(string_to_array(p.product_item_id, '_'), 1))
         ELSE p.product_item_id
    END AS shopify_id
  FROM perf p
),
status_agg AS (
  SELECT agp.product_item_id, MAX(agp.status) AS status
  FROM google_ads.ad_group_products agp
  WHERE agp.campaign_id = ANY($1::bigint[])
  GROUP BY agp.product_item_id
),
child_fallback AS (
  SELECT m.parent_id AS parent_listing_id, MIN(child.id) AS child_listing_id
  FROM listings.shopify_listings_parent_child_mapping m
  JOIN listings.shopify_listings child ON child.id = m.child_id AND child.all_list = 1
  GROUP BY m.parent_id
),
resolved_listing AS (
  SELECT sl.item_id,
    COALESCE(NULLIF(sl.sku, ''), child_sl.sku) AS sku,
    COALESCE(sl.price, child_sl.price) AS price,
    COALESCE(NULLIF(sl.main_image_url, ''), child_sl.main_image_url) AS image,
    sl.listing_url AS url,
    -- Item ID to use for the LIVE Shopify stock lookup: the listing's own
    -- item_id when it's a real sellable variant (all_list=1), otherwise the
    -- representative child variant's item_id (parent-level listings have no
    -- inventory of their own).
    CASE WHEN sl.all_list = 1 THEN sl.item_id ELSE child_sl.item_id END AS live_stock_item_id
  FROM listings.shopify_listings sl
  LEFT JOIN child_fallback cf ON cf.parent_listing_id = sl.id
  LEFT JOIN listings.shopify_listings child_sl ON child_sl.id = cf.child_listing_id
  WHERE sl.channel = $4
)
SELECT
  p.product_item_id,
  p.campaign_ids,
  rl.sku,
  rl.url,
  rl.image,
  rl.price,
  s.status,
  rl.live_stock_item_id,
  p.impressions,
  p.clicks,
  p.conv_value,
  p.cost,
  (SELECT start_date FROM range) AS range_start,
  (SELECT end_date FROM range) AS range_end
FROM perf p
JOIN active_products ap ON ap.product_item_id = p.product_item_id
JOIN resolved_ids ri ON ri.product_item_id = p.product_item_id
LEFT JOIN resolved_listing rl ON rl.item_id = ri.shopify_id
LEFT JOIN status_agg s ON s.product_item_id = p.product_item_id
ORDER BY p.cost DESC NULLS LAST;
`;

function computeRoas(convValue, cost) {
  const cv = Number(convValue) || 0;
  const c = Number(cost) || 0;
  if (c > 0) return (cv / c) * 100;
  if (c === 0 && cv === 0) return null; // unavailable
  return Infinity; // cost=0, convValue>0 — unavailable/infinite, flagged for investigation
}

function computeTag(impressions, clicks, roas, cost, convValue) {
  const impr = Number(impressions) || 0;
  const clk = Number(clicks) || 0;
  const c = Number(cost) || 0;
  const cv = Number(convValue) || 0;

  // 1. Zombie — evaluated first
  if (impr === 0 && clk === 0) return { key: 'zombie', label: '🧟 Zombie' };

  // 2. Hero
  if (clk >= 6 && typeof roas === 'number' && isFinite(roas) && roas >= 400) {
    return { key: 'hero', label: '🏆 Hero' };
  }

  // 3. Villain (ROAS < 400%, OR clicks>=6 with cost>0 and zero conversion value)
  if (clk >= 6 && (
    (typeof roas === 'number' && isFinite(roas) && roas < 400) ||
    (c > 0 && cv === 0) ||
    roas === null ||
    roas === Infinity
  )) {
    // roas === Infinity (cost=0, convValue>0) is an anomaly, not a real Villain signal by ROAS,
    // but clicks>=6 with no cost recorded and value present doesn't match Hero/Sidekick either —
    // still bucketed here per "Villain when clicks>=6 AND ROAS < 400%" as the closest documented rule;
    // flagged via roasUnavailable for investigation, never silently invented.
    if (roas === Infinity) return { key: 'villain', label: '🩸 Villain', roasAnomaly: true };
    return { key: 'villain', label: '🩸 Villain' };
  }

  // 4. Sidekick
  if (clk >= 1 && clk <= 5 && typeof roas === 'number' && isFinite(roas) && roas >= 400) {
    return { key: 'sidekick', label: '🥷 Sidekick' };
  }

  // 5. Unclassified
  return { key: 'unclassified', label: '⚪ Unclassified' };
}

// ---------- Live Current Stock (Shopify Admin GraphQL API, read-only) ----------
// Uses the existing SHOPIFY_ADMIN_TOKEN env var (already used by
// api/sukirtha-req2-duplicate-check.js and api/sukirtha-req3-slow-moving-stock.js
// for ledsone-de.myshopify.com) — no new credential.
const SHOPIFY_STORE_DOMAIN = 'ledsone-de.myshopify.com';
const SHOPIFY_API_VERSION = '2024-10';
const shopifySleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shopifyGraphQL(query, variables) {
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      res = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (e) {
      await shopifySleep(400 * Math.pow(2, attempt));
      continue;
    }
    if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
      await shopifySleep(400 * Math.pow(2, attempt));
      continue;
    }
    if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
    const json = await res.json();
    const throttled = json.errors && Array.isArray(json.errors) && json.errors.some((e) => e.extensions && e.extensions.code === 'THROTTLED');
    if (throttled) { await shopifySleep(800 * Math.pow(2, attempt)); continue; }
    if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error('Shopify API: exceeded retries (throttling / transient errors)');
}

const NODES_QUERY = `
query($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on ProductVariant {
      id
      inventoryItem {
        tracked
        inventoryLevels(first: 10) {
          edges { node { quantities(names: ["available"]) { name quantity } } }
        }
      }
    }
  }
}`;

// Fetches live "available" inventory for a list of Shopify variant item IDs,
// batched at Shopify's node-query limit (250 per call). Returns a Map of
// item_id (string) -> stock (number, or null if not inventory-tracked).
async function fetchLiveStock(itemIds) {
  const stockById = new Map();
  const uniqueIds = [...new Set(itemIds.filter(Boolean).map(String))];
  const BATCH = 250;
  for (let i = 0; i < uniqueIds.length; i += BATCH) {
    const batch = uniqueIds.slice(i, i + BATCH);
    const gids = batch.map((id) => `gid://shopify/ProductVariant/${id}`);
    const data = await shopifyGraphQL(NODES_QUERY, { ids: gids });
    for (const node of data.nodes) {
      if (!node || !node.id) continue;
      const numericId = node.id.split('/').pop();
      if (!node.inventoryItem || !node.inventoryItem.tracked) {
        stockById.set(numericId, null);
        continue;
      }
      const total = node.inventoryItem.inventoryLevels.edges.reduce((sum, e) => {
        const avail = e.node.quantities.find((q) => q.name === 'available');
        return sum + (avail ? avail.quantity : 0);
      }, 0);
      stockById.set(numericId, total);
    }
  }
  return stockById;
}

function normalizeStatus(status) {
  if (!status) return 'Unknown';
  const map = {
    ELIGIBLE: 'Eligible',
    DISAPPROVED: 'Disapproved',
    PENDING: 'Limited',
  };
  return map[status] || status;
}

async function jefriProductStatusHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cacheKey = [req.query.campaign || 'all', req.query.from || '', req.query.to || ''].join('|');
  if (req.query.refresh !== '1') {
    const cached = JEFRI_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.at) < JEFRI_CACHE_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }
    // Static snapshot, added 2026-07-23 (default view only -- no campaign/
    // date filter -- since that's what the page loads by default; filtered
    // views still fall through to a live query). Hourly-regenerated by
    // api/scripts/generate-snapshots.js postgres. Survives
    // cold starts, unlike the in-memory JEFRI_CACHE above.
    if (cacheKey === 'all||') {
      const fs = require('fs');
      const path = require('path');
      const staticPath = path.join(__dirname, 'data', 'jefri-product-status-snapshot.json');
      if (fs.existsSync(staticPath)) {
        const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
        const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
        JEFRI_CACHE.set(cacheKey, { data: payload, at: Date.now() });
        res.status(200).json(payload);
        return;
      }
    }
  }

  const client = await (async () => {
    return await getPool().connect();
  })().catch((err) => {
    // Server-side only (Vercel function logs) — never sent to the client.
    // Safe to log: pg connection errors never include the password itself.
    console.error('[jefri/product-status] DB connect failed:', err && err.message);
    res.status(500).json({ error: 'Server not configured or database unreachable. Contact the site administrator.' });
    return null;
  });
  if (!client) return;

  try {
    const from = isValidDate(req.query.from) ? req.query.from : null;
    const to = isValidDate(req.query.to) ? req.query.to : null;
    // ?campaign=<id> scopes to one of Jefri's 5 campaigns; default (or
    // "all"/omitted) includes all 5 combined.
    const campaignParam = req.query.campaign;
    const campaignIds = (campaignParam && JEFRI_CAMPAIGN_IDS.includes(campaignParam))
      ? [campaignParam]
      : JEFRI_CAMPAIGN_IDS;

    const result = await client.query(QUERY, [campaignIds, from, to, CHANNEL]);
    const rows = result.rows;
    const campaignNameById = new Map(JEFRI_CAMPAIGNS.map((c) => [c.id, c.name]));

    // Current Stock: live from Shopify Admin API, not the Postgres snapshot.
    // Fetched once per request for every distinct variant needed.
    let liveStockById = new Map();
    let stockSourceError = null;
    if (!process.env.SHOPIFY_ADMIN_TOKEN) {
      stockSourceError = 'SHOPIFY_ADMIN_TOKEN missing — Current Stock unavailable';
    } else {
      try {
        liveStockById = await fetchLiveStock(rows.map((r) => r.live_stock_item_id));
      } catch (e) {
        console.error('[jefri/product-status] Live stock fetch failed:', e && e.message);
        stockSourceError = 'Could not fetch live stock from Shopify';
      }
    }

    let rangeStart = null, rangeEnd = null;
    const products = rows.map((r) => {
      rangeStart = r.range_start;
      rangeEnd = r.range_end;
      const roas = computeRoas(r.conv_value, r.cost);
      const tag = computeTag(r.impressions, r.clicks, roas, r.cost, r.conv_value);
      const rowCampaignIds = (r.campaign_ids || []).map(String);
      const liveStock = r.live_stock_item_id ? liveStockById.get(String(r.live_stock_item_id)) : undefined;
      return {
        productId: r.product_item_id,
        sku: r.sku || null,
        url: r.url || null,
        image: r.image || null,
        price: r.price !== null ? Number(r.price) : null,
        status: normalizeStatus(r.status),
        stock: liveStock === undefined || liveStock === null ? null : Number(liveStock),
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
        convValue: Number(r.conv_value) || 0,
        cost: Number(r.cost) || 0,
        roas: (roas === null || roas === Infinity) ? null : Math.round(roas),
        roasUnavailable: roas === null,
        roasAnomaly: roas === Infinity,
        tagKey: tag.key,
        tag: tag.label,
        campaignIds: rowCampaignIds,
        campaignNames: rowCampaignIds.map((id) => campaignNameById.get(id) || id),
      };
    });

    const summary = {
      totalProducts: products.length,
      heroes: products.filter((p) => p.tagKey === 'hero').length,
      villains: products.filter((p) => p.tagKey === 'villain').length,
      zombies: products.filter((p) => p.tagKey === 'zombie').length,
      sidekicks: products.filter((p) => p.tagKey === 'sidekick').length,
      unclassified: products.filter((p) => p.tagKey === 'unclassified').length,
      totalImpressions: products.reduce((s, p) => s + p.impressions, 0),
      totalClicks: products.reduce((s, p) => s + p.clicks, 0),
      totalConvValue: Math.round(products.reduce((s, p) => s + p.convValue, 0) * 100) / 100,
      totalCost: Math.round(products.reduce((s, p) => s + p.cost, 0) * 100) / 100,
    };

    const payload = {
      generatedAt: new Date().toISOString(),
      dateRange: { start: rangeStart, end: rangeEnd },
      campaignList: JEFRI_CAMPAIGNS,
      selectedCampaign: campaignIds.length === 1 ? campaignIds[0] : 'all',
      stockSourceError,
      summary,
      products,
    };
    JEFRI_CACHE.set(cacheKey, { data: payload, at: Date.now() });
    res.status(200).json(payload);
  } catch (err) {
    console.error('[jefri/product-status] Query failed:', err && err.message);
    res.status(500).json({ error: 'Could not load product status data. Please try again shortly.' });
  } finally {
    client.release();
  }
};

// ===== Mahima Requirement 1 — Product Performance Report (live, added 2026-07-23) =====
// Same DB (google_ads schema, DATABASE_URL) and same store (ledsone.de) as
// Jefri above -- placed inside the SAME IIFE so it can reuse
// getPool()/isValidDate()/fetchLiveStock()/shopifyGraphQL() rather than
// duplicating them (those are only in scope within this closure).
// Originally built 2026-07-10 as a static page (see
// evidence/mahima/2026-07-10_mahima_req1_rebuild_evidence.md) by joining
// google_ads.product_performance to google_ads.merchant_products via a
// normalized product-ID match (merchant_products.product_id sometimes
// stores the country segment in uppercase while product_performance's
// product_item_id has it lowercase -- exact same fix replicated here).
// Confirmed live 2026-07-23: a correlated LATERAL version of this join
// timed out (essentially an unindexed per-row nested loop over 509K
// merchant_products rows); rewritten as a plain hash-joinable query
// (DISTINCT ON dedup + equi-join) which runs in a few seconds instead.
const MAHIMA_CAMPAIGNS = [
    { id: '20763699505', name: 'Pmax DE | Mahi | Klarna | DE | All_Myid | MCV' },
    { id: '23684789991', name: 'Pmax DE | Mahi | Shoptimised|  BESTEN-BELEUCHTUNG | priceGT10_5 | MCV' },
    { id: '23053104908', name: 'Pmax DE | Mahi | Shoptimised | LIGHTINGSOLUTION | All_Myid_1 | MCV' },
    { id: '23431543574', name: 'Pmax DE | Mahi | Shoptimised |JAN-TOP-SALES | JanTopSales_3 | MCV' },
    { id: '23926509987', name: 'Shopping DE | Mahi | klarna | TOP-MAHI | Verkaufsprodukt | tROAS | 11/06' },
  ];
  const MAHIMA_CAMPAIGN_IDS = MAHIMA_CAMPAIGNS.map((c) => c.id);
  const MAHIMA_ATTR_COLUMNS = ['product_category', 'item_group_id', 'mpn', 'color', 'condition', 'description', 'product_types', 'availability', 'brand', 'price'];

  const MAHIMA_CACHE = new Map();
  const MAHIMA_CACHE_TTL_MS = 60 * 1000;

  const MAHIMA_QUERY = `
WITH bounds AS (
  SELECT MAX(date) AS max_date FROM google_ads.product_performance WHERE campaign_id = ANY($1::bigint[])
),
range AS (
  SELECT COALESCE($2::date, '2026-01-01'::date) AS start_date,
         COALESCE($3::date, (SELECT max_date FROM bounds))::date AS end_date
),
perf AS (
  SELECT pp.campaign_id, pp.product_item_id,
    SUM(pp.clicks) AS clicks, SUM(pp.impressions) AS impressions,
    SUM(pp.conversions) AS conversions, SUM(pp.cost) AS cost, SUM(pp.conversion_value) AS conv_value
  FROM google_ads.product_performance pp
  CROSS JOIN range r
  WHERE pp.campaign_id = ANY($1::bigint[])
    AND pp.date BETWEEN r.start_date AND r.end_date
  GROUP BY pp.campaign_id, pp.product_item_id
),
perf_norm AS (
  SELECT *,
    lower(CASE WHEN product_item_id ~* '^shopify_[a-z]+_[0-9]+_[0-9]+$'
      THEN split_part(product_item_id, '_', 3) ELSE product_item_id END) AS norm_id,
    CASE WHEN product_item_id ~* '^shopify_[a-z]+_[0-9]+_[0-9]+$'
      THEN split_part(product_item_id, '_', 4) ELSE NULL END AS variant_id
  FROM perf
),
merch_norm AS (
  SELECT DISTINCT ON (norm_id) * FROM (
    SELECT *, lower(CASE WHEN product_id ~* '^shopify_[a-z]+_[0-9]+_[0-9]+$'
        THEN split_part(product_id, '_', 3) ELSE product_id END) AS norm_id
    FROM google_ads.merchant_products
  ) x
  ORDER BY norm_id, (country = 'DE') DESC, (currency = 'EUR') DESC
),
d7 AS (
  SELECT product_item_id, SUM(cost) AS c7, SUM(conversion_value) AS v7
  FROM google_ads.product_performance
  WHERE campaign_id = ANY($1::bigint[]) AND date >= (SELECT max_date FROM bounds) - INTERVAL '6 days'
  GROUP BY product_item_id
),
d30 AS (
  SELECT product_item_id, SUM(cost) AS c30, SUM(conversion_value) AS v30
  FROM google_ads.product_performance
  WHERE campaign_id = ANY($1::bigint[]) AND date >= (SELECT max_date FROM bounds) - INTERVAL '29 days'
  GROUP BY product_item_id
),
camp AS (
  SELECT campaign_id, campaign_name FROM google_ads.campaigns WHERE campaign_id = ANY($1::bigint[])
)
SELECT p.campaign_id, c.campaign_name, p.product_item_id, p.variant_id,
  p.clicks, p.impressions, p.conversions, p.cost, p.conv_value,
  m.title, m.product_category, m.item_group_id, m.mpn, m.color, m.condition, m.description, m.product_types, m.availability, m.brand, m.price,
  d7.c7, d7.v7, d30.c30, d30.v30,
  (SELECT start_date FROM range) AS range_start, (SELECT end_date FROM range) AS range_end
FROM perf_norm p
JOIN camp c ON c.campaign_id = p.campaign_id
LEFT JOIN merch_norm m ON m.norm_id = p.norm_id
LEFT JOIN d7 ON d7.product_item_id = p.product_item_id
LEFT JOIN d30 ON d30.product_item_id = p.product_item_id
ORDER BY p.cost DESC NULLS LAST;
`;

  // Main ROAS is a raw multiplier (e.g. 3.3 = "3.30x"), matching the
  // original 2026-07-10 build exactly -- only the 7d/30d fixed-window ROAS
  // are percentages, confirmed by the page's own roasFmt1()/roasPctFmt1()
  // formatter functions using different units.
  function roasMultiplier(convValue, cost) {
    const cv = Number(convValue) || 0;
    const c = Number(cost) || 0;
    return c > 0 ? Math.round((cv / c) * 100) / 100 : 0;
  }
  function roasPct(convValue, cost) {
    const cv = Number(convValue) || 0;
    const c = Number(cost) || 0;
    return c > 0 ? Math.round((cv / c) * 10000) / 100 : 0;
  }

  // Replicated exactly from reports/mahima/data/2026-07-10_mahima_req1_status_action_builder.py
  // -- original used Merchant Center feed availability text; live version
  // substitutes live Shopify stock (more genuinely "live" than a feed
  // snapshot), same three status buckets the page's UI already filters by.
  function mahimaAction(status, missingAttribute, roas) {
    if (status === 'Not Available in PostgreSQL') return 'Not Available in PostgreSQL';
    if (status === 'Out Of Stock') return 'Pause';
    if (missingAttribute !== 'None missing') return 'Optimize';
    if (roas === 0) return 'Pause';
    if (roas >= 4.0) return 'Scale';
    if (roas >= 2.5) return 'Maintain';
    return 'Reduce';
  }

  async function mahimaReq1Handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const cacheKey = [req.query.from || '', req.query.to || ''].join('|');
    if (req.query.refresh !== '1') {
      const cached = MAHIMA_CACHE.get(cacheKey);
      if (cached && (Date.now() - cached.at) < MAHIMA_CACHE_TTL_MS) {
        res.status(200).json(cached.data);
        return;
      }
      if (cacheKey === '|') {
        const fs = require('fs');
        const path = require('path');
        const staticPath = path.join(__dirname, 'data', 'mahima-req1-snapshot.json');
        if (fs.existsSync(staticPath)) {
          const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
          const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
          MAHIMA_CACHE.set(cacheKey, { data: payload, at: Date.now() });
          res.status(200).json(payload);
          return;
        }
      }
    }

    const client = await (async () => getPool().connect())().catch((err) => {
      console.error('[mahima/req1] DB connect failed:', err && err.message);
      res.status(500).json({ error: 'Server not configured or database unreachable. Contact the site administrator.' });
      return null;
    });
    if (!client) return;

    try {
      const from = isValidDate(req.query.from) ? req.query.from : null;
      const to = isValidDate(req.query.to) ? req.query.to : null;
      const result = await client.query(MAHIMA_QUERY, [MAHIMA_CAMPAIGN_IDS, from, to]);
      const rows = result.rows;

      let liveStockById = new Map();
      let stockSourceError = null;
      if (!process.env.SHOPIFY_ADMIN_TOKEN) {
        stockSourceError = 'SHOPIFY_ADMIN_TOKEN missing — Current Stock unavailable';
      } else {
        try {
          liveStockById = await fetchLiveStock(rows.map((r) => r.variant_id));
        } catch (e) {
          console.error('[mahima/req1] Live stock fetch failed:', e && e.message);
          stockSourceError = 'Could not fetch live stock from Shopify';
        }
      }

      let rangeStart = null, rangeEnd = null;
      const products = rows.map((r) => {
        rangeStart = r.range_start; rangeEnd = r.range_end;
        const missing = [];
        for (const col of MAHIMA_ATTR_COLUMNS) {
          const v = r[col];
          if (v === null || v === undefined || v === '') missing.push(col);
        }
        const missingAttribute = r.title === null ? 'Not Available in PostgreSQL' : (missing.length ? missing.join(', ') : 'None missing');
        const liveStock = r.variant_id ? liveStockById.get(String(r.variant_id)) : undefined;
        const stock = liveStock === undefined || liveStock === null ? null : Number(liveStock);
        const status = stock === null ? 'Not Available in PostgreSQL' : (stock > 0 ? 'In Stock' : 'Out Of Stock');
        const roas = roasMultiplier(r.conv_value, r.cost);
        return {
          campaign: r.campaign_name,
          itemId: r.product_item_id,
          product: r.title || null,
          clicks: Number(r.clicks) || 0,
          impressions: Number(r.impressions) || 0,
          conversions: Math.round((Number(r.conversions) || 0) * 100) / 100,
          cost: Math.round((Number(r.cost) || 0) * 100) / 100,
          convValue: Math.round((Number(r.conv_value) || 0) * 100) / 100,
          roas,
          roas7d: roasPct(r.v7, r.c7),
          roas30d: roasPct(r.v30, r.c30),
          stock,
          status,
          missingAttribute,
          action: mahimaAction(status, missingAttribute, roas),
        };
      });

      const summary = {
        totalProducts: products.length,
        totalImpressions: products.reduce((s, p) => s + p.impressions, 0),
        totalClicks: products.reduce((s, p) => s + p.clicks, 0),
        totalCost: Math.round(products.reduce((s, p) => s + p.cost, 0) * 100) / 100,
        totalConvValue: Math.round(products.reduce((s, p) => s + p.convValue, 0) * 100) / 100,
      };

      const payload = {
        success: true,
        generatedAt: new Date().toISOString(),
        dateRange: { start: rangeStart, end: rangeEnd },
        campaignList: MAHIMA_CAMPAIGNS,
        stockSourceError,
        summary,
        products,
      };
      MAHIMA_CACHE.set(cacheKey, { data: payload, at: Date.now() });
      res.status(200).json(payload);
    } catch (err) {
      console.error('[mahima/req1] Query failed:', err && err.message);
      res.status(500).json({ success: false, error: 'Could not load product performance data. Please try again shortly.' });
    } finally {
      client.release();
    }
  }

  // ===== Mahima Requirement 2 — Stock Management (live, added 2026-07-23) =====
  // Same store (ledsone-de) and same closure as Req1 above -- reuses
  // shopifyGraphQL()/shopifySleep() rather than duplicating them.
  // Originally built 2026-07-09 as a static page (see
  // evidence/mahima/2026-07-09_mahima_req2_stock_management_evidence.md)
  // from an async bulkOperationRunQuery catalog export + a ShopifyQL
  // `FROM inventory ... SINCE -30d` report. Both of those are too slow to
  // run inside a single request (bulk exports are async, can take
  // minutes), so this live version instead paginates the catalog via
  // `products(first:50)` + variants (same shape as SUK-R3's
  // r3FetchAllVariants below) and sums last-30-day units sold from paid,
  // non-cancelled orders directly -- same total end result (current stock
  // + units sold per SKU) without the bulk/ShopifyQL machinery.
  const MAHIMA2_CACHE = new Map();
  const MAHIMA2_CACHE_TTL_MS = 60 * 1000;

  const MAHIMA2_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 50, after: $after) {
    edges {
      node {
        title
        productType
        variants(first: 100) {
          edges {
            node {
              id
              sku
              inventoryItem {
                tracked
                inventoryLevels(first: 5) {
                  edges { node { quantities(names: ["available"]) { name quantity } } }
                }
              }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

  const MAHIMA2_ORDERS_QUERY = `
query($after: String, $q: String) {
  orders(first: 100, after: $after, query: $q) {
    edges {
      node {
        cancelledAt
        test
        displayFinancialStatus
        lineItems(first: 100) {
          edges {
            node {
              quantity
              refundableQuantity
              variant { id }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

  async function mahima2FetchAllVariants() {
    const rows = [];
    let after = null;
    let hasNext = true;
    while (hasNext) {
      const data = await shopifyGraphQL(MAHIMA2_PRODUCTS_QUERY, { after });
      for (const edge of data.products.edges) {
        const p = edge.node;
        for (const vEdge of p.variants.edges) {
          const v = vEdge.node;
          const rawSku = (v.sku || '').toString().trim();
          const tracked = v.inventoryItem ? v.inventoryItem.tracked : false;
          const levels = v.inventoryItem ? v.inventoryItem.inventoryLevels.edges.map((e) => e.node) : [];
          const currentStock = tracked
            ? levels.reduce((sum, l) => {
                const avail = l.quantities.find((q) => q.name === 'available');
                return sum + (avail ? avail.quantity : 0);
              }, 0)
            : null;
          rows.push({
            variantId: v.id,
            sku: rawSku || null,
            title: p.title || null,
            category: p.productType || null,
            currentStock,
          });
        }
      }
      hasNext = data.products.pageInfo.hasNextPage;
      after = data.products.pageInfo.endCursor;
    }
    return rows;
  }

  async function mahima2FetchUnitsSold30d(startISO, endISO) {
    const q = `created_at:>=${startISO} AND created_at:<${endISO}`;
    const soldByVariant = new Map();
    let after = null;
    let hasNext = true;
    while (hasNext) {
      const data = await shopifyGraphQL(MAHIMA2_ORDERS_QUERY, { after, q });
      for (const edge of data.orders.edges) {
        const o = edge.node;
        if (o.cancelledAt || o.test || o.displayFinancialStatus === 'VOIDED') continue;
        for (const liEdge of o.lineItems.edges) {
          const li = liEdge.node;
          if (!li.variant || !li.variant.id) continue;
          const netQty = typeof li.refundableQuantity === 'number' ? li.refundableQuantity : li.quantity;
          soldByVariant.set(li.variant.id, (soldByVariant.get(li.variant.id) || 0) + netQty);
        }
      }
      hasNext = data.orders.pageInfo.hasNextPage;
      after = data.orders.pageInfo.endCursor;
    }
    return soldByVariant;
  }

  // Replicated exactly from the 2026-07-09 static build's rules (see
  // mahima.html "Data Source & Calculation Rules" for Requirement 2).
  function mahima2Status(avgDaily, daysRemaining) {
    if (avgDaily === 0) return 'Never Moving';
    if (daysRemaining <= 7) return 'Fast Moving';
    if (daysRemaining <= 60) return 'Healthy';
    return 'Slow Moving';
  }
  function mahima2Action(status) {
    if (status === 'Fast Moving') return 'Restock';
    if (status === 'Healthy') return 'Monitor';
    if (status === 'Slow Moving') return "Don't Restock Yet";
    return 'Stop Purchasing';
  }

  async function mahimaReq2Handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.query.refresh !== '1') {
      const cached = MAHIMA2_CACHE.get('all');
      if (cached && (Date.now() - cached.at) < MAHIMA2_CACHE_TTL_MS) {
        res.status(200).json(cached.data);
        return;
      }
      const fs = require('fs');
      const path = require('path');
      const staticPath = path.join(__dirname, 'data', 'mahima-req2-snapshot.json');
      if (fs.existsSync(staticPath)) {
        const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
        const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
        MAHIMA2_CACHE.set('all', { data: payload, at: Date.now() });
        res.status(200).json(payload);
        return;
      }
    }

    if (!process.env.SHOPIFY_ADMIN_TOKEN) {
      res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
      return;
    }

    try {
      const now = new Date();
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startISO = start.toISOString();
      const endISO = now.toISOString();

      const [variantRows, soldByVariant] = await Promise.all([
        mahima2FetchAllVariants(),
        mahima2FetchUnitsSold30d(startISO, endISO),
      ]);

      const rows = variantRows.map((v) => {
        const sales30d = soldByVariant.get(v.variantId) || 0;
        const avgDaily = Math.round((sales30d / 30) * 100) / 100;
        const daysRemaining = v.currentStock != null && avgDaily > 0 ? Math.round(v.currentStock / avgDaily) : null;
        const status = v.currentStock == null ? 'Data Missing' : mahima2Status(avgDaily, daysRemaining == null ? Infinity : daysRemaining);
        const action = v.currentStock == null ? 'Data Missing' : mahima2Action(status);
        return {
          sk: v.sku,
          ti: v.title,
          ca: v.category,
          st: v.currentStock,
          sa: sales30d,
          ad: v.currentStock == null ? null : avgDaily,
          dr: daysRemaining == null ? 'N/A' : daysRemaining,
          stat: status,
          ac: action,
        };
      });

      const summary = {
        totalSkus: rows.length,
        fastMoving: rows.filter((r) => r.stat === 'Fast Moving').length,
        healthy: rows.filter((r) => r.stat === 'Healthy').length,
        slowMoving: rows.filter((r) => r.stat === 'Slow Moving').length,
        neverMoving: rows.filter((r) => r.stat === 'Never Moving').length,
        dataMissing: rows.filter((r) => r.stat === 'Data Missing').length,
      };

      const payload = { success: true, generatedAt: new Date().toISOString(), summary, rows };
      MAHIMA2_CACHE.set('all', { data: payload, at: Date.now() });
      res.status(200).json(payload);
    } catch (err) {
      console.error('[mahima/req2] Query failed:', err && err.message);
      res.status(500).json({ success: false, error: 'Could not load stock data. Please try again shortly.' });
    }
  }

  // ===== Jefri Requirement 3 — 3-Period Product Comparison (T-03, added 2026-07-24) =====
  // Business requirement: compare each product's Conv. Value / ROAS across
  // three FIXED calendar-quarter windows (not rolling) to flag Improved /
  // Same / Drop, and classify into Performance Tiers by revenue
  // contribution rank + ROAS. Source: google_ads.product_performance (same
  // table/campaign scope as Req1), SKU resolved via the same
  // listings.shopify_listings(_parent_child_mapping) join as Req1 — no new
  // tables, no invented columns.
  //
  // Known data gap (disclosed, not fabricated): product_performance for
  // Jefri's 5 campaigns only starts 2025-05-12 — the "Next 3 Months in
  // Previous Year" window (Apr 1 - Jun 30 2025) has zero rows for
  // 2025-04-01 through 2025-05-11 (campaigns didn't exist/weren't tracked
  // yet). Those rows are genuinely absent from Postgres, not zeroed out or
  // guessed — a product with no py_conv_value/py_cost simply shows "N/A"
  // for that block, same convention as Req1's "Data Missing".
  const JEFRI_R3_CACHE = new Map();
  const JEFRI_R3_CACHE_TTL_MS = 60 * 1000;
  const JEFRI_R3_STATIC_KEY = 'default';

  const JEFRI_R3_QUERY = `
WITH period_bounds AS (
  SELECT
    '2025-10-01'::date AS prev_start, '2025-12-31'::date AS prev_end,
    '2026-01-01'::date AS last_start, '2026-03-31'::date AS last_end,
    '2025-04-01'::date AS py_start,   '2025-06-30'::date AS py_end
),
prev AS (
  SELECT pp.product_item_id, SUM(pp.conversion_value) AS conv_value, SUM(pp.cost) AS cost
  FROM google_ads.product_performance pp CROSS JOIN period_bounds b
  WHERE pp.campaign_id = ANY($1::bigint[]) AND pp.date BETWEEN b.prev_start AND b.prev_end
  GROUP BY pp.product_item_id
),
last3 AS (
  SELECT pp.product_item_id, SUM(pp.conversion_value) AS conv_value, SUM(pp.cost) AS cost
  FROM google_ads.product_performance pp CROSS JOIN period_bounds b
  WHERE pp.campaign_id = ANY($1::bigint[]) AND pp.date BETWEEN b.last_start AND b.last_end
  GROUP BY pp.product_item_id
),
py AS (
  SELECT pp.product_item_id, SUM(pp.conversion_value) AS conv_value, SUM(pp.cost) AS cost
  FROM google_ads.product_performance pp CROSS JOIN period_bounds b
  WHERE pp.campaign_id = ANY($1::bigint[]) AND pp.date BETWEEN b.py_start AND b.py_end
  GROUP BY pp.product_item_id
),
all_ids AS (
  SELECT product_item_id FROM prev
  UNION
  SELECT product_item_id FROM last3
  UNION
  SELECT product_item_id FROM py
),
ranked AS (
  SELECT product_item_id,
    ROW_NUMBER() OVER (ORDER BY COALESCE(conv_value,0) DESC) AS rn,
    COUNT(*) OVER () AS total_n
  FROM last3
),
resolved_ids AS (
  SELECT ai.product_item_id,
    CASE WHEN ai.product_item_id LIKE 'shopify\\_%'
         THEN split_part(ai.product_item_id, '_', array_length(string_to_array(ai.product_item_id, '_'), 1))
         ELSE ai.product_item_id
    END AS shopify_id
  FROM all_ids ai
),
child_fallback AS (
  SELECT m.parent_id AS parent_listing_id, MIN(child.id) AS child_listing_id
  FROM listings.shopify_listings_parent_child_mapping m
  JOIN listings.shopify_listings child ON child.id = m.child_id AND child.all_list = 1
  GROUP BY m.parent_id
),
resolved_listing AS (
  SELECT sl.item_id,
    COALESCE(NULLIF(sl.sku, ''), child_sl.sku) AS sku
  FROM listings.shopify_listings sl
  LEFT JOIN child_fallback cf ON cf.parent_listing_id = sl.id
  LEFT JOIN listings.shopify_listings child_sl ON child_sl.id = cf.child_listing_id
  WHERE sl.channel = $2
)
SELECT
  ai.product_item_id,
  rl.sku,
  prev.conv_value AS prev_conv_value, prev.cost AS prev_cost,
  last3.conv_value AS last_conv_value, last3.cost AS last_cost,
  py.conv_value AS py_conv_value, py.cost AS py_cost,
  r.rn, r.total_n
FROM all_ids ai
JOIN resolved_ids ri ON ri.product_item_id = ai.product_item_id
LEFT JOIN resolved_listing rl ON rl.item_id = ri.shopify_id
LEFT JOIN prev ON prev.product_item_id = ai.product_item_id
LEFT JOIN last3 ON last3.product_item_id = ai.product_item_id
LEFT JOIN py ON py.product_item_id = ai.product_item_id
LEFT JOIN ranked r ON r.product_item_id = ai.product_item_id
ORDER BY last3.conv_value DESC NULLS LAST;
`;

  function jefriR3Roas(convValue, cost) {
    const cv = Number(convValue) || 0;
    const c = Number(cost) || 0;
    if (c > 0) return (cv / c) * 100;
    return null; // no spend in this period — ROAS not meaningful, not zero
  }

  function jefriR3PctChange(lastVal, prevVal) {
    const l = Number(lastVal), p = Number(prevVal);
    if (!isFinite(p) || p === 0) return null; // no baseline to compare against
    if (!isFinite(l)) return null;
    return ((l - p) / p) * 100;
  }

  // Status: "using Conv. Value OR ROAS" — if EITHER metric's % change hits a
  // threshold, that status applies. Evaluated Improved -> Drop -> Same so a
  // clear improvement signal from either metric always wins first. Changes
  // that fall in neither range (roughly -11% to -29%, and the sliver between
  // the Same/Improved boundaries) are genuinely undefined by the spec as
  // given — left as "—" rather than guessing which bucket they belong in.
  function jefriR3Status(lastCV, prevCV, lastRoas, prevRoas) {
    const cvChange = jefriR3PctChange(lastCV, prevCV);
    const roasChange = jefriR3PctChange(lastRoas, prevRoas);
    const changes = [cvChange, roasChange].filter((v) => v !== null);
    if (!changes.length) return null;
    if (changes.some((v) => v >= 15)) return 'Improved';
    if (changes.some((v) => v <= -30)) return 'Drop';
    if (changes.some((v) => v >= -10 && v <= 14)) return 'Same';
    return null;
  }

  function jefriR3Tier(rn, totalN, lastRoas) {
    if (!rn || !totalN || lastRoas === null) return null;
    const pct = rn / totalN; // 1/total_n .. 1.0, i.e. 0.01 = top 1%
    if (lastRoas >= 400 && pct <= 0.20) return 'High';
    if (lastRoas >= 200 && lastRoas <= 399 && pct > 0.30 && pct <= 0.50) return 'Mid';
    return null;
  }

  async function jefriReq3Handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.query.refresh !== '1') {
      const cached = JEFRI_R3_CACHE.get(JEFRI_R3_STATIC_KEY);
      if (cached && (Date.now() - cached.at) < JEFRI_R3_CACHE_TTL_MS) {
        res.status(200).json(cached.data);
        return;
      }
      const fs = require('fs');
      const path = require('path');
      const staticPath = path.join(__dirname, 'data', 'jefri-req3-snapshot.json');
      if (fs.existsSync(staticPath)) {
        const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
        const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
        JEFRI_R3_CACHE.set(JEFRI_R3_STATIC_KEY, { data: payload, at: Date.now() });
        res.status(200).json(payload);
        return;
      }
    }

    const client = await (async () => getPool().connect())().catch((err) => {
      console.error('[jefri/req3] DB connect failed:', err && err.message);
      res.status(500).json({ success: false, error: 'Server not configured or database unreachable. Contact the site administrator.' });
      return null;
    });
    if (!client) return;

    try {
      const result = await client.query(JEFRI_R3_QUERY, [JEFRI_CAMPAIGN_IDS, CHANNEL]);
      const rows = result.rows.map((r) => {
        const prevRoas = jefriR3Roas(r.prev_conv_value, r.prev_cost);
        const lastRoas = jefriR3Roas(r.last_conv_value, r.last_cost);
        const pyRoas = jefriR3Roas(r.py_conv_value, r.py_cost);
        const status = jefriR3Status(r.last_conv_value, r.prev_conv_value, lastRoas, prevRoas);
        const tier = jefriR3Tier(r.rn ? Number(r.rn) : null, r.total_n ? Number(r.total_n) : null, lastRoas);
        return {
          productId: r.product_item_id,
          sku: r.sku || null,
          tier,
          prev: { convValue: r.prev_conv_value === null ? null : Number(r.prev_conv_value), roas: prevRoas === null ? null : Math.round(prevRoas) },
          last: { convValue: r.last_conv_value === null ? null : Number(r.last_conv_value), roas: lastRoas === null ? null : Math.round(lastRoas), status },
          py: { convValue: r.py_conv_value === null ? null : Number(r.py_conv_value), roas: pyRoas === null ? null : Math.round(pyRoas) },
        };
      });

      const summary = {
        totalProducts: rows.length,
        high: rows.filter((r) => r.tier === 'High').length,
        mid: rows.filter((r) => r.tier === 'Mid').length,
        improved: rows.filter((r) => r.last.status === 'Improved').length,
        same: rows.filter((r) => r.last.status === 'Same').length,
        drop: rows.filter((r) => r.last.status === 'Drop').length,
      };

      const payload = {
        success: true,
        generatedAt: new Date().toISOString(),
        periods: {
          prev: { label: 'Previous 3 Months (Oct-Dec 2025)', start: '2025-10-01', end: '2025-12-31' },
          last: { label: 'Last 3 Months (Jan-Mar 2026)', start: '2026-01-01', end: '2026-03-31' },
          py: { label: 'Next 3 Months in Previous Year (Apr-Jun 2025)', start: '2025-04-01', end: '2025-06-30' },
        },
        dataNote: 'google_ads.product_performance for Jefri\'s 5 campaigns begins 2025-05-12 — Apr 1-May 11 2025 has no rows (pre-dates campaign tracking), so py figures for that sub-range are genuinely absent, not zero.',
        summary,
        rows,
      };
      JEFRI_R3_CACHE.set(JEFRI_R3_STATIC_KEY, { data: payload, at: Date.now() });
      res.status(200).json(payload);
    } catch (err) {
      console.error('[jefri/req3] Query failed:', err && err.message);
      res.status(500).json({ success: false, error: 'Could not load comparison data. Please try again shortly.' });
    } finally {
      client.release();
    }
  }

  jefriProductStatusHandler.mahimaReq1Handler = mahimaReq1Handler;
  jefriProductStatusHandler.mahimaReq2Handler = mahimaReq2Handler;
  jefriProductStatusHandler.jefriReq3Handler = jefriReq3Handler;
  return jefriProductStatusHandler;
})();

// ===== Jefri Requirement 2 — Search Terms Labels (2026-07-22) =====
// Server-side only: reads DATABASE_URL from env, never exposed to the
// client. Read-only queries only -- no writes, no schema changes.
// Uses its own isolated pg Pool (not shared with Req1's module above)
// so this new feature can never affect the already-working Req1 code.
//
// Source tables (read-only PostgreSQL, discovered via
// mcp__ledsone-db-mcp__search_objects, 2026-07-22):
//   google_ads.campaign_search_term_data      (Shopping/Search campaigns)
//   google_ads.pmax_campaign_search_term_data  (Performance Max campaigns)
// Both share: search_term, match_type, clicks, impressions, cost,
// conversions, conversions_value, campaign_id, date. Jefri's 5 campaign
// IDs (same JEFRI_CAMPAIGNS list as Req1, ledsone.de) are shared across
// both tables since his campaigns are a mix of Shopping and PMax types --
// a search term can appear in either or both, so results are UNIONed
// and re-aggregated by (search_term, match_type).
const jefriSearchTermsHandlerModule = (function() {
const { Pool } = require('pg');

let pool2;
function getPool2() {
  if (!pool2) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString && !process.env.PGHOST) {
      throw new Error('Server not configured: DATABASE_URL (or PGHOST/PGUSER/PGPASSWORD) missing');
    }
    pool2 = new Pool({
      connectionString: connectionString || undefined,
      host: connectionString ? undefined : process.env.PGHOST,
      port: connectionString ? undefined : (process.env.PGPORT ? Number(process.env.PGPORT) : 5432),
      database: connectionString ? undefined : process.env.PGDATABASE,
      user: connectionString ? undefined : process.env.PGUSER,
      password: connectionString ? undefined : process.env.PGPASSWORD,
    });
  }
  return pool2;
}

const JEFRI_CAMPAIGN_IDS_R2 = ['23141810147', '23411228109', '22539594891', '23473840779', '23340277562'];

const QUERY_R2 = `
  SELECT search_term, match_type,
         SUM(clicks)::bigint AS clicks,
         SUM(impressions)::bigint AS impressions,
         SUM(cost)::numeric AS cost,
         SUM(conversions)::numeric AS conversions,
         SUM(conversions_value)::numeric AS conv_value
  FROM (
    SELECT search_term, match_type, clicks, impressions, cost, conversions, conversions_value
    FROM google_ads.campaign_search_term_data
    WHERE campaign_id = ANY($1) AND date >= CURRENT_DATE - INTERVAL '90 days'
    UNION ALL
    SELECT search_term, match_type, clicks, impressions, cost, conversions, conversions_value
    FROM google_ads.pmax_campaign_search_term_data
    WHERE campaign_id = ANY($1) AND date >= CURRENT_DATE - INTERVAL '90 days'
  ) t
  WHERE search_term IS NOT NULL
  GROUP BY search_term, match_type
`;

// Tagging rules (Jefri Req2, updated 2026-07-22 per revised business rules
// -- supersedes the earlier version of this function; the earlier version's
// Hero/Villain boundary ambiguity at exactly ROAS=400% is now resolved
// explicitly by the updated spec's own validation example: clicks=763,
// ROAS=400%, conversions=2 -> Hero, confirming >=400 is inclusive on the
// Hero side):
//   Hero:     clicks >= 3 AND ROAS >= 400%
//   Villain:  clicks >= 3 AND (ROAS < 400% OR conversions = 0)
//   Zombie:   impressions > 0 AND clicks = 0
//   Sidekick: clicks BETWEEN 1 AND 2 AND ROAS >= 400%
//   (none match): tag is left empty ('')
function classifyTag(clicks, impressions, cost, conversions, roas) {
  if (clicks >= 3) {
    if (roas >= 400) return 'Hero';
    if (roas < 400 || conversions === 0) return 'Villain';
  }
  if (impressions > 0 && clicks === 0) return 'Zombie';
  if (clicks >= 1 && clicks <= 2 && roas >= 400) return 'Sidekick';
  return '';
}

// Same short-TTL cache pattern as Req1's JEFRI_CACHE, kept in its own Map
// (never shared with Req1) -- this query returns 50k+ rows and was taking
// ~10s on every single request with no caching at all. 60s is short
// enough to stay reasonably live, long enough to absorb repeat hits from
// the UI (tab switches, filter changes, accidental double-refresh).
const JEFRI_CACHE2 = new Map();
const JEFRI_CACHE2_TTL_MS = 60 * 1000;
const JEFRI_CACHE2_KEY = 'jefri-search-terms';

async function jefriSearchTermsHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.query.refresh !== '1') {
    const cached = JEFRI_CACHE2.get(JEFRI_CACHE2_KEY);
    if (cached && (Date.now() - cached.at) < JEFRI_CACHE2_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }
    // Static snapshot, added 2026-07-23: hourly-regenerated file (see
    // api/scripts/generate-snapshots.js postgres + the hourly GitHub Actions
    // workflow) served instead of a live Postgres query. The in-memory
    // JEFRI_CACHE2 above is faster when it's warm but resets on every cold
    // start; this file survives across deploys/cold starts too.
    const fs = require('fs');
    const path = require('path');
    const staticPath = path.join(__dirname, 'data', 'jefri-search-terms-snapshot.json');
    if (fs.existsSync(staticPath)) {
      const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
      const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
      JEFRI_CACHE2.set(JEFRI_CACHE2_KEY, { data: payload, at: Date.now() });
      res.status(200).json(payload);
      return;
    }
  }

  let client;
  try {
    client = await getPool2().connect();
  } catch (err) {
    console.error('[jefri/search-terms] DB connect failed:', err && err.message);
    res.status(500).json({ error: 'Server not configured or database unreachable. Contact the site administrator.' });
    return;
  }

  try {
    const result = await client.query(QUERY_R2, [JEFRI_CAMPAIGN_IDS_R2]);
    const rows = result.rows.map((r) => {
      const clicks = Number(r.clicks) || 0;
      const impressions = Number(r.impressions) || 0;
      const cost = Number(r.cost) || 0;
      const conversions = Number(r.conversions) || 0;
      const convValue = Number(r.conv_value) || 0;
      const ctr = impressions > 0 ? round2((clicks / impressions) * 100) : 0;
      const avgCpc = clicks > 0 ? round2(cost / clicks) : 0;
      const costPerConversion = conversions > 0 ? round2(cost / conversions) : null;
      const roas = cost > 0 ? round2((convValue / cost) * 100) : 0;
      const tag = classifyTag(clicks, impressions, cost, conversions, roas);
      return {
        searchTerm: r.search_term,
        matchType: r.match_type,
        clicks, impressions, ctr, avgCpc, cost,
        conversionValue: round2(convValue),
        conversions: round2(conversions),
        costPerConversion,
        roas,
        tag,
      };
    });

    const payload = {
      success: true,
      staff: { name: 'Jefri', department: 'Google Ads', store: 'ledsone.de' },
      reportPeriod: { label: 'Last 90 Days', days: 90 },
      source: {
        scope: `Jefri's 5 campaigns (${JEFRI_CAMPAIGN_IDS_R2.join(', ')}), search terms from both Shopping/Search and Performance Max campaigns, rolling last 90 days`,
        tables: ['google_ads.campaign_search_term_data', 'google_ads.pmax_campaign_search_term_data'],
      },
      summary: {
        totalTerms: rows.length,
        hero: rows.filter((r) => r.tag === 'Hero').length,
        villain: rows.filter((r) => r.tag === 'Villain').length,
        zombie: rows.filter((r) => r.tag === 'Zombie').length,
        sidekick: rows.filter((r) => r.tag === 'Sidekick').length,
      },
      rows,
      meta: { generatedAt: new Date().toISOString() },
    };
    JEFRI_CACHE2.set(JEFRI_CACHE2_KEY, { data: payload, at: Date.now() });
    res.status(200).json(payload);
  } catch (err) {
    console.error('[jefri/search-terms] Query failed:', err && err.message);
    res.status(500).json({ error: 'Could not load search term data. Please try again shortly.' });
  } finally {
    if (client) client.release();
  }
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

return jefriSearchTermsHandler;
})();


// ===== Mahima Requirement 3 — Search Terms Report (Keep / Exclude), live version (2026-07-23) =====
// Server-side only: reads DATABASE_URL from env, never exposed to the client.
// Read-only queries only -- no writes, no schema changes. Own isolated pg Pool.
//
// Replaces the earlier one-off, manually-exported static report at
// reports/mahima/mahima-requirement-3-search-terms-report.html (built from
// hand-pulled 30d/7d PostgreSQL JSON exports on 2026-07-09/10). Unlike Jefri's
// Req2 (scoped to 5 named campaigns), Mahima's Req3 is account-wide — every
// campaign under ledsone.de (account_id 9031058245), Shopping/Search + PMax,
// matching the original static report's scope.
//
// Classification logic (Keep/Exclude + intent/priority/trend) ported 1:1 from
// reports/mahima/data/2026-07-09_mahima_req3_search_terms_builder.py — see
// that file for the original Python and its rationale/word lists.
const mahimaSearchTermsHandlerModule = (function() {
const { Pool } = require('pg');

let pool3;
function getPool3() {
  if (!pool3) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString && !process.env.PGHOST) {
      throw new Error('Server not configured: DATABASE_URL (or PGHOST/PGUSER/PGPASSWORD) missing');
    }
    pool3 = new Pool({
      connectionString: connectionString || undefined,
      host: connectionString ? undefined : process.env.PGHOST,
      port: connectionString ? undefined : (process.env.PGPORT ? Number(process.env.PGPORT) : 5432),
      database: connectionString ? undefined : process.env.PGDATABASE,
      user: connectionString ? undefined : process.env.PGUSER,
      password: connectionString ? undefined : process.env.PGPASSWORD,
    });
  }
  return pool3;
}

const MAHIMA_ACCOUNT_ID = '9031058245'; // ledsone.de

const QUERY_MAHIMA_R3 = `
  WITH combined AS (
    SELECT c.search_term, c.match_type, c.campaign_id, cam.campaign_name, c.date,
           c.clicks, c.impressions, c.cost, c.conversions, c.conversions_value
    FROM google_ads.campaign_search_term_data c
    JOIN google_ads.campaigns cam ON cam.campaign_id = c.campaign_id
    WHERE cam.account_id = $1::bigint AND c.date >= CURRENT_DATE - INTERVAL '30 days'
    UNION ALL
    SELECT p.search_term, p.match_type, p.campaign_id, cam.campaign_name, p.date,
           p.clicks, p.impressions, p.cost, p.conversions, p.conversions_value
    FROM google_ads.pmax_campaign_search_term_data p
    JOIN google_ads.campaigns cam ON cam.campaign_id = p.campaign_id
    WHERE cam.account_id = $1::bigint AND p.date >= CURRENT_DATE - INTERVAL '30 days'
  )
  SELECT search_term, match_type, campaign_id,
         MAX(campaign_name) AS campaign_name,
         SUM(clicks)::bigint AS clicks,
         SUM(impressions)::bigint AS impressions,
         SUM(cost)::numeric AS cost,
         SUM(conversions)::numeric AS conversions,
         SUM(conversions_value)::numeric AS conv_value,
         SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN cost ELSE 0 END)::numeric AS cost_7d,
         SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN conversions_value ELSE 0 END)::numeric AS conv_value_7d
  FROM combined
  WHERE search_term IS NOT NULL
  GROUP BY search_term, match_type, campaign_id
`;

// ---- Intent classifier (verbatim port of classify_intent() from the Python builder) ----
const COMPETITOR_TERMS = [
  'amazon', 'ebay', 'ikea', 'obi', 'hornbach', 'bauhaus', 'wayfair',
  'lampenwelt', 'westwing', 'otto.de', ' otto ', 'conrad', 'segmuller',
  'segmüller', 'poco', 'moebel', 'möbel', 'hagebau', 'toom', 'globus baumarkt',
  'leroy merlin', 'casa', 'made.com',
];
const NONDE_MARKERS = [
  ' the ', ' and ', ' for ', ' with ', ' cheap ', ' best ', ' buy ',
  'light fixture', 'ceiling light', 'pendant light', 'wall light',
  'chandelier', 'led strip light', 'light bulb', 'lamp shade',
];
const LOW_INTENT_TERMS = [
  'gunstig', 'günstig', 'billig', 'gebraucht', 'kostenlos', 'free',
  'cheap', 'cheapest', 'discount', 'rabatt', 'sale', 'sonderangebot',
  'second hand', 'gebrauchte',
];
const HIGH_INTENT_PRODUCT_WORDS = [
  'lampe', 'leuchte', 'leuchten', 'beleuchtung', 'led', 'pendelleuchte',
  'deckenlampe', 'wandlampe', 'stehlampe', 'tischlampe', 'lampenschirm',
  'kronleuchter', 'strahler', 'spot', 'trafo', 'led-streifen', 'lichterkette',
  'hangeleuchte', 'hängeleuchte', 'kabel', 'fassung', 'e27', 'gu10',
];
const GERMAN_MARKERS = [
  'ü', 'ö', 'ä', 'ß', 'für', 'mit', 'und', 'aus', 'an ', 'decke', 'wand',
  'netzteil', 'abzweigdose', 'leitung', 'kabel', 'stecker', 'dimmbar',
  'schalter', 'halterung', 'birne', 'flach', 'volt', 'watt', 'warmweiss',
  'kaltweiss', 'dimmer', 'wasserdicht', 'aussen', 'innen', 'steckdose',
  'verlaengerung', 'verlängerung', 'adapter', 'anschluss', 'buchse',
];

function classifyIntent(term) {
  const t = ' ' + String(term || '').toLowerCase().trim() + ' ';
  if (COMPETITOR_TERMS.some((c) => t.includes(c))) return 'Competitor brand';

  const hasDeMarker = GERMAN_MARKERS.some((m) => t.includes(m)) || HIGH_INTENT_PRODUCT_WORDS.some((w) => t.includes(w));
  const nonAscii = /[^\x00-\x7F]/.test(term || '');
  const looksEnglishPhrase = NONDE_MARKERS.some((m) => t.includes(m));
  if (looksEnglishPhrase && !hasDeMarker && !nonAscii) return 'Non-DE / mixed language';

  if (LOW_INTENT_TERMS.some((w) => t.includes(w))) return 'Low-intent / bargain';
  if (HIGH_INTENT_PRODUCT_WORDS.some((w) => t.includes(w))) return 'Generic - high';
  return 'Generic - medium';
}

function recommendedAction(conversions, intent) {
  if (conversions > 0) return 'Keep';
  if (intent === 'Competitor brand') return 'Exclude - competitor term, add as negative phrase';
  if (intent === 'Non-DE / mixed language') return 'Exclude - low volume, non-native phrasing';
  return 'Exclude - add as negative exact match';
}

function trendOf(roas7, roas30, conversions) {
  if (conversions === 0 && roas7 === roas30) return 'Flat, no conv.';
  if (roas7 > roas30) return 'Rising';
  if (roas7 < roas30) return 'Slight dip';
  return 'Flat';
}

function priorityOf(action, roas, cost) {
  if (action.startsWith('Exclude')) return cost >= 5 ? 'High' : (cost > 0 ? 'Medium' : 'Low');
  if (action === 'Keep') return roas >= 2 ? 'High' : 'Medium';
  return 'Low';
}

function r3round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

const MAHIMA_R3_CACHE = new Map();
const MAHIMA_R3_CACHE_TTL_MS = 60 * 1000;
const MAHIMA_R3_CACHE_KEY = 'mahima-search-terms';

async function mahimaSearchTermsHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.query.refresh !== '1') {
    const cached = MAHIMA_R3_CACHE.get(MAHIMA_R3_CACHE_KEY);
    if (cached && (Date.now() - cached.at) < MAHIMA_R3_CACHE_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }
    const fs = require('fs');
    const path = require('path');
    const staticPath = path.join(__dirname, 'data', 'mahima-search-terms-snapshot.json');
    if (fs.existsSync(staticPath)) {
      const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
      const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
      MAHIMA_R3_CACHE.set(MAHIMA_R3_CACHE_KEY, { data: payload, at: Date.now() });
      res.status(200).json(payload);
      return;
    }
  }

  let client;
  try {
    client = await getPool3().connect();
  } catch (err) {
    console.error('[mahima/search-terms] DB connect failed:', err && err.message);
    res.status(500).json({ error: 'Server not configured or database unreachable. Contact the site administrator.' });
    return;
  }

  try {
    const result = await client.query(QUERY_MAHIMA_R3, [MAHIMA_ACCOUNT_ID]);
    const rows = result.rows.map((r) => {
      const clicks = Number(r.clicks) || 0;
      const impressions = Number(r.impressions) || 0;
      const cost = Number(r.cost) || 0;
      const conversions = Number(r.conversions) || 0;
      const convValue = Number(r.conv_value) || 0;
      const cost7d = Number(r.cost_7d) || 0;
      const convValue7d = Number(r.conv_value_7d) || 0;

      const ctr = impressions > 0 ? r3round2((clicks / impressions) * 100) : 0;
      const avgCpc = clicks > 0 ? r3round2(cost / clicks) : null;
      const convRate = clicks > 0 ? r3round2((conversions / clicks) * 100) : 0;
      const roas30 = cost > 0 ? r3round2(convValue / cost) : 0; // ratio, e.g. 2.5 = 250%
      const roas7 = cost7d > 0 ? r3round2(convValue7d / cost7d) : 0;
      const costPerConv = conversions > 0 ? r3round2(cost / conversions) : null;

      const matchTypeRaw = r.match_type;
      const matchType = matchTypeRaw === 'Performance Max' ? 'Performance Max (category)' : matchTypeRaw;

      const intent = classifyIntent(r.search_term);
      const action = recommendedAction(conversions, intent);
      const trend = trendOf(roas7, roas30, conversions);
      const priority = priorityOf(action, roas30, cost);

      return {
        searchTerm: r.search_term,
        campaign: r.campaign_name,
        matchType,
        impressions, clicks, ctr, avgCpc, cost,
        conversions: r3round2(conversions),
        convRate,
        convValue: r3round2(convValue),
        roas: roas30,
        roas7d: roas7,
        roas30d: roas30,
        costPerConv,
        queryIntent: intent,
        trend,
        priority,
        action,
      };
    });

    rows.sort((a, b) => (b.cost || 0) - (a.cost || 0));

    const totalCost = rows.reduce((s, r) => s + (r.cost || 0), 0);
    const totalConvValue = rows.reduce((s, r) => s + (r.convValue || 0), 0);
    const payload = {
      success: true,
      staff: { name: 'Mahima', department: 'Google Ads', store: 'ledsone.de' },
      reportPeriod: { label: 'Last 30 Days', days: 30 },
      source: {
        scope: `Account-wide (ledsone.de, account ${MAHIMA_ACCOUNT_ID}), search terms from both Shopping/Search and Performance Max campaigns, rolling last 30 days (7-day trend window)`,
        tables: ['google_ads.campaign_search_term_data', 'google_ads.pmax_campaign_search_term_data'],
      },
      summary: {
        totalTerms: rows.length,
        totalCost: r3round2(totalCost),
        totalConvValue: r3round2(totalConvValue),
        overallRoas: totalCost > 0 ? r3round2(totalConvValue / totalCost) : 0,
        keepCount: rows.filter((r) => r.action === 'Keep').length,
        excludeCount: rows.filter((r) => r.action.startsWith('Exclude')).length,
      },
      rows,
      meta: { generatedAt: new Date().toISOString() },
    };
    MAHIMA_R3_CACHE.set(MAHIMA_R3_CACHE_KEY, { data: payload, at: Date.now() });
    res.status(200).json(payload);
  } catch (err) {
    console.error('[mahima/search-terms] Query failed:', err && err.message);
    res.status(500).json({ error: 'Could not load search term data. Please try again shortly.' });
  } finally {
    if (client) client.release();
  }
}

return mahimaSearchTermsHandler;
})();


// ===== Merged from check-urls.js, kamsi-live.js, sukirtha-req2-req3.js, sukirtha-req4-ga4-seo.js =====
// (2026-07-22, consolidated into requirement.js to further reduce Vercel Hobby-plan serverless
// function count. Each wrapped in its own IIFE closure to avoid top-level identifier collisions
// between files that were originally separate modules with duplicated helper-function names
// like STORE_DOMAIN, sleep, shopifyGraphQL, base64url, getAccessToken.)
const checkUrlsHandlerModule = (function() {
// Checks a small batch of URLs (the ones currently visible on a page of
// results) for liveness, so broken/404 links can be filtered out of the
// displayed table. Deliberately scoped to a caller-supplied batch rather
// than the full dataset — checking thousands of URLs live on every page
// load isn't feasible (timeouts, load on the origin site).
const MAX_URLS = 200;
const TIMEOUT_MS = 6000;
const CONCURRENCY = 10;

// Only 404/410 count as "broken" per the requirement ("do not add any 404
// broken links"). Any other non-2xx (403, 429, 503, etc.) is far more
// likely bot-protection/rate-limiting on the checking request itself
// (Vercel's serverless IPs get treated differently than a normal browser)
// than a genuinely dead page — so those are treated as "assume ok" to
// avoid false positives wiping out real, live pages.
const BROKEN_STATUSES = [404, 410];

async function checkOne(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timer);
    return { url, ok: !BROKEN_STATUSES.includes(res.status), status: res.status };
  } catch (e) {
    clearTimeout(timer);
    // Network error / timeout: don't assume broken, just report unknown-ok
    // so a slow/flaky check never hides a page that's actually fine.
    return { url, ok: true, status: null, checkError: e.message };
  }
}

async function checkUrlsHandler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const urls = Array.isArray(body.urls) ? body.urls.slice(0, MAX_URLS) : [];

    const results = [];
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(checkOne));
      results.push(...batchResults);
    }

    const statusByUrl = {};
    results.forEach((r) => { statusByUrl[r.url] = r.ok; });

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.status(200).json({ statusByUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

  return checkUrlsHandler;
})();

const kamsiLiveHandlerModule = (function() {
// Kamsi live data — Requirements 1, 5, 6 (ledsone.co.uk), merged into one
// serverless function (?req=1|5|6) to stay under the Vercel Hobby-plan
// 12-function cap. Each branch below is an unchanged copy of the logic
// from the original separate files (kamsi-req1-slow-moving-products.js,
// kamsi-req5-missing-meta-detection.js, kamsi-req6-duplicate-price-check.js).
// Server-side only: reads SHOPIFY_UK_ADMIN_TOKEN from env, never exposed to
// the client. Read-only Admin GraphQL calls only — no mutations.

const STORE_DOMAIN = process.env.SHOPIFY_UK_STORE_DOMAIN || 'ledsone.myshopify.com';
const API_VERSION = process.env.SHOPIFY_UK_API_VERSION || '2024-10';
const TOKEN = process.env.SHOPIFY_UK_ADMIN_TOKEN;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shopifyGraphQL(query, variables) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (e) {
      await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
      continue;
    }
    if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
      await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
      continue;
    }
    if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
    const json = await res.json();
    const throttled = json.errors && Array.isArray(json.errors) && json.errors.some(e => e.extensions && e.extensions.code === 'THROTTLED');
    if (throttled) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error('Shopify API: exceeded retries (throttling / transient errors)');
}

// ============================== Requirement 1 ==============================
const DAYS_R1 = 90;

const R1_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 50, after: $after) {
    edges {
      node {
        id
        title
        handle
        status
        productType
        updatedAt
        variants(first: 100) {
          edges {
            node {
              id
              title
              sku
              price
              inventoryItem {
                id
                tracked
                inventoryLevels(first: 5) {
                  edges {
                    node {
                      quantities(names: ["available"]) { name quantity }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const R1_ORDERS_QUERY = `
query($after: String, $q: String) {
  orders(first: 100, after: $after, query: $q) {
    edges {
      node {
        id
        createdAt
        cancelledAt
        test
        displayFinancialStatus
        lineItems(first: 100) {
          edges {
            node {
              sku
              quantity
              refundableQuantity
              variant { id }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchAllVariantsR1() {
  const variants = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R1_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      const p = edge.node;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const rawSku = (v.sku || '').toString().trim();
        const tracked = v.inventoryItem ? v.inventoryItem.tracked : false;
        const levels = v.inventoryItem ? v.inventoryItem.inventoryLevels.edges.map(e => e.node) : [];
        const currentStock = tracked
          ? levels.reduce((sum, l) => {
              const avail = l.quantities.find(q => q.name === 'available');
              return sum + (avail ? avail.quantity : 0);
            }, 0)
          : null;
        variants.push({
          productId: p.id,
          handle: p.handle,
          title: p.title,
          category: p.productType || 'Uncategorized',
          sku: rawSku,
          variantId: v.id,
          currentStock,
          inventoryTracked: tracked,
        });
      }
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return variants;
}

async function fetchUnitsSoldByVariantR1(startISO, endISO) {
  const q = `created_at:>=${startISO} AND created_at:<${endISO}`;
  const soldByVariant = new Map();
  const lastOrderDateByVariant = new Map();
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R1_ORDERS_QUERY, { after, q });
    for (const edge of data.orders.edges) {
      const o = edge.node;
      if (o.cancelledAt) continue;
      if (o.test) continue;
      if (o.displayFinancialStatus === 'VOIDED') continue;
      for (const liEdge of o.lineItems.edges) {
        const li = liEdge.node;
        if (!li.variant || !li.variant.id) continue;
        const netQty = typeof li.refundableQuantity === 'number' ? li.refundableQuantity : li.quantity;
        soldByVariant.set(li.variant.id, (soldByVariant.get(li.variant.id) || 0) + netQty);
        const prevDate = lastOrderDateByVariant.get(li.variant.id);
        if (!prevDate || o.createdAt > prevDate) {
          lastOrderDateByVariant.set(li.variant.id, o.createdAt);
        }
      }
    }
    hasNext = data.orders.pageInfo.hasNextPage;
    after = data.orders.pageInfo.endCursor;
  }
  return { soldByVariant, lastOrderDateByVariant };
}

// Req1 has no caching at all and re-scans the FULL catalog (13,866 SKUs,
// ~278 pages at 50/page) plus a full 90-day storewide order history on
// EVERY click of Refresh -- with Shopify's per-page GraphQL cost throttling
// on top (exponential backoff, up to 6 retries/page), this reliably exceeds
// this function's execution budget and the request never returns. Added
// 2026-07-24: a 10-minute in-memory cache (bypassed with ?refresh=1, though
// the frontend doesn't currently send it) so repeat loads within the
// window are instant, and larger page sizes below to cut total round trips.
const R1_CACHE_TTL_MS = 10 * 60 * 1000;
let r1Cache = null; // { payload, at }

async function handleReq1(req, res) {
  if (req.query.refresh !== '1' && r1Cache && (Date.now() - r1Cache.at) < R1_CACHE_TTL_MS) {
    res.status(200).json(r1Cache.payload);
    return;
  }

  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - DAYS_R1 * 24 * 60 * 60 * 1000);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

  const [variants, { soldByVariant, lastOrderDateByVariant }] = await Promise.all([
    fetchAllVariantsR1(),
    fetchUnitsSoldByVariantR1(startISO, endISO),
  ]);

  const retrievedAt = new Date().toISOString();
  const rows = variants.map(v => {
    const unitsSold = soldByVariant.get(v.variantId) || 0;
    const lastOrderIso = lastOrderDateByVariant.get(v.variantId) || null;
    const stock = v.inventoryTracked && v.currentStock !== null ? v.currentStock : -1;
    const slow = (unitsSold < 10 && stock > 100) ? 1 : 0;
    return [v.sku, v.handle, v.title, v.category, unitsSold, stock, lastOrderIso ? lastOrderIso.slice(0, 10) : '—', slow];
  });

  const totalProducts = new Set(variants.map(v => v.productId)).size;
  const slowMovingCount = rows.filter(r => r[7] === 1).length;
  const stockInSlowMoving = rows.filter(r => r[7] === 1).reduce((s, r) => s + (r[5] > 0 ? r[5] : 0), 0);

  const summary = {
    retrievedAt,
    dateRangeStart: startISO,
    dateRangeEnd: endISO,
    days: DAYS_R1,
    totalProductsChecked: rows.length,
    totalDistinctProducts: totalProducts,
    slowMovingProducts: slowMovingCount,
    activeProducts: rows.length - slowMovingCount,
    stockInSlowMoving,
  };

  const payload = { summary, rows };
  r1Cache = { payload, at: Date.now() };
  res.status(200).json(payload);
}

// ============================== Requirement 5 ==============================
const R5_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 100, after: $after) {
    edges {
      node {
        id
        title
        handle
        description
        productType
        updatedAt
        seo { title description }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchAllProductsR5() {
  const products = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R5_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      products.push(edge.node);
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return products;
}

function normalizeR5(s) {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/~\d+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function metaStatusR5(seoValue, sourceValue) {
  const seoTrim = (seoValue || '').trim();
  if (!seoTrim) return 'Missing';
  if (normalizeR5(seoValue) === normalizeR5(sourceValue)) return 'Auto-generated';
  return 'Custom';
}

function actionNeededR5(mts, mds) {
  const titleBad = mts !== 'Custom';
  const descBad = mds !== 'Custom';
  if (titleBad && descBad) return 'Add Custom Meta Title and Meta Description';
  if (titleBad) return 'Add Custom Meta Title';
  if (descBad) return 'Add Custom Meta Description';
  return 'OK';
}

async function handleReq5(req, res) {
  const products = await fetchAllProductsR5();
  const retrievedAt = new Date().toISOString();

  const rows = products.map(p => {
    const seoTitle = p.seo && p.seo.title ? p.seo.title : '';
    const seoDesc = p.seo && p.seo.description ? p.seo.description : '';
    const mts = metaStatusR5(seoTitle, p.title);
    const mds = metaStatusR5(seoDesc, p.description);
    return {
      u: '/products/' + p.handle,
      c: p.productType || 'Uncategorized',
      t: p.title,
      d: p.description || '',
      mt: seoTitle,
      md: seoDesc,
      mts,
      mds,
      tl: seoTitle.length,
      dl: seoDesc.length,
      a: actionNeededR5(mts, mds),
      lu: p.updatedAt,
    };
  });

  const summary = {
    retrievedAt,
    totalProductsChecked: rows.length,
    missingMetaTitle: rows.filter(r => r.mts === 'Missing').length,
    autoGeneratedMetaTitle: rows.filter(r => r.mts === 'Auto-generated').length,
    missingMetaDescription: rows.filter(r => r.mds === 'Missing').length,
    autoGeneratedMetaDescription: rows.filter(r => r.mds === 'Auto-generated').length,
    okProducts: rows.filter(r => r.a === 'OK').length,
  };

  res.status(200).json({ summary, rows });
}

// ============================== Requirement 6 ==============================
const R6_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 100, after: $after) {
    edges {
      node {
        id
        title
        handle
        status
        publishedAt
        updatedAt
        variants(first: 100) {
          edges {
            node {
              id
              sku
              price
              compareAtPrice
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchAllVariantRowsR6() {
  const rows = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R6_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      const p = edge.node;
      const status = p.status === 'ACTIVE' && !p.publishedAt ? 'UNLISTED' : p.status;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const rawSku = (v.sku || '').toString().trim();
        rows.push({
          sku: rawSku,
          skuNorm: rawSku.toLowerCase(),
          missingSku: rawSku === '',
          url: '/products/' + p.handle,
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          compareAtPrice: v.compareAtPrice !== null && v.compareAtPrice !== undefined ? Number(v.compareAtPrice) : null,
          status,
        });
      }
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return rows;
}

async function handleReq6(req, res) {
  const variantRows = await fetchAllVariantRowsR6();
  const lc = new Date().toISOString().slice(0, 10);

  const groups = new Map();
  const blankRows = [];
  for (const r of variantRows) {
    if (r.missingSku) { blankRows.push(r); continue; }
    if (!groups.has(r.skuNorm)) groups.set(r.skuNorm, []);
    groups.get(r.skuNorm).push(r);
  }

  const rows = [];
  for (const [, list] of groups.entries()) {
    const isDuplicate = list.length > 1;
    const distinctPrices = new Set(list.filter(r => r.price !== null).map(r => r.price));
    const priceMismatch = isDuplicate && distinctPrices.size > 1;
    rows.push({
      s: list[0].sku,
      u: list[0].url,
      cp: list[0].price,
      xp: list[0].compareAtPrice,
      all: list.map(r => ({ u: r.url, cp: r.price, xp: r.compareAtPrice })),
      d: isDuplicate,
      dc: list.length,
      pm: priceMismatch,
      st: list[0].status,
      lc,
    });
  }
  for (const r of blankRows) {
    rows.push({
      s: r.sku,
      u: r.url,
      cp: r.price,
      xp: r.compareAtPrice,
      all: [{ u: r.url, cp: r.price, xp: r.compareAtPrice }],
      d: false,
      dc: 1,
      pm: false,
      st: r.status,
      lc,
    });
  }

  const summary = {
    retrievedAt: new Date().toISOString(),
    totalVariantRowsChecked: variantRows.length,
    uniqueSkusChecked: groups.size,
    duplicateSkus: rows.filter(r => r.d).length,
    rowsWithDuplicateSku: rows.filter(r => r.d).reduce((s, r) => s + r.dc, 0),
    priceMismatchSkus: rows.filter(r => r.pm).length,
    blankSkuRows: blankRows.length,
  };

  res.status(200).json({ summary, rows });
}

// ============================== Router ==============================
async function kamsiLiveHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (!TOKEN) {
      res.status(500).json({ error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' });
      return;
    }
    const which = String(req.query.req || '1');
    if (which === '1') return await handleReq1(req, res);
    if (which === '5') return await handleReq5(req, res);
    if (which === '6') return await handleReq6(req, res);
    res.status(400).json({ error: 'Invalid ?req= value. Expected 1, 5, or 6.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
};

  return kamsiLiveHandler;
})();

const req2Req3HandlerModule = (function() {
// SUK-R2 (Duplicate Listing & Price Check) + SUK-R3 (Slow-Moving Stock
// Identification), merged into one serverless function to stay under the
// Vercel Hobby plan's 12-function-per-deployment cap (2026-07-20).
// Dispatch via ?req=2 (default) or ?req=3 query param.
// Server-side only: reads SHOPIFY_ADMIN_TOKEN from env, never exposed to the client.
// Read-only Admin GraphQL calls only — no mutations.

const STORE_DOMAIN = 'ledsone-de.myshopify.com';
const API_VERSION = '2024-10';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shopifyGraphQL(query, variables) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
    const json = await res.json();
    const throttled = json.errors && json.errors.some(e => e.extensions && e.extensions.code === 'THROTTLED');
    if (throttled) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error('Shopify API error: exceeded retries due to throttling');
}

// ==================== SUK-R2: Duplicate Listing & Price Check ====================

const R2_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 100, after: $after) {
    edges {
      node {
        id
        title
        handle
        status
        updatedAt
        variants(first: 100) {
          edges {
            node {
              id
              title
              sku
              price
              compareAtPrice
              updatedAt
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function r2FetchAllVariantRows() {
  const rows = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R2_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      const p = edge.node;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const rawSku = (v.sku || '').toString();
        const trimmedSku = rawSku.trim();
        rows.push({
          productId: p.id,
          productTitle: p.title,
          handle: p.handle,
          status: p.status,
          productUpdatedAt: p.updatedAt,
          variantId: v.id,
          variantTitle: v.title,
          skuRaw: rawSku,
          skuNorm: trimmedSku.toLowerCase(),
          missingSku: trimmedSku === '',
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          compareAtPrice: v.compareAtPrice !== null && v.compareAtPrice !== undefined ? Number(v.compareAtPrice) : null,
          variantUpdatedAt: v.updatedAt,
          url: `https://ledsone.de/products/${p.handle}`,
        });
      }
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return rows;
}

function r2BuildGroups(rows) {
  const productIds = new Set(rows.map(r => r.productId));
  const groups = new Map();
  for (const r of rows) {
    if (r.missingSku) continue;
    if (!groups.has(r.skuNorm)) groups.set(r.skuNorm, []);
    groups.get(r.skuNorm).push(r);
  }
  const skuGroups = [];
  for (const [norm, list] of groups.entries()) {
    const distinctVariantIds = new Set(list.map(r => r.variantId));
    const isDuplicate = distinctVariantIds.size > 1;
    const distinctPrices = new Set(list.filter(r => r.price !== null).map(r => r.price));
    const priceMismatch = isDuplicate && distinctPrices.size > 1;
    const compareStates = new Set(list.map(r => r.compareAtPrice === null ? 'null' : String(r.compareAtPrice)));
    const compareMismatch = isDuplicate && compareStates.size > 1;
    skuGroups.push({
      skuRaw: list[0].skuRaw,
      skuNorm: norm,
      listings: list,
      listingCount: list.length,
      duplicate: isDuplicate,
      priceMismatch,
      compareMismatch,
    });
  }
  const missingSkuRows = rows.filter(r => r.missingSku);
  for (const r of missingSkuRows) {
    skuGroups.push({
      skuRaw: r.skuRaw,
      skuNorm: '',
      listings: [r],
      listingCount: 1,
      duplicate: 'Not Checked',
      priceMismatch: 'Not Checked',
      compareMismatch: 'Not Checked',
      missingSku: true,
    });
  }

  const summary = {
    retrievedAt: new Date().toISOString(),
    totalProducts: productIds.size,
    totalVariants: rows.length,
    withSku: rows.filter(r => !r.missingSku).length,
    missingSku: missingSkuRows.length,
    uniqueSkus: groups.size,
    duplicateSkus: skuGroups.filter(g => g.duplicate === true).length,
    duplicateListings: skuGroups.filter(g => g.duplicate === true).reduce((a, g) => a + g.listingCount, 0),
    moreThanTwo: skuGroups.filter(g => g.duplicate === true && g.listingCount > 2).length,
    priceMismatches: skuGroups.filter(g => g.priceMismatch === true).length,
    compareMismatches: skuGroups.filter(g => g.compareMismatch === true).length,
  };

  return { summary, groups: skuGroups };
}

async function handleReq2(req, res) {
  const rows = await r2FetchAllVariantRows();
  const result = r2BuildGroups(rows);
  res.status(200).json(result);
}

// ==================== SUK-R3: Slow-Moving Stock Identification ====================

const R3_DAYS = 90;

const R3_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 50, after: $after) {
    edges {
      node {
        id
        title
        handle
        status
        productType
        updatedAt
        variants(first: 100) {
          edges {
            node {
              id
              title
              sku
              price
              inventoryItem {
                id
                tracked
                inventoryLevels(first: 5) {
                  edges {
                    node {
                      location { id name }
                      quantities(names: ["available"]) { name quantity }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const R3_ORDERS_QUERY = `
query($after: String, $q: String) {
  orders(first: 100, after: $after, query: $q) {
    edges {
      node {
        id
        createdAt
        cancelledAt
        test
        displayFinancialStatus
        lineItems(first: 100) {
          edges {
            node {
              sku
              quantity
              refundableQuantity
              variant { id }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function r3FetchAllVariants() {
  const variants = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R3_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      const p = edge.node;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const rawSku = (v.sku || '').toString();
        const trimmedSku = rawSku.trim();
        const tracked = v.inventoryItem ? v.inventoryItem.tracked : false;
        const levels = v.inventoryItem ? v.inventoryItem.inventoryLevels.edges.map(e => e.node) : [];
        const currentStock = tracked
          ? levels.reduce((sum, l) => {
              const avail = l.quantities.find(q => q.name === 'available');
              return sum + (avail ? avail.quantity : 0);
            }, 0)
          : null;
        const locationNames = levels.map(l => l.location.name).join(', ') || null;
        variants.push({
          productId: p.id,
          productTitle: p.title,
          handle: p.handle,
          productStatus: p.status,
          category: p.productType || null,
          productUpdatedAt: p.updatedAt,
          variantId: v.id,
          variantTitle: v.title,
          skuRaw: rawSku,
          missingSku: trimmedSku === '',
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          inventoryTracked: tracked,
          currentStock,
          inventoryLocation: locationNames,
          url: `https://ledsone.de/products/${p.handle}`,
          unitsSold90d: 0,
        });
      }
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return variants;
}

async function r3FetchUnitsSoldByVariant(startISO, endISO) {
  const q = `created_at:>=${startISO} AND created_at:<${endISO}`;
  const soldByVariant = new Map();
  const lastOrderDateByVariant = new Map();
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R3_ORDERS_QUERY, { after, q });
    for (const edge of data.orders.edges) {
      const o = edge.node;
      if (o.cancelledAt) continue;
      if (o.test) continue;
      if (o.displayFinancialStatus === 'VOIDED') continue;
      for (const liEdge of o.lineItems.edges) {
        const li = liEdge.node;
        if (!li.variant || !li.variant.id) continue;
        const netQty = typeof li.refundableQuantity === 'number' ? li.refundableQuantity : li.quantity;
        soldByVariant.set(li.variant.id, (soldByVariant.get(li.variant.id) || 0) + netQty);
        const prevDate = lastOrderDateByVariant.get(li.variant.id);
        if (!prevDate || o.createdAt > prevDate) {
          lastOrderDateByVariant.set(li.variant.id, o.createdAt);
        }
      }
    }
    hasNext = data.orders.pageInfo.hasNextPage;
    after = data.orders.pageInfo.endCursor;
  }
  return { soldByVariant, lastOrderDateByVariant };
}

function r3ComputeStatus(unitsSold, currentStock, tracked) {
  if (!tracked || currentStock === null) return 'Not Assessable';
  if (unitsSold < 10 && currentStock > 100) return 'Slow-Moving';
  return 'OK';
}

async function handleReq3(req, res) {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - R3_DAYS * 24 * 60 * 60 * 1000);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

  const [variants, { soldByVariant, lastOrderDateByVariant }] = await Promise.all([
    r3FetchAllVariants(),
    r3FetchUnitsSoldByVariant(startISO, endISO),
  ]);

  const retrievedAt = new Date().toISOString();
  const rows = variants.map(v => {
    const unitsSold = soldByVariant.get(v.variantId) || 0;
    const avgDaily = unitsSold / R3_DAYS;
    let daysOfStock;
    if (!v.inventoryTracked || v.currentStock === null) {
      daysOfStock = 'Not Assessable';
    } else if (avgDaily > 0) {
      daysOfStock = Math.round((v.currentStock / avgDaily) * 10) / 10;
    } else {
      daysOfStock = 'N/A — No sales';
    }
    return {
      ...v,
      unitsSold90d: unitsSold,
      avgDailyUnitsSold: Math.round(avgDaily * 1000) / 1000,
      daysOfStockRemaining: daysOfStock,
      lastOrderDate: lastOrderDateByVariant.get(v.variantId) || null,
      status: r3ComputeStatus(unitsSold, v.currentStock, v.inventoryTracked),
    };
  });

  const totalProducts = new Set(rows.map(r => r.productId)).size;
  const totalVariants = rows.length;
  const withSku = rows.filter(r => !r.missingSku).length;
  const missingSku = rows.filter(r => r.missingSku).length;
  const invTracked = rows.filter(r => r.inventoryTracked).length;
  const invNotTracked = rows.filter(r => !r.inventoryTracked).length;
  const totalCurrentStock = rows.filter(r => r.currentStock !== null).reduce((s, r) => s + r.currentStock, 0);
  const totalUnitsSold = rows.reduce((s, r) => s + r.unitsSold90d, 0);
  const slowMoving = rows.filter(r => r.status === 'Slow-Moving');
  const slowMovingUnits = slowMoving.reduce((s, r) => s + (r.currentStock || 0), 0);
  const okCount = rows.filter(r => r.status === 'OK').length;
  const notAssessable = rows.filter(r => r.status === 'Not Assessable').length;

  const summary = {
    retrievedAt,
    dateRangeStart: startISO,
    dateRangeEnd: endISO,
    days: R3_DAYS,
    inventoryLocations: [...new Set(rows.map(r => r.inventoryLocation).filter(Boolean))],
    totalProducts,
    totalVariants,
    withSku,
    missingSku,
    inventoryTracked: invTracked,
    inventoryNotTracked: invNotTracked,
    totalCurrentStock,
    totalUnitsSold90d: totalUnitsSold,
    slowMovingCount: slowMoving.length,
    slowMovingStockUnits: slowMovingUnits,
    okCount,
    notAssessableCount: notAssessable,
  };

  res.status(200).json({ summary, rows });
}

// ==================== Dispatcher ====================

async function req2Req3Handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (!process.env.SHOPIFY_ADMIN_TOKEN) {
      res.status(500).json({ error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
      return;
    }
    const reqNum = req.query && req.query.req === '3' ? '3' : '2';
    if (reqNum === '3') {
      await handleReq3(req, res);
    } else {
      await handleReq2(req, res);
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

  return req2Req3Handler;
})();

const req4HandlerModule = (function() {
// SUK-R4 — Core GA4 Data for SEO (ledsone.de)
// Server-side only: reads GA4_SERVICE_ACCOUNT_JSON + GA4_PROPERTY_ID from env,
// never exposed to the client. Read-only GA4 Data API + Search Console API
// calls only — no mutations, no writes to either Google product.

const GSC_SITE_URL = 'https://ledsone.de/';
const STORE_HOST = 'https://ledsone.de';
const DAYS = 30;

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Server not configured: GA4_SERVICE_ACCOUNT_JSON missing');
  const sa = JSON.parse(raw);
  const crypto = await import('node:crypto');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claims));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = unsigned + '.' + signature;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error('Google OAuth token error: ' + JSON.stringify(json));
  return json.access_token;
}

async function fetchGA4(accessToken, propertyId, startDate, endDate) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'landingPage' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'engagementRate' },
        { name: 'userEngagementDuration' },
        { name: 'screenPageViewsPerSession' },
        { name: 'purchaseRevenue' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionDefaultChannelGroup',
          stringFilter: { matchType: 'EXACT', value: 'Organic Search' },
        },
      },
      limit: 100000,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('GA4 Data API error: ' + JSON.stringify(json));
  const rows = json.rows || [];
  return rows.map(r => {
    const landingPage = r.dimensionValues[0].value;
    const sessions = Number(r.metricValues[0].value) || 0;
    const users = Number(r.metricValues[1].value) || 0;
    const engagementRate = Number(r.metricValues[2].value) || 0;
    const userEngagementDuration = Number(r.metricValues[3].value) || 0;
    const pagesPerSession = Number(r.metricValues[4].value) || 0;
    const purchaseRevenue = Number(r.metricValues[5].value) || 0;
    return {
      landingPage,
      sessions,
      users,
      engagementRate,
      avgEngagementTimeSec: sessions > 0 ? userEngagementDuration / sessions : 0,
      pagesPerSession,
      purchaseRevenue,
    };
  });
}

async function fetchGSC(accessToken, startDate, endDate) {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['page', 'query'],
      rowLimit: 25000,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Search Console API error: ' + JSON.stringify(json));
  return json.rows || [];
}

function dateNDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function pathFromUrl(u) {
  try {
    const url = new URL(u, STORE_HOST);
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch (e) {
    return u;
  }
}

function pageType(path) {
  if (path === '/' || path === '') return 'Home';
  if (path.startsWith('/products/')) return 'Product';
  if (path.startsWith('/collections/')) return 'Collection';
  if (path.startsWith('/blogs/') || path.startsWith('/blog/')) return 'Blog';
  if (path.startsWith('/pages/')) return 'Page';
  return 'Other';
}

function fmtEngagementTime(sec) {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

// ---------- Dilaksi Requirement 1 branch (ledsone.co.uk) ----------
// Bundled into this same file (not a separate serverless function) because
// the Vercel Hobby plan caps deployments at 12 functions. Same shared
// service-account key serves both GA4 (property 408110563) and GSC
// (sc-domain:ledsone.co.uk) — see
// evidence/2026-07-03_team_infrastructure_evidence.md. Triggered only when
// req.query.store === 'dilaksi'; the Sukirtha behavior above is unchanged.
const DILAKSI_GA4_PROPERTY_ID = '408110563';
const DILAKSI_GSC_SITE_URL = 'sc-domain:ledsone.co.uk';
const DILAKSI_STORE_HOST = 'https://ledsone.co.uk';
const DILAKSI_ALLOWED_DAYS = [7, 15, 30, 45, 60];

async function fetchDilaksiGA4(accessToken, days) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${DILAKSI_GA4_PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [
        { name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagementRate' },
        { name: 'userEngagementDuration' }, { name: 'screenPageViewsPerSession' },
        { name: 'ecommercePurchases' }, { name: 'purchaseRevenue' },
      ],
      dimensionFilter: {
        filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } },
      },
      limit: 100000,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('GA4 Data API error: ' + JSON.stringify(json));
  return json.rows || [];
}

async function fetchDilaksiGSC(accessToken) {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(DILAKSI_GSC_SITE_URL)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({ startDate: dateNDaysAgo(30), endDate: dateNDaysAgo(0), dimensions: ['page', 'query'], rowLimit: 25000 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Search Console API error: ' + JSON.stringify(json));
  return json.rows || [];
}

function dilaksiPathFromUrl(u) {
  try {
    const url = new URL(u, DILAKSI_STORE_HOST);
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch (e) {
    return u.split('?')[0] || u;
  }
}

async function handleDilaksiReq1(req, res) {
  if (!process.env.GA4_SERVICE_ACCOUNT_JSON) {
    res.status(500).json({ error: 'Server not configured: GA4_SERVICE_ACCOUNT_JSON missing' });
    return;
  }
  const days = DILAKSI_ALLOWED_DAYS.includes(parseInt(req.query.days, 10)) ? parseInt(req.query.days, 10) : 30;

  const accessToken = await getAccessToken();
  const [ga4Rows, gscRows] = await Promise.all([fetchDilaksiGA4(accessToken, days), fetchDilaksiGSC(accessToken)]);

  const gscByPage = new Map();
  for (const r of gscRows) {
    const [pageUrl, query] = r.keys;
    const path = dilaksiPathFromUrl(pageUrl);
    if (!gscByPage.has(path)) gscByPage.set(path, []);
    gscByPage.get(path).push({ query, clicks: r.clicks });
  }
  const topQueryByPath = new Map();
  for (const [path, queries] of gscByPage.entries()) {
    const top = queries.slice().sort((a, b) => b.clicks - a.clicks)[0];
    topQueryByPath.set(path, top ? top.query : '');
  }

  const byPath = new Map();
  for (const r of ga4Rows) {
    const path = dilaksiPathFromUrl(r.dimensionValues[0].value);
    const sessions = Number(r.metricValues[0].value) || 0;
    const users = Number(r.metricValues[1].value) || 0;
    const engagementRate = Number(r.metricValues[2].value) || 0;
    const engagementDuration = Number(r.metricValues[3].value) || 0;
    const pagesPerSession = Number(r.metricValues[4].value) || 0;
    const purchases = Number(r.metricValues[5].value) || 0;
    const purchaseRevenue = Number(r.metricValues[6].value) || 0;

    if (!byPath.has(path)) {
      byPath.set(path, { landingPage: path, sessions: 0, users: 0, engagementRateWeighted: 0, engagementDuration: 0, pagesPerSessionWeighted: 0, purchases: 0, purchaseRevenue: 0 });
    }
    const agg = byPath.get(path);
    agg.sessions += sessions;
    agg.users += users;
    agg.engagementRateWeighted += engagementRate * sessions;
    agg.engagementDuration += engagementDuration;
    agg.pagesPerSessionWeighted += pagesPerSession * sessions;
    agg.purchases += purchases;
    agg.purchaseRevenue += purchaseRevenue;
  }

  const allRows = [...byPath.values()].map(a => ({
    landingPage: a.landingPage,
    topQuery: topQueryByPath.get(a.landingPage) || '',
    sessions: a.sessions,
    users: a.users,
    engagementRate: a.sessions > 0 ? a.engagementRateWeighted / a.sessions : 0,
    engagementDurationTotalSec: a.engagementDuration,
    pagesPerSession: a.sessions > 0 ? a.pagesPerSessionWeighted / a.sessions : 0,
    purchases: a.purchases,
    purchaseRevenue: Math.round(a.purchaseRevenue * 100) / 100,
  })).sort((a, b) => b.sessions - a.sessions);

  const totalSessions = allRows.reduce((s, r) => s + r.sessions, 0);
  const totalUsers = allRows.reduce((s, r) => s + r.users, 0);
  const totalPurchases = allRows.reduce((s, r) => s + r.purchases, 0);
  const totalRevenue = Math.round(allRows.reduce((s, r) => s + r.purchaseRevenue, 0) * 100) / 100;
  const avgEngagementRate = totalSessions > 0 ? allRows.reduce((s, r) => s + r.engagementRate * r.sessions, 0) / totalSessions : 0;

  // refresh=1 (added 2026-07-23): the CDN cache below is keyed by the full
  // request URL, so appending ?refresh=1 already gets a fresh cache-miss
  // response on its own -- explicitly marking it no-store too so this
  // particular fresh fetch doesn't itself get cached for the next 120s.
  const isForceRefresh = req.query && req.query.refresh === '1';
  res.setHeader('Cache-Control', isForceRefresh ? 'no-store' : 's-maxage=120, stale-while-revalidate=300');
  res.status(200).json({
    generatedAt: new Date().toISOString(),
    days,
    ga4Property: DILAKSI_GA4_PROPERTY_ID,
    gscProperty: DILAKSI_GSC_SITE_URL,
    summary: {
      sessions: totalSessions, users: totalUsers, avgEngagementRate,
      purchases: totalPurchases, purchaseRevenue: totalRevenue, totalLandingPages: allRows.length,
    },
    rows: allRows.slice(0, 50),
  });
}

// ---------- Dilaksi Requirement 2 live refresh (cards only) ----------
// Added 2026-07-23. Recomputes the 7 summary cards (Total Products/Variants,
// Total Sales 30D, Total Demand, Total Organic Sessions, High/Medium/Low/
// Low-flag counts) from live Shopify + GA4 data. Semrush Demand is NOT
// fetched live (no Semrush access from this server) -- it's read from a
// frozen snapshot (api/data/dilaksi-req2-demand-frozen.json, built
// 2026-07-07 from reports/dilaksi/data/2026-07-07_req2-allcol-seo-priority-log.csv)
// and joined by product_id. SEO Priority rule replicated exactly from
// reports/dilaksi/data/2026-07-07_req2-allcol-page-builder.py (seo_priority()):
// rules 2 and 4 (profit margin) are permanently unreachable -- PM isn't in
// Postgres and the max 30-day product sales (~£1.7K) never clears their
// £4K/£10K thresholds -- so only rules 1/3/5/6 are implemented.
const DILAKSI_UK_STORE_DOMAIN = 'ledsone.myshopify.com';
const DILAKSI_UK_API_VERSION = '2024-10';

async function dilaksiUkShopifyGraphQL(query, variables) {
  const token = process.env.SHOPIFY_UK_ADMIN_TOKEN;
  if (!token) throw new Error('Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing');
  const res = await fetch(`https://${DILAKSI_UK_STORE_DOMAIN}/admin/api/${DILAKSI_UK_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors || json));
  return json.data;
}

const DILAKSI_R2_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 100, after: $after) {
    edges { node { legacyResourceId handle variantsCount { count } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchDilaksiCatalogLive() {
  const products = [];
  let after = null, hasNext = true;
  while (hasNext) {
    const data = await dilaksiUkShopifyGraphQL(DILAKSI_R2_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      products.push({ productId: String(edge.node.legacyResourceId), handle: edge.node.handle, variantsCount: edge.node.variantsCount.count });
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return products;
}

// ShopifyQL (shopifyqlQuery) requires a `read_reports` scope this app's
// token doesn't have (ACCESS_DENIED, confirmed live 2026-07-23) -- granting
// it requires the store owner adding that scope to the custom app in
// Shopify Admin, which is outside what this server can do on its own. Sales
// are computed the same way the member-sales tabs already do it instead:
// paginate real orders for the last 30 days and sum line items per product
// (only needs read_orders, which this token already has).
const DILAKSI_R2_ORDERS_QUERY = `
query($cursor: String, $query: String!) {
  orders(first: 100, after: $cursor, sortKey: CREATED_AT, query: $query) {
    edges {
      node {
        id
        lineItems(first: 100) {
          edges {
            node {
              quantity
              originalUnitPriceSet { shopMoney { amount } }
              discountedTotalSet { shopMoney { amount } }
              taxLines { priceSet { shopMoney { amount } } }
              variant { product { legacyResourceId } }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchDilaksiSalesLive() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const q = `created_at:>=${since}`;
  const salesByProduct = new Map();
  let cursor = null, hasNext = true;
  while (hasNext) {
    const data = await dilaksiUkShopifyGraphQL(DILAKSI_R2_ORDERS_QUERY, { cursor, query: q });
    for (const edge of data.orders.edges) {
      for (const liEdge of edge.node.lineItems.edges) {
        const li = liEdge.node;
        const pid = li.variant && li.variant.product ? String(li.variant.product.legacyResourceId) : null;
        if (!pid) continue;
        const grossIncl = Number(li.originalUnitPriceSet.shopMoney.amount) * li.quantity;
        const tax = (li.taxLines || []).reduce((s, t) => s + Number(t.priceSet.shopMoney.amount), 0);
        const discounted = Number(li.discountedTotalSet.shopMoney.amount);
        const netSales = Math.max(0, discounted - tax);
        if (!salesByProduct.has(pid)) salesByProduct.set(pid, { sales: 0, units: 0 });
        const agg = salesByProduct.get(pid);
        agg.sales += netSales;
        agg.units += li.quantity;
      }
    }
    hasNext = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
  }
  return salesByProduct;
}

function dilaksiSeoPriority(demand, sales, organic) {
  if (demand === null || demand === undefined) return 'Low — flag for review';
  if (demand < 100 && sales < 2000) return 'Low — flag for review';
  if (demand >= 2000 && organic < demand * 0.5) return 'High';
  if (demand >= 500 && organic >= demand * 0.5) return 'Medium';
  return 'Low';
}

let dilaksiR2DemandCache = null;
function loadDilaksiR2FrozenDemand() {
  if (dilaksiR2DemandCache) return dilaksiR2DemandCache;
  const fs = require('fs');
  const path = require('path');
  const raw = fs.readFileSync(path.join(__dirname, 'data', 'dilaksi-req2-demand-frozen.json'), 'utf8');
  dilaksiR2DemandCache = JSON.parse(raw);
  return dilaksiR2DemandCache;
}

async function handleDilaksiReq2Live(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (!process.env.SHOPIFY_UK_ADMIN_TOKEN) {
      res.status(500).json({ error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' });
      return;
    }
    if (!process.env.GA4_SERVICE_ACCOUNT_JSON) {
      res.status(500).json({ error: 'Server not configured: GA4_SERVICE_ACCOUNT_JSON missing' });
      return;
    }
    if (req.query && req.query.debugSales === '1') {
      const data = await fetchDilaksiSalesLive();
      res.status(200).json({ success: true, entries: [...data.entries()].slice(0, 10), total: data.size });
      return;
    }
    const demandMap = loadDilaksiR2FrozenDemand();
    const accessToken = await getAccessToken();
    const [catalog, salesByProduct, ga4Rows] = await Promise.all([
      fetchDilaksiCatalogLive(),
      fetchDilaksiSalesLive(),
      fetchDilaksiGA4(accessToken, 30),
    ]);

    const organicByHandle = new Map();
    for (const r of ga4Rows) {
      const path = dilaksiPathFromUrl(r.dimensionValues[0].value);
      const m = /\/products\/([^/]+)$/.exec(path);
      if (!m) continue;
      const handle = m[1];
      const sessions = Number(r.metricValues[0].value) || 0;
      organicByHandle.set(handle, (organicByHandle.get(handle) || 0) + sessions);
    }

    let totalVariants = 0, totalSales = 0, totalDemand = 0, totalOrganic = 0;
    let high = 0, medium = 0, low = 0, lowFlag = 0;
    for (const p of catalog) {
      totalVariants += p.variantsCount;
      const s = salesByProduct.get(p.productId) || { sales: 0, units: 0 };
      const organic = organicByHandle.get(p.handle) || 0;
      const demand = Object.prototype.hasOwnProperty.call(demandMap, p.productId) ? demandMap[p.productId] : null;
      totalSales += s.sales;
      totalOrganic += organic;
      if (demand !== null && demand !== undefined) totalDemand += demand;
      const priority = dilaksiSeoPriority(demand, s.sales, organic);
      if (priority === 'High') high++;
      else if (priority === 'Medium') medium++;
      else if (priority === 'Low — flag for review') lowFlag++;
      else low++;
    }

    res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      summary: {
        totalProducts: catalog.length,
        totalVariants,
        totalSales30d: Math.round(totalSales * 100) / 100,
        totalDemand,
        totalOrganicSessions: totalOrganic,
        highPriority: high,
        mediumPriority: medium,
        lowPriority: low,
        lowFlagPriority: lowFlag,
      },
      note: 'Demand is a frozen snapshot (Semrush not fetched live) from 2026-07-07; all other fields are live.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
}

async function req4Handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (req.query && req.query.store === 'dilaksi') {
      await handleDilaksiReq1(req, res);
      return;
    }

    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
      res.status(500).json({ error: 'Server not configured: GA4_PROPERTY_ID missing' });
      return;
    }
    if (!process.env.GA4_SERVICE_ACCOUNT_JSON) {
      res.status(500).json({ error: 'Server not configured: GA4_SERVICE_ACCOUNT_JSON missing' });
      return;
    }

    const customStart = req.query && req.query.start;
    const customEnd = req.query && req.query.end;
    const startDate = customStart || dateNDaysAgo(DAYS);
    const endDate = customEnd || dateNDaysAgo(0);

    const accessToken = await getAccessToken();
    const [ga4Rows, gscRows] = await Promise.all([
      fetchGA4(accessToken, propertyId, startDate, endDate),
      fetchGSC(accessToken, startDate, endDate),
    ]);

    // Aggregate GSC by page path
    const gscByPage = new Map();
    for (const r of gscRows) {
      const [pageUrl, query] = r.keys;
      const path = pathFromUrl(pageUrl);
      if (!gscByPage.has(path)) gscByPage.set(path, { clicks: 0, impressions: 0, positionWeighted: 0, queries: [] });
      const agg = gscByPage.get(path);
      agg.clicks += r.clicks;
      agg.impressions += r.impressions;
      agg.positionWeighted += r.position * r.impressions;
      agg.queries.push({ query, clicks: r.clicks, impressions: r.impressions });
    }

    const retrievedAt = new Date().toISOString();
    const seenPaths = new Set();
    const rows = ga4Rows.map(g => {
      const path = pathFromUrl(g.landingPage);
      seenPaths.add(path);
      const gsc = gscByPage.get(path);
      const topQuery = gsc && gsc.queries.length
        ? gsc.queries.slice().sort((a, b) => b.clicks - a.clicks)[0].query
        : null;
      const clicks = gsc ? gsc.clicks : 0;
      const impressions = gsc ? gsc.impressions : 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const avgPosition = gsc && gsc.impressions > 0 ? gsc.positionWeighted / gsc.impressions : null;
      return {
        landingPage: path,
        pageType: pageType(path),
        topQuery,
        sessions: g.sessions,
        users: g.users,
        engagementRate: g.engagementRate,
        avgEngagementTimeSec: g.avgEngagementTimeSec,
        avgEngagementTimeLabel: fmtEngagementTime(g.avgEngagementTimeSec),
        pagesPerSession: g.pagesPerSession,
        purchaseRevenue: g.purchaseRevenue,
        clicks,
        impressions,
        ctr,
        avgPosition,
        url: STORE_HOST + path,
        retrievedAt,
      };
    });

    const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
    const totalUsers = rows.reduce((s, r) => s + r.users, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.purchaseRevenue, 0);
    const avgEngagementRate = rows.length ? rows.reduce((s, r) => s + r.engagementRate, 0) / rows.length : 0;
    const avgEngagementTimeSec = rows.length ? rows.reduce((s, r) => s + r.avgEngagementTimeSec, 0) / rows.length : 0;
    const avgPagesPerSession = rows.length ? rows.reduce((s, r) => s + r.pagesPerSession, 0) / rows.length : 0;
    const distinctQueries = new Set(gscRows.map(r => r.keys[1]));

    const summary = {
      retrievedAt,
      dateRangeStart: startDate,
      dateRangeEnd: endDate,
      days: DAYS,
      ga4Property: propertyId,
      gscProperty: GSC_SITE_URL,
      organicSessions: totalSessions,
      organicUsers: totalUsers,
      landingPages: rows.length,
      queries: distinctQueries.size,
      purchaseRevenue: totalRevenue,
      avgEngagementRate,
      avgEngagementTimeSec,
      avgEngagementTimeLabel: fmtEngagementTime(avgEngagementTimeSec),
      avgPagesPerSession,
    };

    const today = dateNDaysAgo(0);
    res.status(200).json({
      summary,
      rows,
      dateRange: { start: startDate, end: endDate, requested: today },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

  req4Handler.handleDilaksiReq2Live = handleDilaksiReq2Live;
  return req4Handler;
})();


const STORE_CONFIG = {
  uk: {
    siteUrl: 'sc-domain:ledsone.co.uk',
    ctrThreshold: 0.02,
    defaultDays: 180,
    extendedFields: false,
  },
  de: {
    siteUrl: 'https://ledsone.de/',
    ctrThreshold: 0.015,
    defaultDays: 182,
    extendedFields: true,
  },
};

const SCOPE_PATTERNS = ['/collections/', '/blogs/', '/blog/'];

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function loadKey() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GSC_SERVICE_ACCOUNT_KEY env var not set');
  return JSON.parse(raw);
}

async function getAccessToken(key) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claim));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(key.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = unsigned + '.' + signature;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token request failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function queryGSC(token, siteUrl, startDate, endDate, dimensions = ['page']) {
  const rows = [];
  let startRow = 0;
  let firstIncompleteDate = null;
  const rowLimit = 25000;
  for (;;) {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, startRow, dataState: 'all' })
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GSC API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const batch = data.rows || [];
    rows.push(...batch);
    if (data.metadata && data.metadata.firstIncompleteDate) firstIncompleteDate = data.metadata.firstIncompleteDate;
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }
  rows.firstIncompleteDate = firstIncompleteDate;
  return rows;
}

function inScope(url) {
  return SCOPE_PATTERNS.some((p) => url.includes(p));
}

function typeOfDe(url) {
  if (url.includes('/collections/')) return 'Collection';
  if (url.includes('/blogs/') || url.includes('/blog/')) return 'Blog';
  return 'Other';
}

const RELATED_REASONS = [
  { key: 'pagination', label: 'Pagination (?page= / ?ccp-page=)', test: (u) => /[?&][a-z-]*page=\d+/i.test(u) },
  { key: 'product', label: 'Product pages (/products/)', test: (u) => u.includes('/products/') },
  { key: 'tagged', label: 'Blog tag pages (/tagged/)', test: (u) => u.includes('/tagged/') },
  { key: 'locale', label: 'Locale duplicates (/xx/...)', test: (u) => /^https?:\/\/[^/]+\/[a-z]{2}\/(blogs|collections)\//i.test(u) },
  { key: 'filter', label: 'Faceted filter query (?filter.)', test: (u) => /[?&]filter\./i.test(u) },
  { key: 'facetAll', label: '"/collections/all/<tag>" facet views', test: (u) => /\/collections\/all\//i.test(u) },
  { key: 'nestedCollection', label: 'Nested collection sub-paths (/collections/a/b)', test: (u) => /^https?:\/\/[^/]+\/collections\/[^/?]+\/[^/?]+/i.test(u) },
  { key: 'searchQuery', label: 'Search query filter (?q=)', test: (u) => /[?&]q=/i.test(u) },
  { key: 'recTracking', label: 'Recommendation-widget tracking (pr_*)', test: (u) => /[?&]pr_[a-z_]+=/i.test(u) }
];

function relatedReasonOf(url) {
  for (const r of RELATED_REASONS) {
    if (r.test(url)) return r.key;
  }
  return null;
}

module.exports = async (req, res) => {
  const fn = ((req.query && req.query.fn) || '').toString().toLowerCase();
  if (fn === 'jefri-product-status') return jefriProductStatusHandlerModule(req, res);
  if (fn === 'mahima-req1') return jefriProductStatusHandlerModule.mahimaReq1Handler(req, res);
  if (fn === 'mahima-req2') return jefriProductStatusHandlerModule.mahimaReq2Handler(req, res);
  if (fn === 'jefri-req3') return jefriProductStatusHandlerModule.jefriReq3Handler(req, res);
  if (fn === 'jefri-search-terms') return jefriSearchTermsHandlerModule(req, res);
  if (fn === 'mahima-search-terms') return mahimaSearchTermsHandlerModule(req, res);
  if (fn === 'check-urls') return checkUrlsHandlerModule(req, res);
  if (fn === 'kamsi-live') return kamsiLiveHandlerModule(req, res);
  if (fn === 'req2-req3') return req2Req3HandlerModule(req, res);
  if (fn === 'req4-ga4-seo') return req4HandlerModule(req, res);
  if (fn === 'dilaksi-req2-live') return req4HandlerModule.handleDilaksiReq2Live(req, res);

  try {
    const store = (req.query.store === 'de') ? 'de' : 'uk';
    const cfg = STORE_CONFIG[store];

    const fmt = (d) => d.toISOString().slice(0, 10);
    const isValidDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

    const requestEnd = new Date();
    requestEnd.setUTCDate(requestEnd.getUTCDate() - 1);

    let startDate, endDate;
    if (isValidDate(req.query.start) && isValidDate(req.query.end)) {
      startDate = req.query.start;
      endDate = req.query.end;
    } else {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || cfg.defaultDays, 1), 365);
      const start = new Date(requestEnd);
      start.setUTCDate(start.getUTCDate() - days);
      startDate = fmt(start);
      endDate = fmt(requestEnd);
    }

    const key = loadKey();
    const token = await getAccessToken(key);
    const allRows = await queryGSC(token, cfg.siteUrl, startDate, endDate);

    let realLatestDate = startDate;
    let firstIncompleteDate = null;
    try {
      const dateRows = await queryGSC(token, cfg.siteUrl, startDate, endDate, ['date']);
      for (const r of dateRows) {
        if (r.keys[0] > realLatestDate) realLatestDate = r.keys[0];
      }
      firstIncompleteDate = dateRows.firstIncompleteDate || null;
    } catch {
      realLatestDate = endDate;
    }
    let finalDataThrough = realLatestDate;
    if (firstIncompleteDate) {
      const d = new Date(firstIncompleteDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      finalDataThrough = fmt(d);
    }

    let scoped = allRows
      .filter((r) => inScope(r.keys[0]))
      .map((r) => {
        const url = r.keys[0];
        const clicks = r.clicks;
        const impressions = r.impressions;
        const ctr = r.ctr;
        const position = r.position;

        if (!cfg.extendedFields) {
          const isCollection = url.includes('/collections/');
          const isBlog = url.includes('/blogs/') || url.includes('/blog/');
          return {
            url,
            type: isCollection ? 'collection' : isBlog ? 'blog' : 'other',
            clicks,
            impressions,
            ctr: Math.round(ctr * 10000) / 100,
            position: Math.round(position * 10) / 10,
            lowCtr: ctr < cfg.ctrThreshold
          };
        }

        const relatedReason = relatedReasonOf(url);
        return {
          url,
          type: typeOfDe(url),
          clicks,
          impressions,
          ctr: Math.round(ctr * 10000) / 100,
          position: Math.round(position * 10) / 10,
          lowCtr: ctr < cfg.ctrThreshold,
          status: ctr < cfg.ctrThreshold ? 'Low CTR' : 'OK',
          related: relatedReason !== null,
          relatedReason
        };
      });

    if (cfg.extendedFields) {
      scoped = scoped.sort((a, b) => a.ctr - b.ctr);
    }

    const clean = cfg.extendedFields ? scoped.filter((r) => !r.related) : scoped;
    const totalClicks = clean.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = clean.reduce((s, r) => s + r.impressions, 0);
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;
    const lowCtrCount = clean.filter((r) => r.lowCtr).length;
    const collectionCount = clean.filter((r) => r.type === 'collection' || r.type === 'Collection').length;
    const blogCount = clean.filter((r) => r.type === 'blog' || r.type === 'Blog').length;
    const relatedCount = cfg.extendedFields ? scoped.filter((r) => r.related).length : undefined;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    const summary = {
      totalPages: clean.length,
      collectionCount,
      blogCount,
      lowCtrCount,
      avgCtr,
      totalImpressions,
      totalClicks,
    };
    if (cfg.extendedFields) summary.relatedCount = relatedCount;

    const payload = {
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: startDate,
        end: endDate,
        requested: endDate,
        latestAvailable: realLatestDate,
        finalDataThrough,
        firstIncompleteDate
      },
      summary,
      pages: scoped
    };
    if (cfg.extendedFields) payload.relatedReasons = RELATED_REASONS.map((r) => ({ key: r.key, label: r.label }));

    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
