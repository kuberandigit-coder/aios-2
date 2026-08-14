'use strict';

/**
 * generate-staff-attribution.js
 *
 * Background script — run manually on your machine, no Vercel timeout.
 * Classifies each UK order (LED...) for all staff product IDs as ORGANIC, ADS,
 * DIRECT, or UNKNOWN using Shopify customerJourneySummary, then saves to
 * public.staff_order_attribution in Postgres.
 *
 * Usage:
 *   node scripts/generate-staff-attribution.js
 *   node scripts/generate-staff-attribution.js --from 2026-04-01   (incremental)
 *   node scripts/generate-staff-attribution.js --staff jackson      (one staff only)
 *
 * Env vars needed (same as Vercel):
 *   DATABASE_URL          — Postgres connection string (read-write)
 *   SHOPIFY_UK_ADMIN_TOKEN — Shopify UK Admin API token
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { Pool }    = require('pg');
const { STAFF_IDS } = require('../data/staff-ids');

// ── Config ────────────────────────────────────────────────────────────────────
const STORE_DOMAIN  = 'ledsone.co.uk';
const API_VERSION   = '2024-01';
const BATCH_SIZE    = 20;   // order names per Shopify GraphQL query
const DELAY_MS      = 600;  // ms between Shopify batches (rate-limit friendly)
const UK_SUB_SOURCE = 104;  // sub_source_id for UK ledsone store

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const fromArg = args.includes('--from')  ? args[args.indexOf('--from')  + 1] : null;
const staffArg= args.includes('--staff') ? args[args.indexOf('--staff') + 1] : null;

// ── DB pool (read-write via DATABASE_URL) ────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Classification logic (mirrors sales.js / salesuk.js) ─────────────────────
const PAID_MEDIUMS = new Set([
  'cpc','ppc','paid','paid search','paidsearch','google_ads','googleads',
  'cpm','display','paid_social','paid-social','shopping','performance_max','pmax',
]);
const PAID_SOURCES = ['google_ads','googleads','google ads','bing_ads','bingads','facebook_ads','meta_ads'];
const ORGANIC_ENGINES = ['google','bing','duckduckgo','yahoo','ecosia','yandex','baidu'];

function hasPaidEvidence(visit) {
  if (!visit) return false;
  const utm  = visit.utmParameters || {};
  const med  = (utm.medium || '').toLowerCase().trim();
  const src  = (utm.source || '').toLowerCase().trim();
  if (PAID_MEDIUMS.has(med)) return true;
  if (PAID_SOURCES.some(s => src.includes(s))) return true;
  return false;
}

function isOrganicSearch(visit) {
  if (!visit) return false;
  const utm  = visit.utmParameters || {};
  const med  = (utm.medium || '').toLowerCase().trim();
  const src  = (utm.source || '').toLowerCase().trim();
  const ref  = (visit.referrerUrl || '').toLowerCase();
  if (med === 'organic') return true;
  if (ORGANIC_ENGINES.some(e => src.includes(e)) && !hasPaidEvidence(visit)) return true;
  if (ORGANIC_ENGINES.some(e => ref.includes(e)) && !med && !hasPaidEvidence(visit)) return true;
  return false;
}

function classifyOrder(order) {
  const cjs = order.customerJourneySummary;
  if (!cjs)        return 'NO_DATA';
  if (!cjs.ready)  return 'NO_DATA';
  const first = cjs.firstVisit;
  const last  = cjs.lastVisit;
  if (hasPaidEvidence(first) || hasPaidEvidence(last)) return 'ADS';
  if (isOrganicSearch(first) || isOrganicSearch(last)) return 'ORGANIC';
  if (!first && !last) return 'NO_DATA';
  // Has some utm data but not clearly organic or ads
  const firstMed = (first?.utmParameters?.medium || '').toLowerCase();
  if (!firstMed && !first?.utmParameters?.source && !first?.referrerUrl) return 'DIRECT';
  return 'UNKNOWN';
}

// ── Shopify GraphQL ───────────────────────────────────────────────────────────
const GQL_QUERY = `
query OrderAttr($query: String!) {
  orders(first: ${BATCH_SIZE}, query: $query) {
    edges {
      node {
        id
        name
        cancelledAt
        test
        customerJourneySummary {
          ready
          firstVisit {
            utmParameters { source medium campaign term }
            referrerUrl
            landingPage
          }
          lastVisit {
            utmParameters { source medium campaign term }
            referrerUrl
            landingPage
          }
        }
      }
    }
  }
}`;

async function shopifyGQL(variables, attempt = 0) {
  const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': process.env.SHOPIFY_UK_ADMIN_TOKEN,
    },
    body: JSON.stringify({ query: GQL_QUERY, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    const throttled = json.errors.some(e => e?.extensions?.code === 'THROTTLED');
    if (throttled && attempt < 5) {
      await sleep(2000 * (attempt + 1));
      return shopifyGQL(variables, attempt + 1);
    }
    throw new Error('Shopify GQL error: ' + JSON.stringify(json.errors));
  }
  return json.data;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Ensure table exists ───────────────────────────────────────────────────────
async function ensureTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.staff_order_attribution (
      product_id     TEXT          NOT NULL,
      order_id       TEXT          NOT NULL,
      classification TEXT          NOT NULL,
      qty            INTEGER       NOT NULL DEFAULT 0,
      revenue        NUMERIC(12,2) NOT NULL DEFAULT 0,
      order_date     TIMESTAMP,
      processed_at   TIMESTAMP     DEFAULT NOW(),
      PRIMARY KEY (product_id, order_id)
    );
    CREATE INDEX IF NOT EXISTS idx_soa_product_id ON public.staff_order_attribution(product_id);
    CREATE INDEX IF NOT EXISTS idx_soa_class ON public.staff_order_attribution(classification);
  `);
  console.log('✓ Table public.staff_order_attribution ready');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const db = await pool.connect();
  try {
    await ensureTable(db);

    // Build combined product ID list
    const staffToProcess = staffArg
      ? { [staffArg]: STAFF_IDS[staffArg] }
      : STAFF_IDS;

    if (staffArg && !STAFF_IDS[staffArg]) {
      console.error(`Unknown staff: ${staffArg}. Valid: ${Object.keys(STAFF_IDS).join(', ')}`);
      process.exit(1);
    }

    const allProductIds = [...new Set(Object.values(staffToProcess).flat())];
    console.log(`\nProcessing ${Object.keys(staffToProcess).join(', ')} — ${allProductIds.length} product IDs`);

    // Get UK orders from DB
    const fromClause = fromArg ? `AND o.order_date >= '${fromArg}'::date` : '';
    const { rows: dbOrders } = await db.query(`
      SELECT
        oii.product_id,
        o.order_id                                  AS led_id,
        SUM(oii.item_quantity::int)                 AS qty,
        SUM(oii.item_price::numeric * oii.item_quantity::int) AS revenue,
        MAX(o.order_date)                           AS order_date
      FROM order_management.order_item_info oii
      JOIN order_management.orders o ON o.id = oii.order_id::bigint
      WHERE oii.product_id = ANY($1::text[])
        AND o.sub_source_id = ${UK_SUB_SOURCE}
        AND o.order_id LIKE 'LED%'
        ${fromClause}
      GROUP BY oii.product_id, o.order_id
    `, [allProductIds]);

    console.log(`Found ${dbOrders.length} product-order rows from DB`);

    // Build: led_id → [ { product_id, qty, revenue, order_date } ]
    const orderMap = new Map();
    for (const row of dbOrders) {
      const key = row.led_id; // LED12426
      if (!orderMap.has(key)) orderMap.set(key, []);
      orderMap.get(key).push({
        product_id: row.product_id,
        qty:        parseInt(row.qty) || 0,
        revenue:    parseFloat(row.revenue) || 0,
        order_date: row.order_date,
      });
    }

    const uniqueOrderIds = [...orderMap.keys()];
    console.log(`Unique UK orders to classify: ${uniqueOrderIds.length}`);

    // Batch-fetch from Shopify by name
    let processed = 0, saved = 0, errors = 0;
    const names = uniqueOrderIds.map(id => `"#${id}"`);

    for (let i = 0; i < names.length; i += BATCH_SIZE) {
      const batch      = names.slice(i, i + BATCH_SIZE);
      const queryStr   = batch.map(n => `name:${n}`).join(' OR ');

      let data;
      try {
        data = await shopifyGQL({ query: queryStr });
      } catch (err) {
        console.error(`  Batch ${i}–${i + BATCH_SIZE} error: ${err.message}`);
        errors++;
        await sleep(2000);
        continue;
      }

      const shopifyOrders = (data?.orders?.edges || []).map(e => e.node);

      for (const order of shopifyOrders) {
        if (order.test || order.cancelledAt) continue;
        // order.name = "#LED12426"
        const ledId = order.name.replace(/^#/, '');
        const entries = orderMap.get(ledId);
        if (!entries) continue;

        const classification = classifyOrder(order);

        // Upsert each product-order pair
        for (const entry of entries) {
          await db.query(`
            INSERT INTO public.staff_order_attribution
              (product_id, order_id, classification, qty, revenue, order_date, processed_at)
            VALUES ($1,$2,$3,$4,$5,$6,NOW())
            ON CONFLICT (product_id, order_id)
            DO UPDATE SET
              classification = EXCLUDED.classification,
              qty            = EXCLUDED.qty,
              revenue        = EXCLUDED.revenue,
              processed_at   = NOW()
          `, [entry.product_id, ledId, classification, entry.qty, entry.revenue, entry.order_date]);
          saved++;
        }
      }

      processed += batch.length;
      if (processed % 200 === 0 || processed >= names.length) {
        console.log(`  ${processed}/${names.length} orders processed, ${saved} rows saved`);
      }

      await sleep(DELAY_MS);
    }

    console.log(`\n✓ Done. ${saved} rows saved, ${errors} batch errors.`);
    console.log('Run the dashboard — it will now read organic/ads splits from the DB.');

  } finally {
    db.release();
    await pool.end();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
