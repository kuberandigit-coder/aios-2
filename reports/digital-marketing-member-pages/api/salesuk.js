// salesuk.js — standalone UK sales page backend (salesuk.html), deliberately
// separate from api/sales.js. Built 2026-07-27 after the discovery that
// several UK staff dashboard tabs (Kamsi/Dilaksi/DM/Sonya/Sajeepan) can
// double-count the same order under different definitions (SEO product
// scope vs ad-click attribution). This file starts a clean, order-level
// (not line-item-level) view so every order can be inspected and assigned
// by hand instead of relying on possibly-overlapping per-staff rules.
//
// Server-side only: reads SHOPIFY_UK_ADMIN_TOKEN from env, never exposed to
// the client. Read-only Shopify Admin GraphQL API — zero mutations.

const STORE_DOMAIN_UK = process.env.SHOPIFY_UK_STORE_DOMAIN || 'ledsone.myshopify.com';
const API_VERSION_UK = process.env.SHOPIFY_UK_API_VERSION || '2024-10';
const TOKEN_UK = process.env.SHOPIFY_UK_ADMIN_TOKEN;
const fs = require('fs');
const path = require('path');

// ---------- Europe/London month boundaries, DST-aware ----------
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
// Only January is wired up so far (per explicit request, 2026-07-27) — add
// more months here as this page grows the same way sales.html did.
const SUPPORTED_MONTHS = ['2026-01'];

function resolveReportMonth(monthParam) {
  const month = SUPPORTED_MONTHS.includes(monthParam) ? monthParam : '2026-01';
  const [y, m] = month.split('-').map(Number);
  const startMs = londonMidnightUTCMs(y, m, 1);
  const endMs = m === 12 ? londonMidnightUTCMs(y + 1, 1, 1) : londonMidnightUTCMs(y, m + 1, 1);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    month, startMs, endMs, isLive: false,
    label: `${MONTH_NAMES[m - 1]} 1–${daysInMonth}, ${y}`,
    queryStart: new Date(startMs - 24 * 3600 * 1000).toISOString().slice(0, 10),
    queryEnd: new Date(endMs + 24 * 3600 * 1000).toISOString().slice(0, 10),
  };
}

// ---------- Money helpers ----------
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function amt(moneySet) { return moneySet ? round2(Number(moneySet.shopMoney.amount)) : 0; }
function ccy(moneySet) { return moneySet ? moneySet.shopMoney.currencyCode : null; }

// ---------- Session classification (mirrors api/sales.js exactly) ----------
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
  return { status: 'CLASSIFIED', classifications, first };
}

// ---------- Shopify GraphQL ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function shopifyGraphQL(query, variables, retryState) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      res = await fetch(`https://${STORE_DOMAIN_UK}/admin/api/${API_VERSION_UK}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN_UK },
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
query SalesUkOrders($cursor: String, $query: String!) {
  orders(first: 100, after: $cursor, sortKey: CREATED_AT, query: $query) {
    edges {
      node {
        id
        legacyResourceId
        name
        createdAt
        updatedAt
        cancelledAt
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
              quantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedTotalSet { shopMoney { amount currencyCode } }
              taxLines { priceSet { shopMoney { amount currencyCode } } }
            }
          }
        }
        refunds {
          id
          createdAt
          refundLineItems(first: 100) {
            edges { node { subtotalSet { shopMoney { amount currencyCode } } } }
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
    if (pages > 300) break;
  }
  return { orders, pages };
}

// ---------- Order-level row builder (NOT line-item level — one row per order) ----------
function buildOrderRow(order, journey) {
  let grossSales = 0, discounts = 0, lineItemTax = 0;
  for (const edge of order.lineItems.edges) {
    const li = edge.node;
    const unitPrice = amt(li.originalUnitPriceSet);
    const grossInclTax = round2(unitPrice * li.quantity);
    const tax = round2((li.taxLines || []).reduce((s, t) => s + amt(t.priceSet), 0));
    const gross = round2(grossInclTax - tax);
    const discountedInclTax = amt(li.discountedTotalSet);
    const discountInclTax = round2(Math.max(0, grossInclTax - discountedInclTax));
    const itemTaxRate = grossInclTax > 0 ? tax / (grossInclTax - tax || 1) : 0;
    const discount = round2(discountInclTax / (1 + itemTaxRate));
    grossSales += gross;
    discounts += discount;
    lineItemTax += tax;
  }
  grossSales = round2(grossSales);
  discounts = round2(discounts);
  // Same reconciliation used across api/sales.js: order-level
  // currentTotalDiscountsSet is the reliable source when it disagrees with
  // the sum of per-line discounts.
  const orderLevelDiscountInclTax = amt(order.currentTotalDiscountsSet);
  if (orderLevelDiscountInclTax > 0 && grossSales > 0) {
    const blendedRate = lineItemTax / grossSales;
    const orderLevelDiscountExTax = round2(orderLevelDiscountInclTax / (1 + blendedRate));
    discounts = Math.max(discounts, orderLevelDiscountExTax);
  }
  let refunds = 0;
  for (const rEdge of (order.refunds || [])) {
    for (const rliEdge of (rEdge.refundLineItems && rEdge.refundLineItems.edges || [])) {
      refunds += amt(rliEdge.node.subtotalSet);
    }
  }
  refunds = round2(refunds);
  const netSales = round2(grossSales - discounts - refunds);

  const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
  const utm = (fv && fv.utmParameters) || {};

  return {
    orderId: order.id,
    orderLegacyId: order.legacyResourceId,
    orderName: order.name,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    currency: ccy(order.currentTotalPriceSet),
    orderTotal: amt(order.currentTotalPriceSet),
    grossSales, discounts, refunds, netSales,
    firstVisitSource: utm.source || (fv && fv.source) || null,
    firstVisitMedium: utm.medium || null,
    firstVisitCampaign: utm.campaign || null,
    firstVisitTerm: utm.term || null,
    firstVisitContent: utm.content || null,
    rawFirstVisitSource: fv ? fv.source : null,
    rawFirstVisitSourceType: fv ? fv.sourceType : null,
    rawFirstVisitReferrer: fv ? fv.referrerUrl : null,
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
  };
}

function summarizeOrderRows(rows) {
  let unitsPlaceholder = 0; // not tracked at order-level (no line items requested)
  let grossSales = 0, discounts = 0, refunds = 0, orderTotalSum = 0;
  const currencies = new Set();
  for (const row of rows) {
    grossSales += row.grossSales;
    discounts += row.discounts;
    refunds += row.refunds;
    orderTotalSum += row.orderTotal || 0;
    if (row.currency) currencies.add(row.currency);
  }
  grossSales = round2(grossSales);
  discounts = round2(discounts);
  refunds = round2(refunds);
  orderTotalSum = round2(orderTotalSum);
  const netSales = round2(grossSales - discounts - refunds);
  const currency = currencies.size === 1 ? [...currencies][0] : (currencies.size === 0 ? 'GBP' : 'MIXED');
  return {
    ordersCount: rows.length, grossSales, discounts, refunds, netSales, orderTotalSum,
    averageRevenuePerOrder: rows.length ? round2(netSales / rows.length) : 0,
    currency, multiCurrencyWarning: currencies.size > 1 ? [...currencies] : null,
  };
}

// ---------- Groups (mutually exclusive by construction — 2026-07-27) ----------
// GROUPS is checked in order, first match wins, so no order can ever land
// in more than one group's tab on this page — the exact overlap problem
// found on the main sales.html dashboard. Add new groups by appending here;
// never move an existing group earlier without checking what it would now
// steal from groups after it.
const DM_AD_CAMPAIGNS = ['shop_dm_pmax-46_aguasset', 'shop_dm_pmax-25'];
function isDmAdCampaign(campaign) {
  const c = (campaign || '').toString().toLowerCase();
  if (!c) return false;
  return DM_AD_CAMPAIGNS.some(base => c === base || c.startsWith(base));
}

// Meta group values as given directly by the user, 2026-07-27 (deduped):
// campaigns "Sales Ads – Copy" (en dash), "Sales Ads", "Sales Ads |
// Retargeting | Add to Cart"; sources "Facebook", "Instagram",
// "android-app://m.facebook.com/".
const META_CAMPAIGNS = new Set(['sales ads – copy', 'sales ads', 'sales ads | retargeting | add to cart']);
const META_SOURCES = new Set(['facebook', 'instagram', 'android-app://m.facebook.com/']);
function isMetaMatch(utm, fv) {
  const campaign = (utm.campaign || '').toString().toLowerCase();
  if (campaign && META_CAMPAIGNS.has(campaign)) return true;
  const source = (utm.source || (fv && fv.source) || '').toString().toLowerCase();
  if (source && META_SOURCES.has(source)) return true;
  return false;
}

// Sonya group campaigns, given directly by the user, 2026-07-27.
const SONYA_CAMPAIGNS = new Set(['klarna_sonya_kl-pmx-all', 'sonya_pendantlight']);
function isSonyaCampaign(campaign) {
  const c = (campaign || '').toString().toLowerCase();
  return !!c && SONYA_CAMPAIGNS.has(c);
}

// Sajeepan group campaigns, given directly by the user, 2026-07-27.
const SAJEEPAN_CAMPAIGNS_UK = new Set(['accessories_sj', 'gcss_all_roas_400_sajee_pmax', 'sj_top_20x', 'sajeepan_pmax_gcss_ceiling_rose_fitting_asset', 'shop_sj_pmax-25']);
function isSajeepanCampaignUk(campaign) {
  const c = (campaign || '').toString().toLowerCase();
  return !!c && SAJEEPAN_CAMPAIGNS_UK.has(c);
}

const GROUPS = [
  {
    key: 'dm-ad',
    name: 'DM-Ad',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign exactly matches (or is a prefixed variant of) "Shop_DM_PMax-46_AguAsset" or "Shop_DM_PMax-25" (case-insensitive)',
    match: (utm) => isDmAdCampaign(utm.campaign),
    matchValue: (utm) => utm.campaign,
  },
  {
    key: 'meta',
    name: 'Meta',
    department: 'Meta Ads (Facebook/Instagram)',
    scope: 'first-session utm_campaign is one of "Sales Ads – Copy" / "Sales Ads" / "Sales Ads | Retargeting | Add to Cart", OR first-session source is "Facebook" / "Instagram" / "android-app://m.facebook.com/" (case-insensitive). Checked only after DM-Ad — an order already claimed by DM-Ad never lands here.',
    match: (utm, fv) => isMetaMatch(utm, fv),
    matchValue: (utm, fv) => utm.campaign || utm.source || (fv && fv.source) || null,
  },
  {
    key: 'sonya',
    name: 'Sonya',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign exactly matches "Klarna_Sonya_kl-pmx-all" or "Sonya_PendantLight" (case-insensitive). Checked only after DM-Ad and Meta.',
    match: (utm) => isSonyaCampaign(utm.campaign),
    matchValue: (utm) => utm.campaign,
  },
  {
    key: 'sajeepan',
    name: 'Sajeepan',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign exactly matches one of "Accessories_sj", "GCSS_ALL_ROAS_400_SAJEE_PMAX", "SJ_TOP_20X", "sajeepan_pmax_gcss_ceiling_rose_fitting_asset", "Shop_SJ_PMax-25" (case-insensitive). Checked only after DM-Ad, Meta and Sonya.',
    match: (utm) => isSajeepanCampaignUk(utm.campaign),
    matchValue: (utm) => utm.campaign,
  },
  {
    key: 'sukirtha',
    name: 'Sukirtha',
    department: 'Email Marketing',
    scope: 'first-session channel is classified Email (Shopify sourceType=NEWSLETTER, or utm_medium=email, or source/description contains "email") — EVERY email-attributed order, not restricted to a specific campaign list. Checked last — an order already claimed by DM-Ad/Meta/Sonya/Sajeepan never lands here.',
    match: (utm, fv, journey) => !!(journey && journey.first && journey.first.classification === 'EMAIL'),
    matchValue: (utm, fv) => utm.campaign || (fv && fv.sourceDescription) || (fv && fv.source) || '(email, no campaign)',
  },
];

function assignGroup(utm, fv, journey) {
  for (const g of GROUPS) {
    if (g.match(utm, fv, journey)) return g;
  }
  return null;
}

function deriveChannelLabel(journey) {
  if (!journey || !journey.first) return 'No Journey Data';
  const map = {
    ORGANIC_SEARCH: 'Organic Search', PAID_SEARCH: 'Google Ads / Paid Search', DIRECT: 'Direct',
    SOCIAL: 'Social', EMAIL: 'Email', AFFILIATE: 'Affiliate', REFERRAL: 'Referral', OTHER: 'Other', UNKNOWN: 'Unknown',
  };
  return map[journey.first.classification] || 'Unknown';
}

// Diagnostic-only mode (added 2026-07-27): tally every order NOT matched by
// any group in GROUPS, using the exact same assignGroup() logic the real
// tabs use, so this always stays consistent with what the tabs actually
// show — no separate/approximate reconciliation needed.
async function handleRemaining(req, res, monthConfig, forceRefresh) {
  const startTime = Date.now();
  const retryState = { throttleRetries: 0 };
  const { orders } = await fetchOrdersForMonth(monthConfig, retryState);
  const tally = new Map();
  let remainingCount = 0, remainingNet = 0;
  for (const order of orders) {
    const journey = classifyOrderJourney(order);
    if (journey.status === 'EXCLUDED_TEST_ORDER' || journey.status === 'EXCLUDED_CANCELLED_ORDER') continue;
    const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
    const utm = (fv && fv.utmParameters) || {};
    const assigned = assignGroup(utm, fv, journey);
    if (assigned) continue;
    const row = buildOrderRow(order, journey);
    const channel = deriveChannelLabel(journey);
    const groupValue = utm.campaign || utm.term || (fv && fv.source) || '(no first-session data)';
    const key = channel + ' | ' + groupValue;
    if (!tally.has(key)) tally.set(key, { channel, group: groupValue, orders: 0, netSales: 0, orderNames: [] });
    const t = tally.get(key);
    t.orders += 1;
    t.netSales = round2(t.netSales + row.netSales);
    if (t.orderNames.length < 1000) t.orderNames.push(row.orderName);
    remainingCount += 1;
    remainingNet = round2(remainingNet + row.netSales);
  }
  res.status(200).json({
    success: true,
    reportPeriod: { month: monthConfig.month, label: monthConfig.label, timezone: 'Europe/London' },
    remainingTotal: { orders: remainingCount, netSales: remainingNet },
    remainingSplit: [...tally.values()].sort((a, b) => b.orders - a.orders),
    meta: { generatedAt: new Date().toISOString(), executionMs: Date.now() - startTime },
  });
}

// ---------- Simple in-memory cache (per warm Lambda instance only) ----------
const CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function handleGroup(req, res, monthConfig, forceRefresh, groupDef) {
  const cacheKey = groupDef.key + ':' + monthConfig.month;
  const cached = CACHE.get(cacheKey);
  if (!forceRefresh && cached && (Date.now() - cached.generatedAt) < CACHE_TTL_MS) {
    res.status(200).json({ ...cached.data, meta: { ...cached.data.meta, cacheStatus: 'hit' } });
    return;
  }

  // Static-snapshot fast path (added 2026-07-27, same pattern every other
  // historical-month tab on sales.html uses) — a live full-month Shopify
  // scan takes 30-90s+, unusable for a page load. Once generated this makes
  // a normal page load near-instant; ?refresh=1 always bypasses it.
  if (!forceRefresh) {
    const staticPath = path.join(__dirname, 'data', `salesuk-${groupDef.key}-${monthConfig.month}.json`);
    if (fs.existsSync(staticPath)) {
      const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
      const payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
      CACHE.set(cacheKey, { data: payload, generatedAt: Date.now() });
      res.status(200).json(payload);
      return;
    }
  }

  const startTime = Date.now();
  const retryState = { throttleRetries: 0 };
  const { orders, pages } = await fetchOrdersForMonth(monthConfig, retryState);

  const rows = [];
  for (const order of orders) {
    const journey = classifyOrderJourney(order);
    if (journey.status === 'EXCLUDED_TEST_ORDER' || journey.status === 'EXCLUDED_CANCELLED_ORDER') continue;
    const fv = order.customerJourneySummary && order.customerJourneySummary.firstVisit;
    const utm = (fv && fv.utmParameters) || {};
    const assigned = assignGroup(utm, fv, journey);
    if (!assigned || assigned.key !== groupDef.key) continue;
    const row = buildOrderRow(order, journey);
    row.matchedCampaign = groupDef.matchValue(utm, fv);
    rows.push(row);
  }

  const byCampaign = new Map();
  for (const r of rows) {
    const k = r.matchedCampaign || '(unknown)';
    if (!byCampaign.has(k)) byCampaign.set(k, []);
    byCampaign.get(k).push(r);
  }
  const campaignSummary = [...byCampaign.keys()].sort()
    .map(code => ({ campaign: code, ...summarizeOrderRows(byCampaign.get(code)) }))
    .sort((a, b) => b.ordersCount - a.ordersCount);

  const combinedSummary = summarizeOrderRows(rows);

  const payload = {
    success: true,
    group: { name: groupDef.name, department: groupDef.department, store: 'ledsone.co.uk' },
    reportPeriod: { month: monthConfig.month, label: monthConfig.label, timezone: 'Europe/London' },
    supportedMonths: SUPPORTED_MONTHS,
    source: {
      scope: `store-wide (NOT product-scoped) — an order belongs to ${groupDef.name} if its ${groupDef.scope}. Order-level rows (no per-product breakdown) with full session history. Groups are checked in a fixed priority order (${GROUPS.map(g => g.name).join(' -> ')}) so no order can appear in more than one group's tab. Standalone page, built 2026-07-27.`,
      orders: 'Shopify Admin GraphQL API',
      journey: 'Shopify customerJourneySummary',
    },
    campaignList: [...byCampaign.keys()].sort(),
    combinedSummary,
    campaignSummary,
    orders: rows,
    meta: {
      generatedAt: new Date().toISOString(),
      cacheStatus: 'miss',
      ordersFetched: orders.length,
      matchedOrders: rows.length,
      pagesFetched: pages,
      throttleRetries: retryState.throttleRetries,
      executionMs: Date.now() - startTime,
    },
  };
  CACHE.set(cacheKey, { data: payload, generatedAt: Date.now() });
  res.status(200).json(payload);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!TOKEN_UK) {
    res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' });
    return;
  }
  const forceRefresh = req.query && req.query.refresh === '1';
  const monthConfig = resolveReportMonth(req.query && req.query.month);
  const groupKey = ((req.query && req.query.group) || 'dm-ad').toString().toLowerCase();
  const groupDef = GROUPS.find(g => g.key === groupKey);

  try {
    if (groupKey === 'remaining') {
      await handleRemaining(req, res, monthConfig, forceRefresh);
    } else if (groupDef) {
      await handleGroup(req, res, monthConfig, forceRefresh, groupDef);
    } else {
      res.status(400).json({ success: false, error: `Unknown group "${groupKey}"` });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
