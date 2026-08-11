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
    hasDm: true,
  },
  sajeepan: {
    groupName: 'SAJEEPAN',
    productIds: SAJEEPAN_PRODUCT_IDS_UK,
    snapshotSlug: 'sajeepan',
    hasDm: true,
  },
  // Kamsi is SEO/Organic (department "Organic (product-scoped)" in
  // salesuk.js/sales25.js's attribution rules), not a paid-ads role like
  // Sonya/Sajeepan — confirmed no Google Ads campaign group exists for her
  // in this account (`SELECT DISTINCT group_name FROM google_ads.campaigns
  // WHERE account_id=4503486236` never returns "Kamsi"), and her Sales
  // attribution rule never routes an order to her via the DM 46 campaign
  // (only organic/pure-direct channels). groupName '' and an empty
  // productIds Set make both ad-spend queries naturally return £0 — no
  // special zero-cost branch needed, the existing SQL just matches nothing.
  // Added 2026-08-05 per explicit user choice (keep the same table shape as
  // Sonya/Sajeepan rather than a Sales-only panel).
  //
  // SEO tool cost added 2026-08-05, confirmed split:
  // 2025 — Semrush £265.62/month total, split 50% ledsone.de / 50% ledsone
  // UK. The UK 50% share (£132.81/mo) is split between the UK SEO staff who
  // actually existed that month: 3-way (Kamsi/Dilaksi/Sukirtha) Jan-Oct 2025
  // = £44.27/mo each, then 4-way (adding Hetheesha) Nov-Dec 2025 = £33.20/mo
  // each — Hetheesha joined the split from November. Sukirtha and
  // Hetheesha's own cost rows are NOT added to this dashboard yet (held per
  // explicit instruction — no muguntha.html panel for them yet); only
  // Kamsi's and Dilaksi's shares are reflected here, using the correct
  // 3-way/4-way per-person amount even though the other two aren't shown.
  // 2026 — Semrush + Arrow AI combined £149/month total, split 40% UK /
  // 40% DE / 20% FR; the UK 40% share (£59.60/mo) is split evenly between
  // Kamsi and Dilaksi only (unchanged, not part of the above correction) —
  // £29.80/mo each.
  kamsi: {
    groupName: '',
    productIds: new Set(),
    snapshotSlug: 'kamsi',
    hasDm: false,
    toolCost: { uk2025Share3: 44.27, uk2025Share4: 33.20, uk2026Share2: 29.80 },
  },
  // Dilaksi is also SEO/Organic (product-scoped), same as Kamsi — confirmed
  // no "Dilaksi" group_name exists in google_ads.campaigns for this account
  // (SELECT DISTINCT group_name ... returns DM/DUSHAN/MD Task/O.M/SAJEEPAN/
  // Sonya/Susain/Thanishtika/Tharshan/Theekshi/null — no Dilaksi), and her
  // Sales attribution (salesuk.js/sales25.js) only routes orders to her via
  // organic/pure-direct channels, never the paid DM 46 campaign. Added
  // 2026-08-05, same reasoning as Kamsi — including the SEO tool cost split
  // (see Kamsi's comment above for the full breakdown).
  dilaksi: {
    groupName: '',
    productIds: new Set(),
    snapshotSlug: 'dilaksi',
    hasDm: false,
    toolCost: { uk2025Share3: 44.27, uk2025Share4: 33.20, uk2026Share2: 29.80 },
  },
  // Jefri runs Google Ads on the DE store (ledsone.de), a completely
  // separate Google Ads account (9031058245) from Sonya/Sajeepan/Kamsi's UK
  // account (4503486236). No DM-46-style shared-campaign product-share
  // concept applies here — that's a UK-account-only construct.
  //
  // FIXED 2026-08-05: was previously scoped to only 5 hardcoded campaign IDs
  // (the ones used on jefri.html's Product Status/Req3 tabs), which silently
  // showed £0.00 cost for Jan-Apr 2025 — those 5 campaigns didn't exist yet
  // that early. Confirmed via Google Ads UI: his actual "Jefri" campaign
  // group (Campaign group filter) has 61 campaigns, and
  // `google_ads.campaigns WHERE group_name='Jefri' AND account_id=9031058245`
  // matches all 61 — same group_name-tagging pattern already used for Sonya/
  // Sajeepan, just on the DE account instead of the UK one. Verified: Jan
  // 2025 cost via this query = €1,894.73, matching the Google Ads UI's
  // "Custom Jan 1-31, 2025" campaign-group total (€1.89K) exactly.
  jefri: {
    isJefri: true,
    groupName: 'Jefri',
    accountId: 9031058245,
    productIds: new Set(),
    snapshotSlug: 'jefri',
  },
  // Thasitha runs Google Ads on the same DE store/account as Jefri
  // (9031058245), group_name='Thasi' (same 3 campaigns used on thasitha.html's
  // Requirement tabs, confirmed via google_ads.campaigns). Added 2026-08-11.
  // No 2025 data — her first campaign started 2026-04-20 — so muguntha.html's
  // frontend only ever requests May-2026-onward months for her (a separate
  // code path from the shared 2025-vs-2026 loadAll(), see loadThasitha()).
  thasitha: {
    isJefri: true,
    groupName: 'Thasi',
    accountId: 9031058245,
    productIds: new Set(),
    snapshotSlug: 'thasitha',
  },
};

function buildSourceLabels(cfg) {
  if (cfg.isJefri) {
    // "isJefri" is a generic "DE account, no DM-46 concept" flag, reused
    // as-is (2026-08-11) for Thasitha rather than renamed, to avoid
    // touching Jefri's already-working code path — text below is built
    // from cfg.groupName/cfg.accountId dynamically so it's accurate for
    // both, not hardcoded to Jefri specifically.
    return {
      source: `google_ads.campaign_performance JOIN google_ads.campaigns WHERE group_name='${cfg.groupName}' AND account_id=${cfg.accountId} (all of ${cfg.groupName}'s DE campaigns, current + historical — matches the "${cfg.groupName}" Campaign group filter in the Google Ads UI)`,
      dmSource: 'not applicable — the DM 46 shared-campaign product-share concept is a UK-account-only construct',
      dmTotalSource: 'not applicable',
    };
  }
  if (!cfg.hasDm) {
    const toolNote = cfg.toolCost
      ? ` Cost also includes a fixed monthly SEO tool-cost share: 2025 = Semrush £265.62/mo total, split 50% ledsone.de / 50% ledsone UK, with the UK 50% share (£132.81/mo) split 3-way between Kamsi/Dilaksi/Sukirtha Jan-Oct 2025 (£44.27/mo each) and 4-way after Hetheesha joins the split Nov-Dec 2025 (£33.20/mo each) — only Kamsi's and Dilaksi's shares are reflected on this dashboard, Sukirtha/Hetheesha have no cost row here yet; 2026 = Semrush + Arrow AI combined £149/mo total, split 40% UK / 40% DE / 20% FR, with the UK 40% share (£59.60/mo) split evenly between Kamsi and Dilaksi only (£29.80/mo each). No Google Ads spend applies (SEO/Organic role) — Cost is tool-cost share only.`
      : '';
    return {
      source: `google_ads.campaign_performance JOIN google_ads.campaigns WHERE group_name='${cfg.groupName}' AND account_id=${LEDSONE_ACCOUNT_ID} (LEDSone account only, always £0 — no ads role).${toolNote}`,
      dmSource: 'not applicable — only Sonya and Sajeepan (the LEDSone UK paid-ads staff) get a DM 46 product-share; SEO/Organic staff never receive DM-attributed sales, so no DM cost is queried or added for them',
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

// accountId defaults to the LEDSone UK account; Jefri passes his DE account
// ID explicitly (9031058245) — same group_name-tagging pattern, different
// account, since group_name isn't unique across Google Ads accounts.
function ownCostQuery(groupName, accountId) {
  return `
    SELECT SUM(cp.cost) AS cost
    FROM google_ads.campaign_performance cp
    JOIN google_ads.campaigns c ON c.campaign_id = cp.campaign_id
    WHERE c.group_name = '${groupName}' AND c.account_id = ${accountId}
      AND cp.date >= $1 AND cp.date < $2
  `;
}

// 2026-08 is the current live month (never snapshotted, mirrors
// CURRENT_LIVE_MONTHS in salesuk.js) — always queried live.
const CURRENT_LIVE_MONTHS = ['2026-08'];

// 2025 Jan-Oct = 3-way UK Semrush split (Kamsi/Dilaksi/Sukirtha); Nov-Dec =
// 4-way (Hetheesha joins). 2026 = 2-way UK Semrush+Arrow AI split
// (Kamsi/Dilaksi only). See the Kamsi config comment for the full math.
function getToolCost(cfg, month) {
  if (!cfg.toolCost) return 0;
  const year = month.slice(0, 4);
  if (year === '2025') {
    const isNovDec = month === '2025-11' || month === '2025-12';
    return isNovDec ? cfg.toolCost.uk2025Share4 : cfg.toolCost.uk2025Share3;
  }
  if (year === '2026') return cfg.toolCost.uk2026Share2 || 0;
  return 0;
}

async function queryCostForMonth(cfg, month) {
  const { start, end } = monthRange(month);
  const client = await getPool().connect();
  let adSpend;
  try {
    const result = await client.query(ownCostQuery(cfg.groupName, cfg.accountId || LEDSONE_ACCOUNT_ID), [start, end]);
    adSpend = result.rows[0] && result.rows[0].cost != null ? Number(result.rows[0].cost) : 0;
  } finally {
    client.release();
  }
  const toolCost = getToolCost(cfg, month);
  return Math.round((adSpend + toolCost) * 100) / 100;
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
      // Only Sonya/Sajeepan get a DM 46 product-share — Kamsi/Dilaksi are
      // SEO/Organic and never receive DM-attributed sales, so skip the DM
      // query entirely for them rather than running it and discarding a
      // guaranteed-zero result (per explicit instruction 2026-08-05: remove
      // DM cost from staff who don't actually have it, not just zero it).
      (cfg.isJefri || !cfg.hasDm) ? Promise.resolve({ dmProductCost: 0, dmTotalCost: 0 }) : queryDmCostsForMonth(cfg.productIds, month),
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
