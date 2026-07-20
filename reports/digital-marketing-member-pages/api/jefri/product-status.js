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
//   listings.shopify_listings       — sku, price, main_image_url, listing_url, quantity, channel='LEDSone DE'
//   listings.shopify_listings_parent_child_mapping — resolves parent-level item IDs to a representative child variant
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

const ACCOUNT_ID = 9031058245; // google_ads.accounts.account_id for "ledsone.de"
const CHANNEL = 'LEDSone DE';   // listings.shopify_listings.channel for the DE store

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const QUERY = `
WITH latest AS (
  SELECT MAX(pp.date) AS max_date
  FROM google_ads.product_performance pp
  JOIN google_ads.campaigns c ON c.campaign_id = pp.campaign_id
  WHERE c.account_id = $1
),
range AS (
  SELECT
    COALESCE($2::date, (SELECT max_date FROM latest) - INTERVAL '89 days')::date AS start_date,
    COALESCE($3::date, (SELECT max_date FROM latest))::date AS end_date
),
perf AS (
  SELECT pp.product_item_id,
    SUM(pp.impressions) AS impressions,
    SUM(pp.clicks) AS clicks,
    SUM(pp.conversion_value) AS conv_value,
    SUM(pp.cost) AS cost
  FROM google_ads.product_performance pp
  JOIN google_ads.campaigns c ON c.campaign_id = pp.campaign_id
  CROSS JOIN range r
  WHERE c.account_id = $1
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
  WHERE agp.campaign_id IN (SELECT campaign_id FROM google_ads.campaigns WHERE account_id = $1)
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
    COALESCE(sl.quantity, child_sl.quantity) AS stock
  FROM listings.shopify_listings sl
  LEFT JOIN child_fallback cf ON cf.parent_listing_id = sl.id
  LEFT JOIN listings.shopify_listings child_sl ON child_sl.id = cf.child_listing_id
  WHERE sl.channel = $4
)
SELECT
  p.product_item_id,
  rl.sku,
  rl.url,
  rl.image,
  rl.price,
  s.status,
  rl.stock,
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

    const result = await client.query(QUERY, [ACCOUNT_ID, from, to, CHANNEL]);
    const rows = result.rows;

    let rangeStart = null, rangeEnd = null;
    const products = rows.map((r) => {
      rangeStart = r.range_start;
      rangeEnd = r.range_end;
      const roas = computeRoas(r.conv_value, r.cost);
      const tag = computeTag(r.impressions, r.clicks, roas, r.cost, r.conv_value);
      return {
        productId: r.product_item_id,
        sku: r.sku || null,
        url: r.url || null,
        image: r.image || null,
        price: r.price !== null ? Number(r.price) : null,
        status: normalizeStatus(r.status),
        stock: r.stock !== null ? Number(r.stock) : null,
        impressions: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
        convValue: Number(r.conv_value) || 0,
        cost: Number(r.cost) || 0,
        roas: (roas === null || roas === Infinity) ? null : Math.round(roas),
        roasUnavailable: roas === null,
        roasAnomaly: roas === Infinity,
        tagKey: tag.key,
        tag: tag.label,
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
