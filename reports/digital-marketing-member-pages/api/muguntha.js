// api/muguntha.js — Management Employee Performance dashboard (muguntha.html)
// Currently scoped to Sonya only. Read-only PostgreSQL (SELECT only), reuses
// the same getPool() connection pattern as api/requirement.js (DATABASE_URL /
// PGHOST env vars, no new credential). Supplies ONLY the ADS Cost by month —
// Sales/Net/ROAS come from the existing Shopify-backed endpoints
// (api/sales25.js and api/salesuk.js, group=sonya) which muguntha.html calls
// directly per month, exactly like every other staff dashboard already does.
//
// Snapshot method (added 2026-08-04, mirrors salesuk.js/sales25.js): closed
// months are served from a static JSON file in api/data/ instead of hitting
// Postgres on every page load — same static-snapshot fast path pattern used
// everywhere else in this project. Files are generated offline via
// `node api/scripts/generate-snapshots.js muguntha [months...]` and committed
// to git; `?refresh=1` always bypasses the snapshot and queries live.

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { SONYA_PRODUCT_IDS_UK } = require('./salesuk.js');

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
      statement_timeout: 20000,
      max: 3,
    });
  }
  return pool;
}

// Scoped to the LEDSone Google Ads account's "Sonya" campaign group
// (google_ads.campaigns.group_name = 'Sonya', account_id 4503486236 —
// matches the "Campaign group: Sonya" filter in the Google Ads UI).
// IMPORTANT: campaign_name ILIKE '%sonya%' alone is NOT safe — a completely
// unrelated Google Ads account ("Vintagelite", account_id 3278683670) also
// has an internal group named "Sonya" (different campaigns, e.g. "Suki |
// PMax..."), which inflated Jan-2025 cost from the true £422.23 to
// £675.66 when both accounts were summed together (caught 2026-08-04 by
// cross-checking against the Google Ads UI screenshot for Jan 1-31, 2025).
const LEDSONE_ACCOUNT_ID = 4503486236;
const SOURCE_LABEL = `google_ads.campaign_performance JOIN google_ads.campaigns WHERE group_name='Sonya' AND account_id=${LEDSONE_ACCOUNT_ID} (LEDSone account only)`;
const COST_QUERY = `
  SELECT SUM(cp.cost) AS cost
  FROM google_ads.campaign_performance cp
  JOIN google_ads.campaigns c ON c.campaign_id = cp.campaign_id
  WHERE c.group_name = 'Sonya' AND c.account_id = ${LEDSONE_ACCOUNT_ID}
    AND to_char(cp.date, 'YYYY-MM') = $1
`;

// DM campaign (added 2026-08-04): "Pmax UK | Muguntha | Shoptimised | GB |
// DM 46 All | MCV | UK" — the campaign behind salesuk.js's/sales25.js's
// 'shop_dm_pmax-46*' UTM group. Sales attribution already routes any DM-ad
// order containing one of Sonya's owned products to her Sonya tab (see
// orderHasSonyaProduct() + isDmAdCampaign() in salesuk.js), so her share of
// this campaign's spend belongs in her cost too — not the full campaign,
// and not zero.
const DM_CAMPAIGN_ID = '20810136438';
const DM_SOURCE_LABEL = `google_ads.product_performance WHERE campaign_id=${DM_CAMPAIGN_ID} (DM 46 campaign), filtered to Sonya's owned product IDs (same list salesuk.js uses for sales attribution)`;
const DM_TOTAL_SOURCE_LABEL = `google_ads.campaign_performance WHERE campaign_id=${DM_CAMPAIGN_ID} (full DM 46 campaign spend, all products/traffic — shown for context only)`;

// product_item_id format is "shopify_gb_{productId}_{variantId}" — split_part
// index 3 pulls out {productId} to match against Sonya's Shopify product IDs.
const DM_SONYA_PRODUCT_COST_QUERY = `
  SELECT COALESCE(SUM(pp.cost), 0) AS cost
  FROM google_ads.product_performance pp
  WHERE pp.campaign_id = ${DM_CAMPAIGN_ID}
    AND split_part(pp.product_item_id, '_', 3) = ANY($1::text[])
    AND to_char(pp.date, 'YYYY-MM') = $2
`;

// Full DM campaign spend (all products + any unattributed "other" traffic
// PMax doesn't break out at product level) — shown as a separate, visible
// context column so the DM campaign's total cost is never hidden, even
// though only Sonya's product-share of it feeds her Total Cost/Net/ROAS.
const DM_TOTAL_COST_QUERY = `
  SELECT COALESCE(SUM(cp.cost), 0) AS cost
  FROM google_ads.campaign_performance cp
  WHERE cp.campaign_id = ${DM_CAMPAIGN_ID}
    AND to_char(cp.date, 'YYYY-MM') = $1
`;

// 2026-08 is the current live month (never snapshotted, mirrors
// CURRENT_LIVE_MONTHS in salesuk.js) — always queried live.
const CURRENT_LIVE_MONTHS = ['2026-08'];

async function queryCostForMonth(month) {
  const client = await getPool().connect();
  try {
    const result = await client.query(COST_QUERY, [month]);
    const cost = result.rows[0] && result.rows[0].cost != null ? Number(result.rows[0].cost) : 0;
    return Math.round(cost * 100) / 100;
  } finally {
    client.release();
  }
}

async function queryDmCostsForMonth(month) {
  const client = await getPool().connect();
  try {
    const sonyaIds = Array.from(SONYA_PRODUCT_IDS_UK);
    const [sonyaShareResult, dmTotalResult] = await Promise.all([
      client.query(DM_SONYA_PRODUCT_COST_QUERY, [sonyaIds, month]),
      client.query(DM_TOTAL_COST_QUERY, [month]),
    ]);
    const dmSonyaProductCost = Math.round(Number(sonyaShareResult.rows[0].cost) * 100) / 100;
    const dmTotalCost = Math.round(Number(dmTotalResult.rows[0].cost) * 100) / 100;
    return { dmSonyaProductCost, dmTotalCost };
  } finally {
    client.release();
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const month = req.query && req.query.month ? String(req.query.month) : '';
  const forceRefresh = req.query && req.query.refresh === '1';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ success: false, error: 'Provide ?month=YYYY-MM' });
    return;
  }

  const isLive = CURRENT_LIVE_MONTHS.includes(month);
  if (!forceRefresh && !isLive) {
    const staticPath = path.join(__dirname, 'data', `muguntha-sonya-${month}.json`);
    if (fs.existsSync(staticPath)) {
      const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
      // Snapshots written before the DM-cost fields were added (2026-08-04)
      // don't have them — fall through to a live query rather than serving
      // an incomplete row.
      if (staticData.dmSonyaProductCost != null && staticData.dmTotalCost != null) {
        res.status(200).json({ ...staticData, meta: { ...(staticData.meta || {}), cacheStatus: 'static-snapshot' } });
        return;
      }
    }
  }

  try {
    const [cost, dmCosts] = await Promise.all([
      queryCostForMonth(month),
      queryDmCostsForMonth(month),
    ]);
    const totalCost = Math.round((cost + dmCosts.dmSonyaProductCost) * 100) / 100;
    res.status(200).json({
      success: true,
      employee: 'sonya',
      month,
      cost,
      dmSonyaProductCost: dmCosts.dmSonyaProductCost,
      dmTotalCost: dmCosts.dmTotalCost,
      totalCost,
      source: SOURCE_LABEL,
      dmSource: DM_SOURCE_LABEL,
      dmTotalSource: DM_TOTAL_SOURCE_LABEL,
      meta: { cacheStatus: 'live', generatedAt: new Date().toISOString() },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
