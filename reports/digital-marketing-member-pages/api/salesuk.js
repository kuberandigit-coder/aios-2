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

const GROUPS = [
  {
    key: 'dm-ad',
    name: 'DM-Ad',
    department: 'Google Ads (Paid Search)',
    scope: 'first-session utm_campaign exactly matches (or is a prefixed variant of) "Shop_DM_PMax-46_AguAsset" or "Shop_DM_PMax-46", OR utm_campaign is "sag_organic" (all months — confirmed by the user, 2026-07-27), OR (first session has no campaign/term AND the LAST/converting session\'s campaign is "Shop_DM_PMax-46_AguAsset" — confirmed by the user, 2026-07-27) (case-insensitive). ("Shop_DM_PMax-25" moved to Sajeepan, 2026-07-27.)',
    match: (utm, fv, journey) => isDmAdCampaign(utm.campaign) || (!utm.campaign && !utm.term && lastSessionCampaign(journey) === 'shop_dm_pmax-46_aguasset'),
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
    scope: 'first-session utm_campaign exactly matches one of "Accessories_sj", "GCSS_ALL_ROAS_400_SAJEE_PMAX", "GCSS_ALL_ROAS_400_SAJEE", "SJ_TOP_20X", "sajeepan_pmax_gcss_ceiling_rose_fitting_asset", "Shop_SJ_PMax-25", "Aji_Sh_PMax", "Shop_DM_PMax-25", "Shop_DM_PMax-25_ZERO", "Klarna_P", "SJ_PMAX_Scale_Heroes_25", "KLARNA_CSS_SJ25_PMAX", "Klarna_G2", "P_Max_Klarna_CSS_SJ_OLD" (case-insensitive), OR (first session has no campaign/term AND the 2nd OR LAST session\'s campaign is "Klarna_P", "KLARNA_CSS_SJ25_PMAX" or "Shop_DM_PMax-25" — confirmed by the user, 2026-07-27). Checked only after DM-Ad, Meta and Sonya.',
    match: (utm, fv, journey) => isSajeepanCampaignUk(utm.campaign) || (!utm.campaign && !utm.term && isSajeepanCampaignUk(secondSessionCampaign(journey))) || (!utm.campaign && !utm.term && isSajeepanCampaignUk(lastSessionCampaign(journey))),
    matchValue: (utm, fv, journey) => {
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

function assignGroup(utm, fv, journey, month, orderId) {
  if (orderId) {
    const overrides = loadOverrides();
    const o = overrides[String(orderId)];
    if (o && o.source === 'salesuk' && GROUPS_BY_KEY.has(o.groupKey)) return GROUPS_BY_KEY.get(o.groupKey);
  }
  for (const g of GROUPS) {
    if (g.match(utm, fv, journey, month)) return g;
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
    const assigned = assignGroup(utm, fv, journey, monthConfig.month, order.legacyResourceId);
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
    const assigned = assignGroup(utm, fv, journey, monthConfig.month, order.legacyResourceId);
    const isMatch = groupDef.key === NOT_ASSIGNED_GROUP.key ? !assigned : (assigned && assigned.key === groupDef.key);
    if (!isMatch) continue;
    const row = buildOrderRow(order, journey);
    const ov = loadOverrides()[String(order.legacyResourceId)];
    row.matchedCampaign = (ov && ov.source === 'salesuk')
      ? (row.firstVisitCampaign || '(unknown)') + ' (M)'
      : groupDef.matchValue(utm, fv, journey, monthConfig.month);
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
