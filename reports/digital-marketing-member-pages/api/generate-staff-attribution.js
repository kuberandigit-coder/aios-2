'use strict';

/**
 * POST /api/generate-staff-attribution?staff=kamsi
 *
 * Runs on Vercel — no local DB credentials needed.
 * Reads UK orders from main DB (DATABASE_URL, read),
 * classifies each via Shopify customerJourneySummary,
 * saves results to AUTH_DATABASE_URL (Neon, write).
 *
 * Incremental by default: only processes orders not yet in the table.
 * Pass ?full=1 to reprocess everything.
 */

const { Pool } = require('pg');
const crypto   = require('crypto');
const { STAFF_IDS } = require('../data/staff-ids');

const COOKIE_NAME    = 'dm_session';
const ALLOWED_KEYS   = new Set(['muguntha', 'piranav', 'kuberan']);
const STORE_DOMAIN   = process.env.SHOPIFY_UK_STORE_DOMAIN || 'ledsone.co.uk';
const API_VERSION    = process.env.SHOPIFY_UK_API_VERSION  || '2024-01';
const BATCH_SIZE    = 20;
const DELAY_MS      = 400;
const UK_SUB_SOURCE = 104;

// ── Auth ──────────────────────────────────────────────────────────────────────
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i === -1) return;
    out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function verifySession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return (!d.exp || Date.now() > d.exp) ? null : d;
  } catch { return null; }
}

// ── Classification ────────────────────────────────────────────────────────────
const PAID_MEDIUMS  = new Set(['cpc','ppc','paid','paid search','paidsearch','google_ads','googleads','cpm','display','paid_social','paid-social','shopping','performance_max','pmax']);
const PAID_SOURCES  = ['google_ads','googleads','google ads','bing_ads','bingads','facebook_ads','meta_ads'];
const ORGANIC_ENGINES = ['google','bing','duckduckgo','yahoo','ecosia','yandex','baidu'];

function hasPaid(visit) {
  if (!visit) return false;
  const utm = visit.utmParameters || {};
  const med = (utm.medium || '').toLowerCase().trim();
  const src = (utm.source || '').toLowerCase().trim();
  return PAID_MEDIUMS.has(med) || PAID_SOURCES.some(s => src.includes(s));
}
function isOrganic(visit) {
  if (!visit) return false;
  const utm = visit.utmParameters || {};
  const med = (utm.medium || '').toLowerCase().trim();
  const src = (utm.source || '').toLowerCase().trim();
  const ref = (visit.referrerUrl || '').toLowerCase();
  if (med === 'organic') return true;
  if (ORGANIC_ENGINES.some(e => src.includes(e)) && !hasPaid(visit)) return true;
  if (ORGANIC_ENGINES.some(e => ref.includes(e)) && !med && !hasPaid(visit)) return true;
  return false;
}
function classifyOrder(order) {
  const cjs = order.customerJourneySummary;
  if (!cjs || !cjs.ready) return 'NO_DATA';
  const first = cjs.firstVisit, last = cjs.lastVisit;
  if (hasPaid(first) || hasPaid(last))     return 'ADS';
  if (isOrganic(first) || isOrganic(last)) return 'ORGANIC';
  if (!first && !last) return 'NO_DATA';
  const med = (first?.utmParameters?.medium || '').toLowerCase();
  if (!med && !first?.utmParameters?.source && !first?.referrerUrl) return 'DIRECT';
  return 'UNKNOWN';
}

// ── Shopify GQL ───────────────────────────────────────────────────────────────
const GQL_QUERY = `
query OrderAttr($query: String!) {
  orders(first: ${BATCH_SIZE}, query: $query) {
    edges { node {
      id name cancelledAt test
      customerJourneySummary {
        ready
        firstVisit { utmParameters { source medium campaign term } referrerUrl }
        lastVisit  { utmParameters { source medium campaign term } referrerUrl }
      }
    }}
  }
}`;

async function shopifyGQL(query, attempt = 0) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': process.env.SHOPIFY_UK_ADMIN_TOKEN },
    body: JSON.stringify({ query: GQL_QUERY, variables: { query } }),
  });
  const json = await res.json();
  if (json.errors) {
    if (json.errors.some(e => e?.extensions?.code === 'THROTTLED') && attempt < 4) {
      await sleep(2000 * (attempt + 1));
      return shopifyGQL(query, attempt + 1);
    }
    throw new Error('Shopify: ' + JSON.stringify(json.errors[0]?.message));
  }
  return json.data;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── DB pools ──────────────────────────────────────────────────────────────────
let mainPool, neonPool;
function getMainPool() {
  if (!mainPool) mainPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 15000, ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false });
  return mainPool;
}
function getNeonPool() {
  if (!neonPool) neonPool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL, max: 3, connectionTimeoutMillis: 15000 });
  return neonPool;
}

// ── Ensure table on Neon ──────────────────────────────────────────────────────
async function ensureTable(neon) {
  await neon.query(`
    CREATE TABLE IF NOT EXISTS public.staff_order_attribution (
      product_id     TEXT          NOT NULL,
      order_id       TEXT          NOT NULL,
      classification TEXT          NOT NULL,
      qty            INTEGER       NOT NULL DEFAULT 0,
      revenue        NUMERIC(12,2) NOT NULL DEFAULT 0,
      order_date     DATE,
      processed_at   TIMESTAMPTZ   DEFAULT NOW(),
      PRIMARY KEY (product_id, order_id)
    );
    CREATE INDEX IF NOT EXISTS idx_soa_pid  ON public.staff_order_attribution(product_id);
    CREATE INDEX IF NOT EXISTS idx_soa_cls  ON public.staff_order_attribution(classification);
    CREATE INDEX IF NOT EXISTS idx_soa_date ON public.staff_order_attribution(order_date);
  `);
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const session = verifySession(req);
  if (!session) return res.status(401).json({ ok: false, error: 'Unauthorised' });
  if (session.role !== 'admin' && !ALLOWED_KEYS.has(session.staff_key)) return res.status(403).json({ ok: false, error: 'Forbidden' });

  const staff  = (req.query.staff || '').toLowerCase();
  const full   = req.query.full === '1';
  const ids    = STAFF_IDS[staff];
  if (!ids) return res.status(400).json({ ok: false, error: 'Unknown staff: ' + staff });

  const main = getMainPool();
  const neon = getNeonPool();

  try {
    await ensureTable(neon);

    // Find order IDs already processed (skip in incremental mode)
    let alreadyDone = new Set();
    if (!full) {
      const doneRes = await neon.query(
        `SELECT DISTINCT order_id FROM public.staff_order_attribution WHERE product_id = ANY($1::text[])`,
        [ids]
      );
      alreadyDone = new Set(doneRes.rows.map(r => r.order_id));
    }

    // Read UK orders from main DB
    const { rows: dbOrders } = await main.query(`
      SELECT
        oii.product_id,
        o.order_id                                            AS led_id,
        SUM(oii.item_quantity::int)                           AS qty,
        SUM(oii.item_price::numeric * oii.item_quantity::int) AS revenue,
        MAX(o.order_date)::date                               AS order_date
      FROM order_management.order_item_info oii
      JOIN order_management.orders o ON o.id = oii.order_id::bigint
      WHERE oii.product_id = ANY($1::text[])
        AND o.sub_source_id = $2
        AND o.order_id LIKE 'LED%'
      GROUP BY oii.product_id, o.order_id
    `, [ids, UK_SUB_SOURCE]);

    // Group by order, skip already processed
    const orderMap = new Map();
    for (const row of dbOrders) {
      if (alreadyDone.has(row.led_id)) continue;
      if (!orderMap.has(row.led_id)) orderMap.set(row.led_id, []);
      orderMap.get(row.led_id).push({
        product_id: row.product_id,
        qty:        parseInt(row.qty)      || 0,
        revenue:    parseFloat(row.revenue) || 0,
        order_date: row.order_date,
      });
    }

    const uniqueIds = [...orderMap.keys()];
    let saved = 0, errors = 0;

    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
      const batch    = uniqueIds.slice(i, i + BATCH_SIZE);
      const queryStr = batch.map(id => `name:"#${id}"`).join(' OR ');

      let data;
      try {
        data = await shopifyGQL(queryStr);
      } catch (err) {
        errors++;
        await sleep(2000);
        continue;
      }

      for (const edge of (data?.orders?.edges || [])) {
        const order = edge.node;
        if (order.test || order.cancelledAt) continue;
        const ledId   = order.name.replace(/^#/, '');
        const entries = orderMap.get(ledId);
        if (!entries) continue;
        const classification = classifyOrder(order);
        for (const e of entries) {
          await neon.query(`
            INSERT INTO public.staff_order_attribution
              (product_id, order_id, classification, qty, revenue, order_date, processed_at)
            VALUES ($1,$2,$3,$4,$5,$6,NOW())
            ON CONFLICT (product_id, order_id) DO UPDATE SET
              classification = EXCLUDED.classification,
              qty            = EXCLUDED.qty,
              revenue        = EXCLUDED.revenue,
              processed_at   = NOW()
          `, [e.product_id, ledId, classification, e.qty, e.revenue, e.order_date]);
          saved++;
        }
      }

      await sleep(DELAY_MS);
    }

    return res.status(200).json({
      ok: true, staff,
      total_orders: uniqueIds.length,
      skipped: alreadyDone.size,
      saved, errors,
    });

  } catch (err) {
    console.error('generate-staff-attribution error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
