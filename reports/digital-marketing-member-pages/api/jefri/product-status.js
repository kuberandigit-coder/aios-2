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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

    res.status(200).json({
      generatedAt: new Date().toISOString(),
      dateRange: { start: rangeStart, end: rangeEnd },
      campaignList: JEFRI_CAMPAIGNS,
      selectedCampaign: campaignIds.length === 1 ? campaignIds[0] : 'all',
      stockSourceError,
      summary,
      products,
    });
  } catch (err) {
    console.error('[jefri/product-status] Query failed:', err && err.message);
    res.status(500).json({ error: 'Could not load product status data. Please try again shortly.' });
  } finally {
    client.release();
  }
};
