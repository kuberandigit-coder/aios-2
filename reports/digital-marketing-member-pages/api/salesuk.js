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
const SUPPORTED_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
const CURRENT_LIVE_MONTHS = ['2026-07'];

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
  if (channel === 'Direct' || channel === 'Referral' || channel === 'No Journey Data') return true;
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
      return false;
    },
    matchValue: (utm, fv, journey, month, order) => {
      if ((isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset')) && orderHasSonyaProduct(order)) {
        return (utm.campaign || 'DM-Ad campaign') + ' (product-owned, moved from DM Campaigns)';
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
    match: (utm, fv, journey, month, order) => isSajeepanCampaignUk(utm.campaign) || (!utm.campaign && !utm.term && isSajeepanCampaignUk(secondSessionCampaign(journey))) || (!utm.campaign && !utm.term && isSajeepanCampaignUk(lastSessionCampaign(journey))) || ((isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset')) && orderHasSajeepanProduct(order)),
    matchValue: (utm, fv, journey, month, order) => {
      if ((isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset')) && orderHasSajeepanProduct(order)) {
        return (utm.campaign || 'DM-Ad campaign') + ' (product-owned, moved from DM Campaigns)';
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
    key: 'organic',
    name: 'Organic',
    department: 'Organic / Direct / Referral',
    scope: 'first-session channel is Direct, Referral (any), "No Journey Data", Organic Search from one of Google / Google app (Android) / Bing / DuckDuckGo / Gmail app / Ecosia / Yahoo, Social from Pinterest, OR "Other" with source "ChatGPT" or "an unknown source". Confirmed by the user, 2026-07-27, after verifying none of these carry any paid-ad signal (no gclid/paid utm_medium/paid utm_source/Shopify ad sourceType). Checked last — an order already claimed by any earlier group never lands here.',
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
