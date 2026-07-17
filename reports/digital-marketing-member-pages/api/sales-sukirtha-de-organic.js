// Sukirtha — Organic Search Sales (ledsone.de), store-wide (NOT product-scoped)
// Server-side only: reads SHOPIFY_ADMIN_TOKEN from env, never exposed to client.
// Read-only Shopify Admin GraphQL API — zero mutations.
//
// New DE scope (beyond the existing UK Email tab): Sukirtha also owns
// organic search performance on ledsone.de. Store-wide like the Email
// tab — no product allocation CSV, no line-item matching, every order
// in the store counts. Mirrors Kamsi's Fully Organic / First-Session
// Organic classification logic exactly, applied store-wide.
//
// Credentials: uses the EXISTING SHOPIFY_ADMIN_TOKEN env var (already used
// by api/sukirtha-req2-duplicate-check.js and api/sukirtha-req3-slow-moving-stock.js
// for ledsone-de.myshopify.com) — NOT SHOPIFY_UK_ADMIN_TOKEN. No new env var.

const fs = require('node:fs');
const path = require('node:path');

const STORE_DOMAIN = 'ledsone-de.myshopify.com';
const API_VERSION = '2024-10';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

// Europe/Berlin month boundaries, DST-aware (same approach as sales-kamsi.js,
// but Germany's timezone, since this is the ledsone.de store).
function berlinOffsetMinutesAt(utcGuessMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcGuessMs)).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const asIfUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +hour, +parts.minute, +parts.second);
  return Math.round((asIfUTC - utcGuessMs) / 60000);
}
function berlinMidnightUTCMs(year, month, day) {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMin = berlinOffsetMinutesAt(guess);
  return guess - offsetMin * 60000;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Jan-Jun 2026 closed/historical, Jul 2026 is the live month-to-date tab
// (mirrors the Kamsi pattern added 2026-07-17 — see CURRENT_LIVE_MONTHS).
const SUPPORTED_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
const CURRENT_LIVE_MONTHS = ['2026-07'];

function resolveReportMonth(monthParam) {
  const month = SUPPORTED_MONTHS.includes(monthParam) ? monthParam : '2026-06';
  const [y, m] = month.split('-').map(Number);
  const startMs = berlinMidnightUTCMs(y, m, 1);
  const monthEndMs = m === 12 ? berlinMidnightUTCMs(y + 1, 1, 1) : berlinMidnightUTCMs(y, m + 1, 1);
  const isLive = CURRENT_LIVE_MONTHS.includes(month);
  const endMs = isLive ? Math.min(monthEndMs, Date.now()) : monthEndMs;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDay = isLive ? Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', day: 'numeric' }).format(new Date(endMs))) : daysInMonth;
  return {
    month, startMs, endMs, isLive,
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(endMs).toISOString(),
    label: isLive ? `${MONTH_NAMES[m - 1]} 1–${endDay} (month to date), ${y}` : `${MONTH_NAMES[m - 1]} 1–${daysInMonth}, ${y}`,
    queryStart: new Date(startMs - 24 * 3600 * 1000).toISOString().slice(0, 10),
    queryEnd: new Date(endMs + 24 * 3600 * 1000).toISOString().slice(0, 10),
  };
}

// ---------- Session classification (identical logic to sales-kamsi.js) ----------
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
  if (PAID_SOURCE_TYPES.includes(sourceType)) return `sourceType=${visit.sourceType} (Shopify's paid-ad marketing tactic classification)`;
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

  if (looksLikeSearchEngine && organicSignal) {
    return { classification: 'ORGANIC_SEARCH', evidence: `search engine match (${source || sourceDesc || referrerHost}), medium=${medium || 'none'}` };
  }
  if (looksLikeSearchEngine && !medium && !sourceType) {
    return { classification: 'ORGANIC_SEARCH', evidence: `search engine referrer/source with no paid signal (${source || sourceDesc || referrerHost})` };
  }

  if (source === 'direct' || (!visit.referrerUrl && !visit.source && !medium)) {
    return { classification: 'DIRECT', evidence: source === 'direct' ? 'source="direct"' : 'no referrer, no source, no utm' };
  }
  if (['facebook', 'instagram', 'tiktok', 'twitter', 'x.com', 'pinterest', 'linkedin', 'snapchat'].some(s => source.includes(s) || referrerHost.includes(s)) || medium === 'social') {
    return { classification: 'SOCIAL', evidence: `social platform match (${source || referrerHost})` };
  }
  if (sourceType === 'newsletter' || medium === 'email' || source.includes('email') || sourceDesc.includes('email')) {
    return { classification: 'EMAIL', evidence: sourceType === 'newsletter' ? 'sourceType=NEWSLETTER' : 'email source/medium' };
  }
  if (medium === 'affiliate' || sourceType.includes('affiliate')) {
    return { classification: 'AFFILIATE', evidence: 'affiliate source/medium' };
  }
  if (visit.referrerUrl && !looksLikeSearchEngine) {
    return { classification: 'REFERRAL', evidence: `non-search referrer: ${referrerHost}` };
  }
  if (source || sourceDesc || medium) {
    return { classification: 'OTHER', evidence: `unrecognized source: ${source || sourceDesc || medium}` };
  }
  return { classification: 'UNKNOWN', evidence: 'insufficient evidence' };
}

// ---------- Journey / order classification (ORGANIC variant) ----------
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
  const firstSessionOrganic = !!(first && first.classification === 'ORGANIC_SEARCH');

  if (classifications.some(c => c.classification === 'UNKNOWN')) {
    return { status: 'UNKNOWN_ATTRIBUTION', reason: 'at least one session has insufficient evidence', classifications, first, last, firstSessionOrganic };
  }

  const allOrganic = classifications.every(c => c.classification === 'ORGANIC_SEARCH')
    && first && first.classification === 'ORGANIC_SEARCH'
    && last && last.classification === 'ORGANIC_SEARCH';

  if (allOrganic) {
    return { status: 'FULLY_ORGANIC', reason: 'first, last, and every available session confidently Organic Search', classifications, first, last, firstSessionOrganic };
  }

  const anyOrganic = classifications.some(c => c.classification === 'ORGANIC_SEARCH');
  if (anyOrganic) {
    return { status: 'MIXED_JOURNEY', reason: 'mixture of Organic Search and other channel sessions', classifications, first, last, firstSessionOrganic };
  }
  return { status: 'NON_ORGANIC', reason: 'no qualifying Organic Search session found', classifications, first, last, firstSessionOrganic };
}

function deriveChannel(journey) {
  if (journey.status === 'NO_JOURNEY_DATA') return 'No Journey Data';
  if (journey.status === 'ATTRIBUTION_PENDING') return 'Attribution Pending';
  if (journey.status === 'UNKNOWN_ATTRIBUTION') return 'Unknown';
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

const ORDERS_QUERY = `
query SukirthaDEOrders($cursor: String, $query: String!) {
  orders(first: 50, after: $cursor, sortKey: CREATED_AT, query: $query) {
    edges {
      node {
        id
        legacyResourceId
        name
        createdAt
        updatedAt
        cancelledAt
        cancelReason
        test
        displayFinancialStatus
        displayFulfillmentStatus
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
            pageInfo { hasNextPage endCursor }
          }
        }
        lineItems(first: 100) {
          edges {
            node {
              id name title variantTitle sku quantity refundableQuantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedTotalSet { shopMoney { amount currencyCode } }
              variant {
                id legacyResourceId title sku
                product { id legacyResourceId title handle }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
        refunds {
          id
          createdAt
          refundLineItems(first: 100) {
            edges {
              node {
                quantity
                lineItem { id }
                subtotalSet { shopMoney { amount currencyCode } }
              }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchOrdersForMonth(monthConfig, retryState) {
  const q = `created_at:>=${monthConfig.queryStart} AND created_at:<${monthConfig.queryEnd}`;
  const orders = [];
  let after = null;
  let hasNext = true;
  let pages = 0;
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

// ---------- Financials (store-wide, no product filter) ----------
function amt(moneySet) { return moneySet ? round2(Number(moneySet.shopMoney.amount)) : 0; }
function ccy(moneySet) { return moneySet ? moneySet.shopMoney.currencyCode : null; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function buildSukirthaOrderRow(order, journey) {
  const items = [];
  for (const edge of order.lineItems.edges) {
    const li = edge.node;

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

    items.push({
      lineItemId: li.id,
      productTitle: li.title,
      productId: li.variant && li.variant.product ? li.variant.product.legacyResourceId : null,
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
  if (!items.length) return null;

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
    matchedItems: items,
  };
}

// ---------- Simple in-memory cache (per warm Lambda instance only) ----------
const CACHE = new Map();
const CACHE_TTL_MS = 55 * 1000;

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
  grossSales = round2(grossSales);
  discounts = round2(discounts);
  refunds = round2(refunds);
  const netSales = round2(grossSales - discounts - refunds);
  const currency = currencies.size === 1 ? [...currencies][0] : (currencies.size === 0 ? 'EUR' : 'MIXED');
  const multiCurrencyWarning = currencies.size > 1 ? [...currencies] : null;
  return {
    ordersCount: rows.length, unitsSold, grossSales, discounts, refunds, netSales,
    averageRevenuePerOrder: rows.length ? round2(netSales / rows.length) : 0,
    uniqueProductsSold: uniqueProducts.size, currency, multiCurrencyWarning,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const startTime = Date.now();
  const forceRefresh = req.query && req.query.refresh === '1';
  const monthConfig = resolveReportMonth(req.query && req.query.month);
  const cacheKey = monthConfig.month;

  try {
    if (!TOKEN) {
      res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
      return;
    }

    const cached = CACHE.get(cacheKey);
    if (!forceRefresh && cached && (Date.now() - cached.generatedAt) < CACHE_TTL_MS) {
      res.status(200).json({ ...cached.data, meta: { ...cached.data.meta, cacheStatus: 'hit' } });
      return;
    }

    if (!forceRefresh) {
      const staticPath = path.join(__dirname, 'data', `sukirtha-de-organic-sales-${monthConfig.month}.json`);
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

    const classificationCounts = {
      fullyOrganic: 0, mixedJourney: 0, nonOrganic: 0, attributionPending: 0,
      noJourneyData: 0, unknownAttribution: 0, excludedCancelled: 0, excludedTest: 0,
      firstSessionOrganic: 0,
    };

    const fullyOrganicRows = [];
    const firstSessionOrganicRows = [];

    for (const order of orders) {
      const journey = classifyOrderJourney(order);
      const row = buildSukirthaOrderRow(order, journey);
      if (!row) continue;
      row.channel = deriveChannel(journey);

      const isFirstSessionOrganicBucket = journey.firstSessionOrganic && (journey.status === 'MIXED_JOURNEY' || journey.status === 'NON_ORGANIC');

      if (journey.status === 'FULLY_ORGANIC') {
        fullyOrganicRows.push(row);
        classificationCounts.fullyOrganic++;
      } else if (isFirstSessionOrganicBucket) {
        row.journeyStatus = 'FIRST_SESSION_ORGANIC';
        firstSessionOrganicRows.push(row);
        classificationCounts.firstSessionOrganic++;
      } else {
        switch (journey.status) {
          case 'MIXED_JOURNEY': classificationCounts.mixedJourney++; break;
          case 'NON_ORGANIC': classificationCounts.nonOrganic++; break;
          case 'ATTRIBUTION_PENDING': classificationCounts.attributionPending++; break;
          case 'NO_JOURNEY_DATA': classificationCounts.noJourneyData++; break;
          case 'UNKNOWN_ATTRIBUTION': classificationCounts.unknownAttribution++; break;
          case 'EXCLUDED_CANCELLED_ORDER': classificationCounts.excludedCancelled++; break;
          case 'EXCLUDED_TEST_ORDER': classificationCounts.excludedTest++; break;
        }
      }
    }

    const fullyOrganicSummary = summarizeRows(fullyOrganicRows);
    const firstSessionOrganicSummary = summarizeRows(firstSessionOrganicRows);
    const combinedSummary = summarizeRows([...fullyOrganicRows, ...firstSessionOrganicRows]);

    fullyOrganicRows.forEach(r => { r.group = 'Fully Organic'; });
    firstSessionOrganicRows.forEach(r => { r.group = 'First-Session Organic'; });
    const allSukirthaOrders = [...fullyOrganicRows, ...firstSessionOrganicRows];

    const { grossSales, discounts, refunds, netSales, currency, multiCurrencyWarning } = fullyOrganicSummary;

    const responsePayload = {
      success: true,
      staff: { name: 'Sukirtha', department: 'Organic Search (SEO)', store: 'ledsone.de' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/Berlin' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      source: {
        scope: 'store-wide — every order counts, no product allocation / matching (mirrors sales-sukirtha-uk.js Email pattern, ORGANIC channel instead)',
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      summary: {
        fullyOrganicOrders: fullyOrganicRows.length,
        unitsSold: fullyOrganicSummary.unitsSold, grossSales, discounts, refunds, netSales,
        averageRevenuePerOrder: fullyOrganicSummary.averageRevenuePerOrder,
        uniqueProductsSold: fullyOrganicSummary.uniqueProductsSold,
        currency, multiCurrencyWarning,
      },
      firstSessionOrganicSummary,
      combinedSummary,
      allSukirthaOrders,
      classificationCounts,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        fullyOrganicOrders: fullyOrganicRows.length,
        firstSessionOrganicOrders: firstSessionOrganicRows.length,
        pagesFetched: pages,
        throttleRetries: retryState.throttleRetries,
        executionMs: Date.now() - startTime,
      },
    };

    CACHE.set(cacheKey, { data: responsePayload, generatedAt: Date.now() });
    res.status(200).json(responsePayload);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
}
