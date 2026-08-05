// api/muguntha.js — Management Employee Performance dashboard (muguntha.html)
// Handles Sonya and Sajeepan (?employee=sonya|sajeepan, default sonya for
// backward compatibility). Read-only PostgreSQL (SELECT only), reuses
// the same getPool() connection pattern as api/requirement.js (DATABASE_URL /
// PGHOST env vars, no new credential). Supplies ONLY the ADS Cost by month —
// Sales/Net/ROAS come from the existing Shopify-backed endpoints
// (api/sales25.js and api/salesuk.js, group=<employee>) which muguntha.html
// calls directly per month, exactly like every other staff dashboard already
// does.
//
// Snapshot method (added 2026-08-04, mirrors salesuk.js/sales25.js): closed
// months are served from a static JSON file in api/data/ instead of hitting
// Postgres on every page load — same static-snapshot fast path pattern used
// everywhere else in this project. Files are generated offline and committed
// to git; `?refresh=1` always bypasses the snapshot and queries live.
//
// Sajeepan support added 2026-08-04: same formula as Sonya (own campaign-group
// cost + product-share of the shared "DM 46" campaign), just a different
// Google Ads group_name ('SAJEEPAN', all caps — confirmed via
// `SELECT DISTINCT group_name FROM google_ads.campaigns WHERE account_id=4503486236`)
// and a different owned-product-ID Set (SAJEEPAN_PRODUCT_IDS_UK from salesuk.js).

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { SONYA_PRODUCT_IDS_UK, SAJEEPAN_PRODUCT_IDS_UK } = require('./salesuk.js');

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

// Scoped to the LEDSone Google Ads account's per-employee campaign group
// (google_ads.campaigns.group_name, account_id 4503486236 — matches the
// "Campaign group" filter in the Google Ads UI).
// IMPORTANT: campaign_name ILIKE '%<name>%' alone is NOT safe — a completely
// unrelated Google Ads account ("Vintagelite", account_id 3278683670) also
// has an internal group named "Sonya" (different campaigns, e.g. "Suki |
// PMax..."), which inflated Jan-2025 cost from the true £422.23 to
// £675.66 when both accounts were summed together (caught 2026-08-04 by
// cross-checking against the Google Ads UI screenshot for Jan 1-31, 2025).
// Always filter by account_id as well as group_name.
const LEDSONE_ACCOUNT_ID = 4503486236;

// DM campaign (added 2026-08-04): "Pmax UK | Muguntha | Shoptimised | GB |
// DM 46 All | MCV | UK" — the campaign behind salesuk.js's/sales25.js's
// 'shop_dm_pmax-46*' UTM group. Sales attribution already routes any DM-ad
// order containing one of an employee's owned products to their tab (see
// orderHasSonyaProduct()/orderHasSajeepanProduct() in salesuk.js), so their
// share of this campaign's spend belongs in their cost too — not the full
// campaign, and not zero.
const DM_CAMPAIGN_ID = '20810136438';

const EMPLOYEES = {
  sonya: {
    groupName: 'Sonya',
    productIds: SONYA_PRODUCT_IDS_UK,
    snapshotSlug: 'sonya',
  },
  sajeepan: {
    groupName: 'SAJEEPAN',
    productIds: SAJEEPAN_PRODUCT_IDS_UK,
    snapshotSlug: 'sajeepan',
  },
  // Kamsi is SEO/Organic (department "Organic (product-scoped)" in
  // salesuk.js/sales25.js's attribution rules), not a paid-ads role like
  // Sonya/Sajeepan — confirmed no Google Ads campaign group exists for her
  // in this account (`SELECT DISTINCT group_name FROM google_ads.campaigns
  // WHERE account_id=4503486236` never returns "Kamsi"), and her Sales
  // attribution rule never routes an order to her via the DM 46 campaign
  // (only organic/pure-direct channels). groupName '' and an empty
  // productIds Set make both queries below naturally return £0 — no special
  // zero-cost branch needed, the existing SQL just matches nothing. Added
  // 2026-08-05 per explicit user choice (keep the same table shape as
  // Sonya/Sajeepan rather than a Sales-only panel).
  kamsi: {
    groupName: '',
    productIds: new Set(),
    snapshotSlug: 'kamsi',
  },
  // Jefri runs Google Ads on the DE store (ledsone.de), a completely
  // separate Google Ads account (9031058245) from Sonya/Sajeepan/Kamsi's UK
  // account (4503486236) — same 5 named campaigns already used on
  // jefri.html's Product Status/Req3 tabs (see JEFRI_CAMPAIGN_IDS in
  // requirement.js). No group_name lookup (his campaigns aren't tagged with
  // one) and no DM-46-style shared-campaign product-share concept — that's
  // a UK-account-only construct, doesn't apply here. Added 2026-08-05.
  jefri: {
    isJefri: true,
    campaignIds: ['23141810147', '23411228109', '22539594891', '23473840779', '23340277562'],
    accountId: 9031058245,
    productIds: new Set(),
    snapshotSlug: 'jefri',
  },
};

function buildSourceLabels(cfg) {
  if (cfg.isJefri) {
    return {
      source: `google_ads.campaign_performance WHERE campaign_id IN (${cfg.campaignIds.join(',')}) (Jefri's 5 named DE campaigns, account_id=${cfg.accountId})`,
      dmSource: 'not applicable — the DM 46 shared-campaign product-share concept is a UK-account-only construct',
      dmTotalSource: 'not applicable',
    };
  }
  return {
    source: `google_ads.campaign_performance JOIN google_ads.campaigns WHERE group_name='${cfg.groupName}' AND account_id=${LEDSONE_ACCOUNT_ID} (LEDSone account only)`,
    dmSource: `google_ads.product_performance WHERE campaign_id=${DM_CAMPAIGN_ID} (DM 46 campaign), filtered to ${cfg.groupName}'s owned product IDs (same list salesuk.js uses for sales attribution)`,
    dmTotalSource: `google_ads.campaign_performance WHERE campaign_id=${DM_CAMPAIGN_ID} (full DM 46 campaign spend, all products/traffic — shown for context only)`,
  };
}

// product_item_id format is "shopify_gb_{productId}_{variantId}". Filtering
// used to run split_part(product_item_id,'_',3) = ANY($1::text[]) AND
// to_char(date,'YYYY-MM') = $2 directly in SQL — both wrap the columns in
// functions, so Postgres couldn't use any index and fell back to a parallel
// seq scan of the full 10M+ row table (~1.3s, and scaling with the size of
// the employee's product-ID list — this is what caused the "statement
// timeout" / "timeout exceeded when trying to connect" errors on the Sonya
// and Kamsi tabs, 2026-08-05). Fixed by filtering campaign_id + a plain date
// range in SQL (uses product_performance_date_campaign_adgroup_product_unique,
// confirmed via EXPLAIN ANALYZE: 1287ms -> 52ms), then doing the
// per-product-ID match in JS on the much smaller (~13k row) result set.
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const endY = m === 12 ? y + 1 : y;
  const endM = m === 12 ? 1 : m + 1;
  const end = `${endY}-${String(endM).padStart(2, '0')}-01`;
  return { start, end };
}

const DM_PRODUCT_ROWS_QUERY = `
  SELECT pp.product_item_id, pp.cost
  FROM google_ads.product_performance pp
  WHERE pp.campaign_id = ${DM_CAMPAIGN_ID}
    AND pp.date >= $1 AND pp.date < $2
`;

// Full DM campaign spend (all products + any unattributed "other" traffic
// PMax doesn't break out at product level) — shown as a separate, visible
// context column so the DM campaign's total cost is never hidden, even
// though only the employee's product-share of it feeds their Total Cost/Net/ROAS.
const DM_TOTAL_COST_QUERY = `
  SELECT COALESCE(SUM(cp.cost), 0) AS cost
  FROM google_ads.campaign_performance cp
  WHERE cp.campaign_id = ${DM_CAMPAIGN_ID}
    AND cp.date >= $1 AND cp.date < $2
`;

function ownCostQuery(groupName) {
  return `
    SELECT SUM(cp.cost) AS cost
    FROM google_ads.campaign_performance cp
    JOIN google_ads.campaigns c ON c.campaign_id = cp.campaign_id
    WHERE c.group_name = '${groupName}' AND c.account_id = ${LEDSONE_ACCOUNT_ID}
      AND cp.date >= $1 AND cp.date < $2
  `;
}

// Jefri's campaigns are given directly by ID (no group_name tag), so no
// join against google_ads.campaigns is needed.
function ownCostQueryByCampaignIds(campaignIds) {
  return `
    SELECT SUM(cp.cost) AS cost
    FROM google_ads.campaign_performance cp
    WHERE cp.campaign_id = ANY($3::bigint[])
      AND cp.date >= $1 AND cp.date < $2
  `;
}

// 2026-08 is the current live month (never snapshotted, mirrors
// CURRENT_LIVE_MONTHS in salesuk.js) — always queried live.
const CURRENT_LIVE_MONTHS = ['2026-08'];

async function queryCostForMonth(cfg, month) {
  const { start, end } = monthRange(month);
  const client = await getPool().connect();
  try {
    const result = cfg.isJefri
      ? await client.query(ownCostQueryByCampaignIds(cfg.campaignIds), [start, end, cfg.campaignIds])
      : await client.query(ownCostQuery(cfg.groupName), [start, end]);
    const cost = result.rows[0] && result.rows[0].cost != null ? Number(result.rows[0].cost) : 0;
    return Math.round(cost * 100) / 100;
  } finally {
    client.release();
  }
}

async function queryDmCostsForMonth(productIds, month) {
  const { start, end } = monthRange(month);
  const client = await getPool().connect();
  try {
    const [rowsResult, dmTotalResult] = await Promise.all([
      client.query(DM_PRODUCT_ROWS_QUERY, [start, end]),
      client.query(DM_TOTAL_COST_QUERY, [start, end]),
    ]);
    let dmProductCost = 0;
    if (productIds.size > 0) {
      for (const row of rowsResult.rows) {
        const productId = String(row.product_item_id).split('_')[2];
        if (productIds.has(productId)) dmProductCost += Number(row.cost);
      }
    }
    dmProductCost = Math.round(dmProductCost * 100) / 100;
    const dmTotalCost = Math.round(Number(dmTotalResult.rows[0].cost) * 100) / 100;
    return { dmProductCost, dmTotalCost };
  } finally {
    client.release();
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const month = req.query && req.query.month ? String(req.query.month) : '';
  const forceRefresh = req.query && req.query.refresh === '1';
  const employeeKey = req.query && req.query.employee ? String(req.query.employee).toLowerCase() : 'sonya';
  const cfg = EMPLOYEES[employeeKey];
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ success: false, error: 'Provide ?month=YYYY-MM' });
    return;
  }
  if (!cfg) {
    res.status(400).json({ success: false, error: `Unknown employee "${employeeKey}"` });
    return;
  }

  const labels = buildSourceLabels(cfg);
  const isLive = CURRENT_LIVE_MONTHS.includes(month);
  if (!forceRefresh && !isLive) {
    const staticPath = path.join(__dirname, 'data', `muguntha-${cfg.snapshotSlug}-${month}.json`);
    if (fs.existsSync(staticPath)) {
      const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
      // Snapshots written before the DM-cost fields were added (2026-08-04)
      // don't have them — fall through to a live query rather than serving
      // an incomplete row. Support both the legacy Sonya field name
      // (dmSonyaProductCost) and the generic one (dmProductCost).
      const dmCost = staticData.dmProductCost != null ? staticData.dmProductCost : staticData.dmSonyaProductCost;
      if (dmCost != null && staticData.dmTotalCost != null) {
        res.status(200).json({ ...staticData, meta: { ...(staticData.meta || {}), cacheStatus: 'static-snapshot' } });
        return;
      }
    }
  }

  try {
    const [cost, dmCosts] = await Promise.all([
      queryCostForMonth(cfg, month),
      cfg.isJefri ? Promise.resolve({ dmProductCost: 0, dmTotalCost: 0 }) : queryDmCostsForMonth(cfg.productIds, month),
    ]);
    const totalCost = Math.round((cost + dmCosts.dmProductCost) * 100) / 100;
    res.status(200).json({
      success: true,
      employee: employeeKey,
      month,
      cost,
      // dmSonyaProductCost kept for backward compatibility with existing
      // Sonya snapshot files / any cached clients; dmProductCost is the
      // generic name new code (and Sajeepan) should read.
      dmSonyaProductCost: employeeKey === 'sonya' ? dmCosts.dmProductCost : undefined,
      dmProductCost: dmCosts.dmProductCost,
      dmTotalCost: dmCosts.dmTotalCost,
      totalCost,
      source: labels.source,
      dmSource: labels.dmSource,
      dmTotalSource: labels.dmTotalSource,
      meta: { cacheStatus: 'live', generatedAt: new Date().toISOString() },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
