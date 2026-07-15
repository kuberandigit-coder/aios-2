// Kamsi — Fully Organic Product Sales (ledsone.co.uk), fixed June 1-30, 2026
// Server-side only: reads SHOPIFY_UK_ADMIN_TOKEN from env, never exposed to client.
// Read-only Shopify Admin GraphQL API — zero mutations.
// Source of truth for Kamsi's product ownership: api/data/kamsi-product-allocation.csv
// (generated from reports/Kamsi/data/2026-07-14_kamsi-product-allocation.csv — NOT
// rebuilt from collections here, per task instruction).

import fs from 'node:fs';
import path from 'node:path';

// Vercel compiles this file from ESM to CommonJS at build time, where
// __dirname exists natively — import.meta.url is not valid there.

const STORE_DOMAIN = process.env.SHOPIFY_UK_STORE_DOMAIN || 'ledsone.myshopify.com';
const API_VERSION = process.env.SHOPIFY_UK_API_VERSION || '2024-10';
const TOKEN = process.env.SHOPIFY_UK_ADMIN_TOKEN;

// Europe/London month boundaries, DST-aware (UK clocks change on the last
// Sunday of March and October — Jan-most of Mar is GMT/UTC+0, late-Mar
// through Oct is BST/UTC+1 — so the offset cannot be hardcoded per month).
// Computed via Intl, not a fixed "+01:00" string, per task requirement.
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
// Returns the UTC-ms instant corresponding to local London midnight on
// the given Y/M/D (month 1-indexed).
function londonMidnightUTCMs(year, month, day) {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMin = londonOffsetMinutesAt(guess);
  return guess - offsetMin * 60000;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Supported reporting months for this dashboard — Jan through Jun 2026.
const SUPPORTED_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

function resolveReportMonth(monthParam) {
  const month = SUPPORTED_MONTHS.includes(monthParam) ? monthParam : '2026-06';
  const [y, m] = month.split('-').map(Number);
  const startMs = londonMidnightUTCMs(y, m, 1);
  const endMs = m === 12 ? londonMidnightUTCMs(y + 1, 1, 1) : londonMidnightUTCMs(y, m + 1, 1);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    month, startMs, endMs,
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(endMs).toISOString(),
    label: `${MONTH_NAMES[m - 1]} 1–${daysInMonth}, ${y}`,
    // Shopify's date-only query net (broad, one day padding each side) —
    // exact inclusion is enforced by startMs/endMs above, never trusted
    // from Shopify's own date-only parsing. See the historical
    // THROTTLED/date-parser evidence doc for why this is a date-only
    // broad net, not a time-qualified query string.
    queryStart: new Date(startMs - 24 * 3600 * 1000).toISOString().slice(0, 10),
    queryEnd: new Date(endMs + 24 * 3600 * 1000).toISOString().slice(0, 10),
  };
}

// ---------- CSV parsing (RFC4180-ish, handles quoted commas) ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length === header.length).map(r => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = r[idx]; });
    return obj;
  });
}

function loadKamsiAllocation() {
  const csvPath = path.join(__dirname, 'data', 'kamsi-product-allocation.csv');
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(text);

  const productIds = new Set();
  const productGids = new Set();
  const variantIds = new Set();
  const variantGids = new Set();
  const productById = new Map(); // shopify_product_id -> row

  let duplicateProductIds = 0;
  let emptyIdsRejected = 0;

  for (const r of rows) {
    const pid = (r.shopify_product_id || '').trim();
    if (!pid) { emptyIdsRejected++; continue; }
    if (productById.has(pid)) duplicateProductIds++;
    productById.set(pid, r);
    productIds.add(pid);
    if (r.shopify_product_gid) productGids.add(r.shopify_product_gid.trim());

    const vIds = (r.variant_ids || '').split('|').map(s => s.trim()).filter(s => s && s !== 'MISSING_FROM_DB');
    const vGids = (r.variant_gids || '').split('|').map(s => s.trim()).filter(s => s && s !== 'MISSING_FROM_DB');
    vIds.forEach(v => variantIds.add(v));
    vGids.forEach(v => variantGids.add(v));
  }

  return {
    productIds, productGids, variantIds, variantGids, productById,
    stats: {
      totalRows: rows.length,
      uniqueProductIds: productIds.size,
      uniqueVariantIds: variantIds.size,
      duplicateProductIdsFound: duplicateProductIds,
      emptyIdsRejected,
      variantIdsAvailable: variantIds.size > 0,
    },
  };
}

// ---------- Organic session classification ----------
const SEARCH_ENGINES = ['google', 'bing', 'yahoo', 'duckduckgo', 'ecosia', 'yandex', 'baidu', 'aol', 'ask'];
// "pmax" (Google Ads Performance Max) added after finding live production
// orders with utm_medium=PMax, utm_source=Google_Ads that fell through
// undetected — see hasPaidEvidence's utm.source check below for the
// broader fix (any Google Ads campaign, not just PMax).
const PAID_UTM_MEDIUMS = ['cpc', 'ppc', 'paid', 'paid_search', 'paidsearch', 'display', 'shopping', 'paid_social', 'cpv', 'cpm', 'cpa', 'pmax', 'performance_max', 'demandgen', 'demand_gen', 'discovery'];
const PAID_CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'dclid'];
// utm_source values that indicate a paid ads platform regardless of medium
// (confirmed live: real orders had utm_source="Google_Ads").
const PAID_UTM_SOURCES = ['google_ads', 'googleads', 'google ads', 'bing_ads', 'bingads', 'facebook_ads', 'meta_ads'];

function lower(s) { return (s || '').toString().toLowerCase(); }

// Shopify's real CustomerVisit.sourceType enum (confirmed live against
// production June 2026 data — values actually observed: AD, NEWSLETTER,
// SEO) does NOT contain the substring "paid", so the original
// `sourceType.includes('paid')` check never matched real Shopify data —
// a Google Ads click (sourceType=AD, source=Google) would have fallen
// through and been misclassified as ORGANIC_SEARCH. Fixed to check the
// actual enum value directly.
const PAID_SOURCE_TYPES = ['ad'];

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

  // Shopify's real `source` field returns the literal string "direct" for
  // direct-to-store visits (confirmed live) — not merely an absent field.
  if (source === 'direct' || (!visit.referrerUrl && !visit.source && !medium)) {
    return { classification: 'DIRECT', evidence: source === 'direct' ? 'source="direct"' : 'no referrer, no source, no utm' };
  }
  if (['facebook', 'instagram', 'tiktok', 'twitter', 'x.com', 'pinterest', 'linkedin', 'snapchat'].some(s => source.includes(s) || referrerHost.includes(s)) || medium === 'social') {
    return { classification: 'SOCIAL', evidence: `social platform match (${source || referrerHost})` };
  }
  // Shopify's real sourceType enum uses "NEWSLETTER" for email-driven
  // visits (confirmed live), in addition to the generic string checks below.
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

// ---------- Journey / order classification ----------
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
  // Separate, non-strict signal: was the FIRST session specifically Organic
  // Search? Tracked independently of the strict all-sessions FULLY_ORGANIC
  // rule below — used to build a distinct "first-session organic" sales
  // bucket that is never relabeled or merged as FULLY_ORGANIC.
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

// Human-facing channel label for the "All Channels" breakdown — driven by
// the first session's classification when available (matches how the rest
// of this file already reasons about "channel"), falling back to an
// explicit label when no journey/session data exists at all.
function deriveChannel(journey) {
  if (journey.status === 'NO_JOURNEY_DATA') return 'No Journey Data';
  if (journey.status === 'ATTRIBUTION_PENDING') return 'Attribution Pending';
  if (journey.status === 'UNKNOWN_ATTRIBUTION') return 'Unknown';
  if (journey.first) {
    const map = {
      ORGANIC_SEARCH: 'Organic Search',
      PAID_SEARCH: 'Google Ads / Paid Search',
      DIRECT: 'Direct',
      SOCIAL: 'Social',
      EMAIL: 'Email',
      AFFILIATE: 'Affiliate',
      REFERRAL: 'Referral',
      OTHER: 'Other',
      UNKNOWN: 'Unknown',
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
query KamsiJuneOrders($cursor: String, $query: String!) {
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
  // Date-only, shop-timezone (Europe/London, confirmed live) broad net —
  // padded a day wider each side to tolerate Shopify's date-only rounding;
  // exact inclusion is enforced below with startMs/endMs (DST-aware).
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

// ---------- Kamsi matching + financials ----------
function matchLineItemToKamsi(lineItem, allocation) {
  const variant = lineItem.variant;
  if (!variant) return null;
  if (variant.id && allocation.variantGids.has(variant.id)) return { matchedOn: 'variant_gid' };
  if (variant.legacyResourceId && allocation.variantIds.has(String(variant.legacyResourceId))) return { matchedOn: 'variant_id' };
  const product = variant.product;
  if (product) {
    if (product.id && allocation.productGids.has(product.id)) return { matchedOn: 'product_gid' };
    if (product.legacyResourceId && allocation.productIds.has(String(product.legacyResourceId))) return { matchedOn: 'product_id' };
  }
  return null;
}

function amt(moneySet) { return moneySet ? round2(Number(moneySet.shopMoney.amount)) : 0; }
function ccy(moneySet) { return moneySet ? moneySet.shopMoney.currencyCode : null; }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function buildKamsiOrderRow(order, journey, allocation) {
  const matchedItems = [];
  for (const edge of order.lineItems.edges) {
    const li = edge.node;
    const match = matchLineItemToKamsi(li, allocation);
    if (!match) continue;

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
      productTitle: li.title,
      productId: li.variant && li.variant.product ? li.variant.product.legacyResourceId : null,
      variantTitle: li.variantTitle,
      variantId: li.variant ? li.variant.legacyResourceId : null,
      sku: li.sku,
      quantity: li.quantity,
      matchedOn: match.matchedOn,
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

// ---------- Simple in-memory cache (per warm Lambda instance only — see limitations) ----------
const CACHE = new Map(); // keyed by month, e.g. "2026-06" — each warm Lambda instance only
const CACHE_TTL_MS = 55 * 1000; // slightly under the 60s client poll interval

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const startTime = Date.now();
  const forceRefresh = req.query && req.query.refresh === '1';
  const monthConfig = resolveReportMonth(req.query && req.query.month);
  const cacheKey = monthConfig.month;

  try {
    if (!TOKEN) {
      res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' });
      return;
    }

    const cached = CACHE.get(cacheKey);
    if (!forceRefresh && cached && (Date.now() - cached.generatedAt) < CACHE_TTL_MS) {
      res.status(200).json({ ...cached.data, meta: { ...cached.data.meta, cacheStatus: 'hit' } });
      return;
    }

    // Jan-Jun 2026 are closed, historical calendar months — the numbers
    // cannot change — so a pre-generated static snapshot (built once via
    // this same endpoint with ?refresh=1) is served instantly instead of
    // re-scanning ~2,000+ Shopify orders on every page view. Only used
    // when NOT forcing a refresh; `?refresh=1` always re-fetches live.
    if (!forceRefresh) {
      const staticPath = path.join(__dirname, 'data', `kamsi-sales-${monthConfig.month}.json`);
      if (fs.existsSync(staticPath)) {
        const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
        const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
        CACHE.set(cacheKey, { data: payload, generatedAt: Date.now() });
        res.status(200).json(payload);
        return;
      }
    }

    const allocation = loadKamsiAllocation();
    const retryState = { throttleRetries: 0 };
    const { orders, pages } = await fetchOrdersForMonth(monthConfig, retryState);

    const classificationCounts = {
      fullyOrganic: 0, mixedJourney: 0, nonOrganic: 0, attributionPending: 0,
      noJourneyData: 0, unknownAttribution: 0, excludedCancelled: 0, excludedTest: 0,
      firstSessionOrganic: 0, // Kamsi-related orders only, informational sub-count of mixedJourney+nonOrganic — see firstSessionOrganicSummary
    };

    let kamsiRelatedCount = 0;
    const fullyOrganicRows = [];
    const firstSessionOrganicRows = [];
    // Kamsi-specific diagnostic: unlike classificationCounts (site-wide,
    // all June orders), this only counts orders that actually contain a
    // Kamsi product — answers "why weren't my other orders counted?"
    const kamsiClassificationCounts = {
      fullyOrganic: 0, firstSessionOrganic: 0, mixedJourneyOtherwise: 0, nonOrganicOtherwise: 0,
      attributionPending: 0, noJourneyData: 0, unknownAttribution: 0, excludedCancelled: 0, excludedTest: 0,
    };
    const excludedKamsiRows = []; // Kamsi orders NOT counted in sales — for the "what's missing" breakdown

    for (const order of orders) {
      const journey = classifyOrderJourney(order);
      switch (journey.status) {
        case 'FULLY_ORGANIC': classificationCounts.fullyOrganic++; break;
        case 'MIXED_JOURNEY': classificationCounts.mixedJourney++; break;
        case 'NON_ORGANIC': classificationCounts.nonOrganic++; break;
        case 'ATTRIBUTION_PENDING': classificationCounts.attributionPending++; break;
        case 'NO_JOURNEY_DATA': classificationCounts.noJourneyData++; break;
        case 'UNKNOWN_ATTRIBUTION': classificationCounts.unknownAttribution++; break;
        case 'EXCLUDED_CANCELLED_ORDER': classificationCounts.excludedCancelled++; break;
        case 'EXCLUDED_TEST_ORDER': classificationCounts.excludedTest++; break;
      }

      const row = buildKamsiOrderRow(order, journey, allocation);
      if (row) {
        kamsiRelatedCount++;
        row.channel = deriveChannel(journey);
        const isFirstSessionOrganicBucket = journey.firstSessionOrganic && (journey.status === 'MIXED_JOURNEY' || journey.status === 'NON_ORGANIC');
        if (journey.status === 'FULLY_ORGANIC') {
          fullyOrganicRows.push(row);
          kamsiClassificationCounts.fullyOrganic++;
        } else if (isFirstSessionOrganicBucket) {
          // Separate bucket, never merged into FULLY_ORGANIC — per explicit
          // user instruction, "do not add this as fully organic". Order's
          // first session was confidently Organic Search, but the rest of
          // the journey did not pass the strict all-sessions rule.
          row.journeyStatus = 'FIRST_SESSION_ORGANIC';
          firstSessionOrganicRows.push(row);
          classificationCounts.firstSessionOrganic++;
          kamsiClassificationCounts.firstSessionOrganic++;
        } else {
          // Kamsi-related order excluded from sales — record why.
          switch (journey.status) {
            case 'MIXED_JOURNEY': kamsiClassificationCounts.mixedJourneyOtherwise++; break;
            case 'NON_ORGANIC': kamsiClassificationCounts.nonOrganicOtherwise++; break;
            case 'ATTRIBUTION_PENDING': kamsiClassificationCounts.attributionPending++; break;
            case 'NO_JOURNEY_DATA': kamsiClassificationCounts.noJourneyData++; break;
            case 'UNKNOWN_ATTRIBUTION': kamsiClassificationCounts.unknownAttribution++; break;
            case 'EXCLUDED_CANCELLED_ORDER': kamsiClassificationCounts.excludedCancelled++; break;
            case 'EXCLUDED_TEST_ORDER': kamsiClassificationCounts.excludedTest++; break;
          }
          row.journeyStatus = journey.status;
          excludedKamsiRows.push(row);
        }
      }
    }

    const excludedKamsiSummary = summarizeRows(excludedKamsiRows);
    const allKamsiRows = [...fullyOrganicRows, ...firstSessionOrganicRows, ...excludedKamsiRows];

    // Summary — Kamsi-matched line items only
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
      const currency = currencies.size === 1 ? [...currencies][0] : (currencies.size === 0 ? 'GBP' : 'MIXED');
      const multiCurrencyWarning = currencies.size > 1 ? [...currencies] : null;
      return {
        ordersCount: rows.length, unitsSold, grossSales, discounts, refunds, netSales,
        averageRevenuePerOrder: rows.length ? round2(netSales / rows.length) : 0,
        uniqueProductsSold: uniqueProducts.size, currency, multiCurrencyWarning,
      };
    }

    const fullyOrganicSummary = summarizeRows(fullyOrganicRows);
    const firstSessionOrganicSummary = summarizeRows(firstSessionOrganicRows);

    // "All Channels" — every Kamsi-related June order, grouped by channel
    // (derived from the first session), regardless of organic status.
    // Answers "show all channels — Google Ads and all — for Kamsi's
    // products" without touching the organic-only KPIs above.
    const byChannel = new Map();
    for (const row of allKamsiRows) {
      if (!byChannel.has(row.channel)) byChannel.set(row.channel, []);
      byChannel.get(row.channel).push(row);
    }
    const channelBreakdown = [...byChannel.entries()]
      .map(([channel, rows]) => ({ channel, ...summarizeRows(rows) }))
      .sort((a, b) => b.grossSales - a.grossSales);

    // Kamsi's (SEO team) documented "organic sales" definition = all
    // sales EXCEPT paid advertising: Direct, Referral, No Data/Unknown
    // Attribution, AI tools (ChatGPT, Perplexity, Gemini, Copilot, etc.),
    // and organic search — excludes Google/Facebook/Instagram Ads and
    // paid email. AI rows are extracted specifically out of "Other" by
    // source, not the whole Other bucket. All groups are mutually
    // exclusive by construction (each row's `channel` is a single
    // value), so this is a plain concatenation, never double-counted.
    const AI_SOURCES = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'bing chat', 'bingchat', 'character.ai', 'meta ai', 'grok'];
    const directRows = allKamsiRows.filter(r => r.channel === 'Direct');
    const referralRows = allKamsiRows.filter(r => r.channel === 'Referral');
    const noJourneyRows = allKamsiRows.filter(r => r.channel === 'No Journey Data' || r.channel === 'Unknown' || r.channel === 'Attribution Pending');
    const aiRows = allKamsiRows.filter(r => r.channel === 'Other' && r.firstVisit && AI_SOURCES.some(ai => lower(r.firstVisit.source).includes(ai)));
    const directSummary = summarizeRows(directRows);
    const referralSummary = summarizeRows(referralRows);
    const noJourneySummary = summarizeRows(noJourneyRows);
    const chatgptSummary = summarizeRows(aiRows);

    const combinedSummary = summarizeRows([
      ...fullyOrganicRows, ...firstSessionOrganicRows, ...directRows, ...referralRows, ...noJourneyRows, ...aiRows,
    ]);
    const { grossSales, discounts, refunds, netSales, currency, multiCurrencyWarning } = fullyOrganicSummary;

    const responsePayload = {
      success: true,
      staff: { name: 'Kamsi', department: 'SEO', store: 'ledsone.co.uk' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/London' },
      supportedMonths: SUPPORTED_MONTHS,
      source: {
        allocationFile: 'reports/Kamsi/data/2026-07-14_kamsi-product-allocation.csv',
        orders: 'Shopify Admin GraphQL API',
        journey: 'Shopify customerJourneySummary',
      },
      allocationStats: allocation.stats,
      summary: {
        fullyOrganicOrders: fullyOrganicRows.length,
        unitsSold: fullyOrganicSummary.unitsSold, grossSales, discounts, refunds, netSales,
        averageRevenuePerOrder: fullyOrganicSummary.averageRevenuePerOrder,
        uniqueProductsSold: fullyOrganicSummary.uniqueProductsSold,
        currency, multiCurrencyWarning,
      },
      // Separate bucket summary — orders whose FIRST session was confidently
      // Organic Search but which did not pass the strict all-sessions
      // FULLY_ORGANIC rule. Never merged into `summary` above.
      // (Only the summary total is kept here — the actual order objects
      // live once in `allKamsiOrders` below, tagged with `.channel` /
      // `.journeyStatus`, not duplicated per-bucket, to keep payload size
      // reasonable for a page users load repeatedly.)
      firstSessionOrganicSummary,
      combinedSummary,
      // Diagnostic: why weren't ALL of Kamsi's orders counted? Unlike
      // classificationCounts (site-wide), this only covers orders that
      // actually contain a Kamsi product.
      kamsiClassificationCounts,
      excludedKamsiSummary,
      // "All Channels" — every Kamsi order across every channel, once each.
      channelBreakdown,
      allKamsiOrders: allKamsiRows,
      // Breakdown of the 3 extra groups folded into combinedSummary above.
      directSummary, referralSummary, noJourneySummary, chatgptSummary,
      classificationCounts,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersFetched: orders.length,
        kamsiRelatedOrders: kamsiRelatedCount,
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
