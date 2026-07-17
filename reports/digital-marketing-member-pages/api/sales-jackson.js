// Jackson — Product Sales (ledsone.co.uk), by month, full order-level detail.
// STANDALONE, NOT part of the shared staff dashboard (pages/sales.html) —
// backs pages/jackson-sales.html only. Not linked from index.html or the
// staff tab list. Server-side only: reads SHOPIFY_UK_ADMIN_TOKEN from env,
// never exposed to client. Read-only Shopify Admin GraphQL API, zero mutations.
// Order/session/journey logic mirrors sales-kamsi.js exactly.

const fs = require('node:fs');
const path = require('node:path');

const STORE_DOMAIN = process.env.SHOPIFY_UK_STORE_DOMAIN || 'ledsone.myshopify.com';
const API_VERSION = process.env.SHOPIFY_UK_API_VERSION || '2024-10';
const TOKEN = process.env.SHOPIFY_UK_ADMIN_TOKEN;

const JACKSON_PRODUCT_IDS = new Set([
  '7585585332474','7470952349946','5911744282785','4524553470048','4551406649440',
  '8005774409978','4417270808672','7640296653050','14946951397762','6685790896289',
  '6669353779361','4417257209952','6655620841633','8114277515514','14882306818434',
  '4417260486752','14937948586370','4538255736928','7865820414202','8175831417082',
  '4488111882336','7470951956730','4417261633632','14886272434562','14965693940098',
  '5928354545825','7738421936378','4417278115936','4417255800928','4417284243552',
  '8072405582074','7053375373473','5956003758241','8626277548282','14924960235906',
  '6685792272545','4417276018784','7642575470842','6655620284577','14921103278466',
  '6024709734561','8060940943610','14848208535938','7982634926330','4538256031840',
  '7659907776762','4417276903520','8140667846906','6001950490785','5334324412577',
]);

function londonOffsetMinutesAt(utcGuessMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcGuessMs)).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const asIfUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +hour, +parts.minute, +parts.second);
  return Math.round((asIfUTC - utcGuessMs) / 60000);
}
function londonMidnightUTCMs(year, month, day) {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMin = londonOffsetMinutesAt(guess);
  return guess - offsetMin * 60000;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SUPPORTED_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
const CURRENT_LIVE_MONTHS = ['2026-07'];

function resolveReportMonth(monthParam) {
  const month = SUPPORTED_MONTHS.includes(monthParam) ? monthParam : '2026-06';
  const [y, m] = month.split('-').map(Number);
  const startMs = londonMidnightUTCMs(y, m, 1);
  const monthEndMs = m === 12 ? londonMidnightUTCMs(y + 1, 1, 1) : londonMidnightUTCMs(y, m + 1, 1);
  const isLive = CURRENT_LIVE_MONTHS.includes(month);
  const endMs = isLive ? Math.min(monthEndMs, Date.now()) : monthEndMs;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDay = isLive ? Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric' }).format(new Date(endMs))) : daysInMonth;
  return {
    month, startMs, endMs, isLive,
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(endMs).toISOString(),
    label: isLive ? `${MONTH_NAMES[m - 1]} 1–${endDay} (month to date), ${y}` : `${MONTH_NAMES[m - 1]} 1–${daysInMonth}, ${y}`,
    queryStart: new Date(startMs - 24 * 3600 * 1000).toISOString().slice(0, 10),
    queryEnd: new Date(endMs + 24 * 3600 * 1000).toISOString().slice(0, 10),
  };
}

// ---------- Channel classification (mirrors sales-kamsi.js exactly) ----------
const SEARCH_ENGINES = ['google', 'bing', 'yahoo', 'duckduckgo', 'ecosia', 'yandex', 'baidu', 'aol', 'ask'];
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

function classifySession(visit) {
  if (!visit) return { classification: 'UNKNOWN', evidence: 'no visit data' };
  const paid = hasPaidEvidence(visit);
  if (paid) return { classification: 'PAID_SEARCH', evidence: paid };
  const source = lower(visit.source);
  const sourceDesc = lower(visit.sourceDescription);
  const sourceType = lower(visit.sourceType);
  const utm = visit.utmParameters || {};
  const medium = lower(utm.medium);
  let referrerHost = '';
  try { referrerHost = visit.referrerUrl ? new URL(visit.referrerUrl).hostname.toLowerCase() : ''; } catch (e) { referrerHost = ''; }
  const looksLikeSearchEngine = SEARCH_ENGINES.some(eng => source.includes(eng) || sourceDesc.includes(eng) || referrerHost.includes(eng));
  const organicSignal = medium === 'organic' || sourceType.includes('organic') || sourceType.includes('seo') || (looksLikeSearchEngine && !medium);
  if (looksLikeSearchEngine && organicSignal) return { classification: 'ORGANIC_SEARCH', evidence: `search engine match (${source || sourceDesc || referrerHost}), medium=${medium || 'none'}` };
  if (looksLikeSearchEngine && !medium && !sourceType) return { classification: 'ORGANIC_SEARCH', evidence: `search engine referrer/source with no paid signal (${source || sourceDesc || referrerHost})` };
  if (source === 'direct' || (!visit.referrerUrl && !visit.source && !medium)) return { classification: 'DIRECT', evidence: source === 'direct' ? 'source="direct"' : 'no referrer, no source, no utm' };
  if (['facebook', 'instagram', 'tiktok', 'twitter', 'x.com', 'pinterest', 'linkedin', 'snapchat'].some(s => source.includes(s) || referrerHost.includes(s)) || medium === 'social') return { classification: 'SOCIAL', evidence: `social platform match (${source || referrerHost})` };
  if (sourceType === 'newsletter' || medium === 'email' || source.includes('email') || sourceDesc.includes('email')) return { classification: 'EMAIL', evidence: sourceType === 'newsletter' ? 'sourceType=NEWSLETTER' : 'email source/medium' };
  if (medium === 'affiliate' || sourceType.includes('affiliate')) return { classification: 'AFFILIATE', evidence: 'affiliate source/medium' };
  if (visit.referrerUrl && !looksLikeSearchEngine) return { classification: 'REFERRAL', evidence: `non-search referrer: ${referrerHost}` };
  if (source || sourceDesc || medium) return { classification: 'OTHER', evidence: `unrecognized source: ${source || sourceDesc || medium}` };
  return { classification: 'UNKNOWN', evidence: 'insufficient evidence' };
}

function classifyOrderJourney(order) {
  if (order.test) return { status: 'EXCLUDED_TEST_ORDER', reason: 'test=true' };
  if (order.cancelledAt) return { status: 'EXCLUDED_CANCELLED_ORDER', reason: `cancelledAt=${order.cancelledAt}` };
  const cjs = order.customerJourneySummary;
  if (!cjs) return { status: 'NO_JOURNEY_DATA', reason: 'customerJourneySummary is null' };
  if (!cjs.ready) return { status: 'ATTRIBUTION_PENDING', reason: 'customerJourneySummary.ready=false' };
  const moments = (cjs.moments && cjs.moments.edges || []).map(e => e.node).filter(n => n.__typename === 'CustomerVisit');
  const visits = moments.length ? moments : [cjs.firstVisit, cjs.lastVisit].filter(Boolean);
  if (!visits.length) return { status: 'NO_JOURNEY_DATA', reason: 'no CustomerVisit moments and no first/last visit' };
  const classifications = visits.map(v => ({ visit: v, ...classifySession(v) }));
  const first = cjs.firstVisit ? classifySession(cjs.firstVisit) : null;
  const last = cjs.lastVisit ? classifySession(cjs.lastVisit) : null;
  return { status: 'CLASSIFIED', reason: 'classified by first session', classifications, first, last };
}

function deriveChannel(journey) {
  if (journey.status === 'NO_JOURNEY_DATA') return 'No Journey Data';
  if (journey.status === 'ATTRIBUTION_PENDING') return 'Attribution Pending';
  if (journey.first) {
    const map = {
      ORGANIC_SEARCH: 'Organic Search', PAID_SEARCH: 'Google Ads / Paid Search', DIRECT: 'Direct',
      SOCIAL: 'Social', EMAIL: 'Email', AFFILIATE: 'Affiliate', REFERRAL: 'Referral', OTHER: 'Other', UNKNOWN: 'Unknown',
    };
    return map[journey.first.classification] || 'Unknown';
  }
  return 'Unknown';
}

// ---------- Shopify GraphQL ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
    } catch (e) { retryState.throttleRetries++; await sleep(500 * Math.pow(2, attempt)); continue; }
    if (res.status === 429 || (res.status >= 500 && res.status <= 504)) { retryState.throttleRetries++; await sleep(500 * Math.pow(2, attempt)); continue; }
    if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
    const json = await res.json();
    const throttled = json.errors && Array.isArray(json.errors) && json.errors.some(e => e.extensions && e.extensions.code === 'THROTTLED');
    if (throttled) { retryState.throttleRetries++; await sleep(1000 * Math.pow(2, attempt)); continue; }
    if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error('Shopify API: exceeded retries');
}

const ORDERS_QUERY = `
query JacksonOrders($cursor: String, $query: String!) {
  orders(first: 50, after: $cursor, sortKey: CREATED_AT, query: $query) {
    edges {
      node {
        id legacyResourceId name createdAt updatedAt cancelledAt cancelReason test
        displayFinancialStatus displayFulfillmentStatus
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        currentTotalDiscountsSet { shopMoney { amount currencyCode } }
        customerJourneySummary {
          ready
          customerOrderIndex
          daysToConversion
          firstVisit {
            id occurredAt landingPage referrerUrl source sourceDescription sourceType referralCode
            utmParameters { source medium campaign term content }
          }
          lastVisit {
            id occurredAt landingPage referrerUrl source sourceDescription sourceType referralCode
            utmParameters { source medium campaign term content }
          }
          moments(first: 100) {
            edges {
              node {
                __typename
                ... on CustomerVisit {
                  id occurredAt landingPage referrerUrl source sourceDescription sourceType referralCode
                  utmParameters { source medium campaign term content }
                }
              }
            }
          }
        }
        lineItems(first: 100) {
          edges {
            node {
              id title variantTitle sku quantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedTotalSet { shopMoney { amount currencyCode } }
              variant { id legacyResourceId title sku product { id legacyResourceId title handle } }
            }
          }
        }
        refunds {
          refundLineItems(first: 100) { edges { node { lineItem { id } subtotalSet { shopMoney { amount currencyCode } } } } }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function amt(moneySet) { return moneySet ? round2(Number(moneySet.shopMoney.amount)) : 0; }
function ccy(moneySet) { return moneySet ? moneySet.shopMoney.currencyCode : null; }

async function fetchOrdersForMonth(monthConfig, retryState) {
  const q = `created_at:>=${monthConfig.queryStart} AND created_at:<${monthConfig.queryEnd}`;
  const orders = [];
  let after = null, hasNext = true, pages = 0;
  while (hasNext) {
    const data = await shopifyGraphQL(ORDERS_QUERY, { cursor: after, query: q }, retryState);
    for (const edge of data.orders.edges) {
      const t = new Date(edge.node.createdAt).getTime();
      if (t >= monthConfig.startMs && t < monthConfig.endMs) orders.push(edge.node);
    }
    hasNext = data.orders.pageInfo.hasNextPage;
    after = data.orders.pageInfo.endCursor;
    pages++;
  }
  return { orders, pages };
}

function buildJacksonOrderRow(order, journey) {
  const matchedItems = [];
  for (const edge of order.lineItems.edges) {
    const li = edge.node;
    const productId = li.variant && li.variant.product ? li.variant.product.legacyResourceId : null;
    if (!productId || !JACKSON_PRODUCT_IDS.has(String(productId))) continue;

    const grossUnit = amt(li.originalUnitPriceSet);
    const gross = round2(grossUnit * li.quantity);
    const discounted = amt(li.discountedTotalSet);
    const discount = round2(Math.max(0, gross - discounted));

    let refund = 0;
    for (const rEdge of (order.refunds || [])) {
      for (const rliEdge of (rEdge.refundLineItems && rEdge.refundLineItems.edges || [])) {
        const rli = rliEdge.node;
        if (rli.lineItem && rli.lineItem.id === li.id) refund += amt(rli.subtotalSet);
      }
    }
    refund = round2(refund);

    matchedItems.push({
      lineItemId: li.id,
      productTitle: li.variant && li.variant.product ? li.variant.product.title : li.title,
      productId: String(productId),
      variantTitle: li.variantTitle,
      variantId: li.variant ? li.variant.legacyResourceId : null,
      sku: li.sku,
      quantity: li.quantity,
      grossSales: gross,
      discounts: discount,
      refunds: refund,
      netSales: round2(gross - discount - refund),
      currency: ccy(li.originalUnitPriceSet),
    });
  }
  if (!matchedItems.length) return null;

  return {
    orderId: order.id,
    orderLegacyId: order.legacyResourceId,
    orderName: order.name,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    orderTotal: amt(order.currentTotalPriceSet),
    currency: ccy(order.currentTotalPriceSet),
    journeyStatus: journey.status,
    journeyReason: journey.reason,
    journeyReady: order.customerJourneySummary ? order.customerJourneySummary.ready : false,
    customerOrderIndex: order.customerJourneySummary ? order.customerJourneySummary.customerOrderIndex : null,
    daysToConversion: order.customerJourneySummary ? order.customerJourneySummary.daysToConversion : null,
    firstVisit: order.customerJourneySummary ? order.customerJourneySummary.firstVisit : null,
    lastVisit: order.customerJourneySummary ? order.customerJourneySummary.lastVisit : null,
    sessions: (journey.classifications || []).map((c, i) => ({
      sessionNumber: i + 1,
      visitId: c.visit.id,
      occurredAt: c.visit.occurredAt,
      classification: c.classification,
      evidence: c.evidence,
      source: c.visit.source,
      sourceDescription: c.visit.sourceDescription,
      sourceType: c.visit.sourceType,
      referrerUrl: c.visit.referrerUrl,
      landingPage: c.visit.landingPage,
      referralCode: c.visit.referralCode,
      utm: c.visit.utmParameters,
    })),
    matchedItems,
  };
}

function summarizeRows(rows) {
  let unitsSold = 0, grossSales = 0, discounts = 0, refunds = 0;
  const uniqueProducts = new Set();
  const currencies = new Set();
  for (const row of rows) {
    for (const item of row.matchedItems) {
      unitsSold += item.quantity;
      grossSales += item.grossSales;
      discounts += item.discounts;
      refunds += item.refunds;
      uniqueProducts.add(item.productId);
      if (item.currency) currencies.add(item.currency);
    }
  }
  grossSales = round2(grossSales); discounts = round2(discounts); refunds = round2(refunds);
  const netSales = round2(grossSales - discounts - refunds);
  const currency = currencies.size === 1 ? [...currencies][0] : (currencies.size === 0 ? 'GBP' : 'MIXED');
  return {
    ordersCount: rows.length, unitsSold, grossSales, discounts, refunds, netSales,
    averageRevenuePerOrder: rows.length ? round2(netSales / rows.length) : 0,
    uniqueProductsSold: uniqueProducts.size, currency,
  };
}

const CACHE = new Map();
const CACHE_TTL_MS = 55 * 1000;

// Internal-only: lets a single request scan a narrow date window instead of
// a full month, so static snapshots for historical months can be regenerated
// in fast chunks (a full-month live scan of the whole store's orders can
// exceed serverless function time limits). Not used by the page itself —
// only chunkStart/chunkEnd (YYYY-MM-DD, exclusive end) triggers this path.
function resolveChunkRange(chunkStart, chunkEnd) {
  const startMs = new Date(chunkStart + 'T00:00:00Z').getTime();
  const endMs = new Date(chunkEnd + 'T00:00:00Z').getTime();
  return {
    month: 'chunk', startMs, endMs, isLive: false,
    startISO: new Date(startMs).toISOString(), endISO: new Date(endMs).toISOString(),
    label: `${chunkStart} to ${chunkEnd} (chunk)`,
    queryStart: new Date(startMs - 24 * 3600 * 1000).toISOString().slice(0, 10),
    queryEnd: new Date(endMs + 24 * 3600 * 1000).toISOString().slice(0, 10),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const startTime = Date.now();
  const forceRefresh = req.query && req.query.refresh === '1';
  const isChunkRequest = !!(req.query && req.query.chunkStart && req.query.chunkEnd);
  const monthConfig = isChunkRequest
    ? resolveChunkRange(req.query.chunkStart, req.query.chunkEnd)
    : resolveReportMonth(req.query && req.query.month);
  const cacheKey = isChunkRequest ? `chunk:${req.query.chunkStart}:${req.query.chunkEnd}` : monthConfig.month;

  try {
    if (!TOKEN) { res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' }); return; }

    const cached = CACHE.get(cacheKey);
    if (!forceRefresh && cached && (Date.now() - cached.generatedAt) < CACHE_TTL_MS) {
      res.status(200).json({ ...cached.data, meta: { ...cached.data.meta, cacheStatus: 'hit' } });
      return;
    }

    // Jan-Jun 2026 are closed months — served from a pre-generated static
    // snapshot instantly instead of re-scanning the month's orders on every
    // tab switch (mirrors sales-kamsi.js). Only July (CURRENT_LIVE_MONTHS)
    // always live-fetches.
    if (!forceRefresh) {
      const staticPath = path.join(__dirname, 'data', `jackson-sales-${monthConfig.month}.json`);
      if (fs.existsSync(staticPath)) {
        const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
        const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
        CACHE.set(cacheKey, { data: payload, generatedAt: Date.now() });
        res.status(200).json(payload);
        return;
      }
    }

    const retryState = { throttleRetries: 0 };
    const { orders, pages } = await fetchOrdersForMonth(monthConfig, retryState);

    // Jackson is SEO, same as Kamsi — Google Ads / Paid Search, Email, and
    // Social orders are excluded entirely (never shown, never counted).
    // Every other channel (Organic Search, Direct, Referral, Affiliate,
    // Other, No Journey Data/Unknown) counts as-is.
    const JACKSON_EXCLUDED_CHANNELS = new Set(['Google Ads / Paid Search', 'Email', 'Social']);
    const allJacksonRows = [];
    for (const order of orders) {
      const journey = classifyOrderJourney(order);
      const row = buildJacksonOrderRow(order, journey);
      if (!row) continue;
      row.channel = deriveChannel(journey);
      if (JACKSON_EXCLUDED_CHANNELS.has(row.channel)) continue;
      row.group = row.channel;
      allJacksonRows.push(row);
    }

    const byGroup = new Map();
    for (const row of allJacksonRows) {
      if (!byGroup.has(row.group)) byGroup.set(row.group, []);
      byGroup.get(row.group).push(row);
    }
    const groupBreakdown = [...byGroup.entries()]
      .map(([group, rows]) => ({ group, ...summarizeRows(rows) }))
      .sort((a, b) => b.grossSales - a.grossSales);

    const totalsSummary = summarizeRows(allJacksonRows);
    const totals = {
      units: totalsSummary.unitsSold, gross: totalsSummary.grossSales, discounts: totalsSummary.discounts,
      refunds: totalsSummary.refunds, net: totalsSummary.netSales, orders: allJacksonRows.length,
    };

    const responsePayload = {
      success: true,
      staff: { name: 'Jackson', department: 'SEO', store: 'ledsone.co.uk' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/London' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      productIdsTracked: JACKSON_PRODUCT_IDS.size,
      groupBreakdown,
      totals,
      allJacksonOrders: allJacksonRows,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersScanned: orders.length, ordersWithJacksonProducts: allJacksonRows.length,
        pagesFetched: pages, throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };

    CACHE.set(cacheKey, { data: responsePayload, generatedAt: Date.now() });
    res.status(200).json(responsePayload);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
