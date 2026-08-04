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
// Jan-Jun wired up as closed/historical months; July added 2026-07-28 as
// the current LIVE month (mirrors sales.html's convention) — never gets a
// permanent static snapshot, always reflects month-to-date data. Add more
// months here as this page grows the same way sales.html did.
const SUPPORTED_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const CURRENT_LIVE_MONTHS = ['2026-08'];

function resolveReportMonth(monthParam) {
  const month = SUPPORTED_MONTHS.includes(monthParam) ? monthParam : '2026-01';
  const [y, m] = month.split('-').map(Number);
  const startMs = londonMidnightUTCMs(y, m, 1);
  const monthEndMs = m === 12 ? londonMidnightUTCMs(y + 1, 1, 1) : londonMidnightUTCMs(y, m + 1, 1);
  const isLive = CURRENT_LIVE_MONTHS.includes(month);
  const endMs = isLive ? Math.min(monthEndMs, Date.now()) : monthEndMs;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDay = isLive ? Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric' }).format(new Date(endMs))) : daysInMonth;
  return {
    month, startMs, endMs, isLive,
    label: isLive ? `${MONTH_NAMES[m - 1]} 1–${endDay} (month to date), ${y}` : `${MONTH_NAMES[m - 1]} 1–${daysInMonth}, ${y}`,
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
              variant { product { legacyResourceId } }
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
const DM_AD_CAMPAIGNS = ['shop_dm_pmax-46_aguasset', 'shop_dm_pmax-46', 'sag_organic'];
function isDmAdCampaign(campaign) {
  const c = (campaign || '').toString().toLowerCase();
  if (!c) return false;
  return DM_AD_CAMPAIGNS.some(base => c === base || c.startsWith(base));
}

// Meta group values as given directly by the user, 2026-07-27 (deduped):
// campaigns "Sales Ads – Copy" (en dash), "Sales Ads", "Sales Ads |
// Retargeting | Add to Cart"; sources "Facebook", "Instagram",
// "android-app://m.facebook.com/".
const META_CAMPAIGNS = new Set(['sales ads – copy', 'sales ads', 'sales ads | retargeting | add to cart', 'new sales ad set', 'abo sales ads - retarget - catalog ads', 'abo sales ads - lookalike - catalog ads']);
const META_SOURCES = new Set(['facebook', 'instagram', 'ig', 'android-app://m.facebook.com/']);
function isMetaMatch(utm, fv, journey, month) {
  const campaign = (utm.campaign || '').toString().toLowerCase();
  if (campaign && META_CAMPAIGNS.has(campaign)) return true;
  const source = (utm.source || (fv && fv.source) || '').toString().toLowerCase();
  if (source && META_SOURCES.has(source)) return true;
  // "Social | an unknown source" confirmed by the user, 2026-07-27 — a
  // Social-classified first session whose source Shopify couldn't identify.
  if (deriveChannelLabel(journey) === 'Social' && source === 'an unknown source') return true;
  // May-only: EVERY Social-channel order -> Meta, confirmed by the user,
  // 2026-07-27 (broader than the specific-source rule above).
  if ((month === '2026-05' || month === '2026-06') && deriveChannelLabel(journey) === 'Social') return true;
  return false;
}

// Second-session lookthrough (added 2026-07-27, per user request): when the
// first session carries no campaign/term at all, check the SECOND session's
// utm_campaign instead — used only for a small number of specific,
// user-confirmed cases below, never as a general rule.
function secondSessionCampaign(journey) {
  const second = journey && journey.classifications && journey.classifications[1];
  const utm = second && second.visit && second.visit.utmParameters;
  return (utm && utm.campaign || '').toString().toLowerCase();
}

// Last-session lookthrough (added 2026-07-27, per user request, generalizing
// the 2nd-session check above): when the first session carries no
// campaign/term, check the FINAL (converting) session's utm_campaign
// instead — a customer can browse several untagged sessions before their
// last one picks up a real campaign tag. Still diagnostic-only in spirit:
// only used for the specific campaigns confirmed by the user below.
function lastSessionCampaign(journey) {
  const list = journey && journey.classifications;
  const last = list && list[list.length - 1];
  const utm = last && last.visit && last.visit.utmParameters;
  return (utm && utm.campaign || '').toString().toLowerCase();
}

// Organic group: Direct / Referral (all) / No Journey Data / a specific
// whitelist of Organic Search sources / Other-ChatGPT — confirmed by the
// user, 2026-07-27, after verifying these carry no paid-ad signal.
// Deliberately excludes "Organic Search | Multifeeds" and the other three
// stray "Other" entries (Shopping/unknown source/klarna-merchantboost) —
// not confirmed by the user, left in the remaining/unassigned pool.
const ORGANIC_SEARCH_SOURCES = new Set(['google', 'android-app://com.google.android.googlequicksearchbox/', 'bing', 'duckduckgo', 'android-app://com.google.android.gm/', 'ecosia', 'yahoo']);
function isOrganicMatch(utm, fv, journey) {
  const channel = deriveChannelLabel(journey);
  // 'Direct' removed from Organic (2026-07-30, per user request) — it now
  // has its own standalone "Direct" tab/page, checked earlier in GROUPS.
  if (channel === 'Referral' || channel === 'No Journey Data') return true;
  if (channel === 'Organic Search') {
    // Match on the actual traffic SOURCE, not utm_campaign — Shopify tags
    // some genuine Google-organic clicks (via the free Google Shopping
    // listings surface) with utm_campaign="Multifeeds" even though
    // utm_source/source is still "google". Root-caused 2026-07-27: an
    // earlier version of this check let utm.campaign shadow the real
    // source in the display label (not the match itself).
    // Substring match (not exact-equals), added 2026-07-27: Shopify
    // sometimes records the source as a full URL ("https://www.ecosia.org/")
    // instead of the plain engine name ("ecosia") — an exact-match Set
    // lookup missed those. Every whitelisted name below is still a safe
    // substring check (none collide with each other).
    const src = ((fv && (fv.source || fv.sourceDescription)) || utm.source || '').toString().toLowerCase();
    return [...ORGANIC_SEARCH_SOURCES].some(known => src.includes(known));
  }
  if (channel === 'Social') {
    // Pinterest confirmed by the user, 2026-07-27, as organic (not paid) —
    // distinct from Meta's Facebook/Instagram paid-social campaigns.
    const src = ((fv && fv.source) || utm.source || '').toString().toLowerCase();
    return src === 'pinterest';
  }
  if (channel === 'Other') {
    const src = ((fv && fv.source) || utm.source || '').toString();
    return src === 'ChatGPT' || src.toLowerCase() === 'an unknown source';
  }
  return false;
}

// Sonya group campaigns, given directly by the user, 2026-07-27.
const SONYA_CAMPAIGNS = new Set(['klarna_sonya_kl-pmx-all', 'sonya_pendantlight', 'sh_wall_light', 'klarna_sonya_kl-englisheu-all']);
function isSonyaCampaign(campaign) {
  const c = (campaign || '').toString().toLowerCase();
  return !!c && SONYA_CAMPAIGNS.has(c);
}
// Sonya's 6 confirmed utm_term values (same rule already used on the main
// sales.html Sonya tab, added 2026-07-22) — layered on top of the campaign
// match, added 2026-07-27 after finding 26 remaining orders under
// campaigns not in SONYA_CAMPAIGNS but carrying one of these terms.
const SONYA_TERMS = new Set(['sonya', 'ninc', 'glow_up', 'sonyaireland', 'sonyaspian', 'sonytopeuropeengeu{_adgroup}']);
function isSonyaTerm(term) {
  const t = (term || '').toString().toLowerCase();
  return !!t && SONYA_TERMS.has(t);
}

// Sajeepan group campaigns, given directly by the user, 2026-07-27.
const SAJEEPAN_CAMPAIGNS_UK = new Set(['accessories_sj', 'gcss_all_roas_400_sajee_pmax', 'sj_top_20x', 'sajeepan_pmax_gcss_ceiling_rose_fitting_asset', 'shop_sj_pmax-25', 'aji_sh_pmax', 'shop_dm_pmax-25', 'klarna_p', 'sj_pmax_scale_heroes_25', 'klarna_css_sj25_pmax', 'klarna_g2', 'gcss_all_roas_400_sajee', 'shop_dm_pmax-25_zero', 'p_max_klarna_css_sj_old']);
function isSajeepanCampaignUk(campaign) {
  const c = (campaign || '').toString().toLowerCase();
  return !!c && SAJEEPAN_CAMPAIGNS_UK.has(c);
}

// Sajeepan product-ID ownership within DM Campaigns (added 2026-07-30, per
// user request: "sajeepan tab add as from DM champaigns" — DM Ads and
// Sajeepan both run Google Ads, but the DM-Ad tab's campaign match catches
// orders for products Sajeepan actually owns). Any order whose line items
// include one of these product IDs is pulled out of DM-Ad and into
// Sajeepan's tab, regardless of which campaign the click carried.
const SAJEEPAN_PRODUCT_IDS_UK = new Set([
  '4586055925856', '14933202731394', '15187862323586', '6754306097313', '6818484650145',
  '14921688416642', '7992009392378', '14883363324290', '14880702562690', '4417265959008',
  '8050371068154', '8060501229818', '5282330738849', '6755764076705', '14900892729730',
  '7676244623610', '5752972902561', '14906898448770', '8011172217082', '7984208216314',
  '4417296695392', '4592990716000', '7762610618618', '15170044297602', '8149964718330',
  '14878271373698', '8166046662906', '15106577695106', '15123994182018', '8103204356346',
  '8031875891450', '7661573800186', '6999643979937', '6842385236129', '14929082253698',
  '14983364116866', '7845975654650', '7564838371578', '8115372130554', '6558586470561',
  '8017109451002', '7982629748986', '4506283442272', '4417272184928', '8085567504634',
  '15065372787074', '8182859694330', '4417280606304', '15069278798210', '6750861492385',
  '4537521242208', '15143665828226', '5907634290849', '5240106352801', '8156711780602',
  '8021911044346', '7982118568186', '8160577388794', '6842428293281', '4538256195680',
  '15156143882626', '8166990774522', '6895318237345', '8630295331066', '14933997158786',
  '14925007192450', '14968061985154', '7982092124410', '5509926977697', '8630679011578',
  '14998206972290', '14878296572290', '15160335073666', '7502163738874', '7038324179105',
  '6672640868513', '8011599216890', '4417257078880', '14927469085058', '4553369419872',
  '4542939234400', '14934429598082', '5594436141217', '8073704014074', '14883343040898',
  '4417267531872', '8016430399738', '7560182497530', '8630672883962', '8011105042682',
  '4536805982304', '7651375677690', '4572385214560', '8222107369722', '15193564217730',
  '6756420288673', '6054283411617', '15139784786306', '6942018633889', '6756036837537',
  '15205246632322', '7982361575674', '4436070793312', '15070099079554', '7714001813754',
  '8104214036730', '15139786457474', '6666852532385', '14820687675778', '15139130343810',
  '8095915835642', '6863171322017', '4417267040352', '7702888907002', '4536644337760',
  '8109485031674', '15185667948930', '6052094935201', '7961561334010', '15206086672770',
  '14883152527746', '6819622650017', '15172439998850', '6931062784161', '8004294279418',
  '7659907973370', '6978115436705', '5806504050849', '6827275944097', '8053217886458',
  '14883356803458', '7053367607457', '15177725247874', '7632863691002', '6894937866401',
  '7601296179450', '8152158732538', '6749407051937', '7834308378874', '15048390214018',
  '7697310351610', '7487900319994', '8102757761274', '14921161048450', '8166024478970',
  '4417270939744', '6936508235937', '8072552579322', '7716552999162', '7585585332474',
  '8160583778554', '5370613399713', '6812500557985', '8110972240122', '6896671162529',
  '8155912274170', '8004047241466', '6851839361185', '7982630109434', '14929097884034',
  '15217248764290', '7982924988666', '7982900707578', '7708425355514', '6852485021857',
  '4417281458272', '4417256456288', '15203677372802', '7642582417658', '4490900930656',
  '4600842453088', '7983281504506', '14891155063170', '7983942369530', '7692736659706',
  '8017508073722', '8367805399290', '5245806313633', '4590505033824', '7500851708154',
  '7717833015546', '8156619636986', '15160093049218', '5956068606113', '8011839176954',
  '7065159762081', '14960182296962', '7617807024378', '8100609065210', '7505928257786',
  '14889922855298', '7855905931514', '8104560591098', '14882318418306', '6914992504993',
  '7649552007418', '5971602210977', '4417261305952', '4417285128288', '6754369142945',
  '7541267661050', '4417258356832', '14929692524930', '6052094836897', '14966391079298',
  '8162308653306', '7606776889594', '7928123916538', '14909203972482', '4537408749664',
  '7983934669050', '14932174635394', '8060335456506', '8010522525946', '15211174101378',
  '14961228218754', '7977115615482', '7982905229562', '7692731384058', '6866848448673',
  '5282439004321', '4417261863008', '7983942861050', '8173292093690', '4417286537312',
  '7723836899578', '4528319660128', '14927459418498', '8248377606394', '6887867482273',
  '7855951184122', '15105659044226', '8110991802618', '14932713210242', '8011908514042',
  '7987073057018', '4589278527584', '15071151653250', '8109486964986', '8154523697402',
  '8479369429242', '8162856403194', '7452904095994', '7982347092218', '15065242534274',
  '8062184456442', '6542267646113', '4590874787936', '6751751766177', '7986253037818',
  '7640298291450', '5873931583649', '6912222789793', '8165779144954', '7910139724026',
  '14823229260162', '7982925283578', '6967004692641', '4572385771616', '7865865437434',
  '5740007129249', '8022239478010', '15124381794690', '6620250898593', '7588225220858',
  '14824281309570', '7983290286330', '7649650278650', '4587391058016', '7541360066810',
  '4417271464032', '4417259700320', '14924979175810', '8156713582842', '8070720520442',
  '14927886680450', '7983374172410', '5373857366177', '7038329847969', '6052094607521',
  '4490902569056', '4417294893152', '15205344870786', '4417262518368', '8161314111738',
  '14895430205826', '7564837912826', '4417289551968', '7986285445370', '14875756790146',
  '4493458571360', '7986340528378', '4573903454304', '7984228008186', '7691075289338',
  '7559370178810', '14934638199170', '8010511319290', '7560179384570', '6842221527201',
  '4448091865184', '15164626207106', '7643969257722', '6914752151713', '7673413828858',
  '8027660943610', '8014623506682', '7610244727034', '8021920907514', '8013925777658',
  '8053232468218', '8014339965178', '7500758483194', '4460364791904', '15052065276290',
  '4417295974496', '7615777243386', '15160144101762', '5343276368033', '4417257308256',
  '7983330394362', '7062444966049', '4417279656032', '7640297079034', '8011902058746',
  '4572385443936', '7560398602490', '4537416974432', '6773916827809', '4417292828768',
  '8010062004474', '4417290764384', '8179293782266', '4417286176864', '4589284917344',
  '15198794482050', '8134249382138', '7516400845050', '8009527689466', '6863281488033',
  '8565863579898', '5991593771169', '7694648869114', '6883251028129', '7470952055034',
  '7452902818042', '14928373383554', '4417274544224', '14798531264898', '8163035676922',
  '14957531332994', '14927479144834', '14925553828226', '7590204801274', '5956002742433',
  '6594007138465', '8157983932666', '4538255540320', '15217386226050', '4490902601824',
  '7065159860385', '15156134510978', '7984218112250', '14848208535938', '8341209514234',
  '8149955641594', '6685791813793', '6987652300961', '7609246613754', '14928536764802',
  '14881058324866', '7099555315873', '15101194666370', '7651376791802', '4417258651744',
  '7609246875898', '4417287585888', '14965699674498', '14960127476098', '14932618477954',
  '7015409189025', '14925581484418', '14950492635522', '14960407609730', '8649884762362',
  '14932383039874', '6891632689313', '6810064847009', '5238207807649', '7606776987898',
  '8445363749114', '7713759723770', '7994249281786', '7615777341690', '14953043689858',
  '15214437728642', '15162214482306', '6026337190049', '7694648738042', '5784602575009',
  '4524553470048', '6024708948129', '15112981807490', '4417272086624', '4487760674912',
  '5877381890209', '7984498180346', '8005785288954', '6052095459489', '7053693649057',
  '4448091013216', '14927467610498', '8224230670586', '7564838174970', '8017199005946',
  '14877932093826', '8009550758138', '14907263746434', '15217364730242', '5785150095521',
  '8012324143354', '7630664532218', '14930662588802', '7982405615866', '14924135596418',
  '14874527465858', '7982927741178', '6812509110433', '8021882536186', '7560179712250',
  '15185670078850', '8073630122234', '7983273738490', '7928153112826', '15198882660738',
  '8116915273978', '6842442612897', '5956003758241', '4417254850656', '5956068507809',
  '14933787345282', '4417265893472', '4417292599392', '4495471444064', '7845898584314',
  '15198872043906', '14872979800450', '15008542491010', '8156619211002', '5998486388897',
  '4523828150368', '5887546425505', '5873930829985', '14928519266690', '6749409083553',
  '6741957804193', '6798979760289', '8062958928122', '4536343134304', '8175077720314',
  '7977115681018', '5928615837857', '7865820414202', '6634014277793', '15158078505346',
  '14960160276866', '6896521281697', '7982654128378', '7015799685281', '8061987029242',
  '15205229658498', '7865900957946', '14934663922050', '5282331099297', '7600712679674',
  '7982594162938', '7946045423866', '4417257013344', '8075991318778', '4436070760544',
  '7560398504186', '14932253344130', '7982351614202', '4417292501088', '15157516763522',
  '14932699644290', '7469127303418', '7986338955514', '6666852925601', '4538255704160',
  '14929701208450', '4490900701280', '4590713733216', '5866936369313', '14877123543426',
  '6750878367905', '8225165869306', '6749407281313', '8017859444986', '4552638890080',
  '4417287290976', '8100586193146', '14882325135746', '4417267826784', '7910139461882',
  '4417293385824', '4417290862688', '14888999289218', '15211215061378', '4417287258208',
  '14877951099266', '6755814080673', '14956271567234', '5471051612321', '5928354611361',
  '8073391374586', '7611373682938', '15176571552130', '5321026535585', '14928457171330',
  '4599649140832', '7043673882785', '4417272414304', '5798908821665', '7983922086138',
  '15211033461122', '14928374890882', '8484669948154', '5278378393761', '7962265321722',
  '5321026142369', '6765700219041', '7487959597306', '8122648789242', '7983926903034',
  '6741957607585', '7688943010042', '14977818722690', '7069908730017', '14935131783554',
  '7588225777914', '8116133036282', '5956003954849', '8053246034170', '14909359948162',
  '14934472556930', '4417255178336', '7688946385146', '5313902870689', '7668027457786',
  '15109825036674', '4417273725024', '7684507730170', '14879664472450', '5321026896033',
  '8651637883130', '5482307420321', '8011872731386', '7982900510970', '4417253867616',
  '5877381398689', '7695392047354', '6026337484961', '4524553961568', '15214395752834',
  '6852406640801', '15113222390146', '7617797783802', '14937984106882', '4417284571232',
  '4417292435552', '4488111292512', '15143247839618', '15163062747522', '5911744282785',
  '15072964149634', '4417289814112', '7610439237882', '5509927927969', '4417270317152',
  '14934468723074', '7452902981882', '8000785416442', '7455209357562', '7452903833850',
  '6542267515041', '8651485544698', '6052095787169', '5981722083489', '7704065671418',
  '4536805949536', '4575608963168', '4538255769696', '7985986568442', '4417274904672',
  '4417270710368', '4552703279200', '8230533071098', '15211902665090', '4417280475232',
  '5474398503073', '15105611137410', '15198742249858', '15011934437762', '7986351079674',
  '6026304487585', '7702867378426', '4523829198944', '4490901028960', '4417274151008',
  '4417285914720', '4538256097376', '5956002578593', '5911743070369', '5784601854113',
  '15097993560450', '5911743234209', '6749408166049', '8154759332090', '4417275691104',
  '14932411875714', '4417257996384', '6611834601633', '5360818946209', '7983276556538',
  '5360127180961', '14921103802754', '6008906645665', '6869586149537', '7977118728442',
  '14929797939586', '14959191949698', '6026325655713', '7983910879482', '5244462006433',
  '14924998574466', '4553369485408', '15114173645186', '4417273921632', '7676377170170',
  '7690215031034', '4417260847200', '7688953430266', '7640296227066', '15069263692162',
  '5314626879649', '14875784708482', '7649552761082', '4524554584160', '4506283212896',
  '8021886697722', '4417256390752', '8011834163450', '4417254162528', '14874202472834',
  '7541546877178', '14877967122818', '6614011674785', '4489723248736', '7525714526458',
  '6749410623649', '6069693579425', '6898501189793', '5866936533153', '7487312920826',
  '6672631726241', '14927474459010', '8096699089146', '4468584087648', '8009118974202',
  '8593529241850', '14892889276802', '4417271103584', '4417255538784', '4509718511712',
  '6542267613345', '8182852878586', '7467514102010', '8011571331322', '4417286635616',
  '8230767952122', '8062167023866', '7560180269306', '8073532997882', '7455210799354',
  '4448092848224', '4551406878816', '15205949276546', '6669121814689', '7560181448954',
  '7606831186170', '15205088788866', '14957795213698', '5887545770145', '8076166136058',
  '7762587549946', '8570797981946', '6685792403617', '6024708620449', '7618507866362',
  '4417259012192', '7661571145978', '4523828772960', '4417257406560', '8145329357050',
  '8016439509242', '7910139199738', '4587394859104', '5282330509473', '5971602702497',
  '7977117679866', '6594007302305', '7977117712634', '5873931124897', '6749406855329',
  '14925064405378', '15206151291266', '7984498868474', '7982675362042', '14973836591490',
  '4417291649120', '4448092684384', '5500547858593', '4554880319584', '6001951015073',
  '4417262125152', '7983352512762', '4417275592800', '4417274773600', '7560398045434',
  '7560182006010', '5282330542241', '14984874131842', '4417275461728', '7560180171002',
  '14925531939202', '4488111456352', '7610299121914', '7649553219834', '7982095925498',
  '5758821597345', '4417266679904', '5866936467617', '14880113525122', '5877380153505',
  '15198903730562', '8433335468282', '7987350438138', '14929131569538', '4506282983520',
  '4506283409504', '8009486926074', '15068619735426', '6749408919713', '14929110466946',
  '4417253703776', '4417258913888', '4524554354784', '8100560994554', '4417292697696',
  '14924718440834', '7470952546554', '15129924600194', '7487339823354', '8063044157690',
  '7429687967994', '7986251268346', '7568387965178', '5956003397793', '4475668136032',
  '5911742775457', '4417289617504', '7609712902394', '4417285193824', '14882705146242',
  '7800179753210', '4417259176032', '4417258324064', '14896476127618', '4448092717152',
  '6069694365857', '5758488871073', '4417274052704', '7984513679610', '5433838305441',
  '6052094673057', '15209932882306', '6685791551649', '8132266230010', '7065169461409',
  '4417256652896', '7982924824826', '4417295056992', '7986311954682', '4489762373728',
  '15205938430338', '5753361760417', '14928395633026', '6052094738593', '5661710483617',
  '6022552813729', '7487961792762', '4484056449120', '6024708554913', '6749410328737',
  '4537408782432', '4490900734048', '4417255899232', '6637699891361', '14928368501122',
  '4488111882336', '4417294073952', '4417270415456', '6001950916769', '5244461547681',
  '4417255276640', '8014166556922', '4538255802464', '4417271365728', '7982636400890',
  '5998486913185', '8004329373946', '7467514822906', '6855729840289', '5928354381985',
  '4523828084832', '4553369059424', '5239482876065', '6026337943713', '6749411606689',
  '8175817097466', '5670350356641', '7977120956666', '6594009301153', '6052095688865',
  '7065159893153', '7541402697978', '5742784053409', '7691129585914', '4417270055008',
  '7608529813754', '7977119711482', '15114465935746', '14961292312962', '15264861815170',
  '15270014648706', '15273914204546', '15260848095618', '6069694136481', '15319604593026',
  '5814731276449', '15260844720514', '15279239856514', '15211902828930', '14984921088386',
  '15273127117186', '6024708325537', '4552674377824', '15269981028738', '15273985540482',
  '6664892285089', '5359897903265', '6837460107425', '6026335355041', '8161319813370',
  '4417257439328', '15269017223554', '15269014962562', '15280019800450', '15270801146242',
  '15280014459266', '14880238764418', '6664892612769', '5294722318497', '14927534457218',
  '7487151145210', '14933198373250', '14928494133634', '6001950621857', '4484057006176',
  '6685790797985', '7560399257850', '7989043036410', '7505935630586', '15269011292546',
  '7986289410298', '15273888153986', '4417276248160', '15273974301058', '14933967765890',
  '7982372618490', '8156695494906', '14951624147330', '14975890751874', '15026373132674',
  '15145627189634', '14940507439490', '8011577524474', '6856559394977', '14933786067330',
  '14971726856578', '15086824292738', '15037028532610', '14883184509314', '6885676089505',
  '7541241512186', '7998887231738', '8154257228026', '14882330345858', '6052095230113',
  '8109554172154', '15145624568194', '7645788373242', '15102988484994', '15000444338562',
  '5956002840737', '4417271693408', '8162234794234', '14968000905602', '4417257898080',
  '6885499404449', '14929118691714', '7487348441338', '6935633068193', '8005800165626',
  '4417280376928', '6022553010337', '6022421610657', '5508867260577', '4417265041504',
  '4524606324832', '5742785298593', '14995625640322', '15065359057282', '8113180868858',
  '5482060284065', '7560179613946', '4551406977120', '7452902850810', '5282611953825',
  '6054233637025', '7452902686970', '15147501781378', '7440701882618', '7069847093409',
  '8154855145722', '14971144536450', '7500236128506', '7589224349946', '5742785003681',
  '14959092498818', '6768355180705', '4536806277216', '8014641004794', '15148644204930',
  '7588225581306', '14883169239426', '14975507890562', '5770426941601', '6754421309601',
  '8015404761338', '4448091471968', '7606776922362', '14968030396802', '7452903702778',
  '6594006810785', '8006266454266', '15148456018306', '15167402049922', '14882111193474',
  '8163090858234', '8165930172666', '5866936598689', '4609352368224', '4523827724384',
  '15082728554882', '8565791817978', '4417281687648', '14933802582402', '5753048727713',
  '8011834523898', '7452903768314', '4417268973664', '7910139592954', '15066740687234',
  '7542209741050', '8090718732538', '4417263239264', '15052655493506', '7588220272890',
  '7642578419962', '15148610191746', '5742783922337', '4589196509280', '8096040157434',
  '5911743856801', '5753361465505', '6008908644513', '14971620131202', '7567608873210',
  '8113902878970', '8109646545146', '14932217528706', '8155358855418', '5814733832353',
  '8035035447546', '8522981998842', '4417282277472', '7570088329466', '6876475523233',
  '14971672428930', '8039353352442', '4506283343968', '4417290600544', '4417288274016',
  '8009493381370', '8100986945786', '8167769669882', '7989037727994', '4417274740832',
  '14968265769346', '4536806473824', '8004471390458', '6964730101921', '14958826324354',
  '14995616203138', '4417277100128', '4417291288672', '6741957902497', '7982935277818',
  '7715804348666', '8011839537402', '7452903145722', '6869514977441', '8487866925306',
  '6008906121377', '4589199032416', '15074120925570', '7694648770810', '8156793209082',
  '8039361413370', '14970823049602', '7676245868794', '7588225089786', '4537417039968',
  '4417283096672', '4417268121696', '5770426712225', '4572372303968', '7999536070906',
  '5901236928673', '6052094509217', '6914542665889', '4448091668576', '4505244958816',
  '14971673837954', '4417279983712', '8175798681850', '5729491091617', '14984125350274',
  '4417279819872', '4460364857440', '14933888237954', '8626277548282', '7455210864890',
  '15064665588098', '15069349151106', '4417269465184', '14930568741250', '8011826987258',
  '7501695582458', '6936330600609', '4417293516896', '6685791912097', '8192172130554',
  '8222103798010', '8014154203386', '5991593935009', '8175786131706', '4496148201568',
  '7560398307578', '5334243016865', '4417286209632', '14937352143234', '14879661883778',
  '7983319482618', '4417284407392', '5474398765217', '7455208472826', '15163114979714',
  '7992642699514', '8011830034682', '4448092356704', '8026778796282', '8172540264698',
  '7538525667578', '5742785495201', '7019566006433', '6685791486113', '7713759691002',
  '6024709374113', '5373911892129', '4448091340896', '4589475135584', '8009549349114',
  '15068625535362', '4536795856992', '6798977663137', '4417268449376', '7984494739706',
  '6594008842401', '8009550725370', '6637699301537', '7617807057146', '6052095197345',
  '4505244827744', '15070213472642', '14934032843138', '14934428385666', '7985252729082',
  '7983914352890', '5873930535073', '4460364955744', '7452903964922', '5294721761441',
  '6635418910881', '4417257734240', '15146135683458', '7983916679418', '4417269661792',
  '6749406724257', '4417269563488', '7977119580410', '4490901618784', '4572385607776',
  '7999153209594', '8183771758842', '4417263403104', '14953771008386', '5866682843297',
  '7999167463674', '5278378459297', '14924942672258', '14932471939458', '7619394470138',
  '7564838306042', '4518920192096', '7982346141946', '4536795562080', '8156639461626',
  '14928505110914', '7560180072698', '4417253900384', '8010099753210', '6611256869025',
  '8009901703418', '7569161781498', '7452902523130', '5798909018273', '7984263594234',
  '5334385819809', '7984507715834', '8009500885242', '8006238404858', '7560179548410',
  '8075192238330', '6749407477921', '7455209816314', '4570365427808', '7487955927290',
  '14951566213506', '7679463981306', '4536806342752', '4448092225632', '4417290829920',
  '8163107569914', '7608529780986', '7452904161530', '4553369321568', '7644911403258',
  '7588227121402', '14989636927874', '7455208079610', '4536806047840', '8629243805946',
  '8010960011514', '5928354513057', '7984495132922', '5784601985185', '5998486716577',
  '5814733308065', '4536806604896', '4490902241376', '4448091734112', '5742782578849',
  '4490902077536', '7542214983930', '7560399290618', '6637700022433', '14946951397762',
  '6069693317281', '5742780874913', '14930646729090', '4569343262816', '5866936631457',
  '6685791027361', '7673411535098', '8641920434426', '6634014146721', '6573956989089',
  '4448091963488', '5244462596257', '7455209586938', '4417266974816', '8009195847930',
  '7845306466554', '6845726851233', '8009254797562', '5991593246881', '7651374891258',
  '14965146714498', '6818356887713', '8154495549690', '6999300178081', '15114465608066',
  '5543091536033', '14879114002818', '5245805789345', '6860377555105', '4417279328352',
  '7987056181498', '8565001978106', '8005820285178', '7983355592954', '6751752224929',
  '4417268023392', '14878715249026', '6845851041953', '8011000381690', '8005801738490',
  '7062445359265', '4417284702304', '8167782383866', '8010492346618', '4417260519520',
  '4572385935456', '8011122671866', '8175026798842', '7691129291002', '6878738219169',
  '14919907639682', '8160579059962', '7589224775930', '5806505328801', '4417290567776',
  '4468548173920', '7852431048954', '4417285226592', '7642575470842', '4590456864864',
  '4460364595296', '7697310384378', '4417263468640', '6966926704801', '8107412750586',
  '8021874147578', '8113201152250', '4417282736224', '8039348633850', '14875084423554',
  '6754266120353', '5320834285729', '7099592409249', '7455207588090', '8026824245498',
  '7984164471034', '8014175895802', '7588221223162', '4551406780512', '4460365480032',
  '7570088558842', '6856618082465', '4417277886560', '14893571899778', '8167014465786',
  '4528320479328', '7542240248058', '7691129749754', '8097288814842', '8174260060410',
  '7982908342522', '4417275887712', '7910311821562', '8115366265082', '6024708522145',
  '4523827232864', '6986388209825', '4448091897952', '7644912386298', '4498548260960',
  '6986418749601', '4417257209952', '4417293221984', '8137822208250', '6061345177761',
  '8156701393146', '8136238366970', '7985984143610', '7526905741562', '4417254293600',
  '5866683007137', '7984489267450', '7470952153338', '14877939368322', '4448093175904',
  '4460365283424', '5742787100833', '8009844654330', '6061344293025', '7470952481018',
  '4523830345824', '7062445031585', '4505246433376', '4536795725920', '8004344152314',
  '4536806572128', '7570088362234', '8010025959674', '5956003266721', '6022553796769',
  '8004050977018', '8009861333242', '7615777014010', '4572386033760', '6024708915361',
  '4417265172576', '4417260978272',
]);
function orderHasSajeepanProduct(order) {
  if (!order || !order.lineItems) return false;
  return order.lineItems.edges.some((e) => {
    const pid = e.node.variant && e.node.variant.product ? e.node.variant.product.legacyResourceId : null;
    return pid && SAJEEPAN_PRODUCT_IDS_UK.has(String(pid));
  });
}

// Sonya product-ID ownership within DM Campaigns (added 2026-07-30, same
// pattern as Sajeepan above, per user request). 3 product IDs appear in
// BOTH Sonya's and Sajeepan's lists as given by the user ('5359897903265',
// '4417270055008', '14927886680450') — Sonya is checked first in GROUPS
// priority order, so an order containing one of those 3 IDs (and otherwise
// unclaimed) resolves to Sonya. Flagged to the user; not yet confirmed
// which owner should win on that overlap.
const SONYA_PRODUCT_IDS_UK = new Set([
  '4417257963616', '7977105424634', '7983221932282', '7982923383034', '5359897903265',
  '5432724422817', '4417257373792', '6761677750433', '7570088460538', '8010901520634',
  '8010981998842', '8010993107194', '8011927027962', '8009497739514', '8011903729914',
  '8010893164794', '8010486481146', '4538255900768', '7998922031354', '5432706826401',
  '4538255736928', '7910139363578', '7464579531002', '4538255605856', '6845726884001',
  '4417260421216', '7993710379258', '7910139298042', '7982645608698', '4417279852640',
  '6024709701793', '6024708784289', '6024709210273', '6024709275809', '6024709111969',
  '6024708751521', '6024709734561', '7985931354362', '4417262256224', '4417266319456',
  '4417280213088', '5265738629281', '4417263272032', '4417262452832', '4417262649440',
  '4417281392736', '8011137253626', '4417282146400', '4417281949792', '8165842813178',
  '8166023528698', '4448091832416', '8166063833338', '7982901559546', '7487423381754',
  '8151837507834', '8151983456506', '7982954938618', '8140618662138', '7983233270010',
  '7983275344122', '7588222402810', '7588226236666', '7982928920826', '7982929805562',
  '7588223910138', '7984177479930', '5661708976289', '5661709303969', '7560397947130',
  '6772383252641', '8009855631610', '8009943056634', '8009897836794', '6842266648737',
  '6842411319457', '7464578515194', '4417258389600', '6845726752929', '4538255474784',
  '5794936324257', '4417273004128', '6578507776161', '6578507940001', '6578508398753',
  '7603108479226', '6024708489377', '7982679064826', '7982672118010', '7983996961018',
  '7982664679674', '7982928134394', '8175833415930', '4417283293280', '4417268351072',
  '8005773230330', '4417277395040', '4417277001824', '4417282867296', '4417279197280',
  '4417277952096', '8160580829434', '5956068442273', '7982350827770', '7998541070586',
  '8156631269626', '6749409411233', '6873580241057', '7982352335098', '7982347550970',
  '6818256912545', '7982113390842', '5877379727521', '7576026480890', '4551433060448',
  '8155983446266', '8114277515514', '8108295782650', '8110921908474', '8100938973434',
  '7910311854330', '7053375373473', '8017156014330', '4448091111520', '7588226728186',
  '7984499491066', '7487897075962', '4588929417312', '7588225417466', '7588222697722',
  '8156682354938', '7487962546426', '7588221976826', '7588224729338', '7588226040058',
  '7588220174586', '4595242106976', '4417283555424', '6856501002401', '7984207823098',
  '5661709566113', '8037315051770', '5334324412577', '7105746796705', '7983349006586',
  '6883611410593', '7502097252602', '6898983633057', '8100573479162', '8004438425850',
  '7986304975098', '7994226409722', '7062445686945', '6842423836833', '7455207424250',
  '6842276675745', '7464577138938', '8011905990906', '6871934402721', '7984510533882',
  '7984512696570', '7999546917114', '7487350833402', '6637698842785', '8004001104122',
  '5630655234209', '7651374039290', '7651373547770', '7651373940986', '8156802941178',
  '4417276444768', '7992598364410', '4448091603040', '4448091209824', '4576607731808',
  '4487760478304', '4587393581152', '4587391844448', '7928914182394', '7570088296698',
  '7062445818017', '7910139527418', '7464579793146', '7910139494650', '8010439360762',
  '8010472292602', '8010427564282', '8010080813306', '8009546662138', '8011824398586',
  '8011835212026', '7064905908385', '6008904548513', '8011831804154', '6008906317985',
  '7984498540794', '7984510009594', '7984514138362', '4518921797728', '4448091242592',
  '7977119645946', '7977115713786', '4594908987488', '7977105064186', '7983254044922',
  '7977120923898', '4575522259040', '5661710287009', '7062445916321', '4417261207648',
  '7910139691258', '7982957789434', '8017461641466', '4417260912736', '4448091406432',
  '8100566532346', '4417275199584', '8010078683386', '4448091439200', '4417275953248',
  '7834296811770', '7856106012922', '4417256849504', '4417256980576', '4417259470944',
  '4417259307104', '4417258618976', '4552691253344', '4552694268000', '4552698921056',
  '4552703705184', '4417291845728', '4506281738336', '4536344739936', '8106522640634',
  '8413429498106', '5294721826977', '4417285587040', '5759099961505', '8113161994490',
  '8165921882362', '8014158201082', '4417276575840', '8165925191930', '4417264517216',
  '4536806080608', '8167075217658', '4460365611104', '8165783798010', '8165792383226',
  '4417266810976', '7862139027706', '8140076482810', '8145411080442', '6826627924129',
  '4417279066208', '7615777112314', '8169431269626', '6026335518881', '4570365460576',
  '4496148365408', '4417271824480', '7669393883386', '4417285029984', '8028207120634',
  '5991593115809', '8111103508730', '7640298553594', '6749411344545', '7986333974778',
  '5998486552737', '7910311690490', '8037899141370', '6666852728993', '7986308612346',
  '6620251357345', '5956002447521', '4493459882080', '8113160192250', '8180386529530',
  '7615777308922', '5689672466593', '4436070695008', '4417262354528', '5907634487457',
  '8011825479930', '7564838338810', '6069694496929', '8175807430906', '4417274445920',
  '5558231204001', '5877380972705', '7470951629050', '5991593509025', '5901236961441',
  '4417294270560', '6637699694753', '4536806244448', '7440701980922', '7982654849274',
  '5806502183073', '5742783037601', '5854046650529', '7560181874938', '7560398143738',
  '5742785921185', '6749411016865', '7470951858426', '4417295122528', '4417290338400',
  '6034673074337', '4460365348960', '4460365447264', '8100970397946', '7065169363105',
  '7833276383482', '6036335689889', '8036006134010', '4417269596256', '4509718642784',
  '4589406748768', '4478838571104', '4478838603872', '6859950063777', '4417271398496',
  '6887544815777', '5814733045921', '5814732423329', '7590204637434', '4536806146144',
  '6966905569441', '5842530336929', '4505245417568', '4505245286496', '8161365917946',
  '4417296269408', '4538256130144', '4528319594592', '7004373450913', '4538255933536',
  '4509718577248', '4417285259360', '4467411877984', '6611256049825', '6871458939041',
  '8413346070778', '7982611529978', '7982119747834', '4417273856096', '4417293975648',
  '7982118437114', '7982117257466', '5998487011489', '6542267580577', '7983317025018',
  '7982121517306', '7982347976954', '4417268875360', '8031428542714', '8159334138106',
  '5950507614369', '6069693644961', '8009911664890', '4414315692128', '4417266745440',
  '4417292763232', '6022376194209', '6845727277217', '7983942697210', '4417284767840',
  '7994219495674', '7059370508449', '4417286504544', '7606777151738', '8413306945786',
  '4417278935136', '7539598885114', '8009539715322', '6542283866273', '8014234517754',
  '8014326464762', '6052095099041', '7560181055738', '5410080719009', '5410080850081',
  '5410081112225', '4417261731936', '4417259602016', '4417260159072', '4417259733088',
  '7855884108026', '4417254916192', '8036074193146', '7469126418682', '8163228483834',
  '6953037103265', '7986295800058', '5897318531233', '8021604172026', '6052095000737',
  '6669121388705', '6606562820257', '7682190180602', '4536795824224', '8053229879546',
  '8165939249402', '4417265631328', '7984217325818', '7982351155450', '5321026371745',
  '4417271529568', '8062143070458', '5482771546273', '5321025814689', '5321026732193',
  '7800387404026', '8013922271482', '5305890635937', '4417286242400', '6669353779361',
  '5321026044065', '4417285619808', '7982372389114', '7500120195322', '7983378727162',
  '6761941401761', '7984493396218', '7984490709242', '7984512499962', '7984513057018',
  '6022553632929', '7642577010938', '7983938109690', '5321027190945', '8005812257018',
  '4513178583136', '4417263763552', '8073741762810', '4603700510816', '6761777496225',
  '4417284505696', '5321025749153', '7983345205498', '4417284997216', '4417284964448',
  '4417286602848', '4536795693152', '7644911993082', '6842416431265', '4537417007200',
  '4417288798304', '5849039110305', '8166989136122', '8145508335866', '4417292304480',
  '7977120891130', '6845727506593', '4488103395424', '6846014521505', '7516401434874',
  '4417284636768', '4488103460960', '8165948129530', '8172508381434', '8017518985466',
  '6741957542049', '8053135212794', '8159442403578', '6991307145377', '6629057757345',
  '7991810556154', '6573955448993', '7987363381498', '7982653473018', '6685790896289',
  '5904918347937', '4417275330656', '4417262780512', '4590494187616', '7834279215354',
  '8009922543866', '8003778740474', '7062445293729', '8009969238266', '8013202063610',
  '6573956137121', '4502516170848', '4417287815264', '8165774065914', '6026336469153',
  '4490901946464', '4417272217696', '4417272283232', '4417285849184', '6052095295649',
  '5752973295777', '4417276674144', '4417274249312', '6666853482657', '5956002939041',
  '5474398634145', '7560398831866', '4417273823328', '6664892678305', '6672631595169',
  '8013154812154', '7987360432378', '8031398592762', '8206165836026', '8166946832634',
  '4417285161056', '5814731702433', '8074844700922', '8009121988858', '7600549626106',
  '4417285292128', '8132992696570', '7543029793018', '8103171031290', '4575543591008',
  '8106563043578', '6685792043169', '8075005526266', '7983329280250', '4417290502240',
  '4417285554272', '6925186760865', '7571272171770', '8009506488570', '8006154682618',
  '7097242419361', '4438452437088', '6633783623841', '7600712581370', '8296599552250',
  '6666852139169', '8166941917434', '5866683269281', '4485851512928', '7651374661882',
  '7651374989562', '7593728409850', '4551432863840', '8109892501754', '5784602378401',
  '7983920742650', '4595341361248', '4619926503520', '4417266024544', '7081845588129',
  '4478992121952', '7480767709434', '4502516695136', '4497898537056', '4506281574496',
  '7592071201018', '4484056678496', '6001950490785', '8006295945466', '5343159746721',
  '7455210995962', '7455209226490', '7455210701050', '7455208997114', '7593728377082',
  '6774298673313', '7929839321338', '8006250889466', '7642577142010', '7983914778874',
  '6882008629409', '7500840599802', '7104128680097', '7983361261818', '8028262564090',
  '6903445979297', '7983621505274', '7983931031802', '7673412124922', '7661273481466',
  '7659907023098', '7924177600762', '7763771982074', '7649552498938', '7649552269562',
  '7694649000186', '7694648836346', '7643966636282', '7643966963962', '7643967193338',
  '7643967357178', '6969096634529', '7740554772730', '7695390376186', '7713759625466',
  '7713759592698', '7703993811194', '7703993647354', '7716015243514', '7688945893626',
  '7688946811130', '7642583826682', '7661568884986', '7661569605882', '7661568196858',
  '7661569343738', '7661567901946', '7661569081594', '6917811470497', '7651375481082',
  '7651376333050', '7642580484346', '7642609844474', '7659907776762', '7642579599610',
  '7645787586810', '7661573439738', '7673413566714', '7645787783418', '7642577567994',
  '7701883846906', '4495471542368', '7676244230394', '7643967717626', '6655620382881',
  '6655620284577', '7702868099322', '7702867706106', '7702867542266', '7702867869946',
  '7588337221882', '4553254862944', '6903377625249', '6966867165345', '6859772297377',
  '4417288732768', '4528320839776', '4575543525472', '8165869584634', '4417255604320',
  '4417258553440', '8152219386106', '7986300387578', '4417258750048', '6657324875937',
  '4414316675168', '4417255800928', '4417253769312', '4417255997536', '4417254686816',
  '7994905460986', '5928354316449', '7600336011514', '5928354447521', '4537416843360',
  '7585568653562', '4417288863840', '4414315429984', '4490630561888', '8164023894266',
  '4417256554592', '4417276215392', '8319868928250', '6765808255137', '8042824859898',
  '5410080882849', '5410080587937', '4417257799776', '4417260748896', '4417257832544',
  '6772089192609', '8027118600442', '7465803088122', '4417292107872', '4417291780192',
  '7469126811898', '7617797718266', '7617797685498', '4448093110368', '4448092586080',
  '8230708576506', '4436173848672', '4524553338976', '6669122240673', '4414314971232',
  '7640297799930', '7640298094842', '7640296390906', '7640297406714', '4448091799648',
  '4493458669664', '7611373715706', '4417262223456', '4493458931808', '4448092782688',
  '4493457686624', '4448092160096', '4448093143136', '4448092913760', '4448093306976',
  '4448091996256', '4448092323936', '4448092029024', '4448093012064', '4448092061792',
  '7455208177914', '7560399323386', '5854046388385', '6741957640353', '4524553863264',
  '4488103526496', '4493458341984', '7560182235386', '4496145088608', '6756099424417',
  '4536795627616', '4523827626080', '4523827822688', '6026324967585', '4448092094560',
  '7575861756154', '4414315135072', '7560182399226', '7560182137082', '4505246826592',
  '4505245220960', '6909913825441', '4505246105696', '6026336174241', '6052094640289',
  '5911744446625', '6664892350625', '5558231400609', '8013807583482', '7467515085050',
  '7467513807098', '4486947602528', '7983934144762', '8229756502266', '8182854549754',
  '4417289879648', '4417289453664', '8154486964474', '8009929425146', '6916503797921',
  '8145369989370', '6895095840929', '6061344882849', '6827273289889', '4448091078752',
  '7455208702202', '7455209685242', '8190697734394', '7560179908858', '4537372344416',
  '6842306166945', '5742785167521', '4417254424672', '7993659949306', '8103121453306',
  '5753361891489', '4417257668704', '8062177739002', '8012106498298', '4626541445216',
  '4417275756640', '5907435552929', '8010965057786', '4506283245664', '4626542067808',
  '6052095393953', '7983624192250', '4528321101920', '4528320970848', '4417283653728',
  '4509718413408', '7452903014650', '7455210340602', '7455208407290', '7560181711098',
  '7560181154042', '7560181383418', '7560181547258', '7560181612794', '8096613597434',
  '4484954554464', '4553715810400', '6898917015713', '7588223451386', '8482574958842',
  '8090725712122', '8043531632890', '4417296138336', '5244461580449', '8100967710970',
  '7630663811322', '7983369847034', '6594008252577', '7045912002721', '7008557334689',
  '7476581433594', '8012290752762', '6863327068321', '4496142139488', '6837245804705',
  '4619982700640', '7500897976570', '7505934876922', '6957891125409', '6983076675745',
  '6999220813985', '7606831251706', '7606831218938', '7712260784378', '8183071473914',
  '7891783549178', '7541402534138', '7541403058426', '7541403386106', '4518920552544',
  '8031440568570', '4488103362656', '7501710295290', '5956004085921', '7452903342330',
  '6839466885281', '4626542821472', '7452903473402', '4626542690400', '7640295637242',
  '4536342839392', '5244462268577', '5244462366881', '4506283147360', '4528319758432',
  '7946039427322', '7613044130042', '4528319823968', '7505925341434', '4528319987808',
  '7717938626810', '4536806506592', '4589484507232', '7452903932154', '5278378590369',
  '7541403222266', '4490630692960', '6887666286753', '7543292330234', '4562853789792',
  '6966496919713', '6928893870241', '7822797537530', '5756223652001', '4523829559392',
  '4523829723232', '6912120946849', '4484201775200', '7560179319034', '6916595024033',
  '5784601755809', '5874165448865', '4506281672800', '8026831749370', '4417292370016',
  '4417254064224', '4417290731616', '4417291059296', '4417291190368', '6752233193633',
  '6752120701089', '6754182725793', '5323471814817', '6655619891361', '6655619760289',
  '6655619530913', '7982126989562', '4417295548512', '4417294205024', '4417281130592',
  '4417279918176', '6026335715489', '6052095885473', '6685792272545', '8100999332090',
  '4554880516192', '4554880548960', '4554879991904', '7928096063738', '8154530152698',
  '4490901815392', '4490901487712', '7983390654714', '5907435487393', '5798909214881',
  '5282331263137', '7982657732858', '4551406747744', '7999149932794', '5343443157153',
  '7999152881914', '8448734363898', '4460364562528', '8154275905786', '8155973026042',
  '8156765815034', '5241118064801', '5827041820833', '8155725988090', '6754501558433',
  '8167768883450', '4596720533600', '6863246852257', '7982637875450', '6863219163297',
  '5956003233953', '8473672810746', '7560398536954', '6069694955681', '6026336764065',
  '4504000692320', '6052095525025', '6666853122209', '6768034480289', '5474398732449',
  '7560180924666', '7059080216737', '7989037629690', '7985231102202', '7691129454842',
  '7691129716986', '4536345067616', '7500877332730', '7491041231098', '6855745929377',
  '7019524620449', '6594007433377', '7088530587809', '4536343724128', '6734956363937',
  '7003494940833', '7500108857594', '7065159991457', '7065159729313', '4506281607264',
  '8230470779130', '4489972056160', '6685792338081', '4572385869920', '5432208523425',
  '4414315954272', '6620252012705', '4536795791456', '8021902819578', '4536806375520',
  '4417296203872', '5866936795297', '4518920061024', '7983911239930', '4496142041184',
  '4509718937696', '8107322540282', '4488111587424', '4538195869792', '7560399159546',
  '7910311395578', '4576594853984', '4504000233568', '7470952349946', '5753361727649',
  '5753361563809', '6022553272481', '4417262551136', '8488151351546', '8180411334906',
  '4536795594848', '4523827396704', '5854047240353', '5991573356705', '4417295876192',
  '5742784217249', '5887546130593', '8015336079610', '5784602280097', '7910311526650',
  '6751751176353', '5753361957025', '6634014539937', '4417284210784', '4536642273376',
  '8133905416442', '8037428494586', '8116809892090', '8471204331770', '7560180334842',
  '7669414887674', '8164024025338', '7487951110394', '8078158856442', '4523644256352',
  '8190652875002', '8016450617594', '8108133384442', '7993979437306', '4490900865120',
  '4417270055008', '8061732716794', '7982361051386', '4518922551392', '6921611804833',
  '4460364824672', '4460365250656', '7993908166906', '4528021471328', '7430007030010',
  '8010555457786', '4417266483296', '4417266614368', '8165878989050', '8151692247290',
  '8154514161914', '8153771966714', '6914697003169', '8232211939578', '6036335526049',
  '8035080896762', '4460364693600', '6685792207009', '8005774409978', '8181669036282',
  '8116105445626', '7981472022778', '5835464540321', '5240185421985', '8150064824570',
  '7719883964666', '7858070356218', '8016434692346', '7501640532218', '8113150722298',
  '8014179369210', '8013801980154', '7986250318074', '4417296367712', '5500547432609',
  '5500548087969', '5500547006625', '7618427879674', '7982937112826', '6891196842145',
  '6886381420705', '6964684488865', '7982936523002', '7991601398010', '7773117677818',
  '7982938095866', '4417264320608', '6859601281185', '7991849189626', '8436668367098',
  '4417261928544', '8060380217594', '4417284472928', '8072527642874', '7609246482682',
  '7609246417146', '4568069505120', '8436743930106', '8205279559930', '5321068052641',
  '7985987092730', '8039335002362', '8039341195514', '7737426968826', '5329209458849',
  '8117025898746', '6859836817569', '8155958247674', '4589451444320', '7585089454330',
  '7985980637434', '6921426632865', '4498514870368', '4498513625184', '4498514083936',
  '4498514444384', '4498515198048', '6809551536289', '6991350857889', '8003780346106',
  '6026325229729', '4488103428192', '7515322188026', '4496144859232', '4475616460896',
  '4523829067872', '6845769121953', '4509718741088', '6876281208993', '8060940943610',
  '6655619236001', '6860486213793', '6886023889057', '6812345630881', '7982935802106',
  '4495471706208', '4478991794272', '4417271332960', '6859812274337', '6882076852385',
  '7576026546426', '7983928410362', '6960603988129', '8011103797498', '8173344653562',
  '7500237897978', '7041188397217', '6981162860705', '7996085043450', '5525675081889',
  '7489761476858', '4586055663712', '4505245089888', '7982933115130', '4523828576352',
  '5742786478241', '7986292818170', '6860280135841', '5866683498657', '5806502772897',
  '5556566655137', '4584813297760', '8193211728122', '5347300966561', '6812130607265',
  '6851868721313', '6873875284129', '6874011828385', '6896742203553', '4536343822432',
  '8016548888826', '8016460939514', '5667387375777', '5873931387041', '5901237026977',
  '5313902674081', '6953168535713', '7806935367930', '7568387637498', '7740460761338',
  '7568387735802', '7618508161274', '6982559301793', '4571184005216', '5241086509217',
  '7661570588922', '7661570031866', '4417294499936', '8003821764858', '8248214978810',
  '4505246793824', '6914967306401', '7630664106234', '7606777086202', '5244462203041',
  '5294722252961', '4417270022240', '4523828248672', '4528320577632', '4417294008416',
  '8115891011834', '7452902719738', '4536344117344', '5482307616929', '5482307485857',
  '7593648128250', '7593652551930', '7676373893370', '5667386032289', '8150032744698',
  '6765736722593', '5887546654881', '4505244237920', '5719792648353', '6542306410657',
  '6917838471329', '7560410005754', '8009125986554', '5370613203105', '7564838142202',
  '6751753765025', '7455207325946', '6052094541985', '4417286930528', '8173335904506',
  '4417284309088', '7910312116474', '5742784381089', '7560179482874', '7982403780858',
  '5956002513057', '5956003168417', '5956003659937', '7470951694586', '4417275068512',
  '4417287520352', '4536806015072', '4537437945952', '8167850574074', '4536344346720',
  '8006273859834', '8133067014394', '5770427105441', '5770426908833', '5770427072673',
  '7560398405882', '7564838076666', '7910311428346', '4417274839136', '4490901094496',
  '4417272250464', '4417271496800', '4417272348768', '4417272545376', '6934028714145',
  '5806501527713', '4417286471776', '7455207260410', '6052095656097', '5474398797985',
  '5956003496097', '7560179253498', '5971602538657', '7560180662522', '8169511289082',
  '8555927666938', '8565784641786', '8565906538746', '8565932425466', '8565963849978',
  '8565989769466', '8593504633082', '8620603638010', '8522123608314', '8584336507130',
  '8621310050554', '8565076263162', '8629279588602', '8629863710970', '8497042587898',
  '8493909770490', '8634235355386', '8649874997498', '14819398386050', '14819408216450',
  '14819787506050', '14821925781890', '14822482411906', '14846726799746', '14847019647362',
  '14847065719170', '14872904171906', '14872915083650', '14872978162050', '14874198802818',
  '14874223411586', '14875726086530', '8645782274298', '14873453199746', '14878344577410',
  '14877084057986', '14878702764418', '14877081567618', '14877086843266', '14875761344898',
  '14878293393794', '14877962797442', '14878792417666', '14878723539330', '14879661097346',
  '14879662702978', '14879696290178', '14879701172610', '14880118145410', '14880184992130',
  '14881367327106', '14881436402050', '14882049458562', '14882306818434', '14882320089474',
  '14882707243394', '14882723758466', '14882724839810', '14882799878530', '14883360080258',
  '14884400759170', '14884685578626', '14887020233090', '14889944973698', '14890642243970',
  '14890663870850', '14892316885378', '14892886851970', '14896143630722', '14896149889410',
  '14899845497218', '14899849494914', '14900324368770', '14900890435970', '14900895351170',
  '14903399973250', '14907269546370', '14907824243074', '14908694430082', '14908695150978',
  '14909844816258', '14919938539906', '14919952433538', '14920667857282', '14920702984578',
  '14921060319618', '14921091645826', '14921103278466', '14922486481282', '14922491625858',
  '14922494509442', '14922542973314', '14922549657986', '14924478153090', '14924554666370',
  '14924960235906', '14924980846978', '14924984648066', '14924996477314', '14925037011330',
  '14925041566082', '14925365182850', '14925398409602', '14925407846786', '14924932383106',
  '14925554614658', '14925557825922', '14925559005570', '14925622444418', '14925629063554',
  '14925606748546', '14925621887362', '14926522614146', '14927461876098', '14927611789698',
  '14927902966146', '14927886680450', '14927654519170', '14927696494978', '14927609495938',
  '14927568077186', '14928360604034', '14928360669570', '14928360767874', '14928361324930',
  '14928368238978', '14928368796034', '14928373252482', '14928386359682', '14928392388994',
  '14928394682754', '14928417751426', '14929076519298', '14929786503554', '14929877827970',
  '14930636603778', '14930637816194', '14930640601474', '14930641125762', '14932147601794',
  '14932337033602', '14932375929218', '14932468662658', '14932416594306', '14932606353794',
  '14932653801858', '14933203222914', '14933204926850', '14933430960514', '14933782266242',
  '14933784822146', '14933904261506', '14933958820226', '14933971075458', '14933977334146',
  '14934429958530', '14934433726850', '14934467281282', '14935293460866', '14935224091010',
  '14935075520898', '14937911165314', '14937948586370', '14938076479874', '14937883869570',
  '14940699722114', '14946814493058', '14946973811074', '14949723668866', '14950484967810',
  '14951487439234', '14953918333314', '14956086264194', '14957729284482', '14957842170242',
  '14958828421506', '14958830223746', '14958830649730', '14959094563202', '14959101837698',
  '14959621931394', '14960157163906', '14960177676674', '14960256680322', '14960308224386',
  '14961197023618', '14961278124418', '14965172797826', '14965779759490', '14966296576386',
  '14973020832130', '14973024338306', '14974327914882', '14975886721410', '14979285942658',
  '14979601891714', '14980340023682', '14984117387650', '14986530292098', '14986988323202',
  '14991593636226', '14993332044162', '14993332109698', '14996449067394', '15000434934146',
  '15015804797314', '15022533640578', '15022982594946', '15023091188098', '15023745008002',
  '15023996371330', '15025670553986', '15026401116546', '15026376081794', '15035471069570',
  '15035760902530', '15039008833922', '15039066210690', '15041350893954', '15042460647810',
  '15042460811650', '15042461041026', '15042500723074', '15043605561730', '15046490751362',
  '15046948553090', '15052649103746', '15053340148098', '15053394116994', '15053482099074',
  '15055817638274', '15056531063170', '15056722788738', '15056723214722', '15056915399042',
  '15057870291330', '15057885004162', '15057932550530', '15059906789762', '15059972292994',
  '15060044284290', '15063956652418', '15064660115842', '15064676139394', '15065212256642',
  '15048298561922', '15051980276098', '15056709353858', '15056729244034', '15056734880130',
  '15068327215490', '15069167419778', '15069172826498', '15069196812674', '15069255532930',
  '15069292855682', '15070215242114', '15070329471362', '15071146115458', '15071148605826',
  '15071151423874', '15072982729090', '15072994034050', '15074121777538', '15075284550018',
  '15082675405186', '15083710579074', '15084542099842', '15086824259970', '15090942017922',
  '15090943689090', '15092032242050', '15092032668034', '15092036960642', '15092106789250',
  '15092131955074', '15092145586562', '15096912970114', '15096913625474', '15096988729730',
  '15096989450626', '15097019826562', '15097043255682', '15097074123138', '15097695207810',
  '15097952764290', '15099863368066', '15100038250882', '15118583792002', '15118583824770',
  '15121093951874', '15121175970178', '15124968997250', '15125009858946', '15125129691522',
  '15125235630466', '15125290877314', '15125306933634', '15125325185410', '15125358772610',
  '15139006546306', '15141040652674', '15141040685442', '15141042553218', '15141177229698',
  '15141903565186', '15141907038594', '15141907202434', '15141915197826', '15143265239426',
  '15143320977794', '15143432257922', '15143694696834', '15144403730818', '15144404222338',
  '15144404451714', '15144754807170', '15145628434818', '15145632694658', '15147562238338',
  '15154353635714', '15154364776834', '15154370544002', '15155220513154', '15158075490690',
  '15163045544322', '15164193407362', '15168765165954', '15168975929730', '15170968781186',
  '15171176759682', '15172186145154', '15172188242306', '15178726506882', '15179732550018',
  '15184628547970', '15189299560834', '15189300052354', '15193556222338', '15194277577090',
  '15194333413762', '15194333872514', '15194334888322', '15194385580418', '15197756555650',
  '15203134439810', '15203277046146', '15205737202050', '15205940167042', '15208447213954',
  '15208524513666', '15208529232258', '15208545124738', '15209512501634', '15210967794050',
  '15211900993922', '15211906400642', '15212012110210', '15212824887682', '15216461775234',
  '15222430269826', '15222431121794', '15222437249410', '15222437544322', '15222817784194',
  '15225485754754', '15226691289474', '15227988705666', '15228000993666', '15230790140290',
  '15233439236482', '15247917384066', '15253016805762', '15253036466562', '15253041283458',
  '15254724837762', '15258727842178', '15260005171586', '15260059763074', '15260060582274',
  '15260812935554', '15260815720834', '15260831285634', '15260837380482', '15260848062850',
  '15260849897858', '15260851962242', '15260895773058', '15260936831362', '15260951642498',
  '15261856006530', '15261926687106', '15261964927362', '15263658180994', '15263711789442',
  '15263750619522', '15263751340418', '15264002376066', '15264856605058', '15264857260418',
  '15266782314882', '15267741106562', '15267802055042', '15269012537730', '15269012668802',
  '15269012799874', '15269013094786', '15269015421314', '15269016011138', '15269016469890',
  '15269017354626', '15269018206594', '15269019287938', '15269023187330', '15269028856194',
  '15269181817218', '15269381734786', '15269429182850', '15269470437762', '15269490721154',
  '15269520966018', '15269728747906', '15270340952450', '15270379422082', '15270382305666',
  '15270469009794', '15270801015170', '15270947815810', '15270960234882', '15271016268162',
  '15271022002562', '15272369553794', '15272480702850', '15273056567682', '15273124790658',
  '15273145565570', '15273408954754', '15273479864706', '15273593667970', '15273629811074',
  '15273636135298', '15273639313794', '15273788014978', '15274568614274', '15274647355778',
  '15274666885506', '15274678878594', '15274693394818', '15274694508930', '15275611193730',
  '15275622564226', '15275639636354', '15276163432834', '15276425445762', '15277921960322',
  '15278562017666', '15278572110210', '15278572175746', '15279214625154', '15279271182722',
  '15279888728450', '15279890203010', '15279923069314', '15280059023746', '15280689742210',
  '15280690233730', '15280924950914', '15281138991490', '15282483003778', '15285308752258',
  '15291721023874', '15292870721922', '15296771555714', '15299416818050', '15299417997698',
  '15299983180162', '15303301759362', '15304706982274', '15304748302722', '15304816624002',
  '15304819933570', '15304948875650', '15304957624706', '15305009103234', '15308826116482',
  '15308839256450', '15309025640834', '15311809315202', '15312332063106', '15313775133058',
  '15319606002050', '15319608230274', '15322580779394', '15324534931842', '15325876486530',
  '15326802116994', '15330779857282', '15330780676482', '15345487774082', '5474398437537',
  '15346048663938', '15355088896386', '15356525379970', '15364654498178', '15364740809090',
  '15367270629762', '15367903740290', '15367915340162', '15370143760770', '15370534912386',
  '15370539401602', '15370541105538', '15371473387906', '15372564169090', '15373102645634',
]);
function orderHasSonyaProduct(order) {
  if (!order || !order.lineItems) return false;
  return order.lineItems.edges.some((e) => {
    const pid = e.node.variant && e.node.variant.product ? e.node.variant.product.legacyResourceId : null;
    return pid && SONYA_PRODUCT_IDS_UK.has(String(pid));
  });
}


// Kamsi/Dilaksi product-ID Organic split (added 2026-07-30, per user
// request): the Organic tab lumped both staff members' organic sales
// together. Kamsi checked first, so an order matching Organic's rule AND
// containing one of her products lands here instead of the shared tab.
const KAMSI_PRODUCT_IDS_UK = new Set([
  '4417279983712', '4417268809824', '4448091471968', '4448091013216', '4417257963616',
  '7601296179450', '7977119711482', '7977117712634', '7977105424634', '7977120956666',
  '5359897903265', '5292436193441', '7062445097121', '4538256097376', '6756036837537',
  '6750861492385', '4417276608608', '5432724422817', '4417257373792', '4538256031840',
  '6751883428001', '4490902241376', '6750878367905', '4490902077536', '6755814080673',
  '7570088460538', '8010976493818', '8010558406906', '8010954113274', '8010901520634',
  '8010960011514', '8010981998842', '8011916050682', '8010993107194', '8011926405370',
  '8011927027962', '8009550233850', '8009500655866', '8006266454266', '8009497739514',
  '8011834786042', '8011831509242', '8011829379322', '8011834523898', '8011839176954',
  '8011872731386', '8011903729914', '8011834163450', '8011906253050', '8011901534458',
  '8010893164794', '8010486481146', '4538255900768', '4538255835232', '5432738971809',
  '4553369321568', '7928127291642', '6845727178913', '4417261437024', '6845727146145',
  '4538255802464', '4490901160032', '7910139330810', '6755764076705', '4538255769696',
  '6845726982305', '4417260519520', '5432706826401', '4538255736928', '4538255704160',
  '7910139363578', '7464579531002', '4417258356832', '4538255605856', '6845726884001',
  '4417260421216', '6845726851233', '7993710379258', '7910139298042', '4538255540320',
  '7982645608698', '7992312529146', '4417279852640', '4417264877664', '6024709374113',
  '8010946281722', '4417282080864', '4417262256224', '4417266319456', '4417280213088',
  '7986285445370', '4417263239264', '5265738629281', '4417264746592', '4417263403104',
  '4417263272032', '4417262452832', '4417262649440', '4417263468640', '7869686874362',
  '4417281228896', '4417281458272', '4417282277472', '4417281392736', '4417281294432',
  '8011122671866', '4417280999520', '4417281687648', '8011137253626', '8011149574394',
  '4417282146400', '4417281949792', '4417281884256', '4417280901216', '7762610618618',
  '4448091832416', '4448091504736', '7849767436538', '7617797783802', '5661709729953',
  '5661708976289', '5661709303969', '8017199005946', '7570088558842', '5320834285729',
  '6772383252641', '8009525559546', '7910139232506', '7570088395002', '7062445195425',
  '8009855631610', '8009943056634', '8009897836794', '4417261076576', '7910139199738',
  '6842411319457', '7464578515194', '4417258389600', '4417259634784', '8009526280442',
  '4417289551968', '4417260486752', '4538255474784', '8011925586170', '8011923259642',
  '8011924177146', '4417262518368', '8011922505978', '8011926929658', '8011920605434',
  '5304784879777', '7986338955514', '4417296695392', '4417277460576', '7858443845882',
  '4417267826784', '8011908514042', '4417268187232', '4417278115936', '4417267925088',
  '4417283096672', '4417283293280', '4417277100128', '4417268351072', '8011908940026',
  '4417268121696', '8005741805818', '4417267531872', '4417277788256', '4417277558880',
  '8005773230330', '4417267761248', '4417283391584', '4417268023392', '4417283489888',
  '8006148653306', '4417267859552', '4417268449376', '4417277886560', '8005800165626',
  '4417277395040', '4417268547680', '4417277001824', '4417282867296', '8011900649722',
  '4417282539616', '4417282474080', '8011902058746', '4417279492192', '4417278574688',
  '4417279656032', '4417279197280', '4417279328352', '4417278247008', '4417254162528',
  '4417277231200', '4417282703456', '4417278836832', '4417282736224', '4417282605152',
  '4417277952096', '7910311854330', '7053375373473', '7610439237882', '8017156014330',
  '4448091537504', '4448091111520', '7487955927290', '7977119580410', '7487958614266',
  '7487960449274', '7487959597306', '7984218112250', '7984255598842', '7977118695674',
  '7984499491066', '7977117647098', '7977104441594', '7487900319994', '7487912706298',
  '7487897075962', '7487933055226', '7487962546426', '7984263594234', '7487961792762',
  '8010060333306', '5661710483617', '5661709566113', '5661711302817', '7466279960826',
  '7986340528378', '8003994255610', '8004047241466', '6761846833313', '8166024478970',
  '7983285797114', '6761797845153', '8004480598266', '8004464607482', '8004471390458',
  '8004435706106', '8004438425850', '8004431773946', '7609712902394', '8004445274362',
  '5928615837857', '5359646965921', '8009525919994', '7986304975098', '7570088362234',
  '7062445686945', '5661715398817', '4537408716896', '4537408782432', '4417258520672',
  '5240106352801', '8011905990906', '7984493789434', '7984498180346', '7984507715834',
  '7984510533882', '7984512696570', '7984489267450', '7984513679610', '7984495132922',
  '7984490840314', '7928153374970', '8073717186810', '8072502214906', '7910311723258',
  '4448091570272', '4448091177056', '7487151145210', '7487350833402', '7487348441338',
  '7487312920826', '7487339823354', '5661709893793', '8004001104122', '8004049928442',
  '4417258160224', '8009525985530', '7570088329466', '7062445260961', '7910139560186',
  '7910139592954', '4417259110496', '5630655234209', '7464577302778', '7062445031585',
  '4417265172576', '6986409312417', '7469126320378', '4417276018784', '8320735346938',
  '7065159925921', '6986388209825', '4417276444768', '4417276248160', '4417275592800',
  '6986418749601', '7977115615482', '7065159893153', '7469127303418', '7992598364410',
  '6973502849185', '4448091603040', '4448091209824', '5791484641441', '5412479402145',
  '7984228008186', '7984261202170', '4576607731808', '7977104802042', '4537521242208',
  '4487760478304', '4587391058016', '4587393581152', '4587394859104', '4587394596960',
  '4587391844448', '5928354545825', '8004002218234', '8004050977018', '8009526116602',
  '7570088296698', '7062445818017', '7910139527418', '7464579793146', '7910139494650',
  '7570088526074', '8011831148794', '4417279819872', '8010481828090', '8010558341370',
  '8010439360762', '8010472292602', '8011926307066', '8010427564282', '8011926995194',
  '8011105042682', '8009550725370', '8009550201082', '8009500197114', '8009486926074',
  '8009549349114', '8010099753210', '8010080813306', '8005801738490', '8009546662138',
  '8011826987258', '8011834622202', '8011824398586', '8011906220282', '8011835212026',
  '7064905908385', '8011830034682', '6008906121377', '6008907530401', '6008904548513',
  '6008905466017', '8011831804154', '6008908644513', '6008906317985', '8011839537402',
  '8010511319290', '6008903827617', '7984491528442', '7984498540794', '7984496410874',
  '7984494149882', '7984510009594', '7984510697722', '7984514138362', '7984489791738',
  '7984499982586', '7984512860410', '7984450765050', '4417289814112', '7928153112826',
  '4417257767008', '7993721127162', '7986351079674', '4448091668576', '4448091242592',
  '7977119645946', '7977115681018', '7977115713786', '4594908987488', '4580415045728',
  '7977117679866', '7977118728442', '7977105064186', '7977120923898', '4575522259040',
  '5661710287009', '8004294279418', '8004005691642', '7526905741562', '7062445588641',
  '7570088263930', '7062445916321', '7910139461882', '4417261207648', '7910139691258',
  '4448092291168', '4448091701344', '4448092979296', '4448091340896', '7570088493306',
  '7062445424801', '7910139724026', '4417260912736', '6756420288673', '4538256261216',
  '4448091406432', '4417258324064', '4538256228448', '4417265893472', '7065159827617',
  '4417275199584', '7065159860385', '4448093044832', '4448091439200', '5928354381985',
  '6845727244449', '7986289410298', '4417275953248', '7834296811770', '7856106012922',
  '7855951184122', '7834292322554', '7855905931514', '8450902851834', '8230533071098',
  '4414316380256', '6826633658529', '7849817800954', '4417256652896', '4417256849504',
  '4417256882272', '4417256980576', '4417253867616', '4417257013344', '4417255669856',
  '4417255768160', '7500309889274', '4417256390752', '4417256456288', '4417259176032',
  '4417259241568', '4417259470944', '4417259307104', '4417259077728', '4417258618976',
  '4552674377824', '4553269117024', '4552691253344', '4552694268000', '4552698921056',
  '4552703279200', '4552703705184', '4417291944032', '4417291845728', '4417285587040',
  '4417286635616', '4460365512800', '5759099961505', '4417263992928', '8165921882362',
  '7692736659706', '6845726785697', '8014159085818', '8014158201082', '7858220794106',
  '8014165541114', '4417276575840', '8165925191930', '4417264517216', '4531826688096',
  '8011172217082', '4536806080608', '4417270579296', '4460365480032', '4460365578336',
  '4460365611104', '4460365545568', '4417294172256', '4537416974432', '7862139027706',
  '6008904220833', '6826627924129', '4417279066208', '7615777112314', '4417284079712',
  '4417283850336', '5282330345633', '4542939234400', '7615777014010', '4490902634592',
  '4496148365408', '6751750783137', '8014169735418', '7669393883386', '4417285029984',
  '4417274085472', '4536806604896', '4417273725024', '4536805949536', '7986333974778',
  '7910311690490', '7910312018170', '7910311952634', '7569161781498', '5991593935009',
  '7600601727226', '7987060703482', '7986308612346', '7588357701882', '5752973656225',
  '4493459882080', '7615777308922', '7984497197306', '4417254293600', '4417274773600',
  '4436070695008', '5282330149025', '4537417039968', '7588260151546', '4417295056992',
  '6672631365793', '4417290141792', '4417285783648', '8011825479930', '4417274445920',
  '5558231204001', '4417285685344', '4417265041504', '4417286537312', '4417286406240',
  '7470951629050', '7987056181498', '4490901225568', '4536644337760', '4417294270560',
  '6637699694753', '4490901422176', '4505244827744', '7470951792890', '4536806244448',
  '7069847093409', '7440701980922', '7987057459450', '4417290600544', '7573738160378',
  '4436070760544', '7467514527994', '5742783037601', '5854046650529', '4417290305632',
  '4569343262816', '5742785921185', '7470951858426', '7987064373498', '4417295122528',
  '5742787100833', '4417290338400', '6034673074337', '8009862578426', '4460365348960',
  '4460365316192', '4460365414496', '4460365447264', '4419678666848', '7833276383482',
  '6036335689889', '8036006134010', '5244587507873', '4478838571104', '4478838603872',
  '4478838669408', '4417286209632', '7590204801274', '7590204637434', '4536806146144',
  '7438038040826', '8014688420090', '4538255966304', '4538255671392', '4538256162912',
  '4538256130144', '7689220030714', '8011000381690', '8016454779130', '4538255933536',
  '7865865437434', '4417285226592', '4417285259360', '4505244958816', '4592582623328',
  '7600592093434', '6751752224929', '4490902569056', '4490901618784', '4417286832224',
  '4417273856096', '7470952546554', '4417293975648', '6542338949281', '8009911664890',
  '6578508071073', '4417292697696', '4417292763232', '6022376292513', '6022376194209',
  '6845727277217', '4417275166816', '4417274216544', '6751750226081', '4417286373472',
  '4417285455968', '4417284767840', '7994219495674', '7470951956730', '7059370508449',
  '4417286504544', '4417285816416', '4417278935136', '5244604612769', '4537416712288',
  '5410080719009', '5410080817313', '4417261633632', '5410080850081', '5410080981153',
  '4417261666400', '5410081112225', '4417261731936', '4417261305952', '7993079857402',
  '4417258651744', '4417259602016', '4417260159072', '4417260388448', '4417259700320',
  '4417259896928', '4417260814432', '4417259733088', '6826626777249', '7855877783802',
  '7617797751034', '7855884108026', '4553369485408', '4417255964768', '4553369649248',
  '4417256259680', '4417257734240', '4417260322912', '4553369059424', '4417257308256',
  '4417254916192', '4417257570400', '7598201536762', '8036074193146', '4575647203424',
  '4575608963168', '7469126418682', '4417265238112', '6953037103265', '7986295800058',
  '4536795824224', '8053246034170', '8053229879546', '7986253037818', '8165939249402',
  '4417265631328', '5940562690209', '7984217325818', '7984248848634', '7986333122810',
  '4417283981408', '4590713733216', '4524553601120', '4524553240672', '7989037727994',
  '7865916424442', '4417285750880', '7800387404026', '7856192422138', '4414316183648',
  '7834308378874', '8013922271482', '5305890635937', '8014166556922', '4417284702304',
  '4417286242400', '4417263173728', '6669353779361', '4417285619808', '4524553732192',
  '7986254872826', '8043613192442', '6761941401761', '7469127205114', '7984493396218',
  '7984475570426', '7984494739706', '7984262054138', '7984490709242', '7984510271738',
  '7984512499962', '7984513057018', '4417284898912', '7985187750138', '8050371068154',
  '4417283784800', '7986254086394', '7516384952570', '7519236784378', '4417276903520',
  '4417263763552', '8073741762810', '8072401420538', '8072405582074', '8072539930874',
  '8073730064634', '6798979760289', '6800850682017', '7559370178810', '4417284505696',
  '4417284243552', '4417284997216', '4417284931680', '4417284964448', '4417284866144',
  '4417286602848', '4536795693152', '5742785495201', '5449848127649', '4536806637664',
  '4536795725920', '4536795856992', '4536806473824', '4536795562080', '5770426679457',
  '5742785003681', '4523828478048', '4523828772960', '4537417007200', '7865877463290',
  '5849039110305', '8116133036282', '4417292304480', '4417292173408', '4417292238944',
  '7977120891130', '6845727506593', '4488103395424', '7516401336570', '6798976221345',
  '7516401434874', '4417284636768', '4488103460960', '7516400845050', '7516400976122',
  '8165822497018', '4417280475232', '8172508381434', '8053053030650', '8053135212794',
  '8165922078970', '5928354644129', '7910311559418', '7991810556154', '6751751766177',
  '4417287061600', '7470952317178', '8016464052474', '6934040510625', '5904918347937',
  '4417265959008', '8155993473274', '8053175976186', '8053232468218', '8053225062650',
  '8053644984570', '4417275461728', '4417275330656', '4417265696864', '4417262780512',
  '4590494187616', '4417275887712', '7834279215354', '8072477802746', '8004301947130',
  '8004348412154', '8004344152314', '7600712679674', '8004316201210', '8009922543866',
  '8003778740474', '8009938206970', '8009877225722', '8009887908090', '8004329373946',
  '8004321673466', '8009889972474', '8004308926714', '6994098520225', '8009901703418',
  '7062445293729', '7062445359265', '8009969238266', '5752973197473', '5752972902561',
  '8026824245498', '8013202063610', '4417287815264', '4536806211680', '6672631759009',
  '7910311657722', '6751752487073', '4490901946464', '6683442872481', '7669397487866',
  '4417285390432', '7470952055034', '7987072368890', '6986459349153', '4417274904672',
  '4417274609760', '4417285849184', '5752973295777', '4417276674144', '4417274249312',
  '4417264812128', '6672631857313', '4417273823328', '5558231269537', '6672631595169',
  '8042896163066', '4417285193824', '4417292599392', '4417285161056', '7600549626106',
  '4417285292128', '7643969028346', '7643968798970', '7643968635130', '7643968930042',
  '5500547858593', '6987615862945', '7618508456186', '4536806670432', '4487760740448',
  '8436644249850', '7587330916602', '5742783922337', '4417295646816', '4536806539360',
  '4417290502240', '4417285554272', '8010032349434', '7571272171770', '4417295188064',
  '6883367977121', '5866682843297', '5282330738849', '7600712581370', '5866683269281',
  '7593728409850', '4595341361248', '7081845588129', '7630661910778', '8085567504634',
  '7505934745850', '7592071168250', '5343159746721', '7589224775930', '7589224349946',
  '7588323000570', '7593728377082', '7642577142010', '6882008629409', '7643969487098',
  '5334815506593', '7643966865658', '7661569343738', '7661568688378', '7661567901946',
  '7645788274938', '7659907776762', '7659907973370', '7645787717882', '7645787586810',
  '7505925898490', '7645787783418', '7643967717626', '6655620841633', '6655620382881',
  '5928567898273', '6655620284577', '4536806277216', '7588337221882', '6895016640673',
  '6859772297377', '4417288732768', '4417259405408', '4417255604320', '4417257439328',
  '4417261535328', '8412700180730', '4417257701472', '4417256325216', '4417258553440',
  '6826628677793', '7986300387578', '4417258848352', '4417259339872', '4417258750048',
  '8433335468282', '4417255899232', '4417259012192', '4417253900384', '4417258946656',
  '4417258913888', '4417258881120', '6657324875937', '4414316675168', '4417255800928',
  '8484669948154', '4417253769312', '4417254588512', '4417255997536', '4417254686816',
  '5722587955361', '4417256095840', '4417254785120', '4417255506016', '4417254850656',
  '7989043036410', '4417254981728', '4417255178336', '4417255243872', '4417255276640',
  '4417253703776', '7994905460986', '4417257078880', '6942136008865', '4417255538784',
  '5928354316449', '5928354250913', '7600336011514', '5928354447521', '6866848448673',
  '4537416843360', '7585568653562', '6894937866401', '4495624274016', '4417256554592',
  '4417276215392', '6845727342753', '8072397881594', '6845727473825', '4417265467488',
  '8319515787514', '8319335137530', '8205362462970', '8027138195706', '8163022078202',
  '8027111260410', '8042824859898', '5410080882849', '5410080587937', '7999536070906',
  '7804529213690', '4417260978272', '4553369419872', '4417260028000', '4417260224608',
  '4417257996384', '4417260847200', '4417257799776', '7993906987258', '4417257898080',
  '4417257930848', '4417258258528', '4417257177184', '4417260748896', '4417257832544',
  '6772089192609', '5244423504033', '8060335456506', '8072552579322', '7928152457466',
  '7928139710714', '6845727309985', '8027118600442', '7465803088122', '4417292107872',
  '4417291780192', '4417292075104', '7469126811898', '7469126549754', '7617797718266',
  '7617807024378', '7617807057146', '7617797685498', '4448093405280', '4448093110368',
  '4448092586080', '4493459980384', '4436173848672', '4524553338976', '7611373650170',
  '7588203004154', '7588462330106', '4448091799648', '4448092749920', '4448093077600',
  '4493458669664', '7611373584634', '7611373715706', '4493458931808', '4493457784928',
  '4448092127328', '4493457686624', '7601329438970', '4448092160096', '4448091865184',
  '4448092848224', '4448093143136', '4537408749664', '7585611579642', '4448092192864',
  '4448091897952', '4448092880992', '4448093175904', '4448092225632', '4448091930720',
  '4448092913760', '4448093241440', '4448092258400', '4448091963488', '4448092946528',
  '4448093306976', '5928354611361', '4448091996256', '4448093339744', '4448092323936',
  '4448092029024', '4448091734112', '4448093012064', '4448092684384', '4448093372512',
  '4448092356704', '4448092061792', '4448092717152', '5854046388385', '6026323624097',
  '4524553863264', '4488103526496', '4493458341984', '4496145088608', '4496144990304',
  '4523828346976', '4536795627616', '4448092094560', '7575861756154', '4487760674912',
  '4487760609376', '4493460078688', '4493458571360', '7611373682938', '8225319387386',
  '7574446735610', '5558231400609', '7519284691194', '8013807583482', '4524554354784',
  '7467515085050', '7467514822906', '7467514102010', '7467513807098', '7467514921210',
  '7467514429690', '4538256195680', '4417280376928', '8021946925306', '4417289945184',
  '4417290010720', '4417289879648', '4417289453664', '8009929425146', '8009861333242',
  '6916503797921', '7062444966049', '4537417105504', '4536805982304', '5742782742689',
  '5742782578849', '4448091078752', '4586055925856', '4460364791904', '4524554584160',
  '5282330542241', '5282330640545', '5282331099297', '4537372344416', '5742780874913',
  '5742785167521', '5866683007137', '7993659949306', '5742784053409', '6637699891361',
  '8103121453306', '5282331197601', '7992642699514', '4417257668704', '4417257406560',
  '8010959716602', '8010965057786', '7986319327482', '8096613597434', '4536806342752',
  '7505935630586', '8010962698490', '7599054586106', '7440701882618', '7505934876922',
  '7618508914938', '4488103362656', '4523828707424', '7505868685562', '7618507866362',
  '7505925341434', '4536806506592', '6966496919713', '6859559469217', '6912120946849',
  '6916595024033', '4417292435552', '4417292501088', '4417292370016', '8017109451002',
  '4417290731616', '8015404761338', '4417290764384', '4417290829920', '4417290862688',
  '4417290993760', '4417291059296', '4417291190368', '4417291288672', '8015430353146',
  '6754266120353', '6754368880801', '6752233193633', '6752120701089', '6754369142945',
  '6754306097313', '6754421309601', '6754182725793', '7856492216570', '4417287389280',
  '4417287290976', '4417275691104', '5323471814817', '4417287258208', '4417294073952',
  '4417294205024', '6909667836065', '4417281130592', '4417279918176', '4554880155744',
  '4554880221280', '4554880254048', '4554880319584', '4554880385120', '4554880516192',
  '4554880548960', '4554879991904', '4554880122976', '7928123916538', '7928122835194',
  '7928117526778', '7928096063738', '7928119132410', '4490901815392', '4490901487712',
  '4490901291104', '7986329092346', '7982630109434', '5282331263137', '8013868957946',
  '4417274544224', '5928354513057', '8010020192506', '8009844654330', '4417289715808',
  '4460364529760', '4460364562528', '4460364628064', '4460364595296', '8095915835642',
  '7766242754810', '7608022499578', '7585590706426', '5752973099169', '4536806047840',
  '4536806178912', '5558231072929', '7516401139962', '7985252729082', '7989037629690',
  '7516400779514', '7985231102202', '7505928257786', '6734956363937', '6966926704801',
  '4595341688928', '4609352368224', '7065159991457', '4495624175712', '7962265321722',
  '4524553470048', '4495624437856', '6818356887713', '4414315954272', '4536806408288',
  '4536795791456', '4536806375520', '8107322540282', '4487717126240', '4538203832416',
  '4538195869792', '8230767952122', '7910311395578', '4576594853984', '6751754551457',
  '4417286963296', '4417274970208', '7470952349946', '7982092157178', '7987073057018',
  '4417280606304', '4417262551136', '8009880633594', '4417288274016', '4496148201568',
  '4536795594848', '7470951825658', '7987068043514', '5991573356705', '4417295876192',
  '4436070793312', '7467514495226', '5742784217249', '4417290567776', '4417293451360',
  '4417293385824', '7910311526650', '6751751176353', '6967074783393', '6967004692641',
  '7669411414266', '4417286176864', '8013862240506', '7984498868474', '7615777243386',
  '4417284210784', '4417284046944', '4493459095648', '8013925777658', '4536642273376',
  '8159283577082', '8169446047994', '8175160918266', '7669414887674', '7487951110394',
  '4523644256352', '4417295908960', '8016450617594', '4490900865120', '4490901028960',
  '4490900734048', '4490900701280', '4518922551392', '6819622650017', '4460365185120',
  '4460365152352', '4460365283424', '4460364857440', '4460364922976', '4460364824672',
  '4460364890208', '4460364955744', '4460365250656', '4417266483296', '4417266614368',
  '4417263632480', '8010025959674', '7989035303162', '7910311821562', '4524553961568',
  '4575638388832', '4417263829088', '6036335526049', '4417264418912', '4460364660832',
  '4460364693600', '4417289617504', '4493457883232', '4460364759136', '7981472022778',
  '4417266155616', '4417278017632', '4505244467296', '4518922354784', '5238207807649',
  '7852431048954', '4417293221984', '5323578114209', '8016434692346', '4417280409696',
  '8014179369210', '8013801980154', '8014153646330', '8014154203386', '7986250318074',
  '8009118974202', '8009117368570', '4536806572128', '5500547432609', '5500548087969',
  '5500547006625', '7618427879674', '8140971213050', '4417295810656', '8436668367098',
  '4417266417760', '8060380217594', '4417284472928', '4417284407392', '8072527642874',
  '8073657843962', '4417284341856', '4460365054048', '4460364988512', '4460365119584',
  '4460365086816', '4613822152800', '8014166032634', '4417284571232', '7800179753210',
  '8073704014074', '8072448934138', '5313904246945', '4586056056928', '7605728182522',
  '8003780346106', '6026325229729', '4502516072544', '6798977663137', '4488103428192',
  '7984506405114', '6896780476577', '7515322188026', '4496144859232', '4502516007008',
  '4502515941472', '4488103592032', '6918104580257', '8224230670586', '7615776915706',
  '4460365217888', '4586055729248', '5313902870689', '4586055827552', '5343065211041',
  '8160598720762', '7568355164410', '5334385819809', '5313902313633', '4586055663712',
  '7986245828858', '7065160024225', '7065159762081', '7986292818170', '5866683498657',
  '5556566655137', '8016439509242', '4417288470624', '8016548888826', '8016460939514',
  '7862947610874', '7862947873018', '5901237026977', '5313902674081', '8016430399738',
  '6957638025377', '6953168535713', '7806935367930', '8075133419770', '4417294499936',
  '5500547661985', '8013804732666', '4573903454304', '6883646242977', '4417294008416',
  '8115891011834', '5866684252321', '5433469141153', '4417280770144', '5313903558817',
  '5313903001761', '6917838471329', '4496148299872', '6845727211681', '6845727441057',
  '8036170498298', '6672640868513', '5398941073569', '7585585332474', '8111079194874',
  '7986251268346', '8173365297402', '6751753765025', '4417273921632', '7865900957946',
  '7865820414202', '4417285128288', '4490902601824', '4490900930656', '8014175895802',
  '4417286930528', '4417287585888', '4417284309088', '7470952251642', '7910312116474',
  '5742784381089', '7986311954682', '5956003659937', '7470951694586', '4417275068512',
  '4417287520352', '5742785298593', '6672631496865', '7982634926330', '7982636400890',
  '4536806015072', '4417293516896', '4537437945952', '5770426908833', '5770426712225',
  '5770426417313', '7910311428346', '6751753371809', '4417274839136', '4490901094496',
  '4417286307936', '4417286766688', '4417285488736', '4417287192672', '7470952481018',
  '6934028714145', '4417274740832', '4417286471776', '4417285914720', '4487760216160',
  '4417274052704', '5558231335073', '6672631726241', '8169511289082', '8010049716474',
  '8555927666938', '8564695040250', '8565863579898', '8565886746874', '8565906538746',
  '8565932425466', '8565963849978', '8566014542074', '8566021325050', '8566034071802',
  '8522123608314', '8630295331066', '8566080274682', '8511429673210', '8522981998842',
  '8630674882810', '8505968591098', '8630672883962', '8633541427450', '8649871982842',
  '8649874997498', '8649884762362', '8651485544698', '8651552686330', '8651637883130',
  '8652600606970', '14798531264898', '14798554268034', '14819408216450', '14821247418754',
  '14821912510850', '14821925781890', '14822482411906', '14823201898882', '14823229260162',
  '14824281309570', '14846726799746', '14846737908098', '14847019647362', '14847065719170',
  '14848208535938', '14872903254402', '14872904171906', '14872915083650', '14873353945474',
  '14874199490946', '14874202472834', '14874577043842', '14875076755842', '14875084423554',
  '14873453199746', '14877081502082', '14877086089602', '14877955654018', '14877967122818',
  '14878271373698', '14877941760386', '14878702764418', '14877120692610', '14875756790146',
  '14877123543426', '14877932093826', '14877939368322', '14878293393794', '14877951099266',
  '14876294447490', '14877962797442', '14878715249026', '14878723539330', '14879081759106',
  '14879661883778', '14879662702978', '14879664472450', '14879696290178', '14880118145410',
  '14881058324866', '14881090568578', '14881365295490', '14882049458562', '14882306818434',
  '14882316517762', '14882318418306', '14882705146242', '14883169239426', '14883184509314',
  '14883197059458', '14883497214338', '14884400759170', '14886576947586', '14887020233090',
  '14890642243970', '14890663870850', '14892886851970', '14893490995586', '14893571899778',
  '14896149889410', '14898962596226', '14899845497218', '14908503294338', '14908695150978',
  '14909203972482', '14909844816258', '14919907639682', '14920611627394', '14920667857282',
  '14920702984578', '14921060319618', '14921091645826', '14921103278466', '14921103802754',
  '14921113305474', '14924472779138', '14924476154242', '14924953256322', '14924988187010',
  '14924932383106', '14925531939202', '14925557825922', '14925604225410', '14925629063554',
  '14925581484418', '14927461876098', '14927469085058', '14928368796034', '14928373383554',
  '14928444981634', '14928457171330', '14928465789314', '14928519266690', '14928530243970',
  '14929076519298', '14929105879426', '14929110466946', '14929877827970', '14930637816194',
  '14932109656450', '14932147601794', '14932174635394', '14932253344130', '14932298039682',
  '14932334477698', '14932337033602', '14932339097986', '14932375929218', '14932411875714',
  '14932606353794', '14932699644290', '14933204500866', '14933430960514', '14933787345282',
  '14934429598082', '14935224091010', '14935131783554', '14935075520898', '14935996924290',
  '14937948586370', '14946814493058', '14946951397762', '14946973811074', '14950492635522',
  '4417257209952', '14952673837442', '14953949299074', '14955551785346', '14956271567234',
  '14958817739138', '14958828421506', '14958852374914', '14960127476098', '14960160276866',
  '14960308224386', '14961228218754', '14965146714498', '14965172797826', '14965693940098',
  '14965699674498', '14965779759490', '14966296576386', '14966391079298', '14968000905602',
  '14968061985154', '14968091541890', '14968265769346', '14968468111746', '14968489738626',
  '14970788643202', '14971673837954', '14971620131202', '14973020832130', '14973024338306',
  '14973836591490', '14973874569602', '14975891964290', '14977818722690', '14979285942658',
  '14979601891714', '14979609264514', '14983364116866', '14984874131842', '14984921088386',
  '14986122461570', '14987680252290', '14987781669250', '14989636927874', '14993332109698',
  '14993390403970', '14995605848450', '14998206972290', '15000434934146', '15005018423682',
  '15008542491010', '15019527602562', '15041624146306', '15047001506178', '15057870291330',
  '15064660115842', '15066740687234', '15052065276290', '15068670394754', '15069167419778',
  '15070329471362', '15075284550018', '15082728554882', '15082756505986', '15083710579074',
  '15098025640322', '15099863368066', '15099971568002', '15100091007362', '15100100215170',
  '15112966406530', '15113010938242', '15124381794690', '15141235556738', '15143247511938',
  '15143320977794', '15143365509506', '15145932718466', '15146222748034', '15147439128962',
  '15154364776834', '15154370544002', '15154371395970', '15158075490690', '15160335073666',
  '15171167158658', '15171176759682', '15175015924098', '15176571552130', '15187862323586',
  '15211900993922', '15217364730242', '15260815720834', '15260837380482', '15260895773058',
  '15260954100098', '15261856006530', '15269011292546', '15269012668802', '15271022002562',
  '15273056567682', '15273124790658', '15273127117186', '15273408954754', '15273479864706',
  '15273593667970', '15273788014978', '15273888153986', '15274568614274', '15275639636354',
  '15288186438018', '15291487322498', '15291509539202', '15292042903938', '15292783952258',
  '15292828352898', '15304312357250', '15304322941314', '15304706982274', '15304748302722',
  '15304819933570', '15305009103234', '15306010296706', '15306011738498', '15306050175362',
  '15308561875330', '15308569215362', '15309072204162', '15313775133058', '15313956110722',
  '15319604822402', '15326357651842', '15329296744834', '15330784641410', '15330803024258',
  '15337613820290', '15337725559170', '15338513531266', '15114465608066', '15348209549698',
  '15348210041218', '15358782865794', '15359655346562', '15361607434626', '15370555851138',
]);
function orderHasKamsiProduct(order) {
  if (!order || !order.lineItems) return false;
  return order.lineItems.edges.some((e) => {
    const pid = e.node.variant && e.node.variant.product ? e.node.variant.product.legacyResourceId : null;
    return pid && KAMSI_PRODUCT_IDS_UK.has(String(pid));
  });
}


const DILAKSI_PRODUCT_IDS_UK = new Set([
  '7982121976058', '7991786864890', '8015418720506', '8070720520442', '7982925283578',
  '7983221932282', '8157983932666', '7982923383034', '8175032697082', '6761677750433',
  '7982927806714', '7982914765050', '7982927741178', '7982924988666', '7982924824826',
  '7982924267770', '7982916010234', '7982915059962', '7998887231738', '8156712075514',
  '8341209514234', '4518920388704', '7999167463674', '7998922031354', '4518921502816',
  '6761889202337', '6842133151905', '6024709570721', '6024708948129', '7593019113722',
  '6024709701793', '6024708980897', '6024708784289', '6024708849825', '6024709341345',
  '6024709210273', '6024708915361', '6024709275809', '6024709537953', '6024709603489',
  '6024709046433', '6024709669025', '6024709111969', '6857219276961', '6024708751521',
  '6024708685985', '6024709734561', '7985931354362', '8165842813178', '8053217886458',
  '8166023528698', '7982901559546', '7487423381754', '7983273738490', '8151837507834',
  '8139872272634', '7588220633338', '8151983456506', '7983213936890', '7982954938618',
  '4576612122720', '4580479565920', '7588225581306', '8140618662138', '7984175284474',
  '7983233270010', '7487425118458', '7983276556538', '7983275344122', '7588222402810',
  '7588225089786', '7588226236666', '7982928920826', '7982929805562', '7982928396538',
  '7588220272890', '7588223910138', '7984177479930', '7487373476090', '7560399225082',
  '8014641004794', '7560397947130', '7588227121402', '7502163738874', '6842284343457',
  '6842390708385', '6842266648737', '6842442612897', '6845726752929', '6914752151713',
  '6024708522145', '6024708358305', '6024708653217', '6024708292769', '5313797882017',
  '7608529813754', '6024708554913', '6024708587681', '6024708325537', '5794936324257',
  '8025848971514', '8025806143738', '7684507730170', '4417273004128', '6578507776161',
  '6578507940001', '6578508398753', '7603108479226', '6024708489377', '6024708423841',
  '6898632065185', '7983995781370', '7982663794938', '7982900707578', '7984170303738',
  '7982900510970', '7983273574650', '7983374172410', '7983932244218', '4576619823200',
  '7982679064826', '7982678343930', '7982676639994', '7982675362042', '7982672118010',
  '7983281504506', '7983996961018', '7982664679674', '7982928134394', '7984164471034',
  '8175831417082', '8175833415930', '6852485021857', '6885401755809', '7982631813370',
  '8160580829434', '7773202841850', '5956068442273', '7983397306618', '7985986568442',
  '7982350827770', '6856559394977', '7998541070586', '5956068343969', '5956068507809',
  '8156631269626', '6749409411233', '7541241512186', '5482060284065', '5495924916385',
  '6891852759201', '7608621105402', '6873580241057', '7992059855098', '6666852532385',
  '7564837912826', '7982355251450', '7982352335098', '7982347550970', '6818256912545',
  '7982113390842', '6749408624801', '7982594162938', '7982355677434', '5877379727521',
  '5956068606113', '5433838305441', '5901236928673', '7982095925498', '7982350369018',
  '7983292743930', '8109485031674', '8010052993274', '8160597246202', '7576026480890',
  '8097288814842', '4551433060448', '8156630352122', '8156619211002', '8155983446266',
  '8114277515514', '8109494010106', '8106514088186', '8108295782650', '8108243058938',
  '8097305428218', '8132266230010', '8106532503802', '8110921908474', '8100585668858',
  '6685791027361', '8100938973434', '6749408460961', '6774423814305', '6573956530337',
  '6749409083553', '7588226728186', '8156694184186', '4528319660128', '4588929417312',
  '7588225417466', '4576613892192', '7588222697722', '8156682354938', '7588221976826',
  '7588224729338', '7588226040058', '7588220174586', '4595242106976', '4576634732640',
  '4417283555424', '8440751227130', '8445363749114', '8014623506682', '7983934669050',
  '8011571331322', '6655620055201', '6856501002401', '5333996208289', '5901236895905',
  '7984207823098', '7983923003642', '7983914615034', '8037315051770', '5334324412577',
  '5334243016865', '8160577388794', '7105746796705', '7983349006586', '6883611410593',
  '7502097252602', '6889870491809', '6898983633057', '8100573479162', '8026778796282',
  '4592990716000', '7994226409722', '6842423836833', '7455207424250', '6842276675745',
  '7464577138938', '6871934402721', '8175817097466', '7999546917114', '8017456595194',
  '6594009301153', '8156713582842', '7588221223162', '7588225220858', '8156793209082',
  '7588224336122', '7588225777914', '8217470501114', '6637698842785', '5911744282785',
  '6842221527201', '7652493263098', '7651374039290', '7652493426938', '6748528214177',
  '7651373547770', '7651373940986', '7652493132026', '7652493328634', '7652493558010',
  '8156802941178', '8010056892666', '8103204356346', '7982911619322', '7982904934650',
  '7928914182394', '8076196708602', '8027710783738', '4417291386976', '7982904803578',
  '7982908342522', '7982905229562', '4518921797728', '6869509832865', '7619394470138',
  '8009522643194', '8156748087546', '7983254044922', '8075961237754', '8075991318778',
  '7982957789434', '8017461641466', '8017447452922', '8100586193146', '8100566532346',
  '8107412750586', '8010062004474', '8010078683386', '7643969126650', '7643969257722',
  '8229599871226', '4506281738336', '4475630125152', '8106522640634', '8413429498106',
  '5294721826977', '8224082198778', '8130205319418', '8130202566906', '8113161994490',
  '8165779144954', '8175077720314', '8174300102906', '6845727080609', '6542373191841',
  '4417288962144', '4417294893152', '7983330394362', '7455208308986', '8167075217658',
  '6669122863265', '8443011039482', '8445036298490', '8445628678394', '8217469419770',
  '8175739601146', '8165783798010', '8167782383866', '8165792383226', '4417266810976',
  '4599649140832', '4417288831072', '8140076482810', '8145411080442', '6594007826593',
  '5877380513953', '6749407477921', '6749406855329', '8011593154810', '4496143319136',
  '4417270644832', '4417271955552', '8169431269626', '5806504444065', '6026335518881',
  '4570365460576', '5956004249761', '4505245810784', '7452904161530', '7455208079610',
  '6052094509217', '8010477207802', '7994249281786', '4417271824480', '8136521023738',
  '8028207120634', '5991593115809', '8111103508730', '8109475168506', '4578733228128',
  '7640298553594', '8161229570298', '6749411344545', '8003806593274', '5758488871073',
  '4528321396832', '5887545770145', '6749407051937', '5998486552737', '7762587549946',
  '6542267482273', '7069838737569', '8037899141370', '5752973820065', '6685791912097',
  '7560179384570', '5536371114145', '6666852728993', '6620251357345', '6964730101921',
  '5956002447521', '8011075125498', '7019418648737', '4488111292512', '8113160192250',
  '8180386529530', '7560180171002', '6634014900385', '5689672466593', '5282330280097',
  '4417274151008', '7038329847969', '8147052495098', '4417262354528', '4570499055712',
  '5991592853665', '8011072012538', '5907634487457', '6749408166049', '5991592984737',
  '7560398700794', '7564838338810', '6069694496929', '6069693939873', '8175807430906',
  '6026335355041', '5956004413601', '4504000790624', '6052094673057', '6026337484961',
  '7560182333690', '8152114168058', '7560179548410', '6666853646497', '6664892514465',
  '5971602014369', '4417269563488', '7982381465850', '5956002840737', '5877380972705',
  '5474398601377', '6052095197345', '5981721821345', '4570365427808', '4504000921696',
  '7560399290618', '7985985028346', '7560179843322', '5873930535073', '5991593509025',
  '7560399257850', '5901236961441', '6749409804449', '6620250898593', '5670350356641',
  '6749410328737', '5474398503073', '4417270743136', '5991593771169', '7560397979898',
  '7982654849274', '5806502183073', '5991593443489', '7560181874938', '6749409181857',
  '7560398143738', '4417270808672', '6749411016865', '4495471444064', '6685791223969',
  '5373857366177', '7560179974394', '5784602640545', '5991593836705', '7560398045434',
  '5474398535841', '5907435389089', '4417290698848', '6664892285089', '4523827331168',
  '5991593312417', '8100970397946', '4504000069728', '7065169363105', '8027742961914',
  '8165930172666', '5806505328801', '4417269596256', '4509718642784', '4589406748768',
  '8061987029242', '8062167023866', '8156639461626', '4478838505568', '4592898703456',
  '7103867650209', '6859950063777', '4417271398496', '4417270480992', '8062989926650',
  '8076166136058', '8103238009082', '5729268498593', '6887544815777', '4417270710368',
  '5814733308065', '5814733045921', '5814732718241', '5814733635745', '5814732423329',
  '7590204735738', '6856649277601', '4417268973664', '6966905569441', '8162932785402',
  '7982937473274', '5842529845409', '5842529484961', '5842530336929', '4505245417568',
  '6749407281313', '8009531883770', '4505245286496', '8161365917946', '6914992504993',
  '6873605210273', '4509718872160', '7649552400634', '4417267171424', '4417296269408',
  '6999300178081', '6989497073825', '4528319594592', '4570365329504', '4509718610016',
  '7004373450913', '4490902339680', '5531679719585', '4509718544480', '7649552007418',
  '4509718577248', '8113901961466', '4467411877984', '4417296564320', '4506281508960',
  '6611256049825', '8009527689466', '6885834621089', '6871458939041', '8009517793530',
  '8367805399290', '8413346070778', '7560398373114', '7982621065466', '7982611529978',
  '7910311592186', '5373865754785', '7982629748986', '7982347092218', '7982119747834',
  '7982118437114', '7982117257466', '5998487011489', '6542267580577', '7982654128378',
  '6022421610657', '7982935277818', '7983317025018', '8012116787450', '7983319482618',
  '5753361596577', '7982121517306', '7982347976954', '4417268875360', '8149964718330',
  '8031428542714', '8134410797306', '8159334138106', '8192172130554', '5950507614369',
  '8100916330746', '6818459615393', '6069693644961', '8134552027386', '8136238366970',
  '6054233637025', '4475630059616', '4414315692128', '4417289060448', '4417266745440',
  '7983290286330', '8090698580218', '4538108903520', '7560398242042', '7983942697210',
  '4417271660640', '4417272021088', '5806504050849', '6022553796769', '5784602575009',
  '5998486913185', '5758489100449', '7606777151738', '5753361760417', '6634014408865',
  '6741957902497', '8413306945786', '5956003201185', '5956239720609', '8113198203130',
  '7539598885114', '8009539715322', '8031875891450', '8222129258746', '6542283866273',
  '8222103798010', '8000777748730', '8009550758138', '8010419798266', '8031449317626',
  '8017498210554', '8014234517754', '8014326464762', '6749407641761', '6614011674785',
  '6052095099041', '8182862774522', '7455208014074', '7560181055738', '8115366265082',
  '8150225977594', '8163228483834', '8140667846906', '8137813524730', '8167753285882',
  '8009535947002', '7946045423866', '8175798681850', '8175794913530', '6558586470561',
  '5897318531233', '8183771758842', '7615786451194', '8021604172026', '8021882536186',
  '6052095000737', '8155912274170', '6669121388705', '7993713721594', '7615777341690',
  '8174343815418', '8010511909114', '6606562820257', '8366613037306', '6773916827809',
  '7682190180602', '4537416810592', '8163100819706', '6669121814689', '7983942107386',
  '7983916679418', '7982351155450', '5321026142369', '5321025585313', '5321026371745',
  '4417272184928', '4417271529568', '8010522525946', '8062143070458', '6026337714337',
  '7983940436218', '5245842096289', '5245806117025', '5245806313633', '5245805789345',
  '5482771546273', '4551406977120', '4551406944352', '5321025814689', '5321026732193',
  '5321025945761', '7608529780986', '5321026896033', '7983942369530', '8000785416442',
  '8014189920506', '5321026044065', '5321025650849', '5321026994337', '7982372389114',
  '4417271595104', '7691075289338', '7500120195322', '7983378727162', '4553715744864',
  '4417291649120', '6022553632929', '4528321232992', '7642577010938', '7983938109690',
  '5321027190945', '8005820285178', '8005812257018', '7982092124410', '7983334490362',
  '4513178583136', '4528319529056', '4417272086624', '4603700510816', '6914542665889',
  '5785150095521', '6761777496225', '5321026535585', '7983938601210', '7982358102266',
  '5321025749153', '7982361575674', '7983345205498', '4417271758944', '7644911993082',
  '4626543247456', '6842416431265', '4417288798304', '8163107569914', '8166989136122',
  '8145508335866', '8073630122234', '8159318835450', '4601135923296', '7642575470842',
  '8165948129530', '8017518985466', '6741957542049', '8159442403578', '6991307145377',
  '8156694315258', '8156701393146', '5779096567969', '5956002578593', '6629057757345',
  '7560399094010', '6573956989089', '6573955448993', '7987363381498', '6026303766689',
  '7982653473018', '6685790896289', '6022553010337', '6024707965089', '6001950916769',
  '4417295384672', '8013147275514', '8034949103866', '6001950621857', '6573956137121',
  '4502516170848', '8039361413370', '4504000364640', '6026338533537', '8136410923258',
  '8165774065914', '8448372211962', '6026336469153', '6026338238625', '7560398733562',
  '7564838371578', '6069694300321', '7560398930170', '5866936533153', '4417272217696',
  '4417272283232', '4417272512608', '5998486716577', '4570365362272', '6634014277793',
  '5877380153505', '4504000561248', '6052094738593', '6052095688865', '6052095295649',
  '6026337943713', '7808911933690', '6026324279457', '4538198655072', '7455207850234',
  '7560179450106', '6666853482657', '5956002939041', '5474398634145', '7560180465914',
  '5956003954849', '7560398831866', '7564838174970', '6069694365857', '4504000626784',
  '6052094607521', '7455207784698', '6052095852705', '6052095459489', '5474398699681',
  '7509803237626', '5806504837281', '5911743856801', '6664892678305', '7982647116026',
  '5981722083489', '8013154812154', '8013156286714', '7987360432378', '7985982996730',
  '7985986896122', '8031398592762', '8017859444986', '4497907908704', '8206165836026',
  '8166946832634', '8113902878970', '8141381107962', '8154495549690', '8133926060282',
  '4417261830240', '6681553207457', '5814731702433', '4468548173920', '8060683256058',
  '8074844700922', '8009121988858', '8073391374586', '8140278038778', '8132992696570',
  '8154523697402', '8113180868858', '7982346141946', '8122648789242', '8009216164090',
  '7538525667578', '7543029793018', '8103171031290', '8100579639546', '7543057645818',
  '4523830345824', '4417271234656', '4575543591008', '7543041917178', '8028186083578',
  '7043673882785', '4575543427168', '4417271365728', '8106563043578', '8104621244666',
  '6768355180705', '6685792043169', '5842530631841', '6859676057761', '8075005526266',
  '6614271393953', '8160583778554', '7649552597242', '7983329280250', '6837440118945',
  '7987378192634', '6925186760865', '8010969022714', '6001951015073', '8009506488570',
  '4575543459936', '8006154682618', '7542236184826', '7542240248058', '4468584087648',
  '6069693317281', '8075192238330', '7097242419361', '6898501189793', '4438452437088',
  '6633783623841', '7644912386298', '8166938509562', '8296599552250', '8163035676922',
  '6666852139169', '8166941917434', '5971602374817', '4485851512928', '8009530769658',
  '7651374661882', '7651374891258', '7651374989562', '4566392668256', '7701914452218',
  '7102568267937', '4551432863840', '4581217108064', '4509718970464', '8109892501754',
  '5784602378401', '8109554172154', '6885499404449', '6896521281697', '6895318237345',
  '7983915172090', '7983915401466', '7983916187898', '7983920742650', '7983909961978',
  '6812500557985', '7698535088378', '7983908684026', '6916366729377', '4619926503520',
  '4417266024544', '6750851334305', '4417290403936', '4417271136352', '5798908952737',
  '4478992121952', '7099555315873', '7480767709434', '7983922086138', '7983908094202',
  '6685792403617', '4502516695136', '6611834601633', '4497898537056', '5360689283233',
  '6912420348065', '4506281574496', '4536343461984', '7592071201018', '7053367607457',
  '4484056678496', '6001950490785', '8006295945466', '6749407838369', '7455210864890',
  '7455210995962', '7455209226490', '7455210701050', '7455208571130', '7455210799354',
  '7455208997114', '6774298673313', '7929839321338', '6810064847009', '8006250889466',
  '7983355592954', '7983352512762', '7649650409722', '7649650278650', '7983914778874',
  '7816214053114', '6912021299361', '7610299121914', '7500840599802', '7560182268154',
  '4417271791712', '7104128680097', '7983361261818', '8028262564090', '6903445979297',
  '7983621505274', '7983623569658', '7983926903034', '7983931031802', '7983914352890',
  '7673412124922', '7673410814202', '7673412944122', '7673411535098', '7659906957562',
  '7661273481466', '7659907023098', '7452902686970', '7680984285434', '7924177600762',
  '7680983400698', '7763771982074', '7690215031034', '7645788373242', '7649552498938',
  '7649552269562', '7694648639738', '7694648606970', '7694648738042', '7694649164026',
  '7694649098490', '7694649000186', '7694648901882', '7694648869114', '7694648836346',
  '7694648770810', '7652503585018', '7644911796474', '6761853485217', '4417270874208',
  '7643966636282', '7643966963962', '7643967193338', '7695391391994', '7695391850746',
  '7695392047354', '7695391490298', '7643966734586', '7643967357178', '6969096634529',
  '7643968241914', '7740554772730', '7740554936570', '7695390376186', '7713759625466',
  '7713759592698', '7713759723770', '7713759691002', '7714001813754', '7713759789306',
  '7703993909498', '7703993811194', '7704065671418', '7703993647354', '7716015243514',
  '7716552999162', '7708425355514', '7688953430266', '7688945893626', '7688946385146',
  '7688946811130', '7642583826682', '7642581729530', '7661568884986', '7661569605882',
  '7661568196858', '7661569081594', '7661568459002', '6917811470497', '7708426666234',
  '7651376988410', '7651375481082', '7651375284474', '7651377185018', '7651376529658',
  '7651375677690', '7651376201978', '7651376333050', '7651376791802', '7651375939834',
  '7642580484346', '7642609844474', '7679463981306', '7697310351610', '5253203034273',
  '7668055834874', '7668027457786', '7642582417658', '7642579599610', '7715804348666',
  '7661571965178', '7661572980986', '7661571145978', '7661573800186', '7661573439738',
  '7661574193402', '7645788111098', '7673414058234', '7673413566714', '7673413828858',
  '7642578878714', '7642578419962', '7642577567994', '7701883846906', '4495471542368',
  '4417289257056', '7676245344506', '7676244623610', '7676243902714', '7676245868794',
  '7676245213434', '7676244230394', '7702868033786', '7702867378426', '7702868099322',
  '7702867443962', '7702867706106', '7702867771642', '7702867607802', '7702867542266',
  '7702888907002', '7702867935482', '7702867869946', '7738421936378', '4552643903584',
  '4553254862944', '4575543328864', '4575543263328', '6903377625249', '6966867165345',
  '5373911892129', '6956180275361', '7501695582458', '4528320839776', '7987350438138',
  '4575543525472', '8165869584634', '8231163625722', '8013205471482', '8152305729786',
  '8152219386106', '6542267515041', '8115409879290', '7982104477946', '7644912156922',
  '6685791551649', '7649552761082', '6889804234913', '4417288863840', '4414315429984',
  '4490630561888', '4417269399648', '8164023894266', '8156663120122', '8156084404474',
  '8163184279802', '8138082779386', '8156684091642', '8225162789114', '8319868928250',
  '6765802193057', '6765808255137', '8152263491834', '4417292828768', '8152158732538',
  '6852357423265', '7999148949754', '6878738219169', '4523828871264', '4523828641888',
  '6669122240673', '4414314971232', '7640297799930', '7640298094842', '7640296653050',
  '7640296390906', '7640297079034', '7640297406714', '4448092389472', '4417262223456',
  '7592074871034', '7575717413114', '7455208177914', '7560399323386', '7452902588666',
  '6741957640353', '6604161482913', '7560182006010', '6634014015649', '5814733832353',
  '7560182235386', '6756099424417', '7560182497530', '4523827626080', '4523827822688',
  '4505246433376', '6026324967585', '7560182628602', '4417271693408', '4414315135072',
  '4417296498784', '4518920192096', '4518920159328', '4488111456352', '5784601985185',
  '7560182399226', '7560182137082', '4505246826592', '8229577130234', '4505245220960',
  '6909913825441', '4505246105696', '7568387834106', '4417296466016', '6026336174241',
  '6052094640289', '6052095787169', '7455207653626', '5911744446625', '6664892350625',
  '5971602702497', '4486947602528', '8173292093690', '7983934144762', '7999153209594',
  '8163090858234', '8009302114554', '8150845260026', '8229756502266', '8182854549754',
  '8156831056122', '8159447974138', '8154486964474', '8145369989370', '8117958213882',
  '8175805628666', '6968724390049', '6895095840929', '8167014465786', '7632863691002',
  '6061344882849', '6827273289889', '6024708718753', '6054283411617', '7455209357562',
  '7455208472826', '7455208702202', '7455209685242', '7455209586938', '7599504064762',
  '8190697734394', '8160579059962', '7560179908858', '8013435568378', '6852406640801',
  '7644911403258', '4572385214560', '4417271464032', '8179293782266', '8161538703610',
  '4626541674592', '4417270153312', '6842306166945', '5873931583649', '4417254424672',
  '6885550129313', '8113773379834', '8163022471418', '5753361891489', '8167851229434',
  '8116915273978', '8137822208250', '4509718380640', '4502516334688', '7816203698426',
  '8062177739002', '8233017082106', '7711793545466', '8012111380730', '8012106498298',
  '4528320479328', '4626541445216', '4417275756640', '7649553219834', '8009195847930',
  '8136294301946', '8100609065210', '5907435552929', '5244461908129', '4506283343968',
  '8109486964986', '5244461547681', '4506283245664', '4626542067808', '6052095393953',
  '4417269235808', '7983624192250', '4605494001760', '4528321101920', '4528320970848',
  '4417283653728', '7455210569978', '5356178276513', '6940088074401', '5866936729761',
  '8021920907514', '6851839361185', '6856525021345', '4509718413408', '4528320184416',
  '4528320053344', '4553257386080', '7452903244026', '7452902555898', '7452902392058',
  '7452903145722', '7452903080186', '7452903014650', '7452902981882', '7452902850810',
  '7452902818042', '7452902424826', '7455210340602', '4417269465184', '8114235703546',
  '4572385280096', '8222021976314', '8011577524474', '7455208407290', '6022552617121',
  '7560181285114', '7560181219578', '7560181154042', '7560181383418', '7560181448954',
  '7560181547258', '7560181612794', '8090718732538', '5496122441889', '7892810957050',
  '4484954554464', '8222107369722', '8011579851002', '8011599216890', '8009499934970',
  '4553715810400', '6898917015713', '5543091536033', '6891291967649', '7588223451386',
  '8482574958842', '8487866925306', '8090725712122', '8095479398650', '8062509351162',
  '4600842453088', '8043531632890', '8182859694330', '8182852878586', '5866682581153',
  '5866684580001', '4417296138336', '5911744643233', '6761842507937', '5244461580449',
  '5244462137505', '4506283212896', '6685791682721', '5244461645985', '4506282983520',
  '4626542428256', '8009254797562', '8010989863162', '8037522997498', '6863171322017',
  '8100967710970', '7630663811322', '7630662828282', '7630663319802', '7630662402298',
  '7983369847034', '7983910879482', '7983442985210', '7983324102906', '7982088519930',
  '7015409189025', '6594009202849', '6594008252577', '7045912002721', '6542267646113',
  '6637699301537', '7008557334689', '7438865301754', '7476581433594', '4609306296416',
  '8012290752762', '6863327068321', '4496142139488', '7038269554849', '6837245804705',
  '4619982700640', '6981383192737', '6594008842401', '7567608873210', '7495216988410',
  '7500897976570', '7019740987553', '6909193748641', '6957891125409', '6983076675745',
  '5740007129249', '6999220813985', '7983930376442', '5667386818721', '7606831251706',
  '7606831218938', '7606831186170', '7712260784378', '8113192075514', '8090662830330',
  '8183071473914', '7891783549178', '7541402534138', '7541402697978', '7541402829050',
  '7541403058426', '7541403386106', '4518921109600', '4518920552544', '8009491218682',
  '8009500885242', '8031440568570', '7998902763770', '8009128804602', '6887472332961',
  '4524606324832', '5282439004321', '8021606301946', '8062184456442', '7501710295290',
  '8009169993978', '7640298291450', '5956004085921', '4626542559328', '7452903342330',
  '7452902523130', '6883251028129', '6839466885281', '7985984143610', '7452903538938',
  '4626542821472', '7452903473402', '4626542690400', '8021911372026', '4572385443936',
  '7452903833850', '4626543018080', '4626541903968', '7452904095994', '4589284917344',
  '7452903964922', '8010492346618', '7452903768314', '7452903604474', '4626543149152',
  '7452903702778', '7651375153402', '7640295833850', '7640296227066', '7640295637242',
  '4536342839392', '8156619636986', '6863281488033', '5244461711521', '5244462268577',
  '4506282917984', '8154491617530', '7845306466554', '5244462366881', '4506283147360',
  '4589196509280', '4589197918304', '4589199032416', '4589286817888', '4589278527584',
  '4589482475616', '7991506436346', '6978115436705', '4528319725664', '4528319758432',
  '7946039427322', '7613044130042', '4528319889504', '4528319922272', '7845873320186',
  '4528319823968', '4528319987808', '5866936402081', '7717833015546', '7717938331898',
  '7717938626810', '5450297082017', '4489762373728', '4488111128672', '4589484507232',
  '4589475135584', '6981116657825', '5282331328673', '8017817305338', '8479369429242',
  '8035099410682', '7452903932154', '7455209980154', '5758489034913', '5278378393761',
  '5278378459297', '5278378590369', '5278378655905', '8063044157690', '7541403222266',
  '5734659588257', '5324055740577', '4490630692960', '6685791486113', '6887666286753',
  '6845851041953', '7543292330234', '7697380344058', '7541267661050', '4562853789792',
  '4417271103584', '5321091645601', '6928893870241', '7822797537530', '4572385116256',
  '5321105670305', '7541360066810', '5756223652001', '6666852040865', '6922900635809',
  '7560179712250', '4523829559392', '4523829461088', '4523829723232', '4484201775200',
  '5739846795425', '7560179319034', '8154855145722', '5784601755809', '5874165448865',
  '5244461744289', '5244462596257', '4506283409504', '4626542231648', '4506281672800',
  '8026831749370', '4417254064224', '6635418910881', '5877381890209', '7053693649057',
  '4599561945184', '7668027228410', '6655619891361', '6655619760289', '6655619530913',
  '7564838437114', '7982118568186', '7982126989562', '8021898854650', '7065169461409',
  '4417295548512', '5805741998241', '8021911044346', '6891249565857', '6837460107425',
  '6827326537889', '4417267105888', '5360127180961', '4489762209888', '8010485137658',
  '8013166739706', '8175786131706', '7560398602490', '7564838240506', '6026335715489',
  '7455207588090', '6052095885473', '5911743529121', '5866936696993', '7560179613946',
  '6685792272545', '6664892612769', '7560180793594', '6672631693473', '8223126421754',
  '7998875304186', '8017508073722', '8100999332090', '8475653898490', '8130205548794',
  '4528320381024', '5742321107105', '8154530152698', '8151932469498', '4417289093216',
  '4508720005216', '7983390654714', '5907435487393', '5798909214881', '5814731276449',
  '5956002644129', '7696630284538', '4551406616672', '7982657732858', '4551406878816',
  '4551406780512', '4551406649440', '4551406747744', '8014339965178', '7999149932794',
  '7692731384058', '4417269661792', '4417269792864', '5343443157153', '5348442767521',
  '5877381398689', '4536343134304', '4417267040352', '4417288994912', '6898555617441',
  '6685790797985', '8009493381370', '8100968825082', '4417269858400', '7999152881914',
  '8448263323898', '8448734363898', '8175814902010', '7982405615866', '8181676736762',
  '8175026798842', '8174260060410', '8154275905786', '8155973026042', '8152114331898',
  '8152187732218', '8154257228026', '8156695494906', '8156765815034', '4596704215136',
  '8005840044282', '5241118064801', '5827041820833', '5370613399713', '8155725988090',
  '6754501558433', '8167121682682', '8113201152250', '8167769669882', '8161672069370',
  '8167768883450', '8167143964922', '8162234794234', '8153159303418', '8152024121594',
  '8154759332090', '4596720533600', '8175728492794', '4417273528416', '5956003299489',
  '6863246852257', '7982637875450', '5784602181793', '5784601854113', '6863219163297',
  '5956003397793', '5956002742433', '5956003233953', '5956003266721', '8473672810746',
  '4417269039200', '7560398536954', '7564838306042', '6069694955681', '6069693841569',
  '6026336764065', '4504000692320', '6052094967969', '6052095525025', '4417291583584',
  '7982375731450', '5806500774049', '5866936631457', '6666853122209', '6664892448929',
  '5971602210977', '7982372618490', '6768034480289', '5911743234209', '5474398732449',
  '7982366392570', '7560180924666', '5956003758241', '6799846473889', '8159407931642',
  '8151696212218', '5866936467617', '5866936500385', '4417270251616', '5471051612321',
  '6936330600609', '6749406724257', '7059080216737', '6842428293281', '6842397687969',
  '5594436141217', '7691129946362', '7691129454842', '7691129716986', '7691129749754',
  '7691129422074', '7691129585914', '7691129848058', '7691129389306', '7691129880826',
  '7691129651450', '7691129291002', '4536345067616', '6852374102177', '4496141942880',
  '7500236128506', '7499656659194', '7500877332730', '7491041231098', '6855745929377',
  '7500914655482', '7019524620449', '6594006810785', '6594007007393', '6594007433377',
  '6594007138465', '6594007302305', '6953266282657', '7088530587809', '5729491091617',
  '4509705437280', '7492315414778', '5282611953825', '4536343724128', '7105629159585',
  '8062202544378', '6894872166561', '7099592409249', '7085196050593', '4417290240096',
  '7003494940833', '7500108857594', '6637700022433', '7015799685281', '7065159729313',
  '4536806309984', '4506281607264', '7094174810273', '4417272479840', '8230470779130',
  '4489972056160', '6842192003233', '6685791813793', '6685792338081', '4478992253024',
  '4478991925344', '6770690130081', '4572385804384', '4572385869920', '4572385771616',
  '5432208523425', '6855729840289', '8113163436282', '6620252012705', '8021898264826',
  '8021902819578', '8021923496186', '4417296203872', '5866936795297', '4572385607776',
  '4484057006176', '4417266679904', '4518920061024', '7983911239930', '7632864215290',
  '5314626879649', '4496142041184', '4509718937696', '6812509110433', '4488111587424',
  '4506281771104', '7053633487009', '7560399159546', '4504000233568', '7669402140922',
  '7069908730017', '6026304487585', '5758489133217', '7982646001914', '5753361727649',
  '5753361563809', '6022553272481', '7104050561185', '8488151351546', '8180411334906',
  '8149955641594', '8110972240122', '4485111316576', '7560398307578', '6611256869025',
  '5282330509473', '4523827396704', '4417296302176', '5907435323553', '6749410623649',
  '5854047240353', '7560180072698', '5873930829985', '5991593640097', '7560398110970',
  '6987652300961', '7982405517562', '6774442754209', '5474398568609', '6664892317857',
  '5806503526561', '5991593246881', '6749408919713', '6685791125665', '5887546130593',
  '8015336079610', '5784602280097', '5770426941601', '6535720108193', '6026303078561',
  '7470952153338', '6542267613345', '5753361334433', '5753361957025', '7429687967994',
  '4502516269152', '6634014539937', '8133905416442', '8037428494586', '8116809892090',
  '8471204331770', '8136478621946', '8136489763066', '4523827232864', '7560180334842',
  '8164024025338', '8122668679418', '8136343552250', '8102837321978', '8078158856442',
  '8062958928122', '8100560994554', '8166046662906', '8104214036730', '8078034567418',
  '7982350139642', '8013171327226', '8166990774522', '8190652875002', '8109646545146',
  '8096582271226', '7525714526458', '8108133384442', '7993979437306', '8115372130554',
  '7982351614202', '4417270055008', '8061732716794', '7982361051386', '6052095230113',
  '8151806836986', '6921611804833', '8062830182650', '7515292926202', '8159287607546',
  '7993908166906', '4528021471328', '7430007030010', '7819052286202', '8010555457786',
  '4417272414304', '4417269170272', '8005785288954', '8104560591098', '8162258813178',
  '8165878989050', '8413421928698', '8151692247290', '8154514161914', '8145329357050',
  '8156711780602', '8153771966714', '8155358855418', '6061345177761', '5784602542241',
  '8162856403194', '8012109611258', '4537416908896', '7649552138490', '6914697003169',
  '5784602083489', '8232211939578', '6765700219041', '8429062095098', '6987584077985',
  '6633080717473', '8035080896762', '4460364726368', '6685792207009', '8026793443578',
  '8005774409978', '8017829527802', '8172540264698', '8172737265914', '8181621129466',
  '8181669036282', '8009513042170', '8149970485498', '8116105445626', '8017843192058',
  '8013134889210', '7542214983930', '5956003037345', '5835464540321', '5240185421985',
  '8113157275898', '8150829039866', '8150064824570', '8136525119738', '8183042015482',
  '7719883964666', '8113206231290', '7858070356218', '6860377555105', '6024709439649',
  '6024709636257', '8161255981306', '7983455666426', '7501640532218', '5294722089121',
  '4417267400800', '8113150722298', '4417267335264', '4417296367712', '5500547956897',
  '5500547104929', '8006238404858', '5667387736225', '7500758483194', '4417267204192',
  '4417270415456', '4417270317152', '7982937112826', '6891196842145', '6942018633889',
  '5866936369313', '6886381420705', '6964684488865', '7982936523002', '7982937637114',
  '7991601398010', '7773117677818', '7982938095866', '4417264320608', '5347609182369',
  '7992009392378', '6859601281185', '7991849189626', '7983272755450', '4417261928544',
  '8012324143354', '8012309430522', '5509926977697', '7983274361082', '7609246482682',
  '7609246875898', '7609246613754', '7609246417146', '7609246777594', '4568069505120',
  '4488111882336', '5355945885857', '8436743930106', '5321068052641', '6878229954721',
  '7500851708154', '8009118286074', '7985987092730', '8225172914426', '7945983295738',
  '8039335002362', '8039341195514', '8039348633850', '8039353352442', '7737426968826',
  '4417270939744', '4417262125152', '5329209458849', '8117025898746', '6859836817569',
  '6912222789793', '7985978048762', '8155958247674', '5433968230561', '4589451444320',
  '7585089454330', '7985980637434', '6921426632865', '7019566006433', '7480767774970',
  '7492289822970', '7500075565306', '5814731964577', '8096040157434', '4498514870368',
  '4498513625184', '4498514083936', '4498513231968', '4498514444384', '4498548260960',
  '4498515198048', '7688943010042', '5314170618017', '6809551536289', '4490630627424',
  '8073532997882', '7982934819066', '8060792013050', '5239482876065', '5239482908833',
  '4552638890080', '6991350857889', '6896671162529', '4590874787936', '4417289158752',
  '4551428112480', '6052094935201', '5343276368033', '4468593262688', '4475616460896',
  '6061344719009', '6061344522401', '6061344293025', '6061344161953', '6061344063649',
  '4523829067872', '4523829198944', '6845769121953', '4509718806624', '4509718741088',
  '6876244082849', '6876281208993', '5314328527009', '8060940943610', '7541546877178',
  '7542184640762', '7542209741050', '4489723248736', '6655619236001', '6887867482273',
  '5543643676833', '6860486213793', '4523829330016', '4523829002336', '7500125634810',
  '8060417802490', '8060501229818', '7994217267450', '6885676089505', '6886023889057',
  '5433709953185', '6812345630881', '6923714166945', '7982935802106', '5329136124065',
  '7983942861050', '4572372303968', '4495471706208', '4478991794272', '4417271332960',
  '6930503368865', '6685791322273', '5798909018273', '5798908821665', '6859812274337',
  '7845957533946', '6882076852385', '6936508235937', '6876626682017', '6876357492897',
  '6026301472929', '8021874147578', '8022239478010', '5557074985121', '5509927927969',
  '4536344477792', '7845898584314', '7576026546426', '5508867260577', '4489762570336',
  '7983928410362', '5330026758305', '6960603988129', '7566367654138', '8011103797498',
  '8162296496378', '8173344653562', '4612919066720', '8012431819002', '8012431884538',
  '7500237897978', '7041188397217', '4590559723616', '6981162860705', '7996085043450',
  '5525675081889', '7489761476858', '7541548056826', '6876513173665', '4505245089888',
  '7982933115130', '6869514977441', '4523828576352', '7983994503418', '5742786478241',
  '5294722318497', '5753048727713', '6860280135841', '8102757761274', '7723836899578',
  '8096699089146', '6827275944097', '6876475523233', '5806502772897', '6069693579425',
  '4584813297760', '5450415538337', '8193211728122', '7455209816314', '7961561334010',
  '8190602739962', '4563037880416', '5347300966561', '4572385935456', '6812130607265',
  '6851868721313', '6909809688737', '6842694795425', '6859906056353', '6869586149537',
  '6873875284129', '6874011828385', '6873654788257', '6896742203553', '4536343822432',
  '5758821597345', '4417266974816', '6931062784161', '7038324179105', '6856618082465',
  '4536343330912', '8021886697722', '5667387375777', '5873931387041', '6883290972321',
  '5873931124897', '4475668136032', '8161314111738', '4523827527776', '7697310384378',
  '7568387899642', '7568387637498', '7568387965178', '7740460761338', '7568387735802',
  '6935633068193', '7606777217274', '7618508161274', '6982559301793', '7630664532218',
  '4571184037984', '8100608737530', '4571184005216', '5241086509217', '7618509209850',
  '6883705847969', '6774479618209', '7661570588922', '7661570031866', '8248377606394',
  '7575276060922', '8003821764858', '8073390326010', '8248214978810', '7606776922362',
  '4505246793824', '7606776987898', '7994247414010', '8161319813370', '7845975654650',
  '7606776889594', '6914967306401', '7630664106234', '7606777086202', '8224150225146',
  '5294721761441', '5360818946209', '4590456864864', '4590505033824', '6842385236129',
  '4572386033760', '5244462203041', '5294721958049', '5294722252961', '5239502831777',
  '4417261863008', '4417270022240', '5500547629217', '5355977572513', '4523828248672',
  '4523827724384', '4523828150368', '4523828084832', '7983365325050', '8027660943610',
  '4528320741472', '4528320577632', '8162308653306', '7452902719738', '5482307649697',
  '4536344117344', '5482307616929', '5482307485857', '5482307420321', '8035035447546',
  '7984208216314', '8150185541882', '5596088041633', '6930512478369', '7593648128250',
  '7593652551930', '4417295450208', '6896554541217', '8028194242810', '4417295974496',
  '8021507277050', '7676377170170', '7676373893370', '5347836133537', '5667386032289',
  '8149988999418', '8150032744698', '8192177996026', '8113165992186', '8145334960378',
  '6859886624929', '6765736722593', '6741957705889', '7571339051258', '5238217769121',
  '6741957804193', '4506283442272', '5887546654881', '7560181809402', '4505244237920',
  '5719792648353', '6634014736545', '5887546818721', '5907634290849', '6542306410657',
  '4484056842336', '5315457712289', '8171519279354', '5887546425505', '6741957607585',
  '6878477975713', '5835464868001', '7560410005754', '4417296072800', '4417271267424',
  '6966470574241', '4538223689824', '8009125986554', '8134249382138', '6818484650145',
  '8110991802618', '4417291452512', '7560398504186', '5370613203105', '7564838142202',
  '6069694136481', '8021519794426', '6026337190049', '7455207325946', '6052094541985',
  '6052095623329', '8173335904506', '5998486388897', '5806504673441', '5911743070369',
  '7560179482874', '5950502928545', '4509718511712', '6666852925601', '7982403780858',
  '7982402961658', '5866936598689', '6894988951713', '5956002513057', '5956003168417',
  '5474398765217', '7560180269306', '7982630666490', '7982633320698', '5835464179873',
  '6637698613409', '8100986945786', '8006161662202', '8114229444858', '8156712763642',
  '8167850574074', '4536344346720', '8006273859834', '8169463316730', '8167120535802',
  '8133067014394', '5770427105441', '5770427072673', '7560398405882', '7564838076666',
  '6069694726305', '6891632689313', '7560398962938', '4417272250464', '4417271496800',
  '4417272348768', '4417271890016', '4417272545376', '6022552813729', '6637698285729',
  '6026302390433', '6749411606689', '5806501527713', '5753361465505', '6634014146721',
  '5866936565921', '7455207260410', '6052094836897', '6052095656097', '6026325655713',
  '7984186818810', '5474398797985', '5956003496097', '7610244727034', '7560179253498',
  '6666853318817', '6664892547233', '5971602538657', '5911742775457', '7560180662522',
  '5950502830241', '8174310686970', '8565777957114', '8565784641786', '8565791817978',
  '8593504633082', '8593529241850', '8612312482042', '8623377907962', '8626277548282',
  '8620603638010', '8584336507130', '8630679011578', '8629243805946', '8570797981946',
  '8623658926330', '8621310050554', '8565001978106', '8564462420218', '8565101232378',
  '8565076263162', '8523781210362', '8630284812538', '8629279588602', '8629863710970',
  '8497042587898', '8493909770490', '8634235355386', '8631162994938', '8657402790138',
  '14819398386050', '14819787506050', '14820687675778', '14872907350402', '14872929468802',
  '14872946311554', '14872978162050', '14872979800450', '14873358467458', '14874198802818',
  '14874199196034', '14874199523714', '14874199589250', '14874223411586', '14874527138178',
  '14874527465858', '14875138687362', '14875726086530', '8647150108922', '8645782274298',
  '8647147454714', '8647143981306', '8641920434426', '14875784708482', '14877938221442',
  '14878296572290', '14878344577410', '14878700437890', '14877084057986', '14877081567618',
  '14877086843266', '14875761344898', '8005846204666', '14878792417666', '14878798217602',
  '14879114002818', '14879661097346', '14879664963970', '14879701172610', '14880113525122',
  '14880184992130', '14880238764418', '14880702562690', '14881367327106', '14881436402050',
  '14882095464834', '14882111193474', '14882320089474', '14882325135746', '14882330345858',
  '14882707243394', '14882723758466', '14882724839810', '14882775925122', '14882799878530',
  '14883152527746', '14883163767170', '14883343040898', '14883356803458', '14883360080258',
  '14883363324290', '14884685578626', '14886272434562', '14888999289218', '14888894071170',
  '14889922855298', '14889944973698', '14891155063170', '14892316885378', '14892327797122',
  '14892889276802', '14893024969090', '14895425978754', '14895430205826', '14896143630722',
  '14896476127618', '14899849494914', '14900324368770', '14900890435970', '14900892729730',
  '14900893876610', '14900895351170', '14903375888770', '14903399973250', '14906896810370',
  '14906898448770', '14907263746434', '14907269546370', '14907824243074', '14908694430082',
  '14909245653378', '14909359948162', '14909172908418', '14910234657154', '14909815357826',
  '14919938539906', '14919945650562', '14919952433538', '14921161048450', '14921165668738',
  '14921688416642', '14921711550850', '14922486481282', '14922491625858', '14922494509442',
  '14922496803202', '14922498343298', '14922510041474', '14922542973314', '14922549657986',
  '14924135596418', '14924444139906', '14924478153090', '14924554666370', '14924718440834',
  '14924942672258', '14924942868866', '14924960235906', '14924979175810', '14924980846978',
  '14924984648066', '14924996477314', '14924998574466', '14925001392514', '14925007192450',
  '14925037011330', '14925041566082', '14925054443906', '14925054837122', '14925064405378',
  '14925079478658', '14925365182850', '14925398409602', '14925407846786', '14925553828226',
  '14925554614658', '14925559005570', '14925622444418', '14925606748546', '14925621887362',
  '14926522614146', '14927394275714', '14927459418498', '14927467610498', '14927479144834',
  '14927534457218', '14927611789698', '14927629844866', '14927902966146', '14927886680450',
  '14927654519170', '14927696494978', '14927474459010', '14927609495938', '14927568077186',
  '14928360604034', '14928360669570', '14928360767874', '14928361324930', '14928368238978',
  '14928368501122', '14928373252482', '14928374890882', '14928386359682', '14928392388994',
  '14928394682754', '14928395633026', '14928396386690', '14928417751426', '14928459137410',
  '14928466018690', '14928487612802', '14928505110914', '14928536764802', '14928494133634',
  '14929082253698', '14929096540546', '14929097884034', '14929118691714', '14929131569538',
  '14929147527554', '14929692524930', '14929701208450', '14929786503554', '14929797939586',
  '14930544394626', '14930568741250', '14930593284482', '14930607112578', '14930634768770',
  '14930636603778', '14930639389058', '14930640601474', '14930641125762', '14930646729090',
  '14930662588802', '14930668224898', '14930682184066', '14932127809922', '14932128170370',
  '14932217528706', '14932281721218', '14932468662658', '14932471939458', '14932383039874',
  '14932416594306', '14932618477954', '14932653801858', '14932713210242', '14932718879106',
  '14933197128066', '14933198373250', '14933203222914', '14933204926850', '14933202731394',
  '14933782266242', '14933784822146', '14933786067330', '14933787509122', '14933802582402',
  '14933888237954', '14933904261506', '14933958820226', '14933967765890', '14933971075458',
  '14934032843138', '14933997158786', '14934424977794', '14934428385666', '14934429598082',
  '14934433726850', '14934467281282', '14934468723074', '14934472556930', '14934484713858',
  '14934485369218', '14934538977666', '14934638199170', '14934470721922', '14934663922050',
  '14935293460866', '14937352143234', '14937880330626', '14937911165314', '14937984106882',
  '14937991709058', '14937995084162', '14938076479874', '14937883869570', '14940507439490',
  '14940699722114', '14944163266946', '14949723668866', '14950425100674', '14950484967810',
  '14951487439234', '14951542096258', '14951566213506', '14951624147330', '14951646364034',
  '14952939094402', '14952982872450', '14953043689858', '14952658928002', '14953771008386',
  '14953782444418', '14953818456450', '14953841688962', '14953877307778', '14953903227266',
  '14953918333314', '14954008248706', '14956055921026', '14956086264194', '14957531332994',
  '14957729284482', '14957740786050', '14957766541698', '14957795213698', '14957842170242',
  '14958021968258', '14958813446530', '14958826324354', '14958830223746', '14958830649730',
  '14958851326338', '14958855913858', '14958858142082', '14959092498818', '14959094563202',
  '14959101837698', '14959191949698', '14959226257794', '14959621931394', '14959624028546',
  '14960132718978', '14960152248706', '14960157163906', '14960177676674', '14960182296962',
  '14960256680322', '14960270246274', '14960311927170', '14960407609730', '14960433299842',
  '14961197023618', '14961212096898', '14961233101186', '14961264918914', '14961278124418',
  '14961292312962', '14964936671618', '14965085438338', '14967008002434', '14968030396802',
  '14968057856386', '14970640007554', '14970823049602', '14970833961346', '14971144536450',
  '14971672428930', '14971719352706', '14971726856578', '14971728200066', '14974327914882',
  '14975177523586', '14975504843138', '14975507890562', '14975509266818', '14975886721410',
  '14975890751874', '14980340023682', '14983390134658', '14984117387650', '14984125350274',
  '14986988323202', '14989499138434', '14991546581378', '14991593636226', '14992420143490',
  '14992445997442', '14992559145346', '14993332044162', '14993926783362', '14995616203138',
  '14995625640322', '14996449067394', '15000444338562', '15011934437762', '15015804797314',
  '15022533640578', '15022982594946', '15023043412354', '15023091188098', '15023745008002',
  '15023996371330', '15024538747266', '15025670553986', '15026397249922', '15026401116546',
  '15026377589122', '15026390532482', '15026376081794', '15026373132674', '15030145122690',
  '15035471069570', '15035760902530', '15037028532610', '15039008833922', '15039066210690',
  '15041350893954', '15042460647810', '15042460811650', '15042461041026', '15042500723074',
  '15043605561730', '15046490751362', '15046492094850', '15046948553090', '15048202125698',
  '15048390214018', '15051681399170', '15051985715586', '15052649103746', '15052655493506',
  '15053340148098', '15053341393282', '15053394116994', '15053406634370', '15053482099074',
  '15053484294530', '15055817638274', '15056531063170', '15056723214722', '15056915399042',
  '15057860592002', '15057885004162', '15057932550530', '15059906789762', '15059972292994',
  '15060044284290', '15063956652418', '15064665588098', '15064676139394', '15065212256642',
  '15065242534274', '15065359057282', '15065372787074', '15065709740418', '15066724598146',
  '15048298561922', '15051980276098', '15056709353858', '15056729244034', '15056734880130',
  '15068327215490', '15068437447042', '15068439216514', '15068619735426', '15068625535362',
  '15069172826498', '15069196812674', '15069255532930', '15069263692162', '15069278798210',
  '15069292855682', '15069349151106', '15069598351746', '15069635314050', '15070099079554',
  '15070133158274', '15070155440514', '15070213472642', '15070215242114', '15071146115458',
  '15071148605826', '15071151423874', '15071151653250', '15071739019650', '15071747178882',
  '15071766512002', '15071766774146', '15071814484354', '15072898941314', '15072964149634',
  '15072982729090', '15072994034050', '15074120925570', '15074121122178', '15074121777538',
  '15075268002178', '15075287925122', '15082675405186', '15083428675970', '15084542099842',
  '15086799847810', '15086824259970', '15086824292738', '15090942017922', '15090943689090',
  '15092032242050', '15092032668034', '15092036960642', '15092106789250', '15092131955074',
  '15092145586562', '15093806924162', '15094923297154', '15095811735938', '15096912970114',
  '15096913625474', '15096988729730', '15096989450626', '15097019826562', '15097043255682',
  '15097074123138', '15097095029122', '15097695207810', '15097952764290', '15097993560450',
  '15101194666370', '15101384163714', '15101501800834', '15102790435202', '15102806458754',
  '15102976950658', '15102988484994', '15105470300546', '15105475379586', '15105575125378',
  '15105611137410', '15105659044226', '15105663238530', '15106577695106', '15106616656258',
  '15106694775170', '15108624286082', '15108647747970', '15109569216898', '15109825036674',
  '15112941928834', '15112966078850', '15112975712642', '15112981807490', '15113001533826',
  '15113040068994', '15113057108354', '15113222390146', '15114173645186', '15114462462338',
  '15114465935746', '15114995040642', '15115043307906', '15118583792002', '15118583824770',
  '15121093951874', '15121175970178', '15123669385602', '15123994182018', '15124968997250',
  '15125009858946', '15125129691522', '15125235630466', '15125290877314', '15125306933634',
  '15125325185410', '15125358772610', '15125400191362', '15129924600194', '15136776028546',
  '15136974832002', '15139006546306', '15139130343810', '15139784786306', '15139786457474',
  '15141040652674', '15141040685442', '15141041439106', '15141041668482', '15141042553218',
  '15141070307714', '15141177229698', '15141194596738', '15141903466882', '15141903565186',
  '15141907038594', '15141907202434', '15141915197826', '15141924766082', '15143247839618',
  '15143258620290', '15143261274498', '15143262486914', '15143265239426', '15143404306818',
  '15143412957570', '15143432257922', '15143562445186', '15143665828226', '15143694696834',
  '15144403730818', '15144404222338', '15144404451714', '15144754807170', '15145624568194',
  '15145627189634', '15145628434818', '15145632694658', '15145639412098', '15145927999874',
  '15146135683458', '15147423302018', '15147501781378', '15147562238338', '15148456018306',
  '15148467192194', '15148610191746', '15148633915778', '15148644204930', '15154353635714',
  '15155220513154', '15155226902914', '15156143882626', '15157467611522', '15157516763522',
  '15158078505346', '15160093049218', '15160144101762', '15162214482306', '15163045544322',
  '15163062747522', '15163114979714', '15164193407362', '15164626207106', '15167325143426',
  '15167355453826', '15167402049922', '15168765165954', '15168975929730', '15170044297602',
  '15170956263810', '15170968781186', '15172186145154', '15172188242306', '15172439998850',
  '15176022000002', '15178726506882', '15179732550018', '15183365833090', '15184628547970',
  '15185667948930', '15185670078850', '15187829752194', '15189299560834', '15189300052354',
  '15193556222338', '15193564217730', '15194274759042', '15194277577090', '15194333413762',
  '15194333872514', '15194334888322', '15194335871362', '15194385580418', '15194416284034',
  '15197756555650', '15198742249858', '15198794482050', '15198872043906', '15198882660738',
  '15198903730562', '15203134439810', '15203277046146', '15203677372802', '15205088788866',
  '15205229658498', '15205246632322', '15205344870786', '15205938430338', '15205940167042',
  '15205949276546', '15206086672770', '15206151291266', '15208447213954', '15208524513666',
  '15208529232258', '15208545124738', '15209512501634', '15209932882306', '15210967794050',
  '15211033461122', '15211174101378', '15211215061378', '15211247206786', '15211902665090',
  '15211902828930', '15211906400642', '15212012110210', '15212198625666', '15212824887682',
  '15212979585410', '15214395752834', '15214437728642', '15216461775234', '15217248764290',
  '15217386226050', '15222430269826', '15222431121794', '15222437249410', '15222437544322',
  '15225485754754', '15226612941186', '15226691289474', '15227988705666', '15228000993666',
  '15229551935874', '15230790140290', '15233439236482', '15247917384066', '15253016805762',
  '15253036466562', '15253041283458', '15254586818946', '15254724837762', '15258727842178',
  '15260005171586', '15260059763074', '15260060582274', '15260812935554', '15260831285634',
  '15260844720514', '15260848062850', '15260848095618', '15260849897858', '15260851962242',
  '15260951642498', '15261926687106', '15261964927362', '15263658180994', '15263750619522',
  '15263751340418', '15264002376066', '15264857260418', '15264861815170', '15266782314882',
  '15266961359234', '15267741106562', '15267802055042', '15269014962562', '15269016011138',
  '15269016469890', '15269017223554', '15269017354626', '15269018206594', '15269019287938',
  '15269028856194', '15269217599874', '15269308006786', '15269381734786', '15269429182850',
  '15269470437762', '15269490721154', '15269520966018', '15269981028738', '15270014648706',
  '15270340952450', '15270379422082', '15270469009794', '15270801015170', '15270801146242',
  '15270947815810', '15270960234882', '15271016268162', '15272369553794', '15272480702850',
  '15273629811074', '15273914204546', '15273967550850', '15273974301058', '15273985540482',
  '15275611193730', '15275622564226', '15276425445762', '15277921960322', '15278562017666',
  '15279214625154', '15279239856514', '15279888728450', '15280014459266', '15280019800450',
  '15280023339394', '15280059023746', '15282483003778', '15286318072194', '15287119020418',
  '15288721637762', '15288722030978', '15292011774338', '15292046180738', '15292172337538',
  '15292833038722', '15292870721922', '15293716693378', '15293716791682', '15293721805186',
  '15293722722690', '15293724885378', '15295497470338', '15297532985730', '15297582989698',
  '15299416818050', '15299417997698', '15299488317826', '15299983180162', '15302600425858',
  '15303301759362', '15304779563394', '15308826116482', '15309025640834', '15311809315202',
  '15312219242882', '15312229302658', '15312314302850', '15312332063106', '15312470540674',
  '15317344092546', '15319604593026', '15319606002050', '15319608230274', '15319626023298',
  '15319688511874', '15322553713026', '15322580779394', '15324534931842', '15325851910530',
  '15325874815362', '15325876486530', '15326195581314', '15326802116994', '15326861263234',
  '15326866997634', '15326871257474', '15330780676482', '15332772381058', '15332789223810',
  '15333766103426', '15333783798146', '15334428311938', '15334468813186', '15344949920130',
  '15345487774082', '4484056449120', '5474398437537', '8071288324346', '15346048663938',
  '15349401223554', '15349432680834', '15349451653506', '15355088896386', '15356525379970',
  '15361606582658', '15361622540674', '15364654498178', '15364740809090', '15366343655810',
  '15366507659650', '15367230554498', '15367235371394', '15367270629762', '15367660437890',
  '15367903740290', '15367915340162', '15368302854530', '15368303280514', '15368303673730',
  '15369343762818', '15369345040770', '15369744810370', '15370284466562', '15370534912386',
  '15370539401602', '15370541105538', '15370558407042', '15370562503042', '15371473387906',
  '15372355764610', '15372357697922', '15372357960066', '15372564169090', '15372658246018',
  '15372659720578', '15373038485890',
]);
function orderHasDilaksiProduct(order) {
  if (!order || !order.lineItems) return false;
  return order.lineItems.edges.some((e) => {
    const pid = e.node.variant && e.node.variant.product ? e.node.variant.product.legacyResourceId : null;
    return pid && DILAKSI_PRODUCT_IDS_UK.has(String(pid));
  });
}

const GROUPS = [
  {
    key: 'dm-ad',
    name: 'DM-Ad',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign exactly matches (or is a prefixed variant of) "Shop_DM_PMax-46_AguAsset" or "Shop_DM_PMax-46", OR utm_campaign is "sag_organic" (all months — confirmed by the user, 2026-07-27), OR (first session has no campaign/term AND the LAST/converting session\'s campaign is "Shop_DM_PMax-46_AguAsset" — confirmed by the user, 2026-07-27) (case-insensitive). ("Shop_DM_PMax-25" moved to Sajeepan, 2026-07-27.) EXCLUDES any order containing one of Sajeepan\'s or Sonya\'s owned product IDs (added 2026-07-30) — those go to their tabs instead, even though the click still carries a DM-Ad campaign.',
    match: (utm, fv, journey, month, order) => (isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset')) && !orderHasSajeepanProduct(order) && !orderHasSonyaProduct(order),
    matchValue: (utm, fv, journey) => utm.campaign || (lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset' ? 'Shop_DM_PMax-46_AguAsset (last session)' : null),
  },
  {
    key: 'meta',
    name: 'Meta',
    department: 'Meta Ads (Facebook/Instagram)',
    scope: 'first-session utm_campaign is one of "Sales Ads – Copy" / "Sales Ads" / "Sales Ads | Retargeting | Add to Cart" / "New Sales ad set" / "ABO Sales Ads - Retarget - Catalog Ads" / "ABO Sales Ads - Lookalike - Catalog Ads", OR first-session source is "Facebook" / "Instagram" / "android-app://m.facebook.com/", OR first-session channel is Social with source "an unknown source" (case-insensitive). Checked only after DM-Ad — an order already claimed by DM-Ad never lands here.',
    match: (utm, fv, journey, month) => isMetaMatch(utm, fv, journey, month),
    matchValue: (utm, fv) => utm.campaign || utm.source || (fv && fv.source) || null,
  },
  {
    key: 'sonya',
    name: 'Sonya',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign exactly matches "Klarna_Sonya_kl-pmx-all", "Sonya_PendantLight" or "SH_Wall_Light", OR utm_term exactly matches one of her 6 confirmed values ("Sonya", "ninc", "glow_up", "SonyaIreland", "SonyaSpian", "SonyTopEuropeEngEU{_adgroup}"), OR (first session has no campaign/term AND the 2nd OR LAST session\'s campaign is "Klarna_Sonya_kl-pmx-all" — confirmed by the user, 2026-07-27), OR (no campaign anywhere in the journey AND first-session utm_medium is "google_ads", unless the last session traces to a Sajeepan campaign — confirmed by the user, 2026-07-28, as a PERMANENT rule covering all months, including future live-month updates), OR the order contains one of Sonya\'s owned product IDs and would otherwise have matched DM-Ad\'s campaign rule (product-ID split added 2026-07-30, per user request to split DM Campaigns sales by product ownership). Checked only after DM-Ad and Meta.',
    match: (utm, fv, journey, month, order) => {
      if (isSonyaCampaign(utm.campaign) || isSonyaTerm(utm.term)) return true;
      if (!utm.campaign && !utm.term && (secondSessionCampaign(journey) === 'klarna_sonya_kl-pmx-all' || lastSessionCampaign(journey) === 'klarna_sonya_kl-pmx-all')) return true;
      if (!utm.campaign && !utm.term) {
        const medium = (utm.medium || '').toString().toLowerCase();
        // Don't blanket-claim if the last session traces to a known
        // Sajeepan campaign — let that fall through to Sajeepan instead
        // (checked after Sonya in GROUPS priority order).
        if (medium === 'google_ads' && !isSajeepanCampaignUk(lastSessionCampaign(journey))) return true;
      }
      if ((isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset')) && orderHasSonyaProduct(order)) return true;
      if (deriveChannelLabel(journey) === 'Direct' && isSecondSessionPaidSearch(journey) && orderHasSonyaProduct(order)) return true;
      return false;
    },
    matchValue: (utm, fv, journey, month, order) => {
      if ((isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset')) && orderHasSonyaProduct(order)) {
        return (utm.campaign || 'DM-Ad campaign') + ' (product-owned, moved from DM Campaigns)';
      }
      if (deriveChannelLabel(journey) === 'Direct' && isSecondSessionPaidSearch(journey) && orderHasSonyaProduct(order)) {
        return 'Direct -> 2nd session Google Ads (product-owned)';
      }
      if (utm.campaign) return utm.campaign;
      if (utm.term) return utm.term;
      if (secondSessionCampaign(journey) === 'klarna_sonya_kl-pmx-all') return 'Klarna_Sonya_kl-pmx-all (2nd session)';
      if (lastSessionCampaign(journey) === 'klarna_sonya_kl-pmx-all') return 'Klarna_Sonya_kl-pmx-all (last session)';
      const medium = (utm.medium || '').toString().toLowerCase();
      if (medium === 'google_ads') return 'google_ads (untraceable campaign)';
      return null;
    },
  },
  {
    key: 'sajeepan',
    name: 'Sajeepan',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign exactly matches one of "Accessories_sj", "GCSS_ALL_ROAS_400_SAJEE_PMAX", "GCSS_ALL_ROAS_400_SAJEE", "SJ_TOP_20X", "sajeepan_pmax_gcss_ceiling_rose_fitting_asset", "Shop_SJ_PMax-25", "Aji_Sh_PMax", "Shop_DM_PMax-25", "Shop_DM_PMax-25_ZERO", "Klarna_P", "SJ_PMAX_Scale_Heroes_25", "KLARNA_CSS_SJ25_PMAX", "Klarna_G2", "P_Max_Klarna_CSS_SJ_OLD" (case-insensitive), OR (first session has no campaign/term AND the 2nd OR LAST session\'s campaign is "Klarna_P", "KLARNA_CSS_SJ25_PMAX" or "Shop_DM_PMax-25" — confirmed by the user, 2026-07-27), OR the order contains one of Sajeepan\'s owned product IDs and would otherwise have matched DM-Ad\'s campaign rule (product-ID split added 2026-07-30, per user request to split DM Campaigns sales by product ownership). Checked only after DM-Ad, Meta and Sonya.',
    match: (utm, fv, journey, month, order) => isSajeepanCampaignUk(utm.campaign) || (!utm.campaign && !utm.term && isSajeepanCampaignUk(secondSessionCampaign(journey))) || (!utm.campaign && !utm.term && isSajeepanCampaignUk(lastSessionCampaign(journey))) || ((isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset')) && orderHasSajeepanProduct(order)) || (deriveChannelLabel(journey) === 'Direct' && isSecondSessionPaidSearch(journey) && orderHasSajeepanProduct(order)),
    matchValue: (utm, fv, journey, month, order) => {
      if ((isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset')) && orderHasSajeepanProduct(order)) {
        return (utm.campaign || 'DM-Ad campaign') + ' (product-owned, moved from DM Campaigns)';
      }
      if (deriveChannelLabel(journey) === 'Direct' && isSecondSessionPaidSearch(journey) && orderHasSajeepanProduct(order)) {
        return 'Direct -> 2nd session Google Ads (product-owned)';
      }
      if (utm.campaign) return utm.campaign;
      if (isSajeepanCampaignUk(secondSessionCampaign(journey))) return secondSessionCampaign(journey) + ' (2nd session)';
      if (isSajeepanCampaignUk(lastSessionCampaign(journey))) return lastSessionCampaign(journey) + ' (last session)';
      return null;
    },
  },
  {
    key: 'sukirtha',
    name: 'Sukirtha',
    department: 'Email Marketing',
    scope: 'first-session channel is classified Email (Shopify sourceType=NEWSLETTER, or utm_medium=email, or source/description contains "email") — EVERY email-attributed order, not restricted to a specific campaign list. Also catches utm_source/utm_campaign exactly "email" even when Shopify\'s own channel classifier mislabels it (e.g. Organic Search) — confirmed by the user, 2026-07-27. Checked last — an order already claimed by DM-Ad/Meta/Sonya/Sajeepan never lands here.',
    match: (utm, fv, journey) => {
      if (journey && journey.first && journey.first.classification === 'EMAIL') return true;
      const src = (utm.source || (fv && fv.source) || '').toString().toLowerCase();
      const camp = (utm.campaign || '').toString().toLowerCase();
      return src === 'email' || camp === 'email';
    },
    matchValue: (utm, fv) => utm.campaign || (fv && fv.sourceDescription) || (fv && fv.source) || '(email, no campaign)',
  },
  {
    key: 'kamsi',
    name: 'Kamsi',
    department: 'Organic (product-scoped)',
    scope: 'the order matches Organic\'s rule (see below) AND contains one of Kamsi\'s owned product IDs, OR the order is first-session Direct whose 2nd session is NOT Google Ads paid search (i.e. "pure organic" Direct, per user request 2026-07-30) AND contains one of her products. Checked before Dilaksi, Direct and Organic, so her product-owned orders never land in any of those.',
    match: (utm, fv, journey, month, order) => (isOrganicMatch(utm, fv, journey) || (deriveChannelLabel(journey) === 'Direct' && !isSecondSessionPaidSearch(journey))) && orderHasKamsiProduct(order),
    matchValue: (utm, fv, journey) => deriveChannelLabel(journey) === 'Direct' ? '(owned product, Direct -> pure organic)' : '(owned product, organic)',
  },
  {
    key: 'dilaksi',
    name: 'Dilaksi',
    department: 'Organic (product-scoped)',
    scope: 'the order matches Organic\'s rule (see below) AND contains one of Dilaksi\'s owned product IDs, OR the order is first-session Direct whose 2nd session is NOT Google Ads paid search AND contains one of her products (per user request, 2026-07-30). Checked after Kamsi (1 product ID appears in both lists as given by the user, resolves to Kamsi) and before Direct/Organic.',
    match: (utm, fv, journey, month, order) => (isOrganicMatch(utm, fv, journey) || (deriveChannelLabel(journey) === 'Direct' && !isSecondSessionPaidSearch(journey))) && orderHasDilaksiProduct(order),
    matchValue: (utm, fv, journey) => deriveChannelLabel(journey) === 'Direct' ? '(owned product, Direct -> pure organic)' : '(owned product, organic)',
  },
  {
    key: 'direct',
    name: 'Direct',
    department: 'Direct Traffic',
    scope: 'first-session channel is classified Direct (no referrer, no UTM params, typed the URL or used a bookmark) AND not claimed by Sajeepan/Sonya (2nd session Google Ads + their product) or Kamsi/Dilaksi (2nd session not Google Ads + their product) above. Split out of the Organic tab into its own tab/page (per user request, 2026-07-30) — checked before Organic so Direct orders never land there anymore.',
    match: (utm, fv, journey) => deriveChannelLabel(journey) === 'Direct',
    matchValue: (utm, fv, journey) => 'Direct' + (isSecondSessionPaidSearch(journey) ? ' -> 2nd session Google Ads (unowned)' : '') + ((fv && fv.source) ? ' - ' + fv.source : ''),
  },
  {
    key: 'organic',
    name: 'Organic',
    department: 'Organic / Direct / Referral',
    scope: 'first-session channel is Referral (any), "No Journey Data", Organic Search from one of Google / Google app (Android) / Bing / DuckDuckGo / Gmail app / Ecosia / Yahoo, Social from Pinterest, OR "Other" with source "ChatGPT" or "an unknown source". Confirmed by the user, 2026-07-27, after verifying none of these carry any paid-ad signal (no gclid/paid utm_medium/paid utm_source/Shopify ad sourceType). ("Direct" moved out to its own tab, 2026-07-30.) Checked last — an order already claimed by any earlier group never lands here.',
    match: (utm, fv, journey) => isOrganicMatch(utm, fv, journey),
    // Source/sourceDescription take priority over utm.campaign for display
    // — a genuine Google-organic click can carry utm_campaign="Multifeeds"
    // (Shopify's free Google Shopping listing tag), which would otherwise
    // shadow the real source in the label.
    matchValue: (utm, fv, journey) => deriveChannelLabel(journey) + ' - ' + ((fv && fv.source) || (fv && fv.sourceDescription) || utm.campaign || (journey && journey.status === 'NO_JOURNEY_DATA' ? '(no journey data)' : 'direct')),
  },
  {
    key: 'cppc',
    name: 'CPPC',
    department: 'Google Shopping (Free/Comparison Listings)',
    scope: 'first-session channel is "Other" with utm_campaign (or source/sourceDescription) exactly "Shopping" (Google\'s free Shopping tab listings, not a paid campaign). Confirmed by the user, 2026-07-27. Checked last — an order already claimed by any earlier group never lands here.',
    match: (utm, fv, journey) => {
      const channel = deriveChannelLabel(journey);
      if (channel !== 'Other') return false;
      const val = (utm.campaign || (fv && (fv.source || fv.sourceDescription)) || utm.source || '').toString();
      return val === 'Shopping';
    },
    matchValue: (utm, fv) => utm.campaign || (fv && (fv.source || fv.sourceDescription)) || utm.source || 'Shopping',
  },
  {
    key: 'thishoban',
    name: 'Thishoban',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign contains "THISOBAN" (e.g. "THISOBAN-pmac", "TH_NOC-Shopping") OR utm_term exactly matches "THISOBAN" (case-insensitive). Found in February data, 2026-07-27. Checked last — an order already claimed by any earlier group never lands here.',
    match: (utm) => {
      const campaign = (utm.campaign || '').toString().toLowerCase();
      const term = (utm.term || '').toString().toLowerCase();
      return campaign.includes('thisoban') || term === 'thisoban';
    },
    matchValue: (utm) => utm.campaign || utm.term,
  },
  {
    key: 'theekshy',
    name: 'Theekshy',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign contains "theekshy" (case-insensitive) — covers "Pmax_UK_Theekshy_Shoptimised_THEE_NS_MCV_UK" (found May), "Pmax_Theekshy_Shoptimised_THEE_MYSTERY_Non_Converting_MCV_UK" (found July), and any future variant. Confirmed by the user, 2026-07-27/28. Checked last — an order already claimed by any earlier group never lands here.',
    match: (utm) => (utm.campaign || '').toString().toLowerCase().includes('theekshy'),
    matchValue: (utm) => utm.campaign,
  },
  {
    key: 'thanishtika',
    name: 'Thanishtika',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign exactly matches "Thanish-PMax-HI-12-3-2026" or "Thanish-Pmax-sho-3-2-2026" (case-insensitive). Found in June data, confirmed by the user, 2026-07-27. Checked last — an order already claimed by any earlier group never lands here.',
    match: (utm) => {
      const c = (utm.campaign || '').toString().toLowerCase();
      return c === 'thanish-pmax-hi-12-3-2026' || c === 'thanish-pmax-sho-3-2-2026';
    },
    matchValue: (utm) => utm.campaign,
  },
];

// Virtual 11th tab (added 2026-07-28) — every order that doesn't match any
// group above. Not part of GROUPS itself (it never "claims" anything from
// the real groups; it's just "whatever's left"), so it's handled as a
// special case in handleGroup() below. Same order-level UI/session-history
// treatment as every other tab, and included in the hourly live-month
// refresh so new/unrecognized campaigns surface automatically as July
// progresses — assigning them permanently (moving them into a real group)
// is still a manual step for now (deferred by the user, 2026-07-28).
const NOT_ASSIGNED_GROUP = {
  key: 'not-assigned',
  name: 'Not Assigned',
  department: 'Unassigned / needs review',
  scope: 'every order that does NOT match any other group\'s rule above. Shows up here until a human assigns it to a real tab (that assignment is currently a manual step — ask to add a specific campaign/rule to a group and it moves out of this tab on the next refresh).',
  matchValue: (utm, fv, journey) => {
    const channel = deriveChannelLabel(journey);
    const label = utm.campaign || utm.term || (fv && fv.source) || (journey && journey.status === 'NO_JOURNEY_DATA' ? '(no journey data)' : 'direct');
    return channel + ' - ' + label;
  },
};

// Manual overrides (added 2026-07-29): an order assigned from the Not
// Assigned tab's UI via api/assign-order.js is committed to this file in
// the GitHub repo, which redeploys and gets picked up here on the next
// request -- checked BEFORE the normal GROUPS rules so a manual assignment
// always wins. Read fresh (not cached) since the file is tiny and this is
// the only way a fresh deploy's change becomes visible without restarting
// the whole in-memory CACHE below.
const GROUPS_BY_KEY = new Map(GROUPS.map((g) => [g.key, g]));
function loadOverrides() {
  try {
    const p = path.join(__dirname, 'data', 'order-overrides.json');
    return JSON.parse(fs.readFileSync(p, 'utf8') || '{}');
  } catch (e) {
    return {};
  }
}

function assignGroup(utm, fv, journey, month, orderId, order) {
  if (orderId) {
    const overrides = loadOverrides();
    const o = overrides[String(orderId)];
    if (o && o.source === 'salesuk' && GROUPS_BY_KEY.has(o.groupKey)) return GROUPS_BY_KEY.get(o.groupKey);
  }
  for (const g of GROUPS) {
    if (g.match(utm, fv, journey, month, order)) return g;
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

// Direct-traffic reclassification (added 2026-07-30, per user request): a
// "Direct" first session with no referrer can still be followed by a 2nd
// session that DOES carry an ad signal — Shopify's own classifier says so
// per-session (classifications[1].classification), which is more reliable
// than re-parsing UTM strings. If that 2nd session is Google Ads paid
// search, the order is treated as ad-driven (routed to Sajeepan/Sonya by
// product ownership); otherwise it stays "pure organic" (routed to
// Kamsi/Dilaksi by product ownership, same as any other Organic order).
function isSecondSessionPaidSearch(journey) {
  const second = journey && journey.classifications && journey.classifications[1];
  return !!second && second.classification === 'PAID_SEARCH';
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
    const assigned = assignGroup(utm, fv, journey, monthConfig.month, order.legacyResourceId, order);
    if (assigned) continue;
    const row = buildOrderRow(order, journey);
    const channel = deriveChannelLabel(journey);
    const groupValue = utm.campaign || utm.term || (fv && fv.source) || '(no first-session data)';
    const key = channel + ' | ' + groupValue;
    if (!tally.has(key)) tally.set(key, { channel, group: groupValue, orders: 0, netSales: 0, orderNames: [], terms: new Set(), mediums: new Set(), hasCampaign: 0, noCampaign: 0, secondSessionCampaigns: new Map() });
    const t = tally.get(key);
    t.orders += 1;
    t.netSales = round2(t.netSales + row.netSales);
    if (t.orderNames.length < 1000) t.orderNames.push(row.orderName);
    if (utm.term) t.terms.add(utm.term);
    // Terms from EVERY session, not just first — added 2026-07-27 per user
    // request, purely diagnostic.
    for (const s of (row.sessions || [])) {
      if (s.utm && s.utm.term) t.terms.add(s.utm.term);
    }
    t.mediums.add(utm.medium || '(none)');
    if (utm.campaign) t.hasCampaign++; else t.noCampaign++;
    // Second-session lookthrough (added 2026-07-27, per user request): when
    // the first session carries no campaign, check what the SECOND session
    // was tagged with — still not used for matching, purely diagnostic.
    if (!t.lastSessionCampaigns) t.lastSessionCampaigns = new Map();
    if (!t.sessionCounts) t.sessionCounts = new Map();
    const numSessions = (row.sessions || []).length;
    t.sessionCounts.set(numSessions, (t.sessionCounts.get(numSessions) || 0) + 1);
    const lastSession = (row.sessions || [])[numSessions - 1];
    if (lastSession) {
      const lu = lastSession.utm || {};
      const kL = lu.campaign || lu.term || '(no campaign/term)';
      t.lastSessionCampaigns.set(kL, (t.lastSessionCampaigns.get(kL) || 0) + 1);
      if (!t.orderDetails) t.orderDetails = [];
      if (t.orderDetails.length < 200) t.orderDetails.push({ orderName: row.orderName, lastSessionCampaign: kL });
    }
    const secondSession = (row.sessions || [])[1];
    if (secondSession) {
      const su = secondSession.utm || {};
      const k2 = su.campaign || su.term || '(no campaign/term)';
      t.secondSessionCampaigns.set(k2, (t.secondSessionCampaigns.get(k2) || 0) + 1);
    }
    remainingCount += 1;
    remainingNet = round2(remainingNet + row.netSales);
  }
  res.status(200).json({
    success: true,
    reportPeriod: { month: monthConfig.month, label: monthConfig.label, timezone: 'Europe/London' },
    remainingTotal: { orders: remainingCount, netSales: remainingNet },
    remainingSplit: [...tally.values()].map((v) => ({
      ...v,
      terms: [...v.terms],
      mediums: [...v.mediums],
      secondSessionCampaigns: Object.fromEntries(v.secondSessionCampaigns),
      lastSessionCampaigns: v.lastSessionCampaigns ? Object.fromEntries(v.lastSessionCampaigns) : {},
      sessionCounts: v.sessionCounts ? Object.fromEntries(v.sessionCounts) : {},
    })).sort((a, b) => b.orders - a.orders),
    meta: { generatedAt: new Date().toISOString(), executionMs: Date.now() - startTime },
  });
}

// ---------- Simple in-memory cache (per warm Lambda instance only) ----------
const CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

// Patches a group's payload (static snapshot OR live) with manual overrides
// so an assignment made from the Not Assigned tab's UI takes effect
// IMMEDIATELY, without needing to regenerate the whole month's Shopify
// snapshot (added 2026-07-29, per user request: "after transfer no need in
// not assigned"). Overrides always originate from Not Assigned, so the full
// order row data needed to inject into a real group's view is sourced from
// Not Assigned's own static snapshot for that month.
function applyOverridesToSnapshot(payload, groupDef, monthConfig) {
  const overrides = loadOverrides();
  const overrideEntries = Object.entries(overrides).filter(([, o]) => o.source === 'salesuk' && o.month === monthConfig.month);
  if (!overrideEntries.length) return payload;
  const overriddenIds = new Set(overrideEntries.map(([id]) => id));

  let rows;
  if (groupDef.key === NOT_ASSIGNED_GROUP.key) {
    // Drop any order that's been manually assigned elsewhere.
    rows = payload.orders.filter((r) => !overriddenIds.has(String(r.orderLegacyId)));
  } else {
    // Keep this group's own rows, then pull in any order whose override
    // points here -- its full row data lives in Not Assigned's snapshot.
    const idsForThisGroup = new Set(overrideEntries.filter(([, o]) => o.groupKey === groupDef.key).map(([id]) => id));
    rows = [...payload.orders];
    if (idsForThisGroup.size) {
      const naPath = path.join(__dirname, 'data', `salesuk-not-assigned-${monthConfig.month}.json`);
      if (fs.existsSync(naPath)) {
        const naData = JSON.parse(fs.readFileSync(naPath, 'utf8'));
        for (const r of naData.orders || []) {
          if (idsForThisGroup.has(String(r.orderLegacyId)) && !rows.some((x) => x.orderLegacyId === r.orderLegacyId)) {
            rows.push({ ...r, matchedCampaign: (r.firstVisitCampaign || r.matchedCampaign || '(unknown)') + ' (M)' });
          }
        }
      }
    }
  }

  const byCampaign = new Map();
  for (const r of rows) {
    const k = r.matchedCampaign || '(unknown)';
    if (!byCampaign.has(k)) byCampaign.set(k, []);
    byCampaign.get(k).push(r);
  }
  const campaignSummary = [...byCampaign.keys()].sort()
    .map((code) => ({ campaign: code, ...summarizeOrderRows(byCampaign.get(code)) }))
    .sort((a, b) => b.ordersCount - a.ordersCount);

  return {
    ...payload,
    campaignList: [...byCampaign.keys()].sort(),
    combinedSummary: summarizeOrderRows(rows),
    campaignSummary,
    orders: rows,
  };
}

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
      let payload = { ...staticData, meta: { ...staticData.meta, cacheStatus: 'static-snapshot' } };
      payload = applyOverridesToSnapshot(payload, groupDef, monthConfig);
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
    const assigned = assignGroup(utm, fv, journey, monthConfig.month, order.legacyResourceId, order);
    const isMatch = groupDef.key === NOT_ASSIGNED_GROUP.key ? !assigned : (assigned && assigned.key === groupDef.key);
    if (!isMatch) continue;
    const row = buildOrderRow(order, journey);
    const ov = loadOverrides()[String(order.legacyResourceId)];
    row.matchedCampaign = (ov && ov.source === 'salesuk')
      ? (row.firstVisitCampaign || '(unknown)') + ' (M)'
      : groupDef.matchValue(utm, fv, journey, monthConfig.month, order);
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
  const groupDef = groupKey === NOT_ASSIGNED_GROUP.key ? NOT_ASSIGNED_GROUP : GROUPS.find(g => g.key === groupKey);

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
