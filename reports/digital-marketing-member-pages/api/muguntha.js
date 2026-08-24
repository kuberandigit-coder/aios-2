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

// ===== Tag Listing (muguntha.html "2026 New Listings" tab, added 2026-08-12)
// ===== Shopify UK product listing by tag — read-only, no mutations. Folded
// into this file (instead of a new api/tag-listing.js) to stay under
// Vercel's 12-serverless-function cap. Routed via ?action=tag-listing.
const TAG_STORE_DOMAIN_UK = process.env.SHOPIFY_UK_STORE_DOMAIN || 'ledsone.myshopify.com';
const TAG_API_VERSION_UK = process.env.SHOPIFY_UK_API_VERSION || '2024-10';
const TAG_TOKEN_UK = process.env.SHOPIFY_UK_ADMIN_TOKEN;
const tagSleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tagShopifyGraphQL(query, variables) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      res = await fetch(`https://${TAG_STORE_DOMAIN_UK}/admin/api/${TAG_API_VERSION_UK}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TAG_TOKEN_UK },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (e) {
      await tagSleep(500 * Math.pow(2, attempt) + Math.random() * 250);
      continue;
    }
    if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
      await tagSleep(500 * Math.pow(2, attempt) + Math.random() * 250);
      continue;
    }
    if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
    const json = await res.json();
    const throttled = json.errors && Array.isArray(json.errors) && json.errors.some((e) => e.extensions && e.extensions.code === 'THROTTLED');
    if (throttled) { await tagSleep(1000 * Math.pow(2, attempt)); continue; }
    if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error('Shopify API: exceeded retries');
}

const TAG_PRODUCTS_QUERY = `
query($after: String, $q: String) {
  products(first: 100, after: $after, query: $q) {
    edges {
      node {
        id
        title
        handle
        status
        vendor
        productType
        tags
        totalInventory
        featuredImage { url altText }
        priceRangeV2 {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
        variants(first: 1) { edges { node { sku } } }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function tagFetchAllProductsByTag(tag) {
  const rows = [];
  let after = null;
  let hasNext = true;
  const q = `tag:'${tag.replace(/'/g, "\\'")}'`;
  while (hasNext) {
    const data = await tagShopifyGraphQL(TAG_PRODUCTS_QUERY, { after, q });
    for (const edge of data.products.edges) {
      const p = edge.node;
      const min = p.priceRangeV2 && p.priceRangeV2.minVariantPrice;
      const max = p.priceRangeV2 && p.priceRangeV2.maxVariantPrice;
      rows.push({
        id: p.id,
        title: p.title,
        handle: p.handle,
        status: p.status,
        vendor: p.vendor,
        productType: p.productType,
        tags: p.tags,
        totalInventory: p.totalInventory,
        image: p.featuredImage ? p.featuredImage.url : null,
        sku: (p.variants.edges[0] && p.variants.edges[0].node.sku) || null,
        priceMin: min ? Number(min.amount) : null,
        priceMax: max ? Number(max.amount) : null,
        currency: min ? min.currencyCode : 'GBP',
      });
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return rows;
}

async function handleTagListing(req, res) {
  if (!TAG_TOKEN_UK) {
    res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' });
    return;
  }
  const tag = (req.query && req.query.tag) ? String(req.query.tag) : '2026New';
  try {
    const products = await tagFetchAllProductsByTag(tag);
    res.status(200).json({
      success: true,
      tag,
      store: 'ledsone.co.uk',
      count: products.length,
      products,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
}

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
  // SEO/AI tool cost — REVISED 2026-08-20 per Kuberan, replacing the old
  // year-varying GBP split (2026-08-05) entirely: Semrush $358.95/mo and
  // Arrow $149.00/mo, each split 4 ways, same formula for both 2025 and
  // 2026 (no more different splits/currencies per year). See getToolCost()
  // below for the exact USD->GBP conversion.
  kamsi: {
    groupName: '',
    productIds: new Set(),
    snapshotSlug: 'kamsi',
    hasDm: false,
    toolCost: true,
  },
  // Dilaksi is also SEO/Organic (product-scoped), same as Kamsi — confirmed
  // no "Dilaksi" group_name exists in google_ads.campaigns for this account
  // (SELECT DISTINCT group_name ... returns DM/DUSHAN/MD Task/O.M/SAJEEPAN/
  // Sonya/Susain/Thanishtika/Tharshan/Theekshi/null — no Dilaksi), and her
  // Sales attribution (salesuk.js/sales25.js) only routes orders to her via
  // organic/pure-direct channels, never the paid DM 46 campaign. Added
  // 2026-08-05, same reasoning as Kamsi — including the SEO/AI tool cost
  // split (see Kamsi's comment above for the current formula).
  dilaksi: {
    groupName: '',
    productIds: new Set(),
    snapshotSlug: 'dilaksi',
    hasDm: false,
    toolCost: true,
  },
  // Sukirtha — SEO/Organic on the DE store (ledsone.de), added 2026-08-24.
  // Confirmed no "Sukirtha" (or similar) group_name exists in EITHER Google
  // Ads account (`SELECT DISTINCT group_name FROM google_ads.campaigns
  // WHERE group_name ILIKE '%suki%'` returns 0 rows) — she has no ad spend,
  // same shape as Kamsi/Dilaksi (groupName '' + empty productIds naturally
  // return £0 ad cost; toolCost: true gives her the same shared Semrush/
  // Arrow AI share via getToolCost() below). She was already accounted for
  // in the tool-cost split's historical documentation (see the
  // TOOL_COST_SPLIT_BY comment) but never had her own dashboard entry until
  // now. Her Sales come from the DE store's default/catch-all organic
  // handler (salesde25.js/sales.js, ?staff=sukirtha, department "Organic
  // Search (SEO)") — same DE-routing as Jefri, but netSales basis (organic
  // role convention) instead of Jefri's orderTotalSum.
  sukirtha: {
    groupName: '',
    productIds: new Set(),
    snapshotSlug: 'sukirtha',
    hasDm: false,
    toolCost: true,
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
      ? ` Cost also includes a fixed monthly AI/SEO tool-cost share: Semrush $358.95/mo ÷ 4 + Arrow $149.00/mo ÷ 4, converted to £ at the 2026-08-19 mid-market USD/GBP rate, same formula for both 2025 and 2026 (revised 2026-08-20, replacing the earlier year-varying GBP split). No Google Ads spend applies (SEO/Organic role) — Cost is tool-cost share only.`
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
// AI/SEO tool cost — REVISED 2026-08-20 per Kuberan: Semrush $358.95/mo and
// Arrow $149.00/mo, each split 4 ways, same for both 2025 and 2026 (no more
// year-varying GBP split). USD->GBP at the same fixed mid-market rate
// already used for the Shopify subscription fee elsewhere on this page
// (2026-08-19, 1 USD = 0.7389 GBP) — not live-converted; update by hand if
// the rate or subscriptions change meaningfully.
const USD_TO_GBP_RATE = 0.7389;
const TOOL_COST_SPLIT_BY = 4;
const SEMRUSH_MONTHLY_USD = 358.95;
const ARROW_MONTHLY_USD = 149.00;
function getToolCost(cfg, month) {
  if (!cfg.toolCost) return 0;
  const semrush = (SEMRUSH_MONTHLY_USD * USD_TO_GBP_RATE) / TOOL_COST_SPLIT_BY;
  const arrow = (ARROW_MONTHLY_USD * USD_TO_GBP_RATE) / TOOL_COST_SPLIT_BY;
  return Math.round((semrush + arrow) * 100) / 100;
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

// Extracted from the handler 2026-08-19 so the new perf-batch action (below)
// can reuse the exact same snapshot-then-live logic per month, in-process,
// without an HTTP round trip per call. Behaviour is unchanged from before —
// this is a pure refactor, not a logic change.
async function getCostPayload(employeeKey, month, forceRefresh) {
  const cfg = EMPLOYEES[employeeKey];
  if (!cfg) throw new Error(`Unknown employee "${employeeKey}"`);
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
        return { ...staticData, meta: { ...(staticData.meta || {}), cacheStatus: 'static-snapshot' } };
      }
    }
  }

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
  return {
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
  };
}

// Runs fn over items with at most `limit` in flight — same pattern used in
// muguntha.html's client-side mapLimit, applied here server-side to avoid
// hammering the Postgres pool with 20+ concurrent queries when perf-batch
// fires them all in one function invocation.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(new Array(Math.min(limit, items.length)).fill(0).map(worker));
  return results;
}

// In-process call into salesuk.js/sales25.js's existing HTTP handler,
// avoiding a real network round trip. Mocks just enough of (req, res) for
// those handlers to run unmodified — same snapshot-then-live logic they
// already use for every other staff dashboard.
function callHandlerInProcess(handlerFn, query) {
  return new Promise((resolve, reject) => {
    const res = {
      _status: 200,
      setHeader() {},
      status(code) { this._status = code; return this; },
      json(body) { resolve(body); },
    };
    handlerFn({ query }, res).catch(reject);
  });
}

const MONTHS_2025 = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'];
const MONTHS_2026 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];

// Batch endpoint (added 2026-08-19): replaces the 40 separate HTTP requests
// muguntha.html's loadAll() previously fired per staff tab (20 months x 2
// metrics) with a single request that fetches all months' sales+cost inside
// one serverless function invocation. Sonya added 2026-08-19; Sajeepan added
// same day — both use the identical group-param-equals-member-key pattern,
// so no per-member special-casing needed beyond this allow-list. See
// muguntha.html's loadAll()/fetchGroupSales()/fetchCost() for the client
// side this replaces for each member's tab.
const PERF_BATCH_MEMBERS = new Set(['sonya', 'sajeepan']);

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// Display-only removal of DM 46 campaign-attributed sales/cost from the
// Performance tab for Sonya and Sajeepan, Jan-Jun 2025 (per explicit
// instruction, 2026-08-24). This does NOT touch salesuk.js/sales25.js's
// attribution logic or api/data snapshots — every other page/dashboard that
// reads the same underlying data (Sonya's/Sajeepan's own sales tabs, any
// other report) is unaffected. The marker string below is the exact one
// salesuk.js/sales25.js's Sonya/Sajeepan group.matchValue() already appends
// to orders it routed via the DM-46-plus-owned-product rule (see
// "moved from DM Campaigns" in both files) — no new attribution guesswork,
// just filtering out rows already tagged by the existing logic.
const DM_DISPLAY_EXCLUDE_MONTHS = new Set(['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06']);
const DM_ATTRIBUTION_MARKER = '(product-owned, moved from DM Campaigns)';

function stripDmFromSalesPayload(salesPayload) {
  if (!salesPayload || !salesPayload.success || !Array.isArray(salesPayload.campaignSummary) || !salesPayload.combinedSummary) return salesPayload;
  const dmRows = salesPayload.campaignSummary.filter(c => c.campaign && c.campaign.endsWith(DM_ATTRIBUTION_MARKER));
  if (!dmRows.length) return salesPayload;
  const sum = (field) => dmRows.reduce((a, c) => a + (c[field] || 0), 0);
  const cs = salesPayload.combinedSummary;
  const ordersCount = cs.ordersCount - sum('ordersCount');
  const netSales = round2(cs.netSales - sum('netSales'));
  const combinedSummary = {
    ...cs,
    ordersCount,
    grossSales: round2(cs.grossSales - sum('grossSales')),
    discounts: round2(cs.discounts - sum('discounts')),
    refunds: round2(cs.refunds - sum('refunds')),
    netSales,
    orderTotalSum: round2(cs.orderTotalSum - sum('orderTotalSum')),
    vat: round2(cs.vat - sum('vat')),
    averageRevenuePerOrder: ordersCount ? round2(netSales / ordersCount) : 0,
  };
  return {
    ...salesPayload,
    combinedSummary,
    campaignSummary: salesPayload.campaignSummary.filter(c => !(c.campaign && c.campaign.endsWith(DM_ATTRIBUTION_MARKER))),
    dmExcludedForDisplay: {
      removedCampaigns: dmRows.map(c => c.campaign),
      removedNetSales: round2(sum('netSales')),
      note: 'DM 46 campaign-attributed sales removed from this Performance tab display only (Jan-Jun 2025, per explicit instruction 2026-08-24). Underlying salesuk.js/sales25.js attribution and every other page using the same order data are unaffected.',
    },
  };
}

function stripDmFromCostPayload(costPayload) {
  if (!costPayload || !costPayload.success || !costPayload.dmProductCost) return costPayload;
  const removedDmCost = costPayload.dmProductCost;
  return {
    ...costPayload,
    dmProductCost: 0,
    dmSonyaProductCost: costPayload.dmSonyaProductCost != null ? 0 : undefined,
    totalCost: round2(costPayload.totalCost - removedDmCost),
    dmExcludedForDisplay: {
      removedDmCost,
      note: 'DM 46 product-share cost removed from this Performance tab display only (Jan-Jun 2025, per explicit instruction 2026-08-24). getCostPayload()\'s underlying value and every other consumer of it are unaffected — this strips it only in the perf-batch response.',
    },
  };
}

async function handlePerfBatch(req, res) {
  const member = req.query && req.query.member ? String(req.query.member).toLowerCase() : 'sonya';
  if (!PERF_BATCH_MEMBERS.has(member)) {
    res.status(400).json({ success: false, error: `perf-batch only supports "${[...PERF_BATCH_MEMBERS].join('", "')}" so far` });
    return;
  }
  const forceRefresh = req.query && req.query.refresh === '1';
  const salesuk = require('./salesuk.js');
  const sales25 = require('./sales25.js');

  try {
    const [sales25Arr, sales26Arr, cost25Arr, cost26Arr] = await Promise.all([
      mapLimit(MONTHS_2025, 6, (m) => callHandlerInProcess(sales25, { group: member, month: m })),
      mapLimit(MONTHS_2026, 6, (m) => callHandlerInProcess(salesuk, { group: member, month: m, refresh: (forceRefresh && m === '2026-08') ? '1' : undefined })),
      mapLimit(MONTHS_2025, 6, (m) => getCostPayload(member, m, false)),
      mapLimit(MONTHS_2026, 6, (m) => getCostPayload(member, m, forceRefresh && m === '2026-08')),
    ]);

    const byMonth = {};
    MONTHS_2025.forEach((m, i) => {
      const exclude = DM_DISPLAY_EXCLUDE_MONTHS.has(m);
      byMonth[m] = {
        sales: exclude ? stripDmFromSalesPayload(sales25Arr[i]) : sales25Arr[i],
        cost: exclude ? stripDmFromCostPayload(cost25Arr[i]) : cost25Arr[i],
      };
    });
    MONTHS_2026.forEach((m, i) => { byMonth[m] = { sales: sales26Arr[i], cost: cost26Arr[i] }; });

    res.status(200).json({ success: true, member, months: byMonth, meta: { generatedAt: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
}

// Cache-warming endpoint (added 2026-08-19). The live month's (2026-08)
// Shopify order-journey scan takes a documented 30-90s+, and its result
// lives only in an in-memory Map inside salesuk.js that's local to one
// serverless instance — a fresh instance (after every deploy, or ~10min
// idle) starts cold and pays that 30-90s cost again on whichever real user
// happens to load the page next. Vercel's own Cron Jobs can't fix this on
// the Hobby plan (max once/day, need ~every 8min to beat the 10min cache
// TTL), so this is meant to be pinged by a free external cron service
// (e.g. cron-job.org) instead. Protected by CACHE_WARM_SECRET so random
// traffic can't repeatedly trigger expensive live Shopify scans.
const WARM_TARGETS = [
  { member: 'sonya', month: '2026-08' },
  { member: 'sajeepan', month: '2026-08' },
];
async function handleWarmCache(req, res) {
  const secret = process.env.CACHE_WARM_SECRET;
  if (!secret) {
    res.status(500).json({ success: false, error: 'Server not configured: CACHE_WARM_SECRET missing' });
    return;
  }
  if (!req.query || req.query.secret !== secret) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }
  const salesuk = require('./salesuk.js');
  const startedAt = Date.now();
  try {
    const results = await Promise.all(WARM_TARGETS.map(async (t) => {
      const t0 = Date.now();
      const data = await callHandlerInProcess(salesuk, { group: t.member, month: t.month, refresh: '1' });
      return { member: t.member, month: t.month, ok: !!data.success, ms: Date.now() - t0 };
    }));
    res.status(200).json({ success: true, results, totalMs: Date.now() - startedAt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.query && req.query.action === 'tag-listing') {
    await handleTagListing(req, res);
    return;
  }
  if (req.query && req.query.action === 'warm-cache') {
    await handleWarmCache(req, res);
    return;
  }
  if (req.query && req.query.action === 'perf-batch') {
    await handlePerfBatch(req, res);
    return;
  }
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

  try {
    const payload = await getCostPayload(employeeKey, month, forceRefresh);
    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
