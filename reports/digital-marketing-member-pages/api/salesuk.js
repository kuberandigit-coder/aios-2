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

const GROUPS = [
  {
    key: 'dm-ad',
    name: 'DM-Ad',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign exactly matches (or is a prefixed variant of) "Shop_DM_PMax-46_AguAsset" or "Shop_DM_PMax-46", OR utm_campaign is "sag_organic" (all months — confirmed by the user, 2026-07-27), OR (first session has no campaign/term AND the LAST/converting session\'s campaign is "Shop_DM_PMax-46_AguAsset" — confirmed by the user, 2026-07-27) (case-insensitive). ("Shop_DM_PMax-25" moved to Sajeepan, 2026-07-27.) EXCLUDES any order containing one of Sajeepan\'s owned product IDs (added 2026-07-30) — those go to his tab instead, even though the click still carries a DM-Ad campaign.',
    match: (utm, fv, journey, month, order) => (isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset')) && !orderHasSajeepanProduct(order),
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
    scope: 'first-session utm_campaign exactly matches "Klarna_Sonya_kl-pmx-all", "Sonya_PendantLight" or "SH_Wall_Light", OR utm_term exactly matches one of her 6 confirmed values ("Sonya", "ninc", "glow_up", "SonyaIreland", "SonyaSpian", "SonyTopEuropeEngEU{_adgroup}"), OR (first session has no campaign/term AND the 2nd OR LAST session\'s campaign is "Klarna_Sonya_kl-pmx-all" — confirmed by the user, 2026-07-27), OR (no campaign anywhere in the journey AND first-session utm_medium is "google_ads", unless the last session traces to a Sajeepan campaign — confirmed by the user, 2026-07-28, as a PERMANENT rule covering all months, including future live-month updates). Checked only after DM-Ad and Meta.',
    match: (utm, fv, journey) => {
      if (isSonyaCampaign(utm.campaign) || isSonyaTerm(utm.term)) return true;
      if (!utm.campaign && !utm.term && (secondSessionCampaign(journey) === 'klarna_sonya_kl-pmx-all' || lastSessionCampaign(journey) === 'klarna_sonya_kl-pmx-all')) return true;
      if (!utm.campaign && !utm.term) {
        const medium = (utm.medium || '').toString().toLowerCase();
        // Don't blanket-claim if the last session traces to a known
        // Sajeepan campaign — let that fall through to Sajeepan instead
        // (checked after Sonya in GROUPS priority order).
        if (medium === 'google_ads' && !isSajeepanCampaignUk(lastSessionCampaign(journey))) return true;
      }
      return false;
    },
    matchValue: (utm, fv, journey) => {
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
