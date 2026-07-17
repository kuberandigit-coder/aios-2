// Jackson — Product Sales (ledsone.co.uk), by month.
// STANDALONE, NOT part of the shared staff dashboard (pages/sales.html) —
// backs pages/jackson-sales.html only. Not linked from index.html or the
// staff tab list. Server-side only: reads SHOPIFY_UK_ADMIN_TOKEN from env,
// never exposed to client. Read-only Shopify Admin GraphQL API, zero mutations.

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
  if (!visit) return { classification: 'UNKNOWN' };
  const paid = hasPaidEvidence(visit);
  if (paid) return { classification: 'PAID_SEARCH' };
  const source = lower(visit.source);
  const sourceDesc = lower(visit.sourceDescription);
  const sourceType = lower(visit.sourceType);
  const utm = visit.utmParameters || {};
  const medium = lower(utm.medium);
  let referrerHost = '';
  try { referrerHost = visit.referrerUrl ? new URL(visit.referrerUrl).hostname.toLowerCase() : ''; } catch (e) { referrerHost = ''; }
  const looksLikeSearchEngine = SEARCH_ENGINES.some(eng => source.includes(eng) || sourceDesc.includes(eng) || referrerHost.includes(eng));
  const organicSignal = medium === 'organic' || sourceType.includes('organic') || sourceType.includes('seo') || (looksLikeSearchEngine && !medium);
  if (looksLikeSearchEngine && organicSignal) return { classification: 'ORGANIC_SEARCH' };
  if (looksLikeSearchEngine && !medium && !sourceType) return { classification: 'ORGANIC_SEARCH' };
  if (source === 'direct' || (!visit.referrerUrl && !visit.source && !medium)) return { classification: 'DIRECT' };
  if (['facebook', 'instagram', 'tiktok', 'twitter', 'x.com', 'pinterest', 'linkedin', 'snapchat'].some(s => source.includes(s) || referrerHost.includes(s)) || medium === 'social') return { classification: 'SOCIAL' };
  if (sourceType === 'newsletter' || medium === 'email' || source.includes('email') || sourceDesc.includes('email')) return { classification: 'EMAIL' };
  if (medium === 'affiliate' || sourceType.includes('affiliate')) return { classification: 'AFFILIATE' };
  if (visit.referrerUrl && !looksLikeSearchEngine) return { classification: 'REFERRAL' };
  if (source || sourceDesc || medium) return { classification: 'OTHER' };
  return { classification: 'UNKNOWN' };
}

function classifyOrderJourney(order) {
  if (order.test) return { status: 'EXCLUDED_TEST_ORDER' };
  if (order.cancelledAt) return { status: 'EXCLUDED_CANCELLED_ORDER' };
  const cjs = order.customerJourneySummary;
  if (!cjs) return { status: 'NO_JOURNEY_DATA' };
  if (!cjs.ready) return { status: 'ATTRIBUTION_PENDING' };
  const first = cjs.firstVisit ? classifySession(cjs.firstVisit) : null;
  return { status: 'CLASSIFIED', first };
}

const AI_SOURCES = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'bing chat', 'bingchat', 'character.ai', 'meta ai', 'grok'];

function deriveChannel(journey, order) {
  if (journey.status === 'NO_JOURNEY_DATA') return 'No Journey Data';
  if (journey.status === 'ATTRIBUTION_PENDING') return 'Attribution Pending';
  if (!journey.first) return 'Unknown';
  if (journey.first.classification === 'UNKNOWN') return 'Unknown';
  if (journey.first.classification === 'OTHER') {
    const cjs = order.customerJourneySummary;
    const src = cjs && cjs.firstVisit ? lower(cjs.firstVisit.source) : '';
    if (AI_SOURCES.some(ai => src.includes(ai))) return 'AI Tools';
  }
  const map = {
    ORGANIC_SEARCH: 'Organic Search', PAID_SEARCH: 'Google Ads / Paid Search', DIRECT: 'Direct',
    SOCIAL: 'Social', EMAIL: 'Email', AFFILIATE: 'Affiliate', REFERRAL: 'Referral', OTHER: 'Other', UNKNOWN: 'Unknown',
  };
  return map[journey.first.classification] || 'Unknown';
}

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
        id legacyResourceId name createdAt cancelledAt test
        customerJourneySummary {
          ready
          firstVisit { source sourceDescription sourceType referrerUrl landingPage utmParameters { source medium } }
        }
        lineItems(first: 100) {
          edges {
            node {
              id title variantTitle sku quantity
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              discountedTotalSet { shopMoney { amount currencyCode } }
              variant { product { legacyResourceId title } }
            }
          }
        }
        refunds { refundLineItems(first: 100) { edges { node { lineItem { id } subtotalSet { shopMoney { amount currencyCode } } } } } }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function amt(moneySet) { return moneySet ? round2(Number(moneySet.shopMoney.amount)) : 0; }

const CACHE = new Map();
const CACHE_TTL_MS = 55 * 1000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const startTime = Date.now();
  const forceRefresh = req.query && req.query.refresh === '1';
  const monthConfig = resolveReportMonth(req.query && req.query.month);
  const cacheKey = monthConfig.month;

  try {
    if (!TOKEN) { res.status(500).json({ success: false, error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' }); return; }

    const cached = CACHE.get(cacheKey);
    if (!forceRefresh && cached && (Date.now() - cached.generatedAt) < CACHE_TTL_MS) {
      res.status(200).json({ ...cached.data, meta: { ...cached.data.meta, cacheStatus: 'hit' } });
      return;
    }

    const retryState = { throttleRetries: 0 };
    const q = `created_at:>=${monthConfig.queryStart} AND created_at:<${monthConfig.queryEnd}`;
    let after = null, hasNext = true, pages = 0, ordersScanned = 0, ordersWithJackson = 0;
    const perProduct = new Map();

    while (hasNext) {
      const data = await shopifyGraphQL(ORDERS_QUERY, { cursor: after, query: q }, retryState);
      for (const edge of data.orders.edges) {
        const order = edge.node;
        const t = new Date(order.createdAt).getTime();
        if (t < monthConfig.startMs || t >= monthConfig.endMs) continue;
        ordersScanned++;
        if (order.test || order.cancelledAt) continue;

        const jacksonItems = order.lineItems.edges.map(e => e.node)
          .filter(li => li.variant && li.variant.product && JACKSON_PRODUCT_IDS.has(String(li.variant.product.legacyResourceId)));
        if (!jacksonItems.length) continue;
        ordersWithJackson++;

        const journey = classifyOrderJourney(order);
        const channel = deriveChannel(journey, order);

        for (const li of jacksonItems) {
          const pid = String(li.variant.product.legacyResourceId);
          const title = li.variant.product.title;
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
          const net = round2(gross - discount - refund);

          if (!perProduct.has(pid)) perProduct.set(pid, { productId: pid, title, units: 0, gross: 0, discounts: 0, refunds: 0, net: 0, orderNames: new Set(), channels: {} });
          const p = perProduct.get(pid);
          p.units += li.quantity;
          p.gross = round2(p.gross + gross);
          p.discounts = round2(p.discounts + discount);
          p.refunds = round2(p.refunds + refund);
          p.net = round2(p.net + net);
          p.orderNames.add(order.name);
          p.channels[channel] = round2((p.channels[channel] || 0) + net);
        }
      }
      hasNext = data.orders.pageInfo.hasNextPage;
      after = data.orders.pageInfo.endCursor;
      pages++;
    }

    const rows = [...perProduct.values()]
      .map(p => ({ ...p, orders: p.orderNames.size, orderNames: undefined }))
      .sort((a, b) => b.net - a.net);
    const notFound = [...JACKSON_PRODUCT_IDS].filter(id => !perProduct.has(id));

    const totals = rows.reduce((acc, p) => {
      acc.units += p.units; acc.gross = round2(acc.gross + p.gross); acc.discounts = round2(acc.discounts + p.discounts);
      acc.refunds = round2(acc.refunds + p.refunds); acc.net = round2(acc.net + p.net); acc.orders += p.orders;
      for (const [ch, v] of Object.entries(p.channels)) acc.channels[ch] = round2((acc.channels[ch] || 0) + v);
      return acc;
    }, { units: 0, gross: 0, discounts: 0, refunds: 0, net: 0, orders: 0, channels: {} });

    const responsePayload = {
      success: true,
      staff: { name: 'Jackson', store: 'ledsone.co.uk' },
      reportPeriod: { month: monthConfig.month, label: monthConfig.label, start: monthConfig.startISO, endExclusive: monthConfig.endISO, timezone: 'Europe/London' },
      supportedMonths: SUPPORTED_MONTHS,
      isLive: monthConfig.isLive,
      productIdsTracked: JACKSON_PRODUCT_IDS.size,
      rows,
      totals,
      productIdsWithNoSales: notFound,
      meta: {
        generatedAt: new Date().toISOString(),
        cacheStatus: 'miss',
        ordersScanned, ordersWithJacksonProducts: ordersWithJackson,
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
