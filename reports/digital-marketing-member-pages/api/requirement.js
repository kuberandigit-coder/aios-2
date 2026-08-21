// Merged GSC low-CTR endpoint — serves both UK (Kamsi) and DE (Sukirtha)
// via ?store=uk|de, to stay under the Vercel Hobby-plan 12-function cap.
// Per-store constants/logic below are unchanged copies of the two
// endpoints this replaces (gsc-low-ctr.js store=uk, gsc-sukirtha-low-ctr.js
// store=de) — behavior for existing callers is identical.
const crypto = require('crypto');
const { Client } = require('pg');
const { callGroqAI } = require('../lib/groq');

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
      // SSL requirement varies by host (the original server didn't support
      // it; the current one requires it) — controlled by PGSSL=require env
      // var rather than hardcoded, so switching DB hosts doesn't need a
      // code change. rejectUnauthorized:false accepts the server's cert
      // without a locally-trusted CA chain, matching the connection details
      // provided for the current host.
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
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

  // ===== Mahima Requirement 5 — Product ID Coverage (added 2026-07-29) =====
  // Universe = full ledsone.de merchant feed catalog (google_ads.merchant_products,
  // country='DE', deduped by normalized product id, same pattern as MAHIMA_QUERY's
  // merch_norm) LEFT JOINed out to Mahima's 5 campaigns' performance -- this is the
  // only non-invented "all of Mahima's products" universe available (her campaigns
  // target the DE feed), so products with zero campaign rows correctly surface as
  // "Not In Campaign" instead of being invisible.
  // Previous Period = the immediately preceding period of equal length to the
  // selected/default range (default range = trailing 30 days), same trailing-window
  // idea already used by MAHIMA_QUERY's d7/d30 CTEs.
  // Feed Status / Missing Attribute: no real Merchant Center diagnostics exist in
  // Postgres (raw_data.gmc_product_diagnostics_daily is gone -- see
  // evidence/mahima/2026-07-09_mahima_req1_missing_attribute_evidence.md). Reusing
  // Req1's proven proxy: Missing Attribute = which of the 10 MAHIMA_ATTR_COLUMNS are
  // NULL/blank for that product; Feed Status = "Not Eligible" if any are missing,
  // else "Eligible" -- same signal Req1 already uses to flag "Optimize".
  const MAHIMA5_CACHE = new Map();
  const MAHIMA5_CACHE_TTL_MS = 60 * 1000;

  const MAHIMA5_QUERY = `
WITH bounds AS (
  SELECT MAX(date) AS max_date FROM google_ads.product_performance WHERE campaign_id = ANY($1::bigint[])
),
range AS (
  SELECT
    COALESCE($2::date, (SELECT max_date FROM bounds) - INTERVAL '29 days')::date AS cur_start,
    COALESCE($3::date, (SELECT max_date FROM bounds))::date AS cur_end
),
prev_range AS (
  SELECT (cur_start - (cur_end - cur_start + 1))::date AS prev_start, (cur_start - INTERVAL '1 day')::date AS prev_end
  FROM range
),
camp AS (
  SELECT campaign_id, campaign_name FROM google_ads.campaigns WHERE campaign_id = ANY($1::bigint[])
),
perf_cur_norm AS (
  SELECT pp.campaign_id, pp.clicks, pp.impressions, pp.conversions, pp.cost, pp.conversion_value,
    lower(CASE WHEN pp.product_item_id ~* '^shopify_[a-z]+_[0-9]+_[0-9]+$'
      THEN split_part(pp.product_item_id, '_', 3) ELSE pp.product_item_id END) AS norm_id
  FROM google_ads.product_performance pp CROSS JOIN range r
  WHERE pp.campaign_id = ANY($1::bigint[]) AND pp.date BETWEEN r.cur_start AND r.cur_end
),
perf_by_norm AS (
  SELECT p.norm_id,
    SUM(p.clicks) AS clicks, SUM(p.impressions) AS impressions, SUM(p.conversions) AS conversions,
    SUM(p.cost) AS cost, SUM(p.conversion_value) AS conv_value,
    array_agg(DISTINCT c.campaign_name) AS campaigns
  FROM perf_cur_norm p JOIN camp c ON c.campaign_id = p.campaign_id
  GROUP BY p.norm_id
),
prev_by_norm AS (
  SELECT lower(CASE WHEN pp.product_item_id ~* '^shopify_[a-z]+_[0-9]+_[0-9]+$'
      THEN split_part(pp.product_item_id, '_', 3) ELSE pp.product_item_id END) AS norm_id,
    SUM(pp.cost) AS cost, SUM(pp.conversion_value) AS conv_value
  FROM google_ads.product_performance pp CROSS JOIN prev_range pr
  WHERE pp.campaign_id = ANY($1::bigint[]) AND pp.date BETWEEN pr.prev_start AND pr.prev_end
  GROUP BY 1
),
last_conv_norm AS (
  SELECT lower(CASE WHEN pp.product_item_id ~* '^shopify_[a-z]+_[0-9]+_[0-9]+$'
      THEN split_part(pp.product_item_id, '_', 3) ELSE pp.product_item_id END) AS norm_id,
    MAX(pp.date) AS last_conv_date
  FROM google_ads.product_performance pp
  WHERE pp.campaign_id = ANY($1::bigint[]) AND pp.conversions > 0
  GROUP BY 1
),
merch_norm AS (
  SELECT DISTINCT ON (norm_id) * FROM (
    SELECT *, lower(CASE WHEN product_id ~* '^shopify_[a-z]+_[0-9]+_[0-9]+$'
        THEN split_part(product_id, '_', 3) ELSE product_id END) AS norm_id
    FROM google_ads.merchant_products WHERE country = 'DE'
  ) x
  ORDER BY norm_id, (currency = 'EUR') DESC
)
SELECT m.norm_id AS product_id, m.title, m.product_category, m.item_group_id, m.mpn, m.color,
  m.condition, m.description, m.product_types, m.availability, m.brand, m.price,
  pf.campaigns, pf.clicks, pf.impressions, pf.conversions, pf.cost, pf.conv_value,
  pv.cost AS prev_cost, pv.conv_value AS prev_conv_value,
  lc.last_conv_date,
  (SELECT cur_start FROM range) AS range_start, (SELECT cur_end FROM range) AS range_end,
  (SELECT prev_start FROM prev_range) AS prev_start, (SELECT prev_end FROM prev_range) AS prev_end
FROM merch_norm m
LEFT JOIN perf_by_norm pf ON pf.norm_id = m.norm_id
LEFT JOIN prev_by_norm pv ON pv.norm_id = m.norm_id
LEFT JOIN last_conv_norm lc ON lc.norm_id = m.norm_id
ORDER BY pf.cost DESC NULLS LAST;
`;

  function mahima5MissingAttribute(r) {
    const missing = [];
    for (const col of MAHIMA_ATTR_COLUMNS) {
      const v = r[col];
      if (v === null || v === undefined || v === '') missing.push(col);
    }
    return missing;
  }

  function mahima5SuggestedAction(inCampaign, feedEligible, conversions, roas) {
    if (!inCampaign) {
      return feedEligible ? 'Add to Campaign' : 'Fix Feed First — Not Enrolled';
    }
    if (!feedEligible) return 'Optimize Feed';
    if (conversions === 0) return 'Pause';
    if (roas >= 4) return 'Scale';
    if (roas >= 2.5) return 'Maintain';
    return 'Reduce';
  }

  function mahima5Priority(action) {
    if (action === 'Fix Feed First — Not Enrolled' || action === 'Pause' || action === 'Optimize Feed') return 'High';
    if (action === 'Add to Campaign' || action === 'Reduce') return 'Medium';
    return 'Low';
  }

  async function mahimaReq5Handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const cacheKey = [req.query.from || '', req.query.to || ''].join('|');
    if (req.query.refresh !== '1') {
      const cached = MAHIMA5_CACHE.get(cacheKey);
      if (cached && (Date.now() - cached.at) < MAHIMA5_CACHE_TTL_MS) {
        res.status(200).json(cached.data);
        return;
      }
    }

    const client = await (async () => getPool().connect())().catch((err) => {
      console.error('[mahima/req5] DB connect failed:', err && err.message);
      res.status(500).json({ error: 'Server not configured or database unreachable. Contact the site administrator.' });
      return null;
    });
    if (!client) return;

    try {
      const from = isValidDate(req.query.from) ? req.query.from : null;
      const to = isValidDate(req.query.to) ? req.query.to : null;
      const result = await client.query(MAHIMA5_QUERY, [MAHIMA_CAMPAIGN_IDS, from, to]);
      const rows = result.rows;

      let rangeStart = null, rangeEnd = null, prevStart = null, prevEnd = null;
      const products = rows.map((r) => {
        rangeStart = r.range_start; rangeEnd = r.range_end; prevStart = r.prev_start; prevEnd = r.prev_end;
        const inCampaign = !!(r.campaigns && r.campaigns.length && r.cost !== null);
        const campaigns = inCampaign ? r.campaigns.filter(Boolean) : [];
        const missing = r.title === null ? null : mahima5MissingAttribute(r);
        const feedStatus = missing === null ? 'Data Missing' : (missing.length ? 'Not Eligible' : 'Eligible');
        const missingAttribute = missing === null ? 'Data Missing' : (missing.length ? missing.join(', ') : 'None missing');
        const feedEligible = feedStatus === 'Eligible';

        const clicks = Number(r.clicks) || 0;
        const impressions = Number(r.impressions) || 0;
        const conversions = Math.round((Number(r.conversions) || 0) * 100) / 100;
        const cost = Math.round((Number(r.cost) || 0) * 100) / 100;
        const convValue = Math.round((Number(r.conv_value) || 0) * 100) / 100;
        const prevCost = Number(r.prev_cost) || 0;
        const prevConvValue = Number(r.prev_conv_value) || 0;

        const roas = cost > 0 ? Math.round((convValue / cost) * 100) / 100 : 0;
        const prevRoas = prevCost > 0 ? Math.round((prevConvValue / prevCost) * 100) / 100 : 0;
        let roasTrend = 'Flat';
        if (inCampaign) {
          if (roas > prevRoas) roasTrend = 'Up';
          else if (roas < prevRoas) roasTrend = 'Down';
        } else {
          roasTrend = 'N/A';
        }

        const action = missing === null ? 'Data Missing' : mahima5SuggestedAction(inCampaign, feedEligible, conversions, roas);
        const priority = action === 'Data Missing' ? 'Low' : mahima5Priority(action);

        return {
          productId: r.product_id,
          sku: r.product_id,
          title: r.title || null,
          category: r.product_category || null,
          inCampaign,
          campaigns,
          impressions, clicks, cost, conversions, convValue,
          prevRoas: inCampaign ? prevRoas : null,
          roas: inCampaign ? roas : null,
          roasTrend,
          lastConversionDate: r.last_conv_date || null,
          feedStatus,
          missingAttribute,
          priority,
          action,
        };
      });

      const summary = {
        totalProducts: products.length,
        inCampaign: products.filter((p) => p.inCampaign).length,
        notInCampaign: products.filter((p) => !p.inCampaign).length,
        eligible: products.filter((p) => p.feedStatus === 'Eligible').length,
        feedIssues: products.filter((p) => p.feedStatus === 'Not Eligible').length,
        highPriority: products.filter((p) => p.priority === 'High').length,
        toScale: products.filter((p) => p.action === 'Scale').length,
        toAdd: products.filter((p) => p.action === 'Add to Campaign').length,
      };

      const payload = {
        success: true,
        generatedAt: new Date().toISOString(),
        dateRange: { start: rangeStart, end: rangeEnd },
        prevRange: { start: prevStart, end: prevEnd },
        campaignList: MAHIMA_CAMPAIGNS,
        dataNote: 'Feed Status / Missing Attribute: no live Google Merchant Center diagnostics feed exists in PostgreSQL (raw_data.gmc_product_diagnostics_daily was empty as of 2026-07-09 and has since been dropped). Values shown are derived the same way Req1 already does: which of 10 catalog attribute columns are blank in google_ads.merchant_products.',
        summary,
        products,
      };
      MAHIMA5_CACHE.set(cacheKey, { data: payload, at: Date.now() });
      res.status(200).json(payload);
    } catch (err) {
      console.error('[mahima/req5] Query failed:', err && err.message);
      res.status(500).json({ success: false, error: 'Could not load product coverage data. Please try again shortly.' });
    } finally {
      client.release();
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
  jefriProductStatusHandler.mahimaReq5Handler = mahimaReq5Handler;
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
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool2;
}

// Local copy of Req1's JEFRI_CAMPAIGNS (that one is private to
// jefriProductStatusHandlerModule's own closure, not accessible here) — same
// 5 campaigns/names, kept in sync manually since this module is intentionally
// isolated from Req1's code.
const JEFRI_CAMPAIGNS = [
  { id: '23141810147', name: 'Pmax | Jeff | Klarna | NEWALL | All Products | MCV | DE -16/10' },
  { id: '23411228109', name: 'Pmax | Jeff | Shoparize | ALL | All Products | MCV | DE-01/01/26' },
  { id: '22539594891', name: 'Shopping | Jeff | Shoptimised | AOVU15 | TROAS | DE -12/05' },
  { id: '23473840779', name: 'Pmax | Jeff | Shoparize | FTJ | FinetunedProducts | TROAS | DE-20.01' },
  { id: '23340277562', name: 'Pmax | Jeff | Shoparize | IT | Italy | TROAS | IT-08/12' },
];
const JEFRI_CAMPAIGN_IDS_R2 = JEFRI_CAMPAIGNS.map((c) => c.id);

const QUERY_R2 = `
  SELECT search_term, match_type, campaign_id,
         SUM(clicks)::bigint AS clicks,
         SUM(impressions)::bigint AS impressions,
         SUM(cost)::numeric AS cost,
         SUM(conversions)::numeric AS conversions,
         SUM(conversions_value)::numeric AS conv_value
  FROM (
    SELECT search_term, match_type, campaign_id, clicks, impressions, cost, conversions, conversions_value
    FROM google_ads.campaign_search_term_data
    WHERE campaign_id = ANY($1) AND date >= CURRENT_DATE - INTERVAL '90 days'
    UNION ALL
    SELECT search_term, match_type, campaign_id, clicks, impressions, cost, conversions, conversions_value
    FROM google_ads.pmax_campaign_search_term_data
    WHERE campaign_id = ANY($1) AND date >= CURRENT_DATE - INTERVAL '90 days'
  ) t
  WHERE search_term IS NOT NULL
  GROUP BY search_term, match_type, campaign_id
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
    const campaignNameById = new Map(JEFRI_CAMPAIGNS.map((c) => [c.id, c.name]));
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
      const campaignId = String(r.campaign_id);
      return {
        searchTerm: r.search_term,
        matchType: r.match_type,
        campaignId,
        campaignName: campaignNameById.get(campaignId) || campaignId,
        clicks, impressions, ctr, avgCpc, cost,
        conversionValue: round2(convValue),
        conversions: round2(conversions),
        costPerConversion,
        roas,
        tag,
      };
    });

    const campaignSummaryMap = new Map();
    for (const r of rows) {
      if (!campaignSummaryMap.has(r.campaignId)) {
        campaignSummaryMap.set(r.campaignId, { campaignId: r.campaignId, campaignName: r.campaignName, totalTerms: 0, hero: 0, villain: 0, zombie: 0, sidekick: 0 });
      }
      const cs = campaignSummaryMap.get(r.campaignId);
      cs.totalTerms++;
      if (r.tag === 'Hero') cs.hero++;
      else if (r.tag === 'Villain') cs.villain++;
      else if (r.tag === 'Zombie') cs.zombie++;
      else if (r.tag === 'Sidekick') cs.sidekick++;
    }
    const campaignSummary = [...campaignSummaryMap.values()].sort((a, b) => b.totalTerms - a.totalTerms);

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
      campaignList: JEFRI_CAMPAIGNS.filter((c) => campaignSummaryMap.has(c.id)),
      campaignSummary,
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
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
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
    const productIdNum = (v.productId || '').toString().split('/').pop();
    return [v.sku, v.handle, v.title, v.category, unitsSold, stock, lastOrderIso ? lastOrderIso.slice(0, 10) : '—', slow, productIdNum];
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

// ==================== SUK-R5: Low-Stock Alerts ====================
// Approved Low-Stock threshold: Current Stock < 10 (user-confirmed, 2026-07-27).
// Reuses r3FetchAllVariants (same product/variant/inventory query as SUK-R3) —
// no orders query needed since low-stock only depends on Current Stock.

const R5_LOW_STOCK_THRESHOLD = 10;

function r5ComputeStatus(currentStock, tracked) {
  if (!tracked || currentStock === null) return 'Not Assessable';
  return currentStock < R5_LOW_STOCK_THRESHOLD ? 'Low Stock' : 'OK';
}

async function handleReq5(req, res) {
  const variants = await r3FetchAllVariants();
  const retrievedAt = new Date().toISOString();

  const rows = variants.map(v => ({
    ...v,
    status: r5ComputeStatus(v.currentStock, v.inventoryTracked),
  }));

  const totalProducts = new Set(rows.map(r => r.productId)).size;
  const totalVariants = rows.length;
  const totalCurrentStock = rows.filter(r => r.currentStock !== null).reduce((s, r) => s + r.currentStock, 0);
  const lowStockCount = rows.filter(r => r.status === 'Low Stock').length;
  const okCount = rows.filter(r => r.status === 'OK').length;
  const outOfStockCount = rows.filter(r => r.currentStock === 0).length;
  const missingSku = rows.filter(r => r.missingSku).length;
  const notTracked = rows.filter(r => !r.inventoryTracked).length;

  const summary = {
    retrievedAt,
    lowStockThreshold: R5_LOW_STOCK_THRESHOLD,
    thresholdRule: `Current Stock < ${R5_LOW_STOCK_THRESHOLD}`,
    inventoryLocations: [...new Set(rows.map(r => r.inventoryLocation).filter(Boolean))],
    totalProducts,
    totalVariants,
    totalCurrentStock,
    lowStockCount,
    okCount,
    outOfStockCount,
    missingSku,
    inventoryNotTracked: notTracked,
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
    const reqNum = req.query && req.query.req;
    if (reqNum === '3') {
      await handleReq3(req, res);
    } else if (reqNum === '5') {
      await handleReq5(req, res);
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

// ─── DILAKSI AI CHAT (inside IIFE — accesses fetchDilaksiGA4, GSC, Shopify helpers) ─

async function handleDilaksiAiChat(req, res) {
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ ok: false, error: 'GROQ_API_KEY not configured' });
  if (!process.env.GA4_SERVICE_ACCOUNT_JSON) return res.status(500).json({ ok: false, error: 'GA4_SERVICE_ACCOUNT_JSON not configured' });

  const body = req.body || {};
  const userMessage = (body.message || '').trim();
  const history = Array.isArray(body.history) ? body.history : [];

  try {
    const accessToken = await getAccessToken();

    // Fetch GA4, GSC, Shopify catalog+sales all in parallel (single GA4 call shared)
    const [ga4Rows, gscRows, catalog, salesByProduct] = await Promise.all([
      fetchDilaksiGA4(accessToken, 30),
      fetchDilaksiGSC(accessToken),
      process.env.SHOPIFY_UK_ADMIN_TOKEN ? fetchDilaksiCatalogLive().catch(() => []) : Promise.resolve([]),
      process.env.SHOPIFY_UK_ADMIN_TOKEN ? fetchDilaksiSalesLive().catch(() => new Map()) : Promise.resolve(new Map()),
    ]);

    // ── REQ 1: build page-level data ────────────────────────────────────────
    const gscByPage = new Map();
    for (const r of gscRows) {
      const [pageUrl, query] = r.keys;
      const path = dilaksiPathFromUrl(pageUrl);
      if (!gscByPage.has(path)) gscByPage.set(path, []);
      gscByPage.get(path).push({ query, clicks: r.clicks });
    }

    const organicByHandle = new Map();
    const byPath = new Map();
    for (const r of ga4Rows) {
      const path = dilaksiPathFromUrl(r.dimensionValues[0].value);
      const sessions = Number(r.metricValues[0].value) || 0;
      const engRate  = Number(r.metricValues[2].value) || 0;
      const purchases = Number(r.metricValues[5].value) || 0;
      const revenue  = Number(r.metricValues[6].value) || 0;
      if (!byPath.has(path)) byPath.set(path, { path, sessions: 0, engRateW: 0, purchases: 0, revenue: 0 });
      const a = byPath.get(path);
      a.sessions += sessions; a.engRateW += engRate * sessions;
      a.purchases += purchases; a.revenue += revenue;
      // also track organic by product handle for Req 2
      const m = /\/products\/([^/]+)$/.exec(path);
      if (m) organicByHandle.set(m[1], (organicByHandle.get(m[1]) || 0) + sessions);
    }

    const allPages = [...byPath.values()].map(a => ({
      path: a.path,
      sessions: a.sessions,
      engRate: a.sessions > 0 ? a.engRateW / a.sessions : 0,
      purchases: a.purchases,
      revenue: a.revenue,
      topQuery: (gscByPage.get(a.path) || []).sort((x, y) => y.clicks - x.clicks)[0]?.query || '',
    })).sort((a, b) => b.sessions - a.sessions);

    const totalSessions = allPages.reduce((s, r) => s + r.sessions, 0);
    const top10 = allPages.slice(0, 10);
    const lowEng = allPages.filter(r => r.sessions > 20 && r.engRate < 0.3).slice(0, 5);

    // ── REQ 2: product priority summary ─────────────────────────────────────
    let req2Line = 'Not available (Shopify token missing)';
    if (catalog.length > 0) {
      const demandMap = loadDilaksiR2FrozenDemand();
      let high = 0, medium = 0, low = 0, lowFlag = 0, totalSales = 0;
      for (const p of catalog) {
        const s = salesByProduct.get(p.productId) || { sales: 0 };
        const organic = organicByHandle.get(p.handle) || 0;
        const demand = Object.prototype.hasOwnProperty.call(demandMap, p.productId) ? demandMap[p.productId] : null;
        totalSales += s.sales;
        const pri = dilaksiSeoPriority(demand, s.sales, organic);
        if (pri === 'High') high++;
        else if (pri === 'Medium') medium++;
        else if (pri === 'Low — flag for review') lowFlag++;
        else low++;
      }
      req2Line = `${catalog.length}products|£${Math.round(totalSales)}sales30d|High:${high}|Medium:${medium}|Low:${low}|FlagReview:${lowFlag}`;
    }

    // ── Build compact prompt ─────────────────────────────────────────────────
    const shortPath = p => p.length > 50 ? p.slice(0, 47) + '…' : p;
    const top10Lines = top10.map(r =>
      `${shortPath(r.path)}|${r.sessions}sess|eng${Math.round(r.engRate * 100)}%|${r.purchases}orders|£${Math.round(r.revenue)}|kw:"${r.topQuery.slice(0, 30)}"`
    ).join('\n');
    const lowEngLines = lowEng.map(r =>
      `${shortPath(r.path)}|${r.sessions}sess|eng${Math.round(r.engRate * 100)}%`
    ).join('\n') || 'None';

    const systemPrompt = `You are Dilaksi's SEO AI at LEDSone UK (ledsone.co.uk). Give specific numbered daily priorities using real data. No generic advice. Max 350 words.

DATA (last 30 days, ${totalSessions} total organic sessions):

TOP 10 LANDING PAGES (sessions|engagement|orders|revenue|top keyword):
${top10Lines}

LOW ENGAGEMENT PAGES (sessions>20, eng rate<30%):
${lowEngLines}

PRODUCT SEO PRIORITY (Req 2 summary):
${req2Line}

PAGES FOR REMOVAL (Req 3): Dilaksi reviews this manually in her dashboard. Remind her to check if she hasn't this week.

INSTRUCTIONS:
- Output ONLY numbered action items. No preamble. Start directly with "1."
- Format: "1. [ACTION] — [page/product] ([reason with number])"
- Priority order: low-engagement pages > high-priority products needing SEO boost > pages for removal check
- Max 8 items. UK English only.`;

    const isDailyBrief = !userMessage;
    const messages = [{ role: 'system', content: systemPrompt }];
    for (const h of history) {
      if (h.role && h.content) messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
    }
    messages.push({ role: 'user', content: isDailyBrief ? 'Give me my daily SEO priority briefing. What should I focus on today?' : userMessage });

    // ── Call Groq (shared helper) ────────────────────────────────────────────
    const groqResult = await callGroqAI(messages);
    if (!groqResult.ok) return res.status(502).json({ ok: false, error: groqResult.error, detail: groqResult.detail });

    return res.status(200).json({
      ok: true,
      message: groqResult.text,
      is_daily_brief: isDailyBrief,
      meta: { totalSessions, totalPages: allPages.length },
    });

  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
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
  req4Handler.handleDilaksiAiChat   = handleDilaksiAiChat;
  return req4Handler;
})();


// ─── DILAKSI CHAT HISTORY (outside IIFE — uses Client from top-level require) ──

async function getDilaksiChatClient() {
  const connStr = process.env.SJ_CHAT_DB_URL;
  if (!connStr) throw new Error('SJ_CHAT_DB_URL not configured');
  const c = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS dilaksi_ai_chat (
      id SERIAL PRIMARY KEY,
      session_date DATE NOT NULL DEFAULT CURRENT_DATE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  return c;
}

async function handleDilaksiChatHistory(req, res) {
  let c;
  try {
    c = await getDilaksiChatClient();
    const { rows } = await c.query(
      `SELECT role, content FROM dilaksi_ai_chat WHERE session_date = CURRENT_DATE ORDER BY id ASC`
    );
    return res.status(200).json({ ok: true, messages: rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  } finally {
    if (c) await c.end().catch(() => {});
  }
}

async function handleDilaksiChatSave(req, res) {
  const { role, content } = req.body || {};
  if (!role || !content) return res.status(400).json({ ok: false, error: 'role and content required' });
  let c;
  try {
    c = await getDilaksiChatClient();
    await c.query(`INSERT INTO dilaksi_ai_chat (role, content) VALUES ($1, $2)`, [role, content]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  } finally {
    if (c) await c.end().catch(() => {});
  }
}

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

// ==================== Thasitha Requirement 1 — Campaign Performance & ROAS ====================
// Live PostgreSQL refresh, matching the Jefri Requirement 1 pattern: short
// in-memory cache, bypassed by ?refresh=1 (the page's "Refresh Data" button).
// Source tables (see evidence/thasitha/requirement-1-postgresql-source-map.md):
//   google_ads.campaigns            — campaign_id, campaign_name, budget, feeds (Tags),
//                                      scoped to group_name = 'Thasi' (2 campaigns, ledsone.de)
//   google_ads.campaign_performance — one row per (date, campaign_id): impressions, clicks,
//                                      cost, conversion_value, conversions (account currency, EUR)
// Read-only queries only — no writes, no schema changes. Requires the `pg` npm package
// (already a dependency, shared with the Jefri endpoint above).
const thasithaReq1HandlerModule = (function() {
const { Pool } = require('pg');

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;
const CACHE_KEY = 'thasitha-req1';

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
      // Same server as the Jefri endpoint above — SSL confirmed unsupported.
      // SSL requirement varies by host (the original server didn't support
      // it; the current one requires it) — controlled by PGSSL=require env
      // var rather than hardcoded, so switching DB hosts doesn't need a
      // code change. rejectUnauthorized:false accepts the server's cert
      // without a locally-trusted CA chain, matching the connection details
      // provided for the current host.
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
      statement_timeout: 20000,
      max: 3,
    });
  }
  return pool;
}

const CAMPAIGNS_QUERY = `
  SELECT campaign_id, campaign_name, budget, feeds
  FROM google_ads.campaigns
  WHERE group_name = 'Thasi'
  ORDER BY campaign_id;
`;

const PERFORMANCE_QUERY = `
  SELECT to_char(date, 'YYYY-MM-DD') AS date, campaign_id, impressions, clicks,
         cost, conversion_value, conversions
  FROM google_ads.campaign_performance
  WHERE campaign_id = ANY($1::bigint[])
  ORDER BY date ASC, campaign_id ASC;
`;

async function handleThasithaReq1(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.query.refresh !== '1') {
    const cached = CACHE.get(CACHE_KEY);
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }
  }

  const client = await (async () => getPool().connect())().catch((err) => {
    console.error('[thasitha/req1] DB connect failed:', err && err.message);
    res.status(500).json({ error: 'Server not configured or database unreachable. Contact the site administrator.' });
    return null;
  });
  if (!client) return;

  try {
    const campResult = await client.query(CAMPAIGNS_QUERY);
    const campaigns = campResult.rows.map((r) => ({
      id: String(r.campaign_id),
      name: r.campaign_name,
      tags: r.feeds || null,
      budget: r.budget !== null && r.budget !== undefined ? Number(r.budget) : null,
    }));
    const campaignIds = campaigns.map((c) => c.id);

    let rows = [];
    if (campaignIds.length) {
      const perfResult = await client.query(PERFORMANCE_QUERY, [campaignIds]);
      rows = perfResult.rows.map((r) => ({
        date: r.date,
        campaignId: String(r.campaign_id),
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
        cost: Number(r.cost) || 0,
        conversionValue: Number(r.conversion_value) || 0,
        conversions: Number(r.conversions) || 0,
      }));
    }

    const dates = rows.map((r) => r.date);
    const payload = {
      generatedAt: new Date().toISOString(),
      dateRange: {
        min: dates.length ? dates[0] : null,
        max: dates.length ? dates[dates.length - 1] : null,
      },
      campaigns,
      rows,
    };
    CACHE.set(CACHE_KEY, { data: payload, at: Date.now() });
    res.status(200).json(payload);
  } catch (err) {
    console.error('[thasitha/req1] Query failed:', err && err.message);
    res.status(500).json({ error: 'Could not load campaign performance data. Please try again shortly.' });
  } finally {
    client.release();
  }
}

return handleThasithaReq1;
})();

// ==================== Thasitha Requirement 3 — SKU Overlap & CPC Inflation ====================
// Live PostgreSQL refresh, replacing a static July-built JSON snapshot that
// caused a real bug: a product removed from a Jefri campaign in March/April
// kept showing as "overlapping" indefinitely, because the whole page (data
// AND the "currently active" threshold) was frozen at build time.
//
// There is no per-product "currently in this campaign" status column for
// PMax (confirmed in evidence/thasitha/2026-07-15_requirement-3-discovery.md —
// google_ads.ad_group_products.status only covers Shopping/Search, zero rows
// for PMax). The only live signal is recency of google_ads.product_performance
// rows: a removed product stops generating rows entirely. So "currently
// overlapping" = the (product, campaign) pair has a performance row within 1
// day of the live MAX(date) across the whole dataset — recomputed on every
// request, not a hardcoded date. This mirrors the same proven pattern already
// used by Jefri's Requirement 1 (see the `active_products` CTE comment above).
const thasithaReq3HandlerModule = (function() {
const { Pool } = require('pg');

const CACHE = new Map();
// Longer than most other endpoints' 60s cache — this query takes ~30s on a
// cold connection (many rows aggregated), so 60s meant almost every load
// re-ran the full query. "Refresh Data" always bypasses this regardless.
const CACHE_TTL_MS = 3 * 60 * 1000;
const CACHE_KEY = 'thasitha-req3';

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
      // SSL requirement varies by host (the original server didn't support
      // it; the current one requires it) — controlled by PGSSL=require env
      // var rather than hardcoded, so switching DB hosts doesn't need a
      // code change. rejectUnauthorized:false accepts the server's cert
      // without a locally-trusted CA chain, matching the connection details
      // provided for the current host.
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
      // Longer than the other Thasitha/Jefri pools: this query aggregates
      // tens of thousands of product_performance rows across every campaign
      // that has ever shown any Thasi product (measured ~30-35s on a cold
      // connection) — 30s was cutting it off mid-query.
      statement_timeout: 60000,
      max: 3,
    });
  }
  return pool;
}

// Only products that have BOTH a Thasi campaign row AND at least one
// non-Thasi campaign row (>=2 distinct campaigns overall) are genuine
// overlap candidates — this is a historical/structural filter to keep the
// payload manageable; the real "is this a LIVE overlap" decision is the
// last_active recency check applied per (product, campaign) below and
// re-checked client-side against the range picker.
const QUERY = `
WITH thasi_campaigns AS (
  SELECT campaign_id, campaign_name FROM google_ads.campaigns WHERE group_name = 'Thasi'
),
thasi_products AS (
  SELECT DISTINCT pp.product_item_id
  FROM google_ads.product_performance pp
  WHERE pp.campaign_id IN (SELECT campaign_id FROM thasi_campaigns)
    AND pp.product_item_id IS NOT NULL AND pp.product_item_id <> ''
),
camp_counts AS (
  SELECT pp.product_item_id, count(DISTINCT pp.campaign_id) AS n
  FROM google_ads.product_performance pp
  WHERE pp.product_item_id IN (SELECT product_item_id FROM thasi_products)
  GROUP BY pp.product_item_id
),
overlap_products AS (
  SELECT product_item_id FROM camp_counts WHERE n >= 2
),
latest AS (
  SELECT MAX(pp.date) AS max_date
  FROM google_ads.product_performance pp
  WHERE pp.product_item_id IN (SELECT product_item_id FROM overlap_products)
),
daily AS (
  SELECT pp.product_item_id, pp.campaign_id, pp.date,
         SUM(pp.cost) AS cost, SUM(pp.clicks) AS clicks,
         SUM(pp.conversions) AS conversions, SUM(pp.conversion_value) AS conversion_value
  FROM google_ads.product_performance pp
  WHERE pp.product_item_id IN (SELECT product_item_id FROM overlap_products)
  GROUP BY pp.product_item_id, pp.campaign_id, pp.date
),
last_active AS (
  -- Only count days with real activity (cost/clicks/conversions > 0) — Google
  -- Ads still writes zero-value placeholder rows for products that have had
  -- no actual activity in months, which previously made stale/removed
  -- products look "currently active" just because a $0 row existed.
  SELECT product_item_id, campaign_id, MAX(date) AS last_active
  FROM daily
  WHERE cost > 0 OR clicks > 0 OR conversions > 0
  GROUP BY product_item_id, campaign_id
),
resolved_ids AS (
  SELECT product_item_id,
    CASE WHEN product_item_id LIKE 'shopify\\_%'
         THEN split_part(product_item_id, '_', array_length(string_to_array(product_item_id, '_'), 1))
         ELSE product_item_id
    END AS shopify_id
  FROM overlap_products
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
    COALESCE(NULLIF(sl.title, ''), child_sl.title) AS title,
    COALESCE(NULLIF(sl.main_image_url, ''), child_sl.main_image_url) AS image,
    sl.listing_url AS url
  FROM listings.shopify_listings sl
  LEFT JOIN child_fallback cf ON cf.parent_listing_id = sl.id
  LEFT JOIN listings.shopify_listings child_sl ON child_sl.id = cf.child_listing_id
  WHERE sl.channel = 'LEDSone DE'
),
feed_membership AS (
  -- Whether a product is still present in the specific merchant feed a
  -- campaign actually pulls from. A product can have real historical spend
  -- in a campaign yet have since been removed/re-classified out of that
  -- feed entirely (confirmed case: product still shows recent spend rows,
  -- but Google Ads' live Products tab shows nothing because it dropped out
  -- of the merchant account's feed) — that's undetectable from spend
  -- history alone, so we check current feed membership directly.
  SELECT DISTINCT product_id, merchant_id
  FROM google_ads.merchant_products
)
SELECT
  d.product_item_id, d.campaign_id, to_char(d.date, 'YYYY-MM-DD') AS date,
  d.cost, d.clicks, d.conversions, d.conversion_value,
  c.campaign_name, c.campaign_type, c.campaign_status,
  (c.campaign_id IN (SELECT campaign_id FROM thasi_campaigns)) AS is_thasi,
  to_char(la.last_active, 'YYYY-MM-DD') AS last_active,
  (fm.product_id IS NOT NULL) AS still_in_feed,
  rl.sku, rl.title, rl.image, rl.url,
  to_char((SELECT max_date FROM latest), 'YYYY-MM-DD') AS latest_date
FROM daily d
JOIN google_ads.campaigns c ON c.campaign_id = d.campaign_id
JOIN last_active la ON la.product_item_id = d.product_item_id AND la.campaign_id = d.campaign_id
LEFT JOIN feed_membership fm ON fm.product_id = d.product_item_id AND fm.merchant_id = c.merchant_id
JOIN resolved_ids ri ON ri.product_item_id = d.product_item_id
LEFT JOIN resolved_listing rl ON rl.item_id = ri.shopify_id
ORDER BY d.product_item_id, d.campaign_id, d.date;
`;

async function handleThasithaReq3(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.query.refresh !== '1') {
    const cached = CACHE.get(CACHE_KEY);
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }
  }

  const client = await (async () => getPool().connect())().catch((err) => {
    console.error('[thasitha/req3] DB connect failed:', err && err.message);
    res.status(500).json({ error: 'Server not configured or database unreachable. Contact the site administrator.' });
    return null;
  });
  if (!client) return;

  try {
    const result = await client.query(QUERY);
    const rows = result.rows;

    // Reshape into { sku (product_item_id), title, img, lnk, camps: [{cid, cname,
    // ctype, cstatus, isThasi, lastActive, daily:[{d,cost,clk,conv,cv}]}] } —
    // matching the shape the existing frontend r3ComputeRow()/renderR3Row()
    // already expect, so only the data source changes, not that logic.
    const productMap = new Map();
    let latestDate = null;
    for (const r of rows) {
      latestDate = r.latest_date;
      if (!productMap.has(r.product_item_id)) {
        productMap.set(r.product_item_id, {
          sku: r.sku || r.product_item_id,
          pid: r.product_item_id,
          title: r.title || null,
          img: r.image || null,
          lnk: r.url || null,
          campsById: new Map(),
        });
      }
      const product = productMap.get(r.product_item_id);
      if (!product.campsById.has(r.campaign_id)) {
        product.campsById.set(r.campaign_id, {
          cid: String(r.campaign_id),
          cname: r.campaign_name,
          ctype: r.campaign_type,
          cstatus: r.campaign_status,
          isThasi: !!r.is_thasi,
          lastActive: r.last_active,
          stillInFeed: !!r.still_in_feed,
          daily: [],
        });
      }
      product.campsById.get(r.campaign_id).daily.push({
        d: r.date,
        cost: Number(r.cost) || 0,
        clk: Number(r.clicks) || 0,
        conv: Number(r.conversions) || 0,
        cv: Number(r.conversion_value) || 0,
      });
    }

    const products = [...productMap.values()].map((p) => ({
      sku: p.sku,
      pid: p.pid,
      title: p.title,
      img: p.img,
      lnk: p.lnk,
      camps: [...p.campsById.values()],
    }));

    const payload = {
      generatedAt: new Date().toISOString(),
      latestDate,
      products,
    };
    CACHE.set(CACHE_KEY, { data: payload, at: Date.now() });
    res.status(200).json(payload);
  } catch (err) {
    console.error('[thasitha/req3] Query failed:', err && err.message);
    res.status(500).json({ error: 'Could not load SKU overlap data. Please try again shortly.' });
  } finally {
    client.release();
  }
}

return handleThasithaReq3;
})();

// ==================== Thasitha Requirement 6 — Search Terms Labels (Google Ads) ====================
// Rebuilt 2026-08-10 per explicit instruction: "gather all Thasitha
// campaign-wise search terms, exact as Jefri Req2" — this now mirrors
// jefriSearchTermsHandlerModule (same query shape: UNION of
// google_ads.campaign_search_term_data + pmax_campaign_search_term_data,
// same clicks/impressions/ctr/avgCpc/cost/conversions/convValue/
// costPerConversion/roas fields, same Hero/Villain/Zombie/Sidekick tagging),
// scoped to Thasitha's campaigns (group_name='Thasi', account_id=9031058245)
// instead of Jefri's 5 named campaign IDs. The earlier SKU/H1/Meta/Amazon
// "SEO Gap" version (see evidence/thasitha/2026-08-10_requirement-6-keyword-seo-gap-discovery.md
// for that discovery) is superseded by this — this is the base search-term
// gathering step; any SEO-gap layer on top is a separate future step, not
// part of this rebuild.
const thasithaReq6HandlerModule = (function() {
const { Pool } = require('pg');

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
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
      statement_timeout: 30000,
      max: 3,
    });
  }
  return pool;
}

const THASI_QUERY = `
  WITH thasi_campaigns AS (
    SELECT campaign_id, campaign_name FROM google_ads.campaigns WHERE group_name = 'Thasi'
  ),
  unioned AS (
    SELECT search_term, match_type, campaign_id, clicks, impressions, cost, conversions, conversions_value
    FROM google_ads.campaign_search_term_data
    WHERE campaign_id IN (SELECT campaign_id FROM thasi_campaigns) AND date >= CURRENT_DATE - INTERVAL '90 days'
    UNION ALL
    SELECT search_term, match_type, campaign_id, clicks, impressions, cost, conversions, conversions_value
    FROM google_ads.pmax_campaign_search_term_data
    WHERE campaign_id IN (SELECT campaign_id FROM thasi_campaigns) AND date >= CURRENT_DATE - INTERVAL '90 days'
  )
  SELECT search_term, match_type, campaign_id,
         SUM(clicks)::bigint AS clicks,
         SUM(impressions)::bigint AS impressions,
         SUM(cost)::numeric AS cost,
         SUM(conversions)::numeric AS conversions,
         SUM(conversions_value)::numeric AS conv_value
  FROM unioned
  WHERE search_term IS NOT NULL
  GROUP BY search_term, match_type, campaign_id
`;

// Same tag rules as Jefri Req2 (jefriSearchTermsHandlerModule) — kept
// byte-identical per "exact as Jefri Req2" instruction:
//   Hero:     clicks >= 3 AND ROAS >= 400%
//   Villain:  clicks >= 3 AND (ROAS < 400% OR conversions = 0)
//   Zombie:   impressions > 0 AND clicks = 0
//   Sidekick: clicks BETWEEN 1 AND 2 AND ROAS >= 400%
function classifyTag(clicks, impressions, cost, conversions, roas) {
  if (clicks >= 3) {
    if (roas >= 400) return 'Hero';
    if (roas < 400 || conversions === 0) return 'Villain';
  }
  if (impressions > 0 && clicks === 0) return 'Zombie';
  if (clicks >= 1 && clicks <= 2 && roas >= 400) return 'Sidekick';
  return '';
}
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;
const CACHE_KEY = 'thasitha-req6';

async function handleThasithaReq6(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.query.refresh !== '1') {
    const cached = CACHE.get(CACHE_KEY);
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }
  }

  let client;
  try {
    client = await getPool().connect();
  } catch (err) {
    console.error('[thasitha/req6] DB connect failed:', err && err.message);
    res.status(500).json({ error: 'Server not configured or database unreachable. Contact the site administrator.' });
    return;
  }

  try {
    const campResult = await client.query(`SELECT campaign_id, campaign_name FROM google_ads.campaigns WHERE group_name = 'Thasi'`);
    const campaignNameById = new Map(campResult.rows.map((c) => [String(c.campaign_id), c.campaign_name]));

    const result = await client.query(THASI_QUERY);
    // Bug fix confirmed 2026-08-10 via direct DB inspection: cost is 100%
    // NULL for every row Thasitha has in google_ads.campaign_search_term_data
    // (10,740/10,740 rows, 464 of them with real clicks) — genuinely not
    // tracked at the search-term level for that source, NOT a real €0. The
    // old code did `Number(null) || 0`, silently showing "€0.00 cost" next
    // to real clicks/conversions, which is misleading. google_ads.
    // pmax_campaign_search_term_data's cost is never null (0 there is a real
    // zero — PMax genuinely doesn't allocate spend to some search terms).
    // Now: cost stays null (shown as "N/A", not €0.00) whenever the source
    // row(s) never had cost tracked; ROAS/Avg CPC/Cost per Conversion follow
    // suit; and the row is left untagged (no Hero/Villain/etc.) since a tag
    // driven by ROAS can't be honestly computed without real cost.
    const rows = result.rows.map((r) => {
      const clicks = Number(r.clicks) || 0;
      const impressions = Number(r.impressions) || 0;
      const costKnown = r.cost !== null && r.cost !== undefined;
      const cost = costKnown ? Number(r.cost) : 0;
      const conversions = Number(r.conversions) || 0;
      const convValue = Number(r.conv_value) || 0;
      const ctr = impressions > 0 ? round2((clicks / impressions) * 100) : 0;
      const avgCpc = costKnown && clicks > 0 ? round2(cost / clicks) : null;
      const costPerConversion = costKnown && conversions > 0 ? round2(cost / conversions) : null;
      const roas = costKnown ? (cost > 0 ? round2((convValue / cost) * 100) : 0) : null;
      const tag = costKnown ? classifyTag(clicks, impressions, cost, conversions, roas) : '';
      const campaignId = String(r.campaign_id);
      return {
        searchTerm: r.search_term,
        matchType: r.match_type,
        campaignId,
        campaignName: campaignNameById.get(campaignId) || campaignId,
        clicks, impressions, ctr, avgCpc,
        cost: costKnown ? cost : null,
        conversionValue: round2(convValue),
        conversions: round2(conversions),
        costPerConversion,
        roas,
        costAvailable: costKnown,
        tag,
      };
    });

    // Pre-seed every one of Thasitha's campaigns (not just ones that show up
    // in the search-term rows) — a brand-new campaign with zero search-term
    // data yet (confirmed 2026-08-10: "Klarna | SUMT | NewProduct -22/07",
    // started ~19 days before this fix, genuinely 0 rows in either
    // search-term table, all-time) would otherwise silently vanish from the
    // campaign summary and dropdown instead of showing as 0 terms.
    const campaignSummaryMap = new Map();
    for (const [id, name] of campaignNameById.entries()) {
      campaignSummaryMap.set(id, { campaignId: id, campaignName: name, totalTerms: 0, hero: 0, villain: 0, zombie: 0, sidekick: 0 });
    }
    for (const r of rows) {
      const cs = campaignSummaryMap.get(r.campaignId);
      cs.totalTerms++;
      if (r.tag === 'Hero') cs.hero++;
      else if (r.tag === 'Villain') cs.villain++;
      else if (r.tag === 'Zombie') cs.zombie++;
      else if (r.tag === 'Sidekick') cs.sidekick++;
    }
    const campaignSummary = [...campaignSummaryMap.values()].sort((a, b) => b.totalTerms - a.totalTerms);

    const payload = {
      success: true,
      staff: { name: 'Thasitha', department: 'Google Ads', store: 'ledsone.de' },
      reportPeriod: { label: 'Last 90 Days', days: 90 },
      source: {
        scope: `Thasitha's campaigns (group_name='Thasi', account_id=9031058245), search terms from both Shopping/Search and Performance Max campaigns, rolling last 90 days — same query shape as Jefri Requirement 2`,
        tables: ['google_ads.campaign_search_term_data', 'google_ads.pmax_campaign_search_term_data'],
      },
      summary: {
        totalTerms: rows.length,
        hero: rows.filter((r) => r.tag === 'Hero').length,
        villain: rows.filter((r) => r.tag === 'Villain').length,
        zombie: rows.filter((r) => r.tag === 'Zombie').length,
        sidekick: rows.filter((r) => r.tag === 'Sidekick').length,
      },
      campaignList: [...campaignNameById.entries()].map(([id, name]) => ({ id, name })),
      campaignSummary,
      rows,
      meta: { generatedAt: new Date().toISOString() },
    };
    CACHE.set(CACHE_KEY, { data: payload, at: Date.now() });
    res.status(200).json(payload);
  } catch (err) {
    console.error('[thasitha/req6] Query failed:', err && err.message);
    res.status(500).json({ error: 'Could not load search term data. Please try again shortly.' });
  } finally {
    if (client) client.release();
  }
}

return handleThasithaReq6;
})();

// ==================== Thasitha Requirement 7 — Amazon DE Campaign-Wise Search Terms (for her SKUs) ====================
// Rebuilt 2026-08-10, replacing the earlier Shopify H1/Meta product-catalog
// version entirely, per explicit instruction: "show the amazon de all
// champaign wise search terms ... replacing all req 7 ... like req 6 for
// google ads". Same shape/classification as Requirement 6 (Jefri Req2
// pattern), but scoped to Amazon DE campaigns instead of Google Ads.
//
// Amazon campaigns have NO staff/owner field (confirmed during Requirement 6
// discovery) — Thasitha does not "own" any Amazon campaign. So this stays a
// SKU-based cross-platform proxy, same idea approved earlier ("for the same
// sku what keyword amazon staff using"): every Amazon DE campaign that has
// EVER advertised one of Thasitha's Google-side SKUs (matched via
// amazon_campaigns.performance_data.listing_sku, exact string match),
// grouped campaign-wise, showing every real search term for that
// campaign+SKU match (amazon_campaigns.search_term_performance_data, last 90
// days). Scoped to market_place=10 (Germany/DE, confirmed via
// order_management.market_place) only — other Amazon marketplaces excluded.
//
// Known limitation, disclosed in the UI: Amazon's Search Term Report is
// ad-group level, not per-SKU. A term is attributed to a campaign whenever
// it comes from an ad group that contains one of her SKUs — the "SKU count"
// column shows how many total SKUs sit in that ad group (1 = a tight/exact
// signal, hundreds = a broad proxy, judge accordingly).
//
// Scoped to Manual-targeting campaigns only (targeting_type='Manual'), per
// explicit instruction 2026-08-10 — Auto campaigns excluded. Confirmed via
// direct DB check: of the 75 DE campaigns that ever touched one of her SKUs,
// 23 are Manual / 52 are Auto; restricting to Manual leaves 1,569 real
// campaign+term rows (not empty).
const thasithaReq7HandlerModule = (function() {
const { Pool } = require('pg');

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
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
      statement_timeout: 30000,
      max: 3,
    });
  }
  return pool;
}

// SKU resolution CTEs identical to Req2/Req3/Req6 pattern (blank
// product_item_id rows excluded, parent-listing SKU resolved via mapped
// child variant), feeding into the Amazon match.
const TERMS_QUERY = `
WITH thasi_campaigns AS (
  SELECT campaign_id FROM google_ads.campaigns WHERE group_name = 'Thasi'
),
thasi_products AS (
  SELECT DISTINCT pp.product_item_id
  FROM google_ads.product_performance pp
  WHERE pp.campaign_id IN (SELECT campaign_id FROM thasi_campaigns)
    AND pp.product_item_id IS NOT NULL AND pp.product_item_id <> ''
),
resolved_ids AS (
  SELECT product_item_id,
    CASE WHEN product_item_id LIKE 'shopify\\_%'
         THEN split_part(product_item_id, '_', array_length(string_to_array(product_item_id, '_'), 1))
         ELSE product_item_id END AS shopify_id
  FROM thasi_products
),
child_fallback AS (
  SELECT m.parent_id AS parent_listing_id, MIN(child.id) AS child_listing_id
  FROM listings.shopify_listings_parent_child_mapping m
  JOIN listings.shopify_listings child ON child.id = m.child_id AND child.all_list = 1
  GROUP BY m.parent_id
),
resolved_listing AS (
  SELECT sl.item_id, COALESCE(NULLIF(sl.sku, ''), child_sl.sku) AS sku
  FROM listings.shopify_listings sl
  LEFT JOIN child_fallback cf ON cf.parent_listing_id = sl.id
  LEFT JOIN listings.shopify_listings child_sl ON child_sl.id = cf.child_listing_id
  WHERE sl.channel = 'LEDSone DE'
),
skus AS (
  SELECT DISTINCT rl.sku
  FROM resolved_ids ri
  JOIN resolved_listing rl ON rl.item_id = ri.shopify_id
  WHERE rl.sku IS NOT NULL
),
de_campaigns AS (
  SELECT campaign_id FROM amazon_campaigns.campaigns WHERE market_place = 10 AND targeting_type = 'Manual'
),
matched_ad_groups AS (
  SELECT DISTINCT pd.ad_group_id, pd.campaign_id
  FROM amazon_campaigns.performance_data pd
  JOIN skus s ON s.sku = pd.listing_sku
  WHERE pd.campaign_id IN (SELECT campaign_id FROM de_campaigns)
),
ad_group_sku_counts AS (
  SELECT ad_group_id, COUNT(DISTINCT listing_sku) AS sku_count
  FROM amazon_campaigns.performance_data
  WHERE ad_group_id IN (SELECT ad_group_id FROM matched_ad_groups)
  GROUP BY ad_group_id
),
terms AS (
  SELECT t.campaign_id, t.ad_group_id, t.search_term, t.match_type,
    SUM(t.clicks) AS clicks, SUM(t.impressions) AS impressions,
    SUM(t.spend) AS cost, SUM(t.orders) AS conversions, SUM(t.sales) AS conv_value
  FROM amazon_campaigns.search_term_performance_data t
  WHERE t.ad_group_id IN (SELECT ad_group_id FROM matched_ad_groups)
    AND t.date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY t.campaign_id, t.ad_group_id, t.search_term, t.match_type
)
SELECT te.campaign_id, te.search_term, te.match_type,
  SUM(te.clicks)::bigint AS clicks,
  SUM(te.impressions)::bigint AS impressions,
  SUM(te.cost)::numeric AS cost,
  SUM(te.conversions)::numeric AS conversions,
  SUM(te.conv_value)::numeric AS conv_value,
  MAX(agc.sku_count) AS sku_count
FROM terms te
JOIN ad_group_sku_counts agc ON agc.ad_group_id = te.ad_group_id
WHERE te.search_term IS NOT NULL
GROUP BY te.campaign_id, te.search_term, te.match_type;
`;

// Same tag rules as Req6/Jefri Req2 — kept byte-identical:
//   Hero:     clicks >= 3 AND ROAS >= 400%
//   Villain:  clicks >= 3 AND (ROAS < 400% OR conversions = 0)
//   Zombie:   impressions > 0 AND clicks = 0
//   Sidekick: clicks BETWEEN 1 AND 2 AND ROAS >= 400%
function classifyTag(clicks, impressions, cost, conversions, roas) {
  if (clicks >= 3) {
    if (roas >= 400) return 'Hero';
    if (roas < 400 || conversions === 0) return 'Villain';
  }
  if (impressions > 0 && clicks === 0) return 'Zombie';
  if (clicks >= 1 && clicks <= 2 && roas >= 400) return 'Sidekick';
  return '';
}
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;
const CACHE_KEY = 'thasitha-req7';

async function handleThasithaReq7(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const forceRefresh = req.query && req.query.refresh === '1';

  if (!forceRefresh) {
    const cached = CACHE.get(CACHE_KEY);
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }
  }

  const client = await getPool().connect().catch((err) => {
    console.error('[thasitha/req7] DB connect failed:', err && err.message);
    res.status(500).json({ error: 'Server not configured or database unreachable.' });
    return null;
  });
  if (!client) return;

  try {
    const termsResult = await client.query(TERMS_QUERY);

    const campaignIds = [...new Set(termsResult.rows.map((r) => String(r.campaign_id)))];
    let campaignNameById = new Map();
    if (campaignIds.length) {
      const campResult = await client.query(
        `SELECT campaign_id, campaign_name FROM amazon_campaigns.campaigns WHERE campaign_id = ANY($1::bigint[])`,
        [campaignIds]
      );
      campaignNameById = new Map(campResult.rows.map((c) => [String(c.campaign_id), c.campaign_name]));
    }

    const rows = termsResult.rows.map((r) => {
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
      const campaignId = String(r.campaign_id);
      return {
        searchTerm: r.search_term,
        matchType: r.match_type,
        campaignId,
        campaignName: campaignNameById.get(campaignId) || campaignId,
        clicks, impressions, ctr, avgCpc, cost,
        conversionValue: round2(convValue),
        conversions: round2(conversions),
        costPerConversion,
        roas,
        skuCount: r.sku_count,
        tag,
      };
    });

    const campaignSummaryMap = new Map();
    for (const [id, name] of campaignNameById.entries()) {
      campaignSummaryMap.set(id, { campaignId: id, campaignName: name, totalTerms: 0, hero: 0, villain: 0, zombie: 0, sidekick: 0 });
    }
    for (const r of rows) {
      const cs = campaignSummaryMap.get(r.campaignId);
      cs.totalTerms++;
      if (r.tag === 'Hero') cs.hero++;
      else if (r.tag === 'Villain') cs.villain++;
      else if (r.tag === 'Zombie') cs.zombie++;
      else if (r.tag === 'Sidekick') cs.sidekick++;
    }
    const campaignSummary = [...campaignSummaryMap.values()].sort((a, b) => b.totalTerms - a.totalTerms);

    const payload = {
      success: true,
      staff: { name: 'Thasitha', department: 'Google Ads', store: 'ledsone.de' },
      reportPeriod: { label: 'Last 90 Days', days: 90 },
      source: {
        scope: `Amazon DE campaigns (market_place=10, targeting_type='Manual' only — Auto campaigns excluded) that have ever advertised one of Thasitha's Google-side SKUs (exact SKU string match), search terms rolling last 90 days — same shape as Requirement 6, cross-platform proxy since Amazon campaigns have no staff/owner field`,
        tables: ['amazon_campaigns.performance_data', 'amazon_campaigns.search_term_performance_data', 'amazon_campaigns.campaigns'],
      },
      summary: {
        totalTerms: rows.length,
        hero: rows.filter((r) => r.tag === 'Hero').length,
        villain: rows.filter((r) => r.tag === 'Villain').length,
        zombie: rows.filter((r) => r.tag === 'Zombie').length,
        sidekick: rows.filter((r) => r.tag === 'Sidekick').length,
      },
      campaignList: [...campaignNameById.entries()].map(([id, name]) => ({ id, name })),
      campaignSummary,
      rows,
      meta: { generatedAt: new Date().toISOString() },
    };
    CACHE.set(CACHE_KEY, { data: payload, at: Date.now() });
    res.status(200).json(payload);
  } catch (err) {
    console.error('[thasitha/req7] error:', err && err.message);
    res.status(500).json({ error: err.message || 'Unknown error' });
  } finally {
    client.release();
  }
}

return handleThasithaReq7;
})();

// ==================== Thasitha Requirement 2 — PMax Product Zero-Performance & Root-Cause ====================
// Live PostgreSQL refresh, replacing the static R2_PRODUCTS array baked into
// thasitha.html on 2026-07-15/16. Same live/frozen bug class as the old
// Req1/Req3 (see evidence/thasitha/2026-07-15_requirement-2-pmax-zero-performance-discovery.md).
// GMC/"Data Check" approval status is structurally unavailable for PMax
// (confirmed again live 2026-07-29 -- raw_data.gmc_product_diagnostics_daily
// does not exist, no %eligib%/%disapprov%/%diagnostic% table or column
// anywhere). Per user instruction, the "Data Check" column is kept but
// reuses the exact same derived proxy Mahima's Feed Status uses: which of
// the 10 MAHIMA_ATTR_COLUMNS-equivalent catalog fields are blank in
// google_ads.merchant_products -- not real Merchant Center approval data.
const thasithaReq2HandlerModule = (function() {
const { Pool } = require('pg');

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;
const CACHE_KEY = 'thasitha-req2';

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
      // SSL requirement varies by host (the original server didn't support
      // it; the current one requires it) — controlled by PGSSL=require env
      // var rather than hardcoded, so switching DB hosts doesn't need a
      // code change. rejectUnauthorized:false accepts the server's cert
      // without a locally-trusted CA chain, matching the connection details
      // provided for the current host.
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
      statement_timeout: 30000,
      max: 3,
    });
  }
  return pool;
}

const THASITHA2_ATTR_COLUMNS = ['product_category', 'item_group_id', 'mpn', 'color', 'condition', 'description', 'product_types', 'availability', 'brand', 'price'];

// Self-contained Shopify stock fetch (same ledsone-de store/token/logic as
// Mahima's fetchLiveStock) -- duplicated rather than shared because that
// helper lives inside jefriProductStatusHandlerModule's own IIFE closure and
// isn't reachable from this separate module, matching this file's existing
// per-module self-containment pattern (see kamsiLiveHandlerModule above).
const T2_SHOPIFY_STORE_DOMAIN = 'ledsone-de.myshopify.com';
const T2_SHOPIFY_API_VERSION = '2024-10';
const t2Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function t2ShopifyGraphQL(query, variables) {
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      res = await fetch(`https://${T2_SHOPIFY_STORE_DOMAIN}/admin/api/${T2_SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (e) {
      await t2Sleep(400 * Math.pow(2, attempt));
      continue;
    }
    if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
      await t2Sleep(400 * Math.pow(2, attempt));
      continue;
    }
    if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
    const json = await res.json();
    const throttled = json.errors && Array.isArray(json.errors) && json.errors.some((e) => e.extensions && e.extensions.code === 'THROTTLED');
    if (throttled) { await t2Sleep(800 * Math.pow(2, attempt)); continue; }
    if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error('Shopify API: exceeded retries (throttling / transient errors)');
}

// Includes product title/handle/featuredImage alongside inventory -- needed
// as a fallback for brand-new campaigns whose products haven't synced into
// the slower google_ads.merchant_products feed export yet (real gap found
// 2026-07-29: Thasi's campaign added 2026-07-22 has 193 of 226 products with
// zero merchant_products row). Shopify itself always has the real product,
// since it's actively selling -- pulling from there is live real data, not
// fabrication.
const T2_NODES_QUERY = `
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
      product {
        title
        handle
        featuredImage { url }
      }
    }
  }
}`;

async function t2FetchLiveStock(itemIds) {
  const stockById = new Map();
  const infoById = new Map();
  const uniqueIds = [...new Set(itemIds.filter(Boolean).map(String))];
  const BATCH = 250;
  for (let i = 0; i < uniqueIds.length; i += BATCH) {
    const batch = uniqueIds.slice(i, i + BATCH);
    const gids = batch.map((id) => `gid://shopify/ProductVariant/${id}`);
    const data = await t2ShopifyGraphQL(T2_NODES_QUERY, { ids: gids });
    for (const node of data.nodes) {
      if (!node || !node.id) continue;
      const numericId = node.id.split('/').pop();
      if (!node.inventoryItem || !node.inventoryItem.tracked) {
        stockById.set(numericId, null);
      } else {
        const total = node.inventoryItem.inventoryLevels.edges.reduce((sum, e) => {
          const avail = e.node.quantities.find((q) => q.name === 'available');
          return sum + (avail ? avail.quantity : 0);
        }, 0);
        stockById.set(numericId, total);
      }
      if (node.product) {
        infoById.set(numericId, {
          title: node.product.title || null,
          image: node.product.featuredImage ? node.product.featuredImage.url : null,
          link: node.product.handle ? `https://ledsone.de/products/${node.product.handle}` : null,
        });
      }
    }
  }
  return { stockById, infoById };
}

const QUERY = `
WITH bounds AS (
  SELECT MAX(date) AS max_date FROM google_ads.product_performance
  WHERE campaign_id IN (SELECT campaign_id FROM google_ads.campaigns WHERE group_name = 'Thasi')
),
range AS (
  SELECT ((SELECT max_date FROM bounds) - INTERVAL '29 days')::date AS start_date, (SELECT max_date FROM bounds)::date AS end_date
),
camp AS (
  SELECT campaign_id, campaign_name, budget FROM google_ads.campaigns WHERE group_name = 'Thasi'
),
perf AS (
  SELECT pp.campaign_id, pp.product_item_id,
    SUM(pp.impressions) AS imp, SUM(pp.clicks) AS clk, SUM(pp.cost) AS sp,
    SUM(pp.conversions) AS cv, SUM(pp.conversion_value) AS cvv
  FROM google_ads.product_performance pp CROSS JOIN range r
  WHERE pp.campaign_id IN (SELECT campaign_id FROM camp) AND pp.product_item_id <> ''
    AND pp.date BETWEEN r.start_date AND r.end_date
  GROUP BY pp.campaign_id, pp.product_item_id
),
first_seen AS (
  SELECT campaign_id, product_item_id, MIN(date) AS first_date
  FROM google_ads.product_performance
  WHERE campaign_id IN (SELECT campaign_id FROM camp) AND product_item_id <> ''
  GROUP BY campaign_id, product_item_id
),
merch AS (
  SELECT DISTINCT ON (product_id) *
  FROM google_ads.merchant_products
  ORDER BY product_id, (lan = 'de') DESC
),
listing AS (
  SELECT DISTINCT ON (item_id) item_id, title, main_image_url, listing_url, quantity
  FROM listings.shopify_listings
  WHERE channel = 'LEDSone DE'
  ORDER BY item_id, (all_list = 1) DESC
)
SELECT p.campaign_id, c.campaign_name, c.budget, p.product_item_id,
  p.imp, p.clk, p.sp, p.cv, p.cvv,
  fs.first_date, ((SELECT end_date FROM range) - fs.first_date) AS days_live,
  COALESCE(m.title, l.title) AS title,
  m.title AS merch_title,
  COALESCE(m.image_link, l.main_image_url) AS image_link,
  COALESCE(m.link, l.listing_url) AS link,
  m.availability, l.quantity AS listing_qty,
  m.product_category, m.item_group_id, m.mpn, m.color, m.condition, m.description, m.product_types, m.brand, m.price,
  (SELECT end_date FROM range) AS range_end
FROM perf p
JOIN camp c ON c.campaign_id = p.campaign_id
LEFT JOIN first_seen fs ON fs.campaign_id = p.campaign_id AND fs.product_item_id = p.product_item_id
LEFT JOIN merch m ON m.product_id = p.product_item_id
LEFT JOIN listing l ON l.item_id = p.product_item_id
ORDER BY p.sp DESC NULLS LAST;
`;

function thasitha2DataCheck(r) {
  if (r.merch_title === null) return { status: 'nofeed', missing: [] };
  const missing = [];
  for (const col of THASITHA2_ATTR_COLUMNS) {
    const v = r[col];
    if (v === null || v === undefined || v === '') missing.push(col);
  }
  return missing.length ? { status: 'notapproved', missing } : { status: 'approved', missing: [] };
}

async function handleThasithaReq2(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.query.refresh !== '1') {
    const cached = CACHE.get(CACHE_KEY);
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
      res.status(200).json(cached.data);
      return;
    }
  }

  const client = await (async () => getPool().connect())().catch((err) => {
    console.error('[thasitha/req2] DB connect failed:', err && err.message);
    res.status(500).json({ error: 'Server not configured or database unreachable. Contact the site administrator.' });
    return null;
  });
  if (!client) return;

  try {
    const result = await client.query(QUERY);
    const rows = result.rows;

    let liveStockById = new Map();
    let liveInfoById = new Map();
    let stockSourceError = null;
    if (!process.env.SHOPIFY_ADMIN_TOKEN) {
      stockSourceError = 'SHOPIFY_ADMIN_TOKEN missing — Stock unavailable';
    } else {
      try {
        const live = await t2FetchLiveStock(rows.map((r) => r.product_item_id));
        liveStockById = live.stockById;
        liveInfoById = live.infoById;
      } catch (e) {
        console.error('[thasitha/req2] Live stock fetch failed:', e && e.message);
        stockSourceError = 'Could not fetch live stock from Shopify';
      }
    }

    let rangeEnd = null;
    const products = rows.map((r) => {
      rangeEnd = r.range_end;
      const dc = thasitha2DataCheck(r);
      const liveStock = liveStockById.get(String(r.product_item_id));
      // Fallback to live Shopify title/image/link when this product hasn't
      // synced into the merchant_products feed export yet (common for
      // brand-new campaigns -- real gap, not a bug, see comment on
      // T2_NODES_QUERY above).
      const liveInfo = liveInfoById.get(String(r.product_item_id));
      return {
        cid: String(r.campaign_id),
        pid: r.product_item_id,
        fd: r.first_date ? new Date(r.first_date).toISOString().slice(0, 10) : null,
        dl: r.days_live === null || r.days_live === undefined ? null : Number(r.days_live),
        imp: Number(r.imp) || 0,
        clk: Number(r.clk) || 0,
        sp: Number(r.sp) || 0,
        cv: Number(r.cv) || 0,
        cvv: Number(r.cvv) || 0,
        // qty: live Shopify (freshest) when available; else the synced
        // listings.shopify_listings quantity (a periodic snapshot, not
        // live, but real data -- used only when live lookup has nothing,
        // e.g. the variant doesn't resolve via the Admin API at all).
        qty: liveStock !== undefined && liveStock !== null ? liveStock : (r.listing_qty !== null && r.listing_qty !== undefined ? Number(r.listing_qty) : null),
        bud: r.budget !== null && r.budget !== undefined ? Number(r.budget) : null,
        t: r.title || (liveInfo ? liveInfo.title : null),
        img: r.image_link || (liveInfo ? liveInfo.image : null),
        lnk: r.link || (liveInfo ? liveInfo.link : null),
        // Stock Status: prefer the merchant feed's own availability text,
        // else derive from live Shopify quantity, else the synced listings
        // quantity snapshot -- only "unknown" when all three have nothing.
        av: r.availability
          || (liveStock != null ? (liveStock > 0 ? 'in stock' : 'out of stock') : null)
          || (r.listing_qty != null ? (Number(r.listing_qty) > 0 ? 'in stock' : 'out of stock') : null)
          || 'unknown',
        gmc: dc.status,
        gmcMissing: dc.missing,
      };
    });

    const campaigns = {};
    for (const r of rows) campaigns[String(r.campaign_id)] = r.campaign_name;

    const payload = {
      success: true,
      generatedAt: new Date().toISOString(),
      rangeEnd,
      campaigns,
      stockSourceError,
      dataNote: 'Data Check column is a derived proxy (same technique as Mahima\'s Feed Status): which of 10 catalog attribute columns are blank in google_ads.merchant_products. No real Google Merchant Center approval/diagnostics data exists in PostgreSQL for PMax products (raw_data.gmc_product_diagnostics_daily does not exist; confirmed live).',
      products,
    };
    CACHE.set(CACHE_KEY, { data: payload, at: Date.now() });
    res.status(200).json(payload);
  } catch (err) {
    console.error('[thasitha/req2] Query failed:', err && err.message);
    res.status(500).json({ success: false, error: 'Could not load product zero-performance data. Please try again shortly.' });
  } finally {
    client.release();
  }
}

return handleThasithaReq2;
})();

// ==================== Thasitha order-attribution investigation — read-only order lookup ====================
// Temporary diagnostic endpoint for investigating order #LSDE18503 (UTM-term-
// vs-Google-Ads-conversion mismatch). Read-only — no mutations. Reuses the
// existing SHOPIFY_ADMIN_TOKEN for ledsone-de.myshopify.com, no new credential.
const thasithaOrderLookupModule = (function() {
const STORE_DOMAIN = 'ledsone-de.myshopify.com';
const API_VERSION = '2024-10';

async function shopifyGraphQL(query, variables) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
  return json.data;
}

const ORDER_QUERY = `
query($q: String!) {
  orders(first: 1, query: $q) {
    edges {
      node {
        id
        name
        createdAt
        processedAt
        displayFinancialStatus
        displayFulfillmentStatus
        cancelledAt
        test
        tags
        note
        customAttributes { key value }
        customer { id email createdAt }
        totalPriceSet { shopMoney { amount currencyCode } }
        channelInformation { channelDefinition { channelName } }
        landingPageDisplayText
        landingPageUrl
        referrerDisplayText
        referrerUrl
        sourceIdentifier
        sourceName
        customerJourneySummary {
          customerOrderIndex
          daysToConversion
          momentsCount { count }
          ready
          firstVisit {
            occurredAt
            landingPage
            landingPageHtml
            referrerUrl
            source
            sourceType
            sourceDescription
            utmParameters { source medium campaign term content }
          }
          lastVisit {
            occurredAt
            landingPage
            landingPageHtml
            referrerUrl
            source
            sourceType
            sourceDescription
            utmParameters { source medium campaign term content }
          }
          moments(first: 20) {
            edges {
              node {
                ... on CustomerVisit {
                  occurredAt
                  landingPage
                  referrerUrl
                  source
                  sourceType
                  utmParameters { source medium campaign term content }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

async function handleOrderLookup(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!process.env.SHOPIFY_ADMIN_TOKEN) {
    res.status(500).json({ error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
    return;
  }
  const orderName = (req.query.order || '').toString().replace(/^#/, '');
  if (!orderName) {
    res.status(400).json({ error: 'Missing ?order= param' });
    return;
  }
  try {
    const data = await shopifyGraphQL(ORDER_QUERY, { q: `name:${orderName}` });
    const edge = data.orders.edges[0];
    if (!edge) {
      res.status(404).json({ error: 'Order not found on ledsone-de.myshopify.com', orderName });
      return;
    }
    res.status(200).json({ store: STORE_DOMAIN, order: edge.node });
  } catch (err) {
    console.error('[thasitha/order-lookup] failed:', err && err.message);
    res.status(500).json({ error: err.message || 'Lookup failed' });
  }
}

return handleOrderLookup;
})();

// ===== SUK-R6: Missing Meta Title & Meta Description Detection (2026-08-04) =====
// Mirrors Kamsi's Requirement 5 (same detection logic — metaStatusR5/
// actionNeededR5/normalizeR5 elsewhere in this file — duplicated here, not
// shared, matching the isolation pattern already used for Jefri Req2 vs
// Req1), scoped to ledsone.de instead of ledsone.co.uk. Server-side only:
// reads SHOPIFY_ADMIN_TOKEN from env, never exposed to the client.
// Read-only Admin GraphQL calls only — no mutations, no writes.
const sukirthaR6HandlerModule = (function() {
  const STORE_DOMAIN = 'ledsone-de.myshopify.com';
  const API_VERSION = '2024-10';
  const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function shopifyGraphQL(query, variables) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch('https://' + STORE_DOMAIN + '/admin/api/' + API_VERSION + '/graphql.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': TOKEN,
        },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) throw new Error('Shopify API error ' + res.status);
      const json = await res.json();
      const throttled = json.errors && json.errors.some((e) => e.extensions && e.extensions.code === 'THROTTLED');
      if (throttled) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      if (json.errors) throw new Error(JSON.stringify(json.errors));
      return json.data;
    }
    throw new Error('Shopify API error: exceeded retries due to throttling');
  }

  const PRODUCTS_QUERY = [
    'query($after: String) {',
    '  products(first: 100, after: $after) {',
    '    edges {',
    '      node {',
    '        id',
    '        title',
    '        handle',
    '        description',
    '        productType',
    '        updatedAt',
    '        seo { title description }',
    '      }',
    '    }',
    '    pageInfo { hasNextPage endCursor }',
    '  }',
    '}',
  ].join('\n');

  async function fetchAllProducts() {
    const products = [];
    let after = null;
    let hasNext = true;
    let pages = 0;
    while (hasNext) {
      const data = await shopifyGraphQL(PRODUCTS_QUERY, { after });
      for (const edge of data.products.edges) products.push(edge.node);
      hasNext = data.products.pageInfo.hasNextPage;
      after = data.products.pageInfo.endCursor;
      pages++;
    }
    return { products, pages };
  }

  function normalize(s) {
    return (s || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/~\d+\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function metaStatus(seoValue, sourceValue) {
    const seoTrim = (seoValue || '').trim();
    if (!seoTrim) return 'Missing';
    if (normalize(seoValue) === normalize(sourceValue)) return 'Auto-generated';
    return 'Custom';
  }

  function actionNeeded(mts, mds) {
    const titleBad = mts !== 'Custom';
    const descBad = mds !== 'Custom';
    if (titleBad && descBad) return 'Add Custom Meta Title and Meta Description';
    if (titleBad) return 'Add Custom Meta Title';
    if (descBad) return 'Add Custom Meta Description';
    return 'OK';
  }

  const CACHE = new Map();
  const CACHE_TTL_MS = 60 * 1000;
  const CACHE_KEY = 'sukirtha-r6-meta';

  return async function sukirthaR6Handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      if (!TOKEN) {
        res.status(500).json({ error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
        return;
      }
      if (req.query.refresh !== '1') {
        const cached = CACHE.get(CACHE_KEY);
        if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
          res.status(200).json(cached.data);
          return;
        }
        // Static snapshot — survives cold starts/deploys, same pattern used
        // by Kamsi's Req5 (jefri-search-terms-snapshot.json, etc.). Requires
        // this file to exist in api/data/; regenerated via ?refresh=1 or the
        // hourly snapshot-refresh workflow, same as everywhere else in this
        // project.
        const fs = require('fs');
        const path = require('path');
        const staticPath = path.join(__dirname, 'data', 'sukirtha-r6-meta-snapshot.json');
        if (fs.existsSync(staticPath)) {
          const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
          const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
          CACHE.set(CACHE_KEY, { data: payload, at: Date.now() });
          res.status(200).json(payload);
          return;
        }
      }

      const { products, pages } = await fetchAllProducts();

      const rows = products.map((p) => {
        const seoTitle = p.seo && p.seo.title ? p.seo.title : '';
        const seoDesc = p.seo && p.seo.description ? p.seo.description : '';
        const mts = metaStatus(seoTitle, p.title);
        const mds = metaStatus(seoDesc, p.description);
        return {
          url: '/products/' + p.handle,
          productType: p.productType || 'Uncategorized',
          title: p.title,
          description: p.description || '',
          metaTitle: seoTitle,
          metaDescription: seoDesc,
          metaTitleStatus: mts,
          metaDescriptionStatus: mds,
          metaTitleLength: seoTitle.length,
          metaDescriptionLength: seoDesc.length,
          actionNeeded: actionNeeded(mts, mds),
          lastUpdated: p.updatedAt,
        };
      });

      const summary = {
        totalProductsChecked: rows.length,
        missingMetaTitle: rows.filter((r) => r.metaTitleStatus === 'Missing').length,
        autoGeneratedMetaTitle: rows.filter((r) => r.metaTitleStatus === 'Auto-generated').length,
        missingMetaDescription: rows.filter((r) => r.metaDescriptionStatus === 'Missing').length,
        autoGeneratedMetaDescription: rows.filter((r) => r.metaDescriptionStatus === 'Auto-generated').length,
        okProducts: rows.filter((r) => r.actionNeeded === 'OK').length,
      };

      const payload = {
        success: true,
        staff: { name: 'Sukirtha', department: 'SEO', store: 'ledsone.de' },
        source: {
          scope: 'All Shopify products on ledsone.de, via Admin GraphQL API (read-only). Same detection logic as Kamsi Requirement 5 (ledsone.co.uk).',
        },
        summary,
        rows,
        meta: { generatedAt: new Date().toISOString(), productsFetched: products.length, pagesFetched: pages },
      };
      CACHE.set(CACHE_KEY, { data: payload, at: Date.now() });
      res.status(200).json(payload);
    } catch (err) {
      console.error('[sukirtha-r6-meta] failed:', err && err.message);
      res.status(500).json({ error: 'Could not load meta title/description data. Please try again shortly.' });
    }
  };
})();

// ==================== Jefri T-04 (Step 1) — Google Ads Item ID -> Parent Product ID mapping ====================
// Added 2026-08-11. DISCOVERY-VALIDATED, step 1 of T-04 only: for every
// distinct Google Ads product_item_id Jefri has ever had (all-time, not
// windowed), resolve it to a Shopify listing and — for variant-level items —
// its Parent Product ID via listings.shopify_listings_parent_child_mapping.
// Same identifier-resolution mechanics as Req1 (raw ID, or Merchant Center
// "shopify_de_<parent>_<variant>" format). Confirmed live via direct SQL
// (see evidence/jefri/T-04-data-discovery.md): 8,073 distinct items,
// 4,543 resolve to a variant (100% of those map to exactly one parent, 0
// many-to-one conflicts for Jefri's items), 1,147 resolve to a parent
// directly, 2,383 (29.5%) have no Shopify match at all (non-Shopify-format
// long IDs, concentrated in the "Shoparize ALL | All Products" campaign).
const jefriReq4MappingHandlerModule = (function() {
  const { Pool } = require('pg');

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
        ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 8000,
        statement_timeout: 30000,
        max: 3,
      });
    }
    return pool;
  }

  const JEFRI_CAMPAIGN_IDS_R4 = ['23141810147', '23411228109', '22539594891', '23473840779', '23340277562'];

  const MAPPING_QUERY = `
WITH jefri_items AS (
  SELECT DISTINCT product_item_id
  FROM google_ads.product_performance
  WHERE campaign_id = ANY($1::bigint[]) AND product_item_id IS NOT NULL AND product_item_id <> ''
),
resolved AS (
  SELECT product_item_id,
    CASE WHEN product_item_id LIKE 'shopify\\_%'
         THEN split_part(product_item_id, '_', array_length(string_to_array(product_item_id, '_'), 1))
         ELSE product_item_id END AS shopify_id
  FROM jefri_items
),
matched AS (
  SELECT r.product_item_id, sl.id AS listing_pk, sl.is_parent, sl.is_child, sl.item_id AS matched_shopify_id, sl.sku
  FROM resolved r
  LEFT JOIN listings.shopify_listings sl ON sl.item_id = r.shopify_id AND sl.channel = 'LEDSone DE'
),
child_to_parent AS (
  SELECT m.child_id AS listing_pk, p.item_id AS parent_product_id
  FROM listings.shopify_listings_parent_child_mapping m
  JOIN listings.shopify_listings p ON p.id = m.parent_id
),
-- Total Sales (Store): gross line-item revenue (item_price x item_quantity),
-- status='Completed' (excludes Refunded/Cancelled/Inprogress/New), Shopify
-- DE only (sub_source_id=108). Date-filtered via $2 (start) / $3 (end,
-- inclusive) — both NULL by default = all-time, added 2026-08-11 per
-- explicit "real date filter" instruction. Parent rollup = SUM of every
-- order line sharing that Parent Product ID (order_item_info.product_id is
-- shared across all its variants, so this already IS the full rollup —
-- proven, not re-summed from child rows). Documented as GROSS, not
-- net-of-tax — see evidence/jefri/T-04-data-discovery.md for the
-- unresolved gross-vs-net decision.
parent_sales AS (
  SELECT oii.product_id, SUM(oii.item_price::numeric * oii.item_quantity::numeric) AS total_sales
  FROM order_management.orders o
  JOIN order_management.order_item_info oii ON oii.order_id = o.id
  WHERE o.sub_source_id = 108 AND o.status = 'Completed'
    AND ($2::date IS NULL OR o.order_date >= $2::date)
    AND ($3::date IS NULL OR o.order_date < ($3::date + INTERVAL '1 day'))
  GROUP BY oii.product_id
),
variant_sales AS (
  SELECT oii.variant_id, SUM(oii.item_price::numeric * oii.item_quantity::numeric) AS total_sales
  FROM order_management.orders o
  JOIN order_management.order_item_info oii ON oii.order_id = o.id
  WHERE o.sub_source_id = 108 AND o.status = 'Completed'
    AND ($2::date IS NULL OR o.order_date >= $2::date)
    AND ($3::date IS NULL OR o.order_date < ($3::date + INTERVAL '1 day'))
  GROUP BY oii.variant_id
),
-- Ads columns: Parent rows show a TRUE ROLLUP (SUM of the parent's own
-- ad entry, if it has one, PLUS every one of its variants' ad entries) —
-- per the T-04 spec's explicit "Parent rollup = SUM of variant values,
-- never average." Variant/Unmatched rows show their own single item's
-- ad performance (an Unmatched row still has real Ads data even though it
-- has no Shopify match — shown, not hidden).
resolved_full AS (
  SELECT m.product_item_id,
    CASE WHEN m.is_parent = 1 THEN m.matched_shopify_id WHEN m.is_child = 1 THEN ctp.parent_product_id ELSE NULL END AS parent_product_id
  FROM matched m LEFT JOIN child_to_parent ctp ON ctp.listing_pk = m.listing_pk
),
ads_by_item AS (
  SELECT product_item_id,
    SUM(clicks)::bigint AS clicks, SUM(impressions)::bigint AS impressions,
    SUM(cost)::numeric AS cost, SUM(conversion_value)::numeric AS conv_value
  FROM google_ads.product_performance
  WHERE campaign_id = ANY($1::bigint[])
    AND ($2::date IS NULL OR date >= $2::date)
    AND ($3::date IS NULL OR date <= $3::date)
  GROUP BY product_item_id
),
rollup_by_parent AS (
  SELECT rf.parent_product_id,
    SUM(a.clicks)::bigint AS clicks, SUM(a.impressions)::bigint AS impressions,
    SUM(a.cost)::numeric AS cost, SUM(a.conv_value)::numeric AS conv_value
  FROM resolved_full rf
  JOIN ads_by_item a ON a.product_item_id = rf.product_item_id
  WHERE rf.parent_product_id IS NOT NULL
  GROUP BY rf.parent_product_id
)
SELECT
  m.product_item_id AS item_id,
  CASE
    WHEN m.is_parent = 1 THEN m.matched_shopify_id
    WHEN m.is_child = 1 THEN ctp.parent_product_id
    ELSE NULL
  END AS parent_product_id,
  CASE WHEN m.is_parent = 1 THEN 'Parent' WHEN m.is_child = 1 THEN 'Variant' ELSE 'Unmatched' END AS level,
  m.sku,
  CASE
    WHEN m.is_parent = 1 THEN ps.total_sales
    WHEN m.is_child = 1 THEN vs.total_sales
    ELSE NULL
  END AS total_sales,
  CASE WHEN m.is_parent = 1 THEN rp.clicks ELSE ai.clicks END AS ads_clicks,
  CASE WHEN m.is_parent = 1 THEN rp.impressions ELSE ai.impressions END AS ads_impressions,
  CASE WHEN m.is_parent = 1 THEN rp.cost ELSE ai.cost END AS ads_cost,
  CASE WHEN m.is_parent = 1 THEN rp.conv_value ELSE ai.conv_value END AS ads_sales
FROM matched m
LEFT JOIN child_to_parent ctp ON ctp.listing_pk = m.listing_pk
LEFT JOIN parent_sales ps ON m.is_parent = 1 AND ps.product_id = m.matched_shopify_id
LEFT JOIN variant_sales vs ON m.is_child = 1 AND vs.variant_id = m.matched_shopify_id
LEFT JOIN ads_by_item ai ON ai.product_item_id = m.product_item_id
LEFT JOIN rollup_by_parent rp ON m.is_parent = 1 AND rp.parent_product_id = m.matched_shopify_id
ORDER BY
  COALESCE(CASE WHEN m.is_parent = 1 THEN m.matched_shopify_id WHEN m.is_child = 1 THEN ctp.parent_product_id ELSE NULL END, '~unmatched') ASC,
  CASE WHEN m.is_parent = 1 THEN 0 WHEN m.is_child = 1 THEN 1 ELSE 2 END ASC,
  m.product_item_id ASC;
`;

  const CACHE = new Map();
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const CACHE_KEY = 'jefri-req4-mapping';

  function isValidDateR4(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  async function handleJefriReq4Mapping(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const forceRefresh = req.query && req.query.refresh === '1';
    const startDate = isValidDateR4(req.query && req.query.startDate) ? req.query.startDate : null;
    const endDate = isValidDateR4(req.query && req.query.endDate) ? req.query.endDate : null;
    const isDefaultView = !startDate && !endDate;
    const cacheKey = CACHE_KEY + '|' + (startDate || '') + '|' + (endDate || '');
    if (!forceRefresh) {
      const cached = CACHE.get(cacheKey);
      if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
        res.status(200).json(cached.data);
        return;
      }
      // Static snapshot — same pattern as jefri-product-status/jefri-req3/
      // jefri-search-terms (see api/scripts/generate-snapshots.js "postgres"
      // mode, hourly cron). This query is a full-table 8,073-row scan with
      // two nested Postgres aggregations, too slow to run on every cold
      // start; the snapshot survives cold starts, unlike CACHE above. Only
      // covers the default all-time view — a custom date range always
      // queries live (added 2026-08-11, real date filter).
      if (isDefaultView) {
        const fs = require('fs');
        const path = require('path');
        const staticPath = path.join(__dirname, 'data', 'jefri-req4-mapping-snapshot.json');
        if (fs.existsSync(staticPath)) {
          const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
          const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
          CACHE.set(cacheKey, { data: payload, at: Date.now() });
          res.status(200).json(payload);
          return;
        }
      }
    }
    const client = await getPool().connect().catch((err) => {
      console.error('[jefri/req4-mapping] DB connect failed:', err && err.message);
      res.status(500).json({ error: 'Server not configured or database unreachable.' });
      return null;
    });
    if (!client) return;
    try {
      const result = await client.query(MAPPING_QUERY, [JEFRI_CAMPAIGN_IDS_R4, startDate, endDate]);
      const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
      const rows = result.rows.map((r) => {
        const level = r.level;
        const totalSales = r.total_sales !== null && r.total_sales !== undefined ? Number(r.total_sales) : (level === 'Unmatched' ? null : 0);
        const adsClicks = Number(r.ads_clicks) || 0;
        const adsImpressions = Number(r.ads_impressions) || 0;
        const adsCost = Number(r.ads_cost) || 0;
        const adsSales = Number(r.ads_sales) || 0;
        const roas = adsCost > 0 ? round2((adsSales / adsCost) * 100) : (adsSales > 0 ? null : 0);
        const adsSalesPct = totalSales != null
          ? (totalSales > 0 ? round2((adsSales / totalSales) * 100) : (adsSales > 0 ? null : 0))
          : null;
        return {
          itemId: r.item_id,
          parentProductId: r.parent_product_id,
          level,
          sku: r.sku || null,
          totalSales,
          adsSales: round2(adsSales),
          adsClicks,
          adsImpressions,
          adsCost: round2(adsCost),
          roas,
          adsSalesPct,
        };
      });
      const payload = {
        generatedAt: new Date().toISOString(),
        rows,
        meta: {
          totalItems: rows.length,
          levelParent: rows.filter((r) => r.level === 'Parent').length,
          levelVariant: rows.filter((r) => r.level === 'Variant').length,
          unmatched: rows.filter((r) => r.level === 'Unmatched').length,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      };
      CACHE.set(cacheKey, { data: payload, at: Date.now() });
      res.status(200).json(payload);
    } catch (err) {
      console.error('[jefri/req4-mapping] error:', err && err.message);
      res.status(500).json({ error: err.message || 'Unknown error' });
    } finally {
      client.release();
    }
  }

  return handleJefriReq4Mapping;
})();

// ==================== Jefri Requirement 5 — Cross-Campaign Attribution / ROI Analyzer ====================
// Added 2026-08-12. Business question: a product spent money in a selected
// Source Campaign but generated €0 conversion value there — did it actually
// convert through another Google Ads campaign, through Direct/Organic/Other
// Shopify sales, or nothing at all? See evidence/jefri/2026-08-12_req5-cross-campaign-attribution-evidence.md
// for full discovery, design decisions, and real-data validation.
//
// Design decision (documented, not invented): Source Campaign is restricted
// to Jefri's 5 named campaigns (consistent with every other tab on this
// page — the dropdown only lets him investigate his own campaigns). Cross-
// campaign search is ACCOUNT-WIDE (account_id=9031058245, all campaigns,
// not just Jefri's other 4) — confirmed necessary via real data: items
// frequently convert in campaigns outside Jefri's 5 (e.g. item
// 42864380805350 converts in campaign 23340277562, one of Jefri's, while
// also having activity in a dozen+ campaigns belonging to other Google Ads
// PMax/Shopping structures in the same account).
const jefriReq5HandlerModule = (function() {
  const { Pool } = require('pg');

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
        ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 8000,
        statement_timeout: 30000,
        max: 3,
      });
    }
    return pool;
  }

  const JEFRI_ACCOUNT_ID = 9031058245;
  const JEFRI_CAMPAIGNS_R5 = [
    { id: '23141810147', name: 'Pmax | Jeff | Klarna | NEWALL | All Products | MCV | DE -16/10' },
    { id: '23411228109', name: 'Pmax | Jeff | Shoparize | ALL | All Products | MCV | DE-01/01/26' },
    { id: '22539594891', name: 'Shopping | Jeff | Shoptimised | AOVU15 | TROAS | DE -12/05' },
    { id: '23473840779', name: 'Pmax | Jeff | Shoparize | FTJ | FinetunedProducts | TROAS | DE-20.01' },
    { id: '23340277562', name: 'Pmax | Jeff | Shoparize | IT | Italy | TROAS | IT-08/12' },
  ];
  const JEFRI_CAMPAIGN_ID_SET = new Set(JEFRI_CAMPAIGNS_R5.map((c) => c.id));

  function isValidDateR5(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  // Entry filter (mandatory, Phase 4): Source Campaign Cost > 0 AND Source
  // Campaign Conv. Value = 0, for the selected campaign + date range only.
  const QUALIFYING_QUERY = `
    SELECT product_item_id,
      SUM(cost)::numeric AS source_cost,
      SUM(clicks)::bigint AS source_clicks,
      SUM(conversion_value)::numeric AS source_conv
    FROM google_ads.product_performance
    WHERE campaign_id = $1 AND date >= $2::date AND date <= $3::date
      AND product_item_id IS NOT NULL AND product_item_id <> ''
    GROUP BY product_item_id
    HAVING SUM(cost) > 0 AND SUM(conversion_value) = 0
  `;

  // Same identifier-resolution CTE proven in Req1/T-04/Req4 (raw ID or
  // Merchant Center shopify_de_<parent>_<variant> format), resolving to
  // Parent Product ID via listings.shopify_listings + parent_child_mapping.
  function resolutionCte(itemIdsParamIndex) {
    return `
resolved AS (
  SELECT product_item_id,
    CASE WHEN product_item_id LIKE 'shopify\\_%'
         THEN split_part(product_item_id, '_', array_length(string_to_array(product_item_id, '_'), 1))
         ELSE product_item_id END AS shopify_id
  FROM (SELECT unnest($${itemIdsParamIndex}::text[]) AS product_item_id) t
),
matched AS (
  SELECT r.product_item_id, sl.id AS listing_pk, sl.is_parent, sl.is_child, sl.item_id AS matched_shopify_id, sl.sku
  FROM resolved r
  LEFT JOIN listings.shopify_listings sl ON sl.item_id = r.shopify_id AND sl.channel = 'LEDSone DE'
),
child_to_parent AS (
  SELECT m.child_id AS listing_pk, p.item_id AS parent_product_id
  FROM listings.shopify_listings_parent_child_mapping m
  JOIN listings.shopify_listings p ON p.id = m.parent_id
),
resolved_full AS (
  SELECT m.product_item_id,
    CASE WHEN m.is_parent = 1 THEN m.matched_shopify_id WHEN m.is_child = 1 THEN ctp.parent_product_id ELSE NULL END AS parent_product_id,
    CASE WHEN m.is_parent = 1 THEN 'Parent' WHEN m.is_child = 1 THEN 'Variant' ELSE 'Unmatched' END AS level,
    m.sku, m.matched_shopify_id, m.is_parent, m.is_child
  FROM matched m
  LEFT JOIN child_to_parent ctp ON ctp.listing_pk = m.listing_pk
)`;
  }

  // Phase 6 — cross-campaign attribution: same item_id, ALL other campaigns
  // in the account (excluding the source campaign), same date range.
  const OTHER_CAMPAIGNS_QUERY = `
    SELECT pp.product_item_id, pp.campaign_id, c.campaign_name,
      SUM(pp.conversion_value)::numeric AS conv_value
    FROM google_ads.product_performance pp
    JOIN google_ads.campaigns c ON c.campaign_id = pp.campaign_id
    WHERE pp.product_item_id = ANY($1::text[]) AND c.account_id = ${JEFRI_ACCOUNT_ID}
      AND pp.campaign_id <> $2 AND pp.date >= $3::date AND pp.date <= $4::date
    GROUP BY pp.product_item_id, pp.campaign_id, c.campaign_name
    HAVING SUM(pp.conversion_value) > 0
  `;

  // Phase 8 — total Ads conv. value across ALL campaigns (source + others).
  const TOTAL_ADS_CONV_QUERY = `
    SELECT pp.product_item_id, SUM(pp.conversion_value)::numeric AS total_ads_conv
    FROM google_ads.product_performance pp
    JOIN google_ads.campaigns c ON c.campaign_id = pp.campaign_id
    WHERE pp.product_item_id = ANY($1::text[]) AND c.account_id = ${JEFRI_ACCOUNT_ID}
      AND pp.date >= $2::date AND pp.date <= $3::date
    GROUP BY pp.product_item_id
  `;

  // Phase 7 — Total Shopify Sales, all channels, same date range. Parent
  // rollup = every order line sharing that Parent Product ID (already
  // includes all variants — same mechanism proven in T-04/Req4).
  const SHOPIFY_SALES_QUERY = `
    SELECT oii.product_id AS parent_id, oii.variant_id,
      SUM(oii.item_price::numeric * oii.item_quantity::numeric) AS sales
    FROM order_management.orders o
    JOIN order_management.order_item_info oii ON oii.order_id = o.id
    WHERE o.sub_source_id = 108 AND o.status = 'Completed'
      AND o.order_date >= $1::date AND o.order_date < $2::date + INTERVAL '1 day'
      AND (oii.product_id = ANY($3::text[]) OR oii.variant_id = ANY($4::text[]))
    GROUP BY oii.product_id, oii.variant_id
  `;

  const CACHE = new Map();
  const CACHE_TTL_MS = 5 * 60 * 1000;

  function classifyVerdict(otherConv, nonAdsSales) {
    if (otherConv > 0 && nonAdsSales > 0) return 'Mixed attribution';
    if (otherConv > 0) return 'Converts elsewhere';
    if (nonAdsSales > 0) return 'Direct/Organic only';
    return 'True zero-converter';
  }

  async function handleJefriReq5(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const sourceCampaign = req.query && req.query.sourceCampaign;
    const startDate = isValidDateR5(req.query && req.query.startDate) ? req.query.startDate : null;
    const endDate = isValidDateR5(req.query && req.query.endDate) ? req.query.endDate : null;
    const forceRefresh = req.query && req.query.refresh === '1';

    if (!sourceCampaign || !JEFRI_CAMPAIGN_ID_SET.has(String(sourceCampaign))) {
      res.status(400).json({ error: 'Provide ?sourceCampaign=<one of Jefri\'s 5 campaign IDs>' });
      return;
    }
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Provide ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD' });
      return;
    }

    const cacheKey = `${sourceCampaign}|${startDate}|${endDate}`;
    if (!forceRefresh) {
      const cached = CACHE.get(cacheKey);
      if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
        res.status(200).json(cached.data);
        return;
      }
    }

    const client = await getPool().connect().catch((err) => {
      console.error('[jefri/req5] DB connect failed:', err && err.message);
      res.status(500).json({ error: 'Server not configured or database unreachable.' });
      return null;
    });
    if (!client) return;

    try {
      const qualifyingResult = await client.query(QUALIFYING_QUERY, [sourceCampaign, startDate, endDate]);
      const itemIds = qualifyingResult.rows.map((r) => r.product_item_id);

      const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

      if (!itemIds.length) {
        const payload = {
          generatedAt: new Date().toISOString(),
          sourceCampaign: { id: sourceCampaign, name: (JEFRI_CAMPAIGNS_R5.find((c) => c.id === sourceCampaign) || {}).name || sourceCampaign },
          dateRange: { startDate, endDate },
          rows: [],
          meta: { qualifyingProducts: 0, noQualifyingReason: 'No products matched the mandatory filter: Source Campaign Cost > 0 and Source Campaign Conv. Value = 0.' },
        };
        CACHE.set(cacheKey, { data: payload, at: Date.now() });
        res.status(200).json(payload);
        return;
      }

      const resolutionQuery = `WITH ${resolutionCte(1)} SELECT product_item_id, parent_product_id, level, sku, matched_shopify_id, is_parent, is_child FROM resolved_full`;
      const [resolvedResult, otherCampaignsResult, totalAdsResult] = await Promise.all([
        client.query(resolutionQuery, [itemIds]),
        client.query(OTHER_CAMPAIGNS_QUERY, [itemIds, sourceCampaign, startDate, endDate]),
        client.query(TOTAL_ADS_CONV_QUERY, [itemIds, startDate, endDate]),
      ]);

      const resolvedByItem = new Map(resolvedResult.rows.map((r) => [r.product_item_id, r]));

      const parentIds = [];
      const variantIds = [];
      for (const r of resolvedResult.rows) {
        if (r.is_parent === 1 && r.matched_shopify_id) parentIds.push(r.matched_shopify_id);
        if (r.is_child === 1 && r.matched_shopify_id) variantIds.push(r.matched_shopify_id);
      }
      const shopifyResult = parentIds.length || variantIds.length
        ? await client.query(SHOPIFY_SALES_QUERY, [startDate, endDate, parentIds.length ? parentIds : [''], variantIds.length ? variantIds : ['']])
        : { rows: [] };
      const salesByParent = new Map();
      const salesByVariant = new Map();
      for (const r of shopifyResult.rows) {
        if (r.parent_id) salesByParent.set(r.parent_id, (salesByParent.get(r.parent_id) || 0) + Number(r.sales));
        if (r.variant_id) salesByVariant.set(r.variant_id, (salesByVariant.get(r.variant_id) || 0) + Number(r.sales));
      }

      const otherCampaignsByItem = new Map();
      for (const r of otherCampaignsResult.rows) {
        if (!otherCampaignsByItem.has(r.product_item_id)) otherCampaignsByItem.set(r.product_item_id, []);
        otherCampaignsByItem.get(r.product_item_id).push({ campaignId: r.campaign_id, campaignName: r.campaign_name, convValue: round2(r.conv_value) });
      }
      const totalAdsByItem = new Map(totalAdsResult.rows.map((r) => [r.product_item_id, Number(r.total_ads_conv)]));

      const rows = qualifyingResult.rows.map((q) => {
        const itemId = q.product_item_id;
        const resolved = resolvedByItem.get(itemId) || {};
        const level = resolved.level || 'Unmatched';
        const parentProductId = resolved.parent_product_id || null;

        const sourceCost = round2(q.source_cost);
        const sourceClicks = Number(q.source_clicks) || 0;
        const sourceConv = round2(q.source_conv); // always 0 by the entry filter

        const otherCampaigns = otherCampaignsByItem.get(itemId) || [];
        const otherConvValue = round2(otherCampaigns.reduce((s, c) => s + c.convValue, 0));

        let totalShopifySales;
        if (level === 'Parent') totalShopifySales = salesByParent.get(resolved.matched_shopify_id) || 0;
        else if (level === 'Variant') totalShopifySales = salesByVariant.get(resolved.matched_shopify_id) || 0;
        else totalShopifySales = null; // Unmatched — genuinely cannot be computed, not invented as 0

        const totalAdsConvValue = round2(totalAdsByItem.get(itemId) || 0);
        // Phase 9 — exact formula, negative results NOT clamped to zero.
        const nonAdsAttributedSales = totalShopifySales != null ? round2(totalShopifySales - totalAdsConvValue) : null;

        const whatHappened = `Spent €${sourceCost.toFixed(2)} and received ${sourceClicks} click${sourceClicks === 1 ? '' : 's'} but generated €0 conversion value in the source campaign.`;

        const verdict = totalShopifySales != null
          ? classifyVerdict(otherConvValue, nonAdsAttributedSales)
          : 'Unmatched — Shopify sales cannot be computed';

        return {
          itemId, parentProductId, level, sku: resolved.sku || null,
          sourceCampaignSpend: sourceCost, sourceCampaignClicks: sourceClicks, sourceCampaignConvValue: sourceConv,
          whatHappenedInSource: whatHappened,
          convertsInOtherCampaigns: otherConvValue > 0,
          otherCampaigns, otherCampaignConvValue: otherConvValue,
          totalShopifySales, totalAdsConvValue, nonAdsAttributedSales,
          nonAdsIsNegative: nonAdsAttributedSales != null && nonAdsAttributedSales < 0,
          verdict,
        };
      });

      const payload = {
        generatedAt: new Date().toISOString(),
        sourceCampaign: { id: sourceCampaign, name: (JEFRI_CAMPAIGNS_R5.find((c) => c.id === sourceCampaign) || {}).name || sourceCampaign },
        dateRange: { startDate, endDate },
        campaignList: JEFRI_CAMPAIGNS_R5,
        rows,
        meta: {
          qualifyingProducts: rows.length,
          sourceCampaignSpend: round2(rows.reduce((s, r) => s + r.sourceCampaignSpend, 0)),
          sourceCampaignClicks: rows.reduce((s, r) => s + r.sourceCampaignClicks, 0),
          totalShopifySales: round2(rows.reduce((s, r) => s + (r.totalShopifySales || 0), 0)),
          totalAdsConvValue: round2(rows.reduce((s, r) => s + r.totalAdsConvValue, 0)),
          nonAdsAttributedSales: round2(rows.reduce((s, r) => s + (r.nonAdsAttributedSales || 0), 0)),
          convertsElsewhere: rows.filter((r) => r.verdict === 'Converts elsewhere').length,
          mixedAttribution: rows.filter((r) => r.verdict === 'Mixed attribution').length,
          directOrganicOnly: rows.filter((r) => r.verdict === 'Direct/Organic only').length,
          trueZeroConverters: rows.filter((r) => r.verdict === 'True zero-converter').length,
        },
      };
      CACHE.set(cacheKey, { data: payload, at: Date.now() });
      res.status(200).json(payload);
    } catch (err) {
      console.error('[jefri/req5] error:', err && err.message);
      res.status(500).json({ error: err.message || 'Unknown error' });
    } finally {
      client.release();
    }
  }

  return handleJefriReq5;
})();

// ===== Jefri Requirement 7: T-07 B&Q -> Amazon -> Shopify SKU & Price
// Reconciliation (added 2026-08-19, per prompts/jefri/jefri-req-07-t07-prompt.md).
//
// Source discovery (read-only, DATABASE_URL):
//   order_management.sub_source id=242 ("bq_ledsone") — the only B&Q sub-source
//   with real order rows (9,568 as of 2026-08-19); id=244 ("bq_ledsone_b&q")
//   exists but has 0 orders, confirmed via COUNT before use.
//   order_management.orders / order_item_info — item_sku/real_sku, item_price
//   (confirmed PER-UNIT already, not a line total — spot-checked real rows:
//   item_price=13.74 x item_quantity=2 => order total 27.48, i.e. item_price
//   already equals price-per-unit), item_quantity, order_date.
//   listings.amazon_listings — site='UK', sub_source=8 ("amazon Ledsone") is
//   LEDSONE UK's Amazon channel (confirmed via order_management.sub_source
//   name lookup). sku/mapped_sku/price/status.
//   listings.shopify_listings — channel='LEDSone' (no country suffix) is
//   LEDSONE UK's Shopify channel (DE/US/FR are separate channel values).
//   sku/mapped_sku/price/status.
//
// B&Q Price Per Unit: DB item_price is already per-unit, so "B&Q Order Price"
// (the line total, per the requirement's own definition) is reconstructed as
// item_price * item_quantity, then divided back by item_quantity to get the
// per-unit figure — mathematically resolves to item_price, kept as an
// explicit division (not a shortcut) exactly per the requirement's mandated
// formula, with divide-by-zero protection.
//
// SKU validation ambiguity (documented, not invented): Amazon/Shopify listings
// occasionally have duplicate rows for the same exact sku (verified — same
// price, same asin, likely duplicate import rows, not two genuinely different
// listings). Exact-match rows are treated as "Correct"; when no row's `sku`
// column matches exactly but a row's `mapped_sku` column matches the B&Q sku
// (an existing schema field for recording a listing whose real sku differs
// from what it should be), it is treated as "Incorrect" and that listing's
// own sku is surfaced as "Amazon/Shopify SKU Found". No exact or mapped match
// = "Not Found". This uses only existing, already-populated schema fields —
// no invented matching heuristic.
//
// "Listing 1 / Listing 2": up to two listing rows per marketplace per sku
// (prioritizing active-like statuses), matching what the schema actually
// contains — most skus have exactly one live listing per marketplace; some
// have two (duplicate import rows or a genuine second listing). Never more
// than two are shown, and a second is never fabricated when only one exists.
const jefriReq7HandlerModule = (function() {
  const { Pool } = require('pg');

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
        ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 8000,
        statement_timeout: 30000,
        max: 3,
      });
    }
    return pool;
  }

  const BQ_SUB_SOURCE_ID = 242;
  const AMAZON_UK_SUB_SOURCE = 8;
  const SHOPIFY_UK_CHANNEL = 'LEDSone';
  const ACTIVE_STATUSES = new Set(['active', 'Active', 'BUYABLE', 'DISCOVERABLE']);

  function isValidDateR7(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  const BQ_LINES_QUERY = `
    SELECT o.order_id, o.order_date,
      COALESCE(NULLIF(oi.real_sku, ''), oi.item_sku) AS sku,
      oi.item_price::numeric AS unit_price,
      oi.item_quantity::numeric AS quantity
    FROM order_management.orders o
    JOIN order_management.order_item_info oi ON oi.order_id = o.id
    WHERE o.sub_source_id = ${BQ_SUB_SOURCE_ID}
      AND o.order_date >= $1::date AND o.order_date < $1::date + INTERVAL '1 day'
    ORDER BY o.order_date ASC, o.order_id ASC
  `;

  const LATEST_BQ_DATE_QUERY = `
    SELECT MAX(order_date)::date AS latest_date
    FROM order_management.orders
    WHERE sub_source_id = ${BQ_SUB_SOURCE_ID}
  `;

  const AMAZON_LISTINGS_QUERY = `
    SELECT sku, mapped_sku, price, status, id
    FROM listings.amazon_listings
    WHERE site = 'UK' AND sub_source = ${AMAZON_UK_SUB_SOURCE}
      AND (sku = ANY($1::text[]) OR mapped_sku = ANY($1::text[]))
  `;

  const SHOPIFY_LISTINGS_QUERY = `
    SELECT sku, mapped_sku, price, status, id
    FROM listings.shopify_listings
    WHERE channel = '${SHOPIFY_UK_CHANNEL}'
      AND (sku = ANY($1::text[]) OR mapped_sku = ANY($1::text[]))
  `;

  const CACHE = new Map();
  const CACHE_TTL_MS = 5 * 60 * 1000;

  function round1(n) {
    return Math.round((Number(n) + Number.EPSILON) * 10) / 10;
  }
  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  // Up to 2 listing rows for a given sku, active-like statuses first.
  function pickListings(rowsForSku) {
    const sorted = rowsForSku.slice().sort((a, b) => {
      const aActive = ACTIVE_STATUSES.has(a.status) ? 0 : 1;
      const bActive = ACTIVE_STATUSES.has(b.status) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return Number(a.id) - Number(b.id);
    });
    return sorted.slice(0, 2);
  }

  // Deterministic tie-break (active-like status first, then lowest id) —
  // real data has skus with MULTIPLE mapped_sku candidates (e.g. reseller
  // duplicates), so picking an arbitrary query-order row would make the
  // reported "SKU Found" flip nondeterministically between requests.
  function sortByActiveThenId(rows) {
    return rows.slice().sort((a, b) => {
      const aActive = ACTIVE_STATUSES.has(a.status) ? 0 : 1;
      const bActive = ACTIVE_STATUSES.has(b.status) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return Number(a.id) - Number(b.id);
    });
  }

  // Corrected 2026-08-19 per Kuberan: `mapped_sku` is NOT a red flag — it is
  // the corrected/canonical SKU staff enter for that listing in the actual
  // Listing Tool (confirmed against a real example: raw sku "LDMST64B228 D"
  // with mapped_sku "LDMST64B228" — the Listing Tool's own "corrected SKU"
  // box shows "LDMST64B228", matching mapped_sku exactly). So a listing
  // whose `mapped_sku` equals the B&Q SKU has ALREADY been corrected to the
  // right identity and counts as Correct, with its price included in the
  // comparison — not "Incorrect". The raw `sku` is only shown (as "SKU
  // Found") for transparency when it differs from the B&Q SKU, so staff can
  // see what the uncorrected/displayed listing SKU still looks like.
  // "Incorrect"/"Fix SKU First" is kept in the flag vocabulary for cases
  // where a listing's raw sku is close-but-wrong AND no mapped_sku
  // correction has been recorded — this data source cannot produce that
  // case today (every match here is found via exact sku OR mapped_sku), so
  // in practice this flag is currently unreachable; not invented, just
  // dormant until a data source can signal a genuinely uncorrected mismatch.
  function validateSku(sku, listingRows) {
    const matched = listingRows.filter((r) => r.sku === sku || r.mapped_sku === sku);
    if (matched.length === 0) {
      return { validation: 'Not Found', foundSku: null, listings: [] };
    }
    const listings = pickListings(matched);
    // 2026-08-19 (2nd correction, per Kuberan): show the CORRECTED sku
    // (mapped_sku, the value staff actually entered in the Listing Tool's
    // own "correct the SKU" box) here — not the raw/uncorrected listing
    // sku. Only populated when a correction was actually involved (i.e.
    // no row's raw sku matched exactly); when the raw sku already matched
    // B&Q exactly, nothing needs to be "found", so this stays blank.
    const correctedRow = sortByActiveThenId(matched).find((r) => r.sku !== sku);
    const foundSku = correctedRow ? (correctedRow.mapped_sku || correctedRow.sku) : null;
    return { validation: 'Correct', foundSku, listings };
  }

  // 2026-08-19 (per Kuberan): the marketplace listing price is the BASE for
  // this %, not B&Q — e.g. Amazon=£9, B&Q=£15 must show as positive (Amazon
  // cheaper than B&Q); Amazon=£9, B&Q=£6 must show as negative (Amazon
  // pricier than B&Q). That flips both which price is the denominator AND
  // the sign versus the original ((listing-bq)/bq) formula.
  function priceCompare(listings, bqPricePerUnit) {
    if (bqPricePerUnit === null || !(bqPricePerUnit > 0)) return { pcts: [], prices: [] };
    const prices = listings.map((l) => Number(l.price));
    const pcts = prices.map((p) => (p > 0 ? round1(((bqPricePerUnit - p) / p) * 100) : null));
    return { pcts, prices };
  }

  function computeFlag(validation, pcts, fixLabel, notListedLabel) {
    if (validation === 'Incorrect') return fixLabel;
    if (validation === 'Not Found') return notListedLabel;
    if (pcts.length === 0) return 'No Price Data';
    const hasHigh = pcts.some((p) => p > 2);
    const hasLow = pcts.some((p) => p < -2);
    if (hasHigh && hasLow) return 'Mixed';
    if (hasHigh) return 'High';
    if (hasLow) return 'Low';
    return 'Match';
  }

  async function handleJefriReq7(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let date = isValidDateR7(req.query && req.query.date) ? req.query.date : null;
    const forceRefresh = req.query && req.query.refresh === '1';

    const client = await getPool().connect().catch((err) => {
      console.error('[jefri/req7] DB connect failed:', err && err.message);
      res.status(500).json({ error: 'Server not configured or database unreachable.' });
      return null;
    });
    if (!client) return;

    try {
      if (!date) {
        const latest = await client.query(LATEST_BQ_DATE_QUERY);
        const latestDate = latest.rows[0] && latest.rows[0].latest_date;
        if (!latestDate) {
          res.status(200).json({ date: null, generatedAt: new Date().toISOString(), count: 0, rows: [], note: 'No B&Q orders found in source data.' });
          return;
        }
        date = new Date(latestDate).toISOString().slice(0, 10);
      }

      const cacheKey = date;
      if (!forceRefresh) {
        const cached = CACHE.get(cacheKey);
        if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
          res.status(200).json(cached.data);
          return;
        }
      }

      const linesResult = await client.query(BQ_LINES_QUERY, [date]);
      const lines = linesResult.rows;

      if (lines.length === 0) {
        const payload = { date, generatedAt: new Date().toISOString(), count: 0, rows: [] };
        CACHE.set(cacheKey, { data: payload, at: Date.now() });
        res.status(200).json(payload);
        return;
      }

      const skus = Array.from(new Set(lines.map((l) => l.sku).filter(Boolean)));
      const [amazonResult, shopifyResult] = await Promise.all([
        client.query(AMAZON_LISTINGS_QUERY, [skus]),
        client.query(SHOPIFY_LISTINGS_QUERY, [skus]),
      ]);

      const amazonBySku = new Map();
      amazonResult.rows.forEach((r) => {
        if (!amazonBySku.has(r.sku)) amazonBySku.set(r.sku, []);
        amazonBySku.get(r.sku).push(r);
        if (r.mapped_sku && r.mapped_sku !== r.sku) {
          if (!amazonBySku.has(r.mapped_sku)) amazonBySku.set(r.mapped_sku, []);
          amazonBySku.get(r.mapped_sku).push(r);
        }
      });
      const shopifyBySku = new Map();
      shopifyResult.rows.forEach((r) => {
        if (!shopifyBySku.has(r.sku)) shopifyBySku.set(r.sku, []);
        shopifyBySku.get(r.sku).push(r);
        if (r.mapped_sku && r.mapped_sku !== r.sku) {
          if (!shopifyBySku.has(r.mapped_sku)) shopifyBySku.set(r.mapped_sku, []);
          shopifyBySku.get(r.mapped_sku).push(r);
        }
      });

      const rows = lines.map((line) => {
        const sku = line.sku;
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unit_price);
        const bqOrderPrice = (quantity > 0) ? round2(unitPrice * quantity) : null;
        const bqPricePerUnit = (quantity > 0) ? round2(bqOrderPrice / quantity) : null;

        const amzRows = amazonBySku.get(sku) || [];
        const shopRows = shopifyBySku.get(sku) || [];

        const amz = validateSku(sku, amzRows);
        const shop = validateSku(sku, shopRows);

        const amzCompare = amz.validation === 'Correct' ? priceCompare(amz.listings, bqPricePerUnit) : { pcts: [], prices: [] };
        const shopCompare = shop.validation === 'Correct' ? priceCompare(shop.listings, bqPricePerUnit) : { pcts: [], prices: [] };

        const amzFlag = computeFlag(amz.validation, amzCompare.pcts, 'Fix Amazon SKU First', 'Not Listed');
        const shopFlag = computeFlag(shop.validation, shopCompare.pcts, 'Fix Shopify SKU First', 'Not Listed');

        return {
          orderDate: line.order_date ? new Date(line.order_date).toISOString().slice(0, 10) : date,
          orderId: line.order_id,
          bqSku: sku,
          orderQuantity: quantity,
          bqOrderPrice,
          bqPricePerUnit,
          amazonSkuValidation: amz.validation,
          amazonSkuFound: amz.foundSku,
          amazonPriceListing1: amzCompare.prices[0] !== undefined ? round2(amzCompare.prices[0]) : null,
          amazonPriceListing2: amzCompare.prices[1] !== undefined ? round2(amzCompare.prices[1]) : null,
          amazonPctListing1: amzCompare.pcts[0] !== undefined ? amzCompare.pcts[0] : null,
          amazonPctListing2: amzCompare.pcts[1] !== undefined ? amzCompare.pcts[1] : null,
          amazonFlag: amzFlag,
          shopifySkuValidation: shop.validation,
          shopifyPriceListing1: shopCompare.prices[0] !== undefined ? round2(shopCompare.prices[0]) : null,
          shopifyPriceListing2: shopCompare.prices[1] !== undefined ? round2(shopCompare.prices[1]) : null,
          shopifyPctListing1: shopCompare.pcts[0] !== undefined ? shopCompare.pcts[0] : null,
          shopifyPctListing2: shopCompare.pcts[1] !== undefined ? shopCompare.pcts[1] : null,
          shopifyFlag: shopFlag,
        };
      });

      const payload = {
        date,
        generatedAt: new Date().toISOString(),
        count: rows.length,
        rows,
        summary: {
          amazonMatch: rows.filter((r) => r.amazonFlag === 'Match').length,
          amazonHigh: rows.filter((r) => r.amazonFlag === 'High').length,
          amazonLow: rows.filter((r) => r.amazonFlag === 'Low').length,
          amazonMixed: rows.filter((r) => r.amazonFlag === 'Mixed').length,
          amazonFixSkuFirst: rows.filter((r) => r.amazonFlag === 'Fix Amazon SKU First').length,
          amazonNotListed: rows.filter((r) => r.amazonFlag === 'Not Listed').length,
          shopifyMatch: rows.filter((r) => r.shopifyFlag === 'Match').length,
          shopifyHigh: rows.filter((r) => r.shopifyFlag === 'High').length,
          shopifyLow: rows.filter((r) => r.shopifyFlag === 'Low').length,
          shopifyMixed: rows.filter((r) => r.shopifyFlag === 'Mixed').length,
          shopifyFixSkuFirst: rows.filter((r) => r.shopifyFlag === 'Fix Shopify SKU First').length,
          shopifyNotListed: rows.filter((r) => r.shopifyFlag === 'Not Listed').length,
        },
      };
      CACHE.set(cacheKey, { data: payload, at: Date.now() });
      res.status(200).json(payload);
    } catch (err) {
      console.error('[jefri/req7] error:', err && err.message);
      res.status(500).json({ error: err.message || 'Unknown error' });
    } finally {
      client.release();
    }
  }

  return handleJefriReq7;
})();

// ===== Jefri Requirement 6: Image Update Live Sales Tracker (added 2026-08-14,
// reworked FOUR times same day, each per an explicit correction from
// Kuberan — this is the final architecture, replacing all earlier ones:
//   1. single search-box, manual Listing ID + Image Update Date -> one result
//   2. always-visible table of every Jefri Google-Ads-campaign listing
//   3. Image Update Date auto-fetched live from Shopify per listing
//   4. THIS ONE: fully manual, permanently stored, user-curated tracker —
//      "i need first column as label user need to add the label and
//      listing id and sku and image update date also user can add ...
//      need to store these all ... create table in neon"
// =====
//
// This is no longer tied to Jefri's Google Ads campaigns at all — it's a
// small, user-managed list. The user adds a row (Label, Listing ID, SKU,
// Image Update Date — all typed in by hand, nothing auto-filled, per
// Kuberan's explicit "fully manual" choice), it's stored permanently in a
// dedicated Postgres table, and Days Live / Total Sales Since Update /
// Pre-Update Baseline Sales / % Change / Trend are computed live from
// Shopify's own sales data every time the list is viewed.
//
// Storage: NOT the main read-only analytics Postgres (DATABASE_URL) this
// whole file otherwise uses — that connection is intentionally read-only
// for this project. Writable table `public.jefri_req6_tracker` lives on
// the `AUTH_DATABASE_URL` Neon project (the same one holding this app's
// own `users`/login table) — deliberately its OWN database, not the
// `FEED_TRACKER_DB_URL` one Sajeepan's Req4 feed-optimization tracker uses
// (moved off that shared database 2026-08-14 per explicit instruction —
// see getTrackerPool's own comment below for the full history). Self-
// provisioned via `CREATE TABLE IF NOT EXISTS` on first use (no manual
// migration step).
//
// Sales calculation still reads from the main read-only Postgres
// (order_management.orders/order_item_info, sub_source_id=108,
// status='Completed', gross item_price x item_quantity — same definition
// as every other requirement on this page). Matched directly against the
// user-typed Listing ID on EITHER product_id OR variant_id (no dependency
// on listings.shopify_listings resolution at all now — the user is
// providing the identifier by hand, so there's nothing to "resolve").
//
// Days Live / baseline-window / % Change / Trend formulas are UNCHANGED
// from every earlier version of this feature (validated extensively
// earlier the same day — see validation/jefri/2026-08-14_req6-image-
// update-live-sales-tracker.md): Days Live = today - imageUpdateDate;
// baseline window = exactly that many days immediately before
// imageUpdateDate; Improved >= +15%, Dropped <= -15%, else Same;
// zero/undefined baseline -> null/"Insufficient data", never Infinity/NaN.
const jefriReq6HandlerModule = (function() {
  const { Pool } = require('pg');

  // Writable tracker DB — Label/Listing ID/SKU/Image Update Date storage.
  // (Sales no longer come from Postgres at all — see fetchShopifySalesTotal
  // below, added 2026-08-14 — so there is no separate read-only DB pool in
  // this module anymore, unlike every earlier version of this feature.)
  // History (2026-08-14): originally fell back to AUTH_DATABASE_URL when
  // FEED_TRACKER_DB_URL was unset (matching Sajeepan's tracker code in
  // members-api.js) — that fallback caused real, confirmed data loss (an
  // added row vanished on a later list call while the id SEQUENCE kept
  // advancing), so the fallback was removed and FEED_TRACKER_DB_URL made
  // required. Kuberan then explicitly asked to move off FEED_TRACKER_DB_URL
  // entirely — "that is piranv remove from theri first and add in this neo
  // data base" — since that database/table is shared with Piranav's
  // feed_optimization_tracker feature, not something Req6 should depend on
  // or write into. Now uses AUTH_DATABASE_URL instead — the Neon project
  // already holding this app's own `users` table (confirmed via the Neon
  // console: project "neon-bisque-battery"), fully separate from
  // FEED_TRACKER_DB_URL's project. The `jefri_req6_tracker` table was
  // dropped from the old (FEED_TRACKER_DB_URL) database as part of this
  // move — see evidence/jefri/2026-08-14_req6-image-update-live-sales-
  // tracker.md for the cleanup record.
  let trackerPool;
  function getTrackerPool() {
    if (!trackerPool) {
      const connectionString = process.env.AUTH_DATABASE_URL;
      if (!connectionString) throw new Error('Server not configured: AUTH_DATABASE_URL missing');
      trackerPool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 6000 });
    }
    return trackerPool;
  }

  let tableEnsured = false;
  async function ensureTable(client) {
    if (tableEnsured) return;
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.jefri_req6_tracker (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        image_update_date DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    tableEnsured = true;
  }

  function isValidDateR6(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  function classifyTrend(pctChange) {
    if (pctChange === null) return 'Insufficient data';
    if (pctChange >= 15) return 'Improved';
    if (pctChange <= -15) return 'Dropped';
    return 'Same';
  }

  // Sales now come DIRECTLY from Shopify's own ShopifyQL Analytics API
  // (2026-08-14, per Kuberan: "no need to gather the sales in postgres use
  // direct api of ledsone.de and gather from their") — not Postgres. This
  // is the same source/numbers a merchant sees in Shopify's own reporting
  // (as demonstrated: "FROM sales SHOW total_sales WHERE product_id...",
  // confirmed €797.08 all-time for a real listing vs Postgres's
  // Completed-orders-only €768.54 — different definitions of "sales",
  // Shopify's is now the one used here). Local duplicate of the store
  // domain/API version constants rather than reusing another module's (see
  // R6_SHOPIFY_STORE_DOMAIN's own history elsewhere in this file for why).
  const R6_SHOPIFY_STORE_DOMAIN = 'ledsone-de.myshopify.com';
  const R6_SHOPIFY_API_VERSION = '2024-10';

  async function fetchShopifySalesTotal(productId, startDate, endDateExclusive) {
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!token) throw new Error('Server not configured: SHOPIFY_ADMIN_TOKEN missing');
    // ShopifyQL's UNTIL is inclusive, so convert our exclusive end-date
    // convention (used everywhere else on this page) to an inclusive one.
    const untilInclusive = new Date(new Date(endDateExclusive).getTime() - 86400000).toISOString().slice(0, 10);
    const shopifyql = `FROM sales SHOW total_sales WHERE product_id = ${productId} SINCE ${startDate} UNTIL ${untilInclusive}`;
    const gqlQuery = `query($q: String!) {
      shopifyqlQuery(query: $q) {
        tableData { rows columns { name } }
        parseErrors
      }
    }`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let res;
    try {
      res = await fetch(`https://${R6_SHOPIFY_STORE_DOMAIN}/admin/api/${R6_SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({ query: gqlQuery, variables: { q: shopifyql } }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`Shopify Admin API error ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
    const payload = json.data && json.data.shopifyqlQuery;
    if (payload && payload.parseErrors && payload.parseErrors.length) {
      throw new Error('ShopifyQL parse error: ' + payload.parseErrors.join('; '));
    }
    const rowData = payload && payload.tableData && payload.tableData.rows; // JSON scalar — array of KEYED objects, e.g. [{"total_sales":"797.08"}], NOT array-of-arrays (confirmed live 2026-08-14 via direct query outside the deploy pipeline)
    if (!rowData || !rowData.length) return 0; // no sales in this window — genuinely zero, not an error
    return Number(rowData[0].total_sales) || 0;
  }

  // GET — list every tracked row with live-computed sales/trend, sales
  // fetched directly from Shopify (see fetchShopifySalesTotal above).
  async function handleJefriReq6List(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const trackerClient = await getTrackerPool().connect().catch((err) => {
      console.error('[jefri/req6-list] tracker DB connect failed:', err && err.message);
      res.status(500).json({ error: 'Tracker database not configured or unreachable.' });
      return null;
    });
    if (!trackerClient) return;

    let tracked;
    try {
      await ensureTable(trackerClient);
      const result = await trackerClient.query('SELECT id, label, listing_id, sku, image_update_date FROM public.jefri_req6_tracker ORDER BY created_at DESC');
      tracked = result.rows;
    } catch (err) {
      console.error('[jefri/req6-list] tracker query error:', err && err.message);
      res.status(500).json({ error: err.message || 'Unknown error' });
      return;
    } finally {
      trackerClient.release();
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrowStr = new Date(new Date(todayStr).getTime() + 86400000).toISOString().slice(0, 10);

    const rows = tracked.map((t) => {
      const imageUpdateDate = t.image_update_date instanceof Date ? t.image_update_date.toISOString().slice(0, 10) : String(t.image_update_date).slice(0, 10);
      const daysLive = Math.max(0, Math.floor((new Date(todayStr) - new Date(imageUpdateDate)) / 86400000));
      const baselineStartStr = new Date(new Date(imageUpdateDate).getTime() - daysLive * 86400000).toISOString().slice(0, 10);
      return {
        id: t.id, label: t.label, listingId: t.listing_id, sku: t.sku, imageUpdateDate,
        daysLiveSinceUpdate: daysLive,
        postWindow: { start: imageUpdateDate, end: tomorrowStr },
        baselineWindow: daysLive > 0 ? { start: baselineStartStr, end: imageUpdateDate } : null,
      };
    });

    if (!rows.length) {
      res.status(200).json({ generatedAt: new Date().toISOString(), rows: [] });
      return;
    }

    try {
      const finalRows = await Promise.all(rows.map(async (r) => {
        let post = 0, baseline = null, err = null;
        try {
          post = round2(await fetchShopifySalesTotal(r.listingId, r.postWindow.start, r.postWindow.end));
          if (r.baselineWindow) {
            baseline = round2(await fetchShopifySalesTotal(r.listingId, r.baselineWindow.start, r.baselineWindow.end));
          }
        } catch (e) {
          console.error('[jefri/req6-list] Shopify sales lookup failed for', r.listingId, e && e.message);
          err = 'Shopify sales lookup failed: ' + (e && e.message || 'unknown error');
        }
        let pctChange = null;
        if (!err && baseline !== null && baseline > 0) pctChange = round2(((post - baseline) / baseline) * 100);
        return {
          id: r.id, label: r.label, listingId: r.listingId, sku: r.sku, imageUpdateDate: r.imageUpdateDate,
          daysLiveSinceUpdate: r.daysLiveSinceUpdate,
          totalSalesSinceUpdate: post,
          preUpdateBaselineSales: baseline,
          pctChangeVsBaseline: pctChange,
          trend: err ? 'Insufficient data' : classifyTrend(pctChange),
          zeroBaseline: baseline === 0,
          insufficientData: r.daysLiveSinceUpdate === 0,
          error: err,
        };
      }));

      res.status(200).json({ generatedAt: new Date().toISOString(), rows: finalRows });
    } catch (err) {
      console.error('[jefri/req6-list] error:', err && err.message);
      res.status(500).json({ error: err.message || 'Unknown error' });
    }
  }

  // POST — add a new tracked row. Body: { label, listingId, sku, imageUpdateDate }.
  async function handleJefriReq6Add(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    const label = (body.label || '').toString().trim();
    const listingId = (body.listingId || '').toString().trim();
    const sku = (body.sku || '').toString().trim();
    const imageUpdateDate = body.imageUpdateDate;

    // SKU is a display-only reference field (confirmed explicitly by
    // Kuberan, 2026-08-14) — stored so the user can recognize the row at a
    // glance, but never used to look up or match sales data. Only
    // Listing ID drives data gathering (see BULK_SALES_QUERY's matchIds,
    // built purely from listingId — sku never enters that query).
    if (!label) { res.status(400).json({ error: 'Label is required.' }); return; }
    if (!listingId) { res.status(400).json({ error: 'Listing ID is required.' }); return; }
    if (!sku) { res.status(400).json({ error: 'SKU is required.' }); return; }
    if (!isValidDateR6(imageUpdateDate)) { res.status(400).json({ error: 'Provide imageUpdateDate as YYYY-MM-DD.' }); return; }

    const client = await getTrackerPool().connect().catch((err) => {
      console.error('[jefri/req6-add] tracker DB connect failed:', err && err.message);
      res.status(500).json({ error: 'Tracker database not configured or unreachable.' });
      return null;
    });
    if (!client) return;

    try {
      await ensureTable(client);
      const result = await client.query(
        `INSERT INTO public.jefri_req6_tracker (label, listing_id, sku, image_update_date, updated_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
        [label, listingId, sku, imageUpdateDate]
      );
      res.status(200).json({ ok: true, id: result.rows[0].id });
    } catch (err) {
      console.error('[jefri/req6-add] error:', err && err.message);
      res.status(500).json({ error: err.message || 'Unknown error' });
    } finally {
      client.release();
    }
  }

  // POST — remove a tracked row. Body: { id }.
  async function handleJefriReq6Delete(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const id = parseInt(body.id, 10);
    if (!id) { res.status(400).json({ error: 'Provide id.' }); return; }

    const client = await getTrackerPool().connect().catch((err) => {
      console.error('[jefri/req6-delete] tracker DB connect failed:', err && err.message);
      res.status(500).json({ error: 'Tracker database not configured or unreachable.' });
      return null;
    });
    if (!client) return;

    try {
      await ensureTable(client);
      await client.query('DELETE FROM public.jefri_req6_tracker WHERE id = $1', [id]);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[jefri/req6-delete] error:', err && err.message);
      res.status(500).json({ error: err.message || 'Unknown error' });
    } finally {
      client.release();
    }
  }

  // Note: a temporary handleJefriReq6CleanupOldDb handler lived here
  // briefly on 2026-08-14 to drop public.jefri_req6_tracker from the OLD
  // FEED_TRACKER_DB_URL database when this table moved to AUTH_DATABASE_URL
  // — run once (confirmed dropped), then removed. See
  // evidence/jefri/2026-08-14_req6-image-update-live-sales-tracker.md.

  return { handleJefriReq6List, handleJefriReq6Add, handleJefriReq6Delete };
})();

// ===== Jefri Requirement 8: T-08 Order Conversion Split by Campaign Date
// (added 2026-08-20). BLOCKED end-to-end per evidence/jefri/req-08-t08-*.md
// (no Google Ads transaction ID / delta / bid-adjustment data exists in
// Postgres) — built incrementally, step by step, per Kuberan's explicit
// "let's do one by one" instruction.
// Step 1: Order Number + Order Value (Excl. Shipping) — Shopify Admin API
// `current_subtotal_price` (spot-checked: 16.88 + 10.57 shipping = 27.45
// total, matches exactly).
// Step 2 (this update): Order Summary / conversion source. Discovered that
// Shopify's own GraphQL Admin API exposes `Order.customerJourneySummary`
// — literally the same "Conversion summary" panel visible on each order's
// admin page — including UTM source/medium/campaign/term per visit. This
// is NOT the blocked Google Ads transaction-level data (still doesn't
// exist), but it IS a real, live, per-order attribution signal Shopify
// itself already tracks, spot-checked against 10 real live orders before
// building (see evidence/jefri/req-08-t08-order-summary-discovery.md).
// Classification: if firstVisit.utmParameters exists, the order is
// UTM-tagged (Google Ads, in every real order seen so far) — attempt to
// match the source/medium/campaign/term combination against Jefri's 5
// known named campaigns (JEFRI_CAMPAIGNS_R5, same list as Req1/4/5) using
// simple keyword rules; if no confident, unambiguous match is found, the
// raw UTM tags are shown instead of a guessed campaign name — never a
// false-confidence match. If no utmParameters: 'direct' source -> Direct;
// otherwise -> Organic/Other (raw source shown).
const jefriReq8HandlerModule = (function() {
  const { Pool } = require('pg');
  const SHOPIFY_STORE_DOMAIN = 'ledsone-de.myshopify.com';
  const API_VERSION = '2024-10';
  const GADS_ACCOUNT_ID = 9031058245;

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
        ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 8000,
        statement_timeout: 30000,
        max: 3,
      });
    }
    return pool;
  }

  // Attributed Date / Campaign matching (added 2026-08-20, Method 2 —
  // Inferred, per T-08's own Step 3/4/7). Two real, exact-cent matches
  // found before building this (see evidence/jefri/req-08-t08-attribution-
  // discovery.md): campaign_performance is a per-day AGGREGATE (many
  // orders summed — exact-value matching against it fails almost always,
  // confirmed by exhaustively searching a real order's value across every
  // conversion_value column in the whole account, all-time, zero matches).
  // google_ads.product_performance is per-day PER-PRODUCT — much finer
  // grain, so a `conversions = 1` row usually isolates exactly one order.
  // Google Ads' "New Customer Acquisition" bid strategy (confirmed via
  // google_ads.campaigns.customer_acquisition = 'BID_HIGHER_FOR_NEW_
  // CUSTOMER' on these campaigns) ADDS a bonus on top of the real order
  // value for new-customer conversions — the bonus €-amount itself is NOT
  // stored anywhere in Postgres (only the on/off flag), so these values
  // were supplied directly by Kuberan from the Google Ads UI and are
  // hardcoded here, keyed by campaign_id (resolved from the real campaign
  // names via a live query before building this).
  // IMPORTANT: the matched product_performance row is NOT necessarily the
  // literal product the customer bought (verified on a real order — the
  // matched row's product title differed from the order's actual line
  // item) — Google Ads Shopping/PMax can attribute a conversion's value to
  // whichever product ad was last clicked, not necessarily what ended up
  // in the cart. So matching is done on CAMPAIGN + DATE + VALUE only, not
  // on product identity — the product_performance table is used purely as
  // a finer-grained VALUE signal than campaign_performance, to avoid the
  // multi-order-per-day aggregation problem, not as a product-level join.
  const ACTIVE_CAMPAIGN_BONUS = {
    '23246898942': [0.70, 0.90], // Pmax | Jeff | Klarna | BT | Backup | TROAS | DE-11/11
    '23141810147': [0.70, 0.90], // Pmax | Jeff | Klarna | NEWALL | All Products | MCV | DE -16/10
    '24038115272': [0.70, 0.90], // Pmax | Jeff | Klarna | SANCTUARY | SoftMinimalism | MCV | DE-16/07
    '23411228109': [0.50, 0.70], // Pmax | Jeff | Shoparize | ALL | All Products | MCV | DE-01/01/26
    '23473840779': [1.00, 1.10], // Pmax | Jeff | Shoparize | FTJ | FinetunedProducts | TROAS | DE-20.01
    '23340277562': [0.80, 0.90], // Pmax | Jeff | Shoparize | IT | Italy | TROAS | IT-08/12
    '21923476465': [0.70, 0.90], // Pmax | Jeff | Shoptimised | BLACKFRIDAY | Blackfriday | MCV | DE- 18/11
    '23791285134': [0.70, 0.90], // Pmax | Thasi | Shoptimised | MT | Metal Product | MCV -27/04
    '23765634627': [0.50, 0.70], // Pmax | Thasi | Shoptimised | THT | NewProduct | MCV -20/04
    '24051146082': [0.50, 0.70], // Pmax | Thasi | Klarna | SUMT | NewProduct | MCV -22/07
    '20763699505': [0.70, 0.90], // Pmax DE | Mahi | Klarna | DE | All_Myid | MCV
    '23053104908': [0.60, 0.90], // Pmax DE | Mahi | Shoptimised | LIGHTINGSOLUTION | All_Myid_1 | MCV
    '23431543574': [1.00, 1.10], // Pmax DE | Mahi | Shoptimised | JAN-TOP-SALES | JanTopSales_3 | MCV
    '23684789991': [0.75, 0.95], // Pmax DE | Mahi | Shoptimised | BESTEN-BELEUCHTUNG | priceGT10_5 | MCV
    '22539594891': [1.00],       // Shopping | Jeff | Shoptimised | AOVU15 | TROAS | DE -12/05
    '23926509987': [1.00],       // Shopping DE | Mahi | klarna | TOP-MAHI | Verkaufsprodukt | tROAS | 11/06
  };
  const ACTIVE_CAMPAIGN_IDS = Object.keys(ACTIVE_CAMPAIGN_BONUS);
  const BONUS_MATCH_TOLERANCE = 0.03; // real matches seen were exact-to-the-cent

  const ATTRIBUTION_CANDIDATES_QUERY = `
    SELECT pp.date, pp.campaign_id, c.campaign_name, pp.conversion_value
    FROM google_ads.product_performance pp
    JOIN google_ads.campaigns c ON c.campaign_id = pp.campaign_id
    WHERE pp.campaign_id = ANY($1::bigint[])
      AND pp.date >= $2::date AND pp.date <= $3::date
      AND pp.conversions = 1
      AND pp.conversion_value > 0
  `;

  // For one order, find every campaign/date candidate whose
  // product_performance conversion_value equals the order value, either
  // exactly (no bonus / bonus not applicable) or exactly minus that
  // specific campaign's known bonus (new-customer or high-value-customer).
  function findAttributionCandidates(orderValue, candidateRows) {
    const matches = [];
    candidateRows.forEach((row) => {
      const bonuses = ACTIVE_CAMPAIGN_BONUS[row.campaign_id] || [];
      const diff = Number(row.conversion_value) - orderValue;
      let bonusType = null;
      if (Math.abs(diff) <= BONUS_MATCH_TOLERANCE) {
        bonusType = 'none';
      } else if (bonuses.length && Math.abs(diff - bonuses[0]) <= BONUS_MATCH_TOLERANCE) {
        bonusType = 'new_customer';
      } else if (bonuses.length > 1 && Math.abs(diff - bonuses[1]) <= BONUS_MATCH_TOLERANCE) {
        bonusType = 'high_value_customer';
      }
      if (bonusType) {
        matches.push({
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          attributedDate: new Date(row.date).toISOString().slice(0, 10),
          conversionValue: Number(row.conversion_value),
          bonusApplied: bonusType === 'none' ? 0 : (bonusType === 'new_customer' ? bonuses[0] : bonuses[1]),
          bonusType,
        });
      }
    });
    return matches;
  }

  // Same 5 campaigns already used by Req5 (JEFRI_CAMPAIGNS_R5) — duplicated
  // here rather than reaching into that IIFE's closure, since these lists
  // must stay identical by construction (both are literally Jefri's fixed
  // 5 named campaigns) and this keeps the two modules independently
  // readable/deployable.
  const JEFRI_CAMPAIGN_NAMES = [
    'Pmax | Jeff | Klarna | NEWALL | All Products | MCV | DE -16/10',
    'Pmax | Jeff | Shoparize | ALL | All Products | MCV | DE-01/01/26',
    'Shopping | Jeff | Shoptimised | AOVU15 | TROAS | DE -12/05',
    'Pmax | Jeff | Shoparize | FTJ | FinetunedProducts | TROAS | DE-20.01',
    'Pmax | Jeff | Shoparize | IT | Italy | TROAS | IT-08/12',
  ];

  // Best-effort match of UTM fragments -> one of Jefri's 5 named campaigns.
  // Returns the full campaign name ONLY when the combination is unambiguous;
  // returns null otherwise (caller falls back to showing the raw UTM tags).
  function matchJefriCampaign(utm) {
    if (!utm) return null;
    const src = (utm.source || '').toLowerCase();
    const med = (utm.medium || '').toLowerCase();
    const camp = (utm.campaign || '').toLowerCase();
    const isPmax = camp.includes('pmax') || camp.includes('pamx'); // real data has a typo variant "Pamx"
    const isShopping = camp.includes('shopping');
    if (isShopping && src.includes('shoptimised')) {
      return JEFRI_CAMPAIGN_NAMES[2]; // Shopping | Shoptimised | AOVU15
    }
    if (isPmax && src.includes('klarna')) {
      return JEFRI_CAMPAIGN_NAMES[0]; // Pmax | Klarna | NEWALL
    }
    if (isPmax && src.includes('shoparize')) {
      if (med.includes('italy') || src.includes('asset')) {
        return JEFRI_CAMPAIGN_NAMES[4]; // Pmax | Shoparize | IT
      }
      // Ambiguous between "ALL" and "FTJ" Shoparize Pmax campaigns —
      // both share the same source fragment with no distinguishing UTM
      // signal seen in real data yet. Do not guess.
      return null;
    }
    return null;
  }

  function classifyOrderSummary(journey) {
    const visit = journey && journey.firstVisit;
    const utm = visit && visit.utmParameters;
    const src = (visit && visit.source) || '';
    const srcLower = src.toLowerCase();

    if (utm && (utm.campaign || utm.source || utm.medium || utm.term)) {
      const rawTag = [utm.source, utm.medium, utm.campaign, utm.term].filter(Boolean).join(' / ');
      // The journey's own `source` field (Shopify's platform detection, e.g.
      // "Google", "Meta", a raw domain) decides the PLATFORM — the UTM
      // fragments are only ever used to pick a Jefri campaign name WITHIN
      // Google Ads, never to guess the platform itself. A "Meta"-sourced
      // order with UTM tags is Meta Ads, not an "unmatched Google" order —
      // caught via a real live order (#LSDE19256, source="Meta") during
      // testing before this went live.
      if (srcLower.includes('google')) {
        const matched = matchJefriCampaign(utm);
        return {
          type: 'Google Ads',
          campaignMatched: matched,
          campaignRaw: rawTag,
          display: matched || `Google Ads (unmatched tag: ${rawTag})`,
        };
      }
      if (srcLower.includes('meta') || srcLower.includes('facebook') || srcLower.includes('instagram')) {
        return { type: 'Meta Ads', campaignRaw: rawTag, display: `Meta Ads (${rawTag})` };
      }
      return { type: 'Other (tagged)', campaignRaw: rawTag, display: `${src || 'Tagged'} (${rawTag})` };
    }
    if (!src || srcLower === 'direct') return { type: 'Direct', display: 'Direct' };
    return { type: 'Organic/Other', display: src };
  }

  async function shopifyGraphQL(query, variables) {
    const token = process.env.SHOPIFY_ADMIN_TOKEN;
    if (!token) throw new Error('Server not configured: SHOPIFY_ADMIN_TOKEN missing');
    const res = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(body.errors || res.statusText)}`);
    return body.data;
  }

  function isValidDateR8(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  const CACHE = new Map();
  const CACHE_TTL_MS = 5 * 60 * 1000;

  const ORDERS_QUERY = `
    query($cursor: String, $searchQuery: String!) {
      orders(first: 100, after: $cursor, query: $searchQuery, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            name
            createdAt
            cancelledAt
            currentSubtotalPriceSet { shopMoney { amount } }
            customerJourneySummary {
              firstVisit { source utmParameters { source medium campaign term } }
            }
          }
        }
      }
    }
  `;

  async function handleJefriReq8Orders(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const startDate = isValidDateR8(req.query && req.query.startDate) ? req.query.startDate : null;
    const endDate = isValidDateR8(req.query && req.query.endDate) ? req.query.endDate : null;
    const forceRefresh = req.query && req.query.refresh === '1';
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Provide ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD' });
      return;
    }

    const cacheKey = `${startDate}|${endDate}`;
    if (!forceRefresh) {
      const cached = CACHE.get(cacheKey);
      if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
        res.status(200).json(cached.data);
        return;
      }
    }

    try {
      const searchQuery = `created_at:>='${startDate}' AND created_at:<='${endDate}T23:59:59Z'`;
      const orders = [];
      let cursor = null;
      let guard = 0;
      let hasNext = true;
      while (hasNext && guard < 50) {
        guard += 1;
        const data = await shopifyGraphQL(ORDERS_QUERY, { cursor, searchQuery });
        const conn = data.orders;
        (conn.edges || []).forEach(({ node: o }) => {
          const summary = classifyOrderSummary(o.customerJourneySummary);
          orders.push({
            orderNumber: o.name,
            orderValueExclShipping: o.currentSubtotalPriceSet && o.currentSubtotalPriceSet.shopMoney
              ? Number(o.currentSubtotalPriceSet.shopMoney.amount) : null,
            createdAt: o.createdAt,
            cancelled: !!o.cancelledAt,
            orderSummaryType: summary.type,
            orderSummaryDisplay: summary.display,
            campaignMatched: summary.campaignMatched || null,
            campaignRaw: summary.campaignRaw || null,
          });
        });
        hasNext = conn.pageInfo && conn.pageInfo.hasNextPage;
        cursor = conn.pageInfo && conn.pageInfo.endCursor;
      }

      // Attributed Date / Campaign (Method 2, inferred) — one Postgres
      // query covering the whole date range (+padding for attribution
      // lag), then matched in-memory per order. See ACTIVE_CAMPAIGN_BONUS
      // comment above for the full method.
      const windowStart = new Date(new Date(startDate + 'T00:00:00Z').getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const windowEnd = new Date(new Date(endDate + 'T00:00:00Z').getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      let candidateRows = [];
      const client = await getPool().connect().catch((err) => {
        console.error('[jefri/req8-orders] Postgres connect failed (attribution skipped):', err && err.message);
        return null;
      });
      if (client) {
        try {
          const result = await client.query(ATTRIBUTION_CANDIDATES_QUERY, [ACTIVE_CAMPAIGN_IDS, windowStart, windowEnd]);
          candidateRows = result.rows;
        } catch (err) {
          console.error('[jefri/req8-orders] attribution query failed:', err && err.message);
        } finally {
          client.release();
        }
      }

      orders.forEach((o) => {
        if (o.orderValueExclShipping == null) {
          o.attribution = { status: 'No match', candidates: [] };
          return;
        }
        const orderDate = o.createdAt.slice(0, 10);
        const rowsNearOrder = candidateRows.filter((r) => {
          const rDate = new Date(r.date).toISOString().slice(0, 10);
          return rDate >= new Date(new Date(orderDate + 'T00:00:00Z').getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
              && rDate <= new Date(new Date(orderDate + 'T00:00:00Z').getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        });
        const candidates = findAttributionCandidates(o.orderValueExclShipping, rowsNearOrder);
        o.attribution = {
          status: candidates.length === 0 ? 'No match' : (candidates.length === 1 ? 'Matched' : 'Ambiguous'),
          candidates,
        };
      });

      const payload = { startDate, endDate, generatedAt: new Date().toISOString(), count: orders.length, orders };
      CACHE.set(cacheKey, { data: payload, at: Date.now() });
      res.status(200).json(payload);
    } catch (err) {
      console.error('[jefri/req8-orders] error:', err && err.message);
      res.status(500).json({ error: err.message || 'Unknown error' });
    }
  }

  return { handleJefriReq8Orders };
})();
// Mahima Requirement 5 (Product x Campaign Sales) — added 2026-08-20.
// NOTE: this is intentionally NOT the same as the earlier "mahima-req5"
// (Product ID Coverage) tab above — per Kuberan's explicit instruction,
// the existing Req5 tab was left untouched and this ships as a separate
// tab ("Tab 6" in mahima.html) rather than renumbering anything.
// Reuses the exact proven Shopify Admin API + customerJourneySummary/UTM
// first-session paid-vs-organic classification logic already validated
// in api/salesde25.js (ledsone-de.myshopify.com, SHOPIFY_ADMIN_TOKEN,
// PAID_UTM_MEDIUMS/PAID_UTM_SOURCES/PAID_CLICK_IDS/PAID_SOURCE_TYPES,
// hasPaidEvidence/classifySession) — copied here (not imported) because
// salesde25.js only exports its top-level request handler, consistent
// with how every other handler in this codebase self-contains its own
// copy of these helpers (see salesde25.js itself, which redefines
// shopifyGraphQL 5 separate times across its own merged handlers).
const mahimaReq5bHandlerModule = (function() {
  const STORE_DOMAIN = 'ledsone-de.myshopify.com';
  const API_VERSION = '2024-10';
  const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function amt(moneySet) { return moneySet ? round2(Number(moneySet.shopMoney.amount)) : 0; }

  // ---------- Scope to Mahima's own products only (added per Kuberan,
  // 2026-08-21: "need for only mahima products") ----------
  // Reuses the EXACT same 5 campaign IDs already proven/live in Req1/Req5
  // above (MAHIMA_CAMPAIGNS, jefriProductStatusHandlerModule) — copied,
  // not re-derived, since this module is self-contained like every other
  // handler in this file. Mahima's product universe = every product_item_id
  // that has ever appeared in google_ads.product_performance for these
  // campaigns (same "advertised by Mahima" definition Req1/Req5 use).
  const { Pool: MahimaPool } = require('pg');
  const MAHIMA_OWN_CAMPAIGN_IDS = ['20763699505', '23684789991', '23053104908', '23431543574', '23926509987'];
  let mahimaPgPool;
  function getMahimaPgPool() {
    if (!mahimaPgPool) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString && !process.env.PGHOST) throw new Error('Server not configured: DATABASE_URL missing');
      mahimaPgPool = new MahimaPool({
        connectionString: connectionString || undefined,
        host: connectionString ? undefined : process.env.PGHOST,
        port: connectionString ? undefined : (process.env.PGPORT ? Number(process.env.PGPORT) : 5432),
        database: connectionString ? undefined : process.env.PGDATABASE,
        user: connectionString ? undefined : process.env.PGUSER,
        password: connectionString ? undefined : process.env.PGPASSWORD,
        ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
        max: 3,
      });
    }
    return mahimaPgPool;
  }

  // product_item_id can be a bare numeric Shopify product ID or a
  // shopify_<country>_<productid>_<variantid> string (same format Req1's
  // rebuild found and fixed, see evidence/mahima/2026-07-10_mahima_req1_rebuild_evidence.md
  // section 3) — normalize both forms to the bare numeric product ID.
  function normalizeProductItemId(raw) {
    const s = String(raw || '').trim();
    const m = /^shopify_[A-Za-z]+_(\d+)_(\d+)$/.exec(s);
    if (m) return m[1];
    if (/^\d+$/.test(s)) return s;
    return null;
  }

  let mahimaProductIdSetCache = null; // { at, set }
  const MAHIMA_PRODUCTS_TTL_MS = 60 * 60 * 1000; // 1h — this universe changes rarely
  async function getMahimaOwnedProductIds() {
    if (mahimaProductIdSetCache && (Date.now() - mahimaProductIdSetCache.at) < MAHIMA_PRODUCTS_TTL_MS) {
      return mahimaProductIdSetCache.set;
    }
    const pool = getMahimaPgPool();
    const result = await pool.query(
      'SELECT DISTINCT product_item_id FROM google_ads.product_performance WHERE campaign_id = ANY($1::bigint[]) AND product_item_id IS NOT NULL',
      [MAHIMA_OWN_CAMPAIGN_IDS]
    );
    const set = new Set();
    for (const row of result.rows) {
      const norm = normalizeProductItemId(row.product_item_id);
      if (norm) set.add(norm);
    }
    mahimaProductIdSetCache = { at: Date.now(), set };
    return set;
  }

  async function shopifyGraphQL(query, variables, retryState) {
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
        retryState.throttleRetries++;
        await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
        continue;
      }
      if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
        retryState.throttleRetries++;
        await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
        continue;
      }
      if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
      const json = await res.json();
      const throttled = json.errors && Array.isArray(json.errors) && json.errors.some(e => e.extensions && e.extensions.code === 'THROTTLED');
      if (throttled) {
        retryState.throttleRetries++;
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
      return json.data;
    }
    throw new Error('Shopify API: exceeded retries (throttling / transient errors)');
  }

  // ---------- Paid vs Organic first-session classification ----------
  // Copied verbatim from api/salesde25.js's proven, live-verified logic
  // (see that file's comments: PAID_UTM_MEDIUMS/PAID_UTM_SOURCES/PAID_SOURCE_TYPES
  // were each tuned against real production orders that were initially
  // misclassified — pmax/demandgen mediums, utm_source=Google_Ads,
  // sourceType=AD — not re-derived here, reused exactly).
  const PAID_UTM_MEDIUMS = ['cpc', 'ppc', 'paid', 'paid_search', 'paidsearch', 'display', 'shopping', 'paid_social', 'cpv', 'cpm', 'cpa', 'pmax', 'performance_max', 'demandgen', 'demand_gen', 'discovery'];
  const PAID_CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'dclid'];
  const PAID_UTM_SOURCES = ['google_ads', 'googleads', 'google ads', 'bing_ads', 'bingads', 'facebook_ads', 'meta_ads'];
  const PAID_SOURCE_TYPES = ['ad'];
  function lower(s) { return (s || '').toString().toLowerCase(); }

  function hasPaidEvidence(visit) {
    const utm = visit.utmParameters || {};
    const medium = lower(utm.medium);
    if (PAID_UTM_MEDIUMS.includes(medium)) return `paid utm_medium=${medium}`;
    const utmSource = lower(utm.source);
    if (PAID_UTM_SOURCES.some(s => utmSource.includes(s))) return `paid utm_source=${utm.source}`;
    const urlFields = [visit.referrerUrl, visit.landingPage].filter(Boolean).join(' ').toLowerCase();
    for (const id of PAID_CLICK_IDS) {
      if (urlFields.includes(id + '=')) return `paid click id present: ${id}`;
    }
    const sourceType = lower(visit.sourceType);
    if (PAID_SOURCE_TYPES.includes(sourceType)) return `sourceType=${visit.sourceType}`;
    return null;
  }

  const ORDERS_QUERY = `
  query MahimaReq5bOrders($cursor: String, $query: String!) {
    orders(first: 50, after: $cursor, sortKey: CREATED_AT, query: $query) {
      edges {
        node {
          id
          legacyResourceId
          name
          createdAt
          cancelledAt
          test
          customerJourneySummary {
            ready
            firstVisit {
              landingPage referrerUrl source sourceDescription sourceType
              utmParameters { source medium campaign term content }
            }
          }
          lineItems(first: 100) {
            edges {
              node {
                quantity
                discountedTotalSet { shopMoney { amount currencyCode } }
                variant {
                  legacyResourceId
                  product { legacyResourceId title featuredImage { url } }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

  const REQ5B_START = '2026-01-01';
  let CACHE = null; // { at, payload }
  const CACHE_TTL_MS = 15 * 60 * 1000;

  // Fetches one calendar month's orders (paginated, serial within the month).
  async function fetchOrdersForRange(queryStart, queryEndExclusive) {
    const retryState = { throttleRetries: 0 };
    const q = `created_at:>=${queryStart} AND created_at:<${queryEndExclusive}`;
    const orders = [];
    let after = null;
    let hasNext = true;
    let pages = 0;
    while (hasNext) {
      const data = await shopifyGraphQL(ORDERS_QUERY, { cursor: after, query: q }, retryState);
      for (const edge of data.orders.edges) orders.push(edge.node);
      hasNext = data.orders.pageInfo.hasNextPage;
      after = data.orders.pageInfo.endCursor;
      pages++;
      if (pages > 400) break; // safety cap per month (~20,000 orders/month)
    }
    return orders;
  }

  // Splits the full report range into calendar months and fetches all of
  // them in PARALLEL (not serially) — a single serial fetch of the full
  // Jan-current range timed out in production testing (2026-08-21, ran
  // past the 300s maxDuration on api/requirement.js). Per-month parallel
  // fetching matches the pattern already used elsewhere in this codebase
  // (api/salesde25.js's monthConfig architecture) and finishes in roughly
  // (slowest single month's time) instead of (sum of all months' time).
  async function fetchAllOrders() {
    const start = new Date(REQ5B_START + 'T00:00:00Z');
    const endExclusive = new Date();
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1); // include "today"

    const months = [];
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor < endExclusive) {
      const monthStart = new Date(cursor);
      const monthEndExclusive = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      const queryStart = (monthStart < start ? start : monthStart).toISOString().slice(0, 10);
      const queryEnd = (monthEndExclusive < endExclusive ? monthEndExclusive : endExclusive).toISOString().slice(0, 10);
      months.push({ queryStart, queryEnd });
      cursor = monthEndExclusive;
    }

    // Limited concurrency (not full Promise.all across every month) — running
    // all 8 months fully in parallel overwhelmed Shopify's rate limiter and
    // every month exhausted its 6 retries ("Shopify API: exceeded retries"),
    // confirmed live 2026-08-21 via the deployed Refresh button. 3-at-a-time
    // still finishes well under the serial version's timeout while staying
    // under Shopify's throttle.
    const CONCURRENCY = 3;
    const orders = [];
    for (let i = 0; i < months.length; i += CONCURRENCY) {
      const batch = months.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map((m) => fetchOrdersForRange(m.queryStart, m.queryEnd)));
      for (const r of batchResults) orders.push(...r);
    }
    return { orders, months: months.length };
  }

  // Emits per-order-line events (not pre-aggregated rows) so the frontend
  // can recompute any date-range preset (Daily/Weekly/.../Custom) instantly
  // client-side, with zero re-query to Shopify — same pattern already used
  // by Req1's embedded daily dataset for its date-range picker. Added
  // 2026-08-21 per Kuberan's request for date-range filters on this tab.
  async function buildReport() {
    const [{ orders }, mahimaProductIds] = await Promise.all([fetchAllOrders(), getMahimaOwnedProductIds()]);
    const events = [];
    const productImages = {};
    let excludedTest = 0, excludedCancelled = 0, noJourney = 0, excludedNotMahimaProduct = 0;

    for (const order of orders) {
      if (order.test) { excludedTest++; continue; }
      if (order.cancelledAt) { excludedCancelled++; continue; }

      const cjs = order.customerJourneySummary;
      const firstVisit = cjs && cjs.ready ? cjs.firstVisit : null;
      if (!firstVisit) noJourney++;

      const paidEvidence = firstVisit ? hasPaidEvidence(firstVisit) : null;
      const isPaid = !!paidEvidence;
      const utmCampaign = firstVisit && firstVisit.utmParameters ? firstVisit.utmParameters.campaign : null;
      const campaignKey = isPaid ? (utmCampaign || 'Paid — Campaign Unknown') : null;
      const dateStr = order.createdAt.slice(0, 10);

      for (const edge of (order.lineItems && order.lineItems.edges) || []) {
        const li = edge.node;
        const variant = li.variant;
        const product = variant && variant.product;
        if (!product) continue;
        const productId = String(product.legacyResourceId);
        if (!mahimaProductIds.has(productId)) { excludedNotMahimaProduct++; continue; }
        if (!productImages[productId] && product.featuredImage) productImages[productId] = product.featuredImage.url;
        const sales = amt(li.discountedTotalSet);
        events.push({
          d: dateStr,
          pid: productId,
          camp: campaignKey,
          paid: isPaid ? 1 : 0,
          amt: sales,
          qty: li.quantity,
          oid: order.legacyResourceId || order.id,
        });
      }
    }

    return {
      events,
      productImages,
      meta: {
        ordersFetched: orders.length,
        excludedTest,
        excludedCancelled,
        ordersWithNoJourneyData: noJourney,
        lineItemsExcludedNotMahimaProduct: excludedNotMahimaProduct,
        mahimaOwnedProductCount: mahimaProductIds.size,
      },
    };
  }

  async function mahimaReq5bHandler(req, res) {
    try {
      const force = req.query && req.query.refresh === '1';
      if (!force && CACHE && (Date.now() - CACHE.at) < CACHE_TTL_MS) {
        return res.status(200).json(CACHE.payload);
      }
      // Static snapshot fallback (same pattern as Req1/Req2's staticPath) —
      // a full live Shopify + Postgres fetch across 8 months takes minutes
      // even with limited concurrency, which is too slow for a normal page
      // load. Default loads serve this committed snapshot instantly; the
      // user's explicit Refresh button (?refresh=1) is what triggers the
      // real live fetch below.
      if (!force) {
        try {
          const fs = require('fs');
          const path = require('path');
          const staticPath = path.join(__dirname, 'data', 'mahima-req5b-snapshot.json');
          const snapshot = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
          snapshot.isSnapshot = true;
          return res.status(200).json(snapshot);
        } catch (e) {
          // No snapshot on disk yet — fall through to a live fetch.
        }
      }
      if (!TOKEN) {
        return res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
      }
      const report = await buildReport();
      const payload = {
        success: true,
        generatedAt: new Date().toISOString(),
        dateRange: { start: REQ5B_START, end: new Date().toISOString().slice(0, 10) },
        grain: 'One row per Product ID within the selected date range. Organic Sales and Ads Sales are both shown on the same row (combined, not split by campaign); Campaign lists every campaign that contributed Ads Sales for that product. Scoped to Mahima\'s own products only.',
        events: report.events,
        productImages: report.productImages,
        meta: report.meta,
      };
      CACHE = { at: Date.now(), payload };
      res.status(200).json(payload);
    } catch (err) {
      console.error('[mahima/req5b] error:', err && err.message);
      res.status(500).json({ success: false, error: err.message || 'Unknown error' });
    }
  }

  return { mahimaReq5bHandler };
})();

// Muguntha — Shopify UK Last 60 Days Refund Report — added 2026-08-21.
// Reuses the exact same Shopify UK Admin API credentials/domain/version
// already proven in api/salesuk.js (STORE_DOMAIN_UK, TOKEN_UK, API_VERSION_UK)
// — no second Shopify auth system created, per the requirement's explicit
// instruction. Self-contained module, consistent with every other handler
// in this file.
const mugunthaUkRefundsHandlerModule = (function() {
  const STORE_DOMAIN = process.env.SHOPIFY_UK_STORE_DOMAIN || 'ledsone.myshopify.com';
  const API_VERSION = process.env.SHOPIFY_UK_API_VERSION || '2024-10';
  const TOKEN = process.env.SHOPIFY_UK_ADMIN_TOKEN;

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function amt(moneySet) { return moneySet ? round2(Number(moneySet.shopMoney.amount)) : 0; }
  function ccy(moneySet) { return moneySet ? moneySet.shopMoney.currencyCode : null; }

  async function shopifyGraphQL(query, variables, retryState) {
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
        retryState.throttleRetries++;
        await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
        continue;
      }
      if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
        retryState.throttleRetries++;
        await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
        continue;
      }
      if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
      const json = await res.json();
      const throttled = json.errors && Array.isArray(json.errors) && json.errors.some(e => e.extensions && e.extensions.code === 'THROTTLED');
      if (throttled) {
        retryState.throttleRetries++;
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
      return json.data;
    }
    throw new Error('Shopify API: exceeded retries (throttling / transient errors)');
  }

  // Queried by updated_at (not created_at) so refunds on ORDERS PLACED
  // BEFORE the 60-day window are still caught — an order can be refunded
  // long after it was placed. The window filter for "last 60 days" is then
  // applied to each REFUND's own createdAt below, which is the field that
  // actually matters per the requirement (Refund Date, not Order Date).
  //
  // Refund reason field: Shopify's Admin GraphQL Refund object has no
  // structured "reason" enum — the actual text staff/system record when a
  // refund is created is stored in Refund.note. That is what this report
  // displays as "Refund Reason" (documented, not invented — see evidence).
  const ORDERS_QUERY = `
  query MugunthaUkRefundsOrders($cursor: String, $query: String!) {
    orders(first: 50, after: $cursor, sortKey: UPDATED_AT, query: $query) {
      edges {
        node {
          id
          legacyResourceId
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          refunds {
            id
            createdAt
            note
            refundLineItems(first: 100) {
              edges {
                node {
                  quantity
                  priceSet { shopMoney { amount currencyCode } }
                  subtotalSet { shopMoney { amount currencyCode } }
                  lineItem {
                    id
                    title
                    sku
                    variant {
                      id
                      title
                      product { legacyResourceId title }
                    }
                  }
                }
              }
            }
            transactions(first: 10) {
              edges { node { id amountSet { shopMoney { amount currencyCode } } kind status } }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

  const WINDOW_DAYS = 60;
  let CACHE = null; // { at, payload }
  const CACHE_TTL_MS = 15 * 60 * 1000;

  async function fetchOrdersWithRefunds(sinceISO) {
    const retryState = { throttleRetries: 0 };
    const q = `updated_at:>=${sinceISO}`;
    const orders = [];
    let after = null, hasNext = true, pages = 0;
    while (hasNext) {
      const data = await shopifyGraphQL(ORDERS_QUERY, { cursor: after, query: q }, retryState);
      for (const edge of data.orders.edges) {
        if (edge.node.refunds && edge.node.refunds.length) orders.push(edge.node);
      }
      hasNext = data.orders.pageInfo.hasNextPage;
      after = data.orders.pageInfo.endCursor;
      pages++;
      if (pages > 600) break; // safety cap
    }
    return orders;
  }

  // Grain: one row = one refund x one refund line item. If a single refund
  // has no refundLineItems (e.g. a shipping-only refund with no product
  // line attached), one summary row is still emitted so the refund isn't
  // silently dropped — flagged via lineItem: null.
  function buildRows(orders, windowStartMs, windowEndMs) {
    const rows = [];
    for (const order of orders) {
      for (const refund of order.refunds) {
        const refundMs = new Date(refund.createdAt).getTime();
        if (refundMs < windowStartMs || refundMs >= windowEndMs) continue; // outside the 60-day refund window

        const reason = (refund.note && refund.note.trim()) ? refund.note.trim() : 'Not Provided';
        const edges = (refund.refundLineItems && refund.refundLineItems.edges) || [];

        if (!edges.length) {
          rows.push({
            refundDate: refund.createdAt,
            orderDate: order.createdAt,
            orderId: order.legacyResourceId,
            orderName: order.name,
            productId: null,
            productTitle: null,
            variant: null,
            sku: null,
            refundedQty: 0,
            refundAmount: 0,
            currency: ccy(order.currentTotalPriceSet),
            refundReason: reason,
            refundId: refund.id,
            financialStatus: order.displayFinancialStatus,
            fulfillmentStatus: order.displayFulfillmentStatus,
            note: '(no line item — e.g. shipping-only refund)',
          });
          continue;
        }

        for (const e of edges) {
          const li = e.node;
          const variant = li.lineItem.variant;
          const product = variant && variant.product;
          rows.push({
            refundDate: refund.createdAt,
            orderDate: order.createdAt,
            orderId: order.legacyResourceId,
            orderName: order.name,
            productId: product ? product.legacyResourceId : null,
            productTitle: product ? product.title : li.lineItem.title,
            variant: variant ? variant.title : null,
            sku: li.lineItem.sku || null,
            refundedQty: li.quantity,
            refundAmount: amt(li.subtotalSet),
            currency: ccy(li.subtotalSet) || ccy(order.currentTotalPriceSet),
            refundReason: reason,
            refundId: refund.id,
            financialStatus: order.displayFinancialStatus,
            fulfillmentStatus: order.displayFulfillmentStatus,
          });
        }
      }
    }
    return rows;
  }

  async function buildReport() {
    const now = new Date();
    const windowEndMs = now.getTime();
    const windowStart = new Date(now);
    windowStart.setUTCDate(windowStart.getUTCDate() - WINDOW_DAYS);
    const windowStartMs = windowStart.getTime();
    // Fetch window is intentionally wider than the refund window (order
    // could be updated for reasons other than the refund itself, so we
    // over-fetch on updated_at and precisely filter on refund.createdAt).
    const sinceISO = windowStart.toISOString().slice(0, 10);

    const orders = await fetchOrdersWithRefunds(sinceISO);
    const rows = buildRows(orders, windowStartMs, windowEndMs).sort((a, b) => new Date(b.refundDate) - new Date(a.refundDate));

    const refundIds = new Set(rows.map(r => r.refundId));
    const orderIds = new Set(rows.map(r => r.orderId));
    const totalQty = rows.reduce((s, r) => s + r.refundedQty, 0);
    const totalAmount = round2(rows.reduce((s, r) => s + r.refundAmount, 0));

    const productAgg = new Map();
    for (const r of rows) {
      if (!r.productId) continue;
      if (!productAgg.has(r.productId)) {
        productAgg.set(r.productId, { productId: r.productId, productTitle: r.productTitle, sku: r.sku, qty: 0, amount: 0, refundIds: new Set(), orderIds: new Set(), reasons: {} });
      }
      const p = productAgg.get(r.productId);
      p.qty += r.refundedQty;
      p.amount = round2(p.amount + r.refundAmount);
      p.refundIds.add(r.refundId);
      p.orderIds.add(r.orderId);
      p.reasons[r.refundReason] = (p.reasons[r.refundReason] || 0) + 1;
    }
    const productSummary = Array.from(productAgg.values()).map(p => ({
      productId: p.productId,
      productTitle: p.productTitle,
      sku: p.sku,
      refundedQty: p.qty,
      refundAmount: p.amount,
      refundCount: p.refundIds.size,
      ordersAffected: p.orderIds.size,
      topReason: Object.entries(p.reasons).sort((a, b) => b[1] - a[1])[0][0],
    })).sort((a, b) => b.refundedQty - a.refundedQty);

    const reasonAgg = new Map();
    for (const r of rows) {
      if (!reasonAgg.has(r.refundReason)) reasonAgg.set(r.refundReason, { reason: r.refundReason, count: 0, orderIds: new Set(), qty: 0, amount: 0 });
      const g = reasonAgg.get(r.refundReason);
      g.count++;
      g.orderIds.add(r.orderId);
      g.qty += r.refundedQty;
      g.amount = round2(g.amount + r.refundAmount);
    }
    const reasonSummary = Array.from(reasonAgg.values()).map(g => ({
      reason: g.reason,
      refunds: g.count,
      orders: g.orderIds.size,
      qty: g.qty,
      amount: g.amount,
      pct: rows.length ? round2((g.count / rows.length) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    return {
      rows,
      summary: {
        totalRefunds: refundIds.size,
        refundedOrders: orderIds.size,
        refundedLineItems: rows.filter(r => r.productId).length,
        refundedQty: totalQty,
        totalRefundAmount: totalAmount,
        averageRefundAmount: refundIds.size ? round2(totalAmount / refundIds.size) : 0,
        mostRefundedProduct: productSummary.length ? productSummary[0].productTitle : null,
        topRefundReason: reasonSummary.length ? reasonSummary[0].reason : null,
      },
      productSummary,
      reasonSummary,
      meta: {
        ordersScanned: orders.length,
        currency: rows.length ? rows[0].currency : null,
      },
    };
  }

  async function mugunthaUkRefundsHandler(req, res) {
    try {
      const force = req.query && req.query.refresh === '1';
      if (!force && CACHE && (Date.now() - CACHE.at) < CACHE_TTL_MS) {
        return res.status(200).json(CACHE.payload);
      }
      // Static snapshot fallback (same pattern as Mahima Req5b) — a full
      // live 60-day Shopify UK refund scan takes minutes, too slow for a
      // normal page load. Default loads serve this committed snapshot
      // instantly; the user's Refresh button (?refresh=1) does the live fetch.
      if (!force) {
        try {
          const fs = require('fs');
          const path = require('path');
          const staticPath = path.join(__dirname, 'data', 'muguntha-uk-refunds-snapshot.json');
          const snapshot = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
          snapshot.isSnapshot = true;
          return res.status(200).json(snapshot);
        } catch (e) {
          // No snapshot on disk yet — fall through to a live fetch.
        }
      }
      if (!TOKEN) {
        return res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' });
      }
      const now = new Date();
      const start = new Date(now); start.setUTCDate(start.getUTCDate() - WINDOW_DAYS);
      const report = await buildReport();
      const payload = {
        success: true,
        generatedAt: now.toISOString(),
        dateRange: { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10), days: WINDOW_DAYS },
        store: 'Shopify UK (ledsone.myshopify.com)',
        grain: 'One row = one refund x one refunded line item (refunds with no line item, e.g. shipping-only, get one summary row)',
        rows: report.rows,
        summary: report.summary,
        productSummary: report.productSummary,
        reasonSummary: report.reasonSummary,
        meta: report.meta,
      };
      CACHE = { at: Date.now(), payload };
      res.status(200).json(payload);
    } catch (err) {
      console.error('[muguntha/uk-refunds] error:', err && err.message);
      res.status(500).json({ success: false, error: err.message || 'Unknown error' });
    }
  }

  return { mugunthaUkRefundsHandler };
})();

module.exports = async (req, res) => {
  const fn = ((req.query && req.query.fn) || '').toString().toLowerCase();
  if (fn === 'jefri-req5') return jefriReq5HandlerModule(req, res);
  if (fn === 'jefri-req7') return jefriReq7HandlerModule(req, res);
  if (fn === 'jefri-req8-orders') return jefriReq8HandlerModule.handleJefriReq8Orders(req, res);
  if (fn === 'jefri-req6-list') return jefriReq6HandlerModule.handleJefriReq6List(req, res);
  if (fn === 'jefri-req6-add') return jefriReq6HandlerModule.handleJefriReq6Add(req, res);
  if (fn === 'jefri-req6-delete') return jefriReq6HandlerModule.handleJefriReq6Delete(req, res);
  if (fn === 'jefri-req4-mapping') return jefriReq4MappingHandlerModule(req, res);
  if (fn === 'sukirtha-r6') return sukirthaR6HandlerModule(req, res);
  if (fn === 'thasitha-order-lookup') return thasithaOrderLookupModule(req, res);
  if (fn === 'thasitha-req1') return thasithaReq1HandlerModule(req, res);
  if (fn === 'thasitha-req2') return thasithaReq2HandlerModule(req, res);
  if (fn === 'thasitha-req3') return thasithaReq3HandlerModule(req, res);
  if (fn === 'thasitha-req6') return thasithaReq6HandlerModule(req, res);
  if (fn === 'thasitha-req7') return thasithaReq7HandlerModule(req, res);
  if (fn === 'jefri-product-status') return jefriProductStatusHandlerModule(req, res);
  if (fn === 'mahima-req1') return jefriProductStatusHandlerModule.mahimaReq1Handler(req, res);
  if (fn === 'mahima-req2') return jefriProductStatusHandlerModule.mahimaReq2Handler(req, res);
  if (fn === 'mahima-req5') return jefriProductStatusHandlerModule.mahimaReq5Handler(req, res);
  if (fn === 'mahima-req5b') return mahimaReq5bHandlerModule.mahimaReq5bHandler(req, res);
  if (fn === 'muguntha-uk-refunds') return mugunthaUkRefundsHandlerModule.mugunthaUkRefundsHandler(req, res);
  if (fn === 'jefri-req3') return jefriProductStatusHandlerModule.jefriReq3Handler(req, res);
  if (fn === 'jefri-search-terms') return jefriSearchTermsHandlerModule(req, res);
  if (fn === 'mahima-search-terms') return mahimaSearchTermsHandlerModule(req, res);

  // REQ-DM-2026-08-MAHI01 — Mahima "Search Term -> Product Mapping" (STPM).
  //
  // Thin routing only: every behaviour lives in lib/stpm/. Helpers are under
  // root-level lib/ rather than api/lib/ because Vercel turns EVERY file under
  // api/ into its own Serverless Function and this project already deploys
  // exactly 12 — the Hobby-plan ceiling. lib/ is traced into this function
  // instead, so no new function is created.
  //
  // Distinct from `mahima-search-terms` above, which is an older account-wide
  // 30-day report with its own thresholds. These routes are group-scoped
  // (campaigns.group_name = 'Mahima') and implement the approved requirement.
  // The two are deliberately NOT merged.
  if (typeof fn === 'string' && fn.startsWith('mahima-stpm-')) {
    return require('../lib/stpm/router').handle(req, res, fn);
  }

  if (fn === 'check-urls') return checkUrlsHandlerModule(req, res);
  if (fn === 'kamsi-live') return kamsiLiveHandlerModule(req, res);
  if (fn === 'req2-req3') return req2Req3HandlerModule(req, res);
  if (fn === 'req4-ga4-seo') return req4HandlerModule(req, res);
  if (fn === 'dilaksi-req2-live') return req4HandlerModule.handleDilaksiReq2Live(req, res);
  if (fn === 'dilaksi-ai-chat') return req4HandlerModule.handleDilaksiAiChat(req, res);
  if (fn === 'dilaksi-chat-history') return handleDilaksiChatHistory(req, res);
  if (fn === 'dilaksi-chat-save') return handleDilaksiChatSave(req, res);

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
