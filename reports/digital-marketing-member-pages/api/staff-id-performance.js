const { Pool } = require('pg');
const crypto = require('crypto');

const ALLOWED_STAFF_KEYS = new Set(['muguntha', 'piranav', 'kuberan']);

const { STAFF_IDS } = require('../data/staff-ids');

let pool, neonPool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || undefined,
      host: process.env.DATABASE_URL ? undefined : process.env.PGHOST,
      port: process.env.DATABASE_URL ? undefined : (process.env.PGPORT ? Number(process.env.PGPORT) : 5432),
      database: process.env.DATABASE_URL ? undefined : process.env.PGDATABASE,
      user: process.env.DATABASE_URL ? undefined : process.env.PGUSER,
      password: process.env.DATABASE_URL ? undefined : process.env.PGPASSWORD,
      max: 5,
      connectionTimeoutMillis: 15000,
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}
function getNeonPool() {
  if (!neonPool) neonPool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL, max: 3, connectionTimeoutMillis: 10000 });
  return neonPool;
}

const COOKIE_NAME = 'dm_session';

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function verifySession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  const session = verifySession(req);
  if (!session) return res.status(401).json({ ok: false, error: 'Unauthorised' });
  const allowed = session.role === 'admin' || ALLOWED_STAFF_KEYS.has(session.staff_key);
  if (!allowed) return res.status(403).json({ ok: false, error: 'Forbidden' });

  const ids_param = (req.query.staff || '').toLowerCase();
  if (!STAFF_IDS[ids_param]) return res.status(400).json({ ok: false, error: 'Unknown staff. Use: ' + Object.keys(STAFF_IDS).join(', ') });

  const ids = STAFF_IDS[ids_param];

  // Optional date range (ISO date strings, e.g. 2026-04-10)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const fromDate = req.query.from && dateRegex.test(req.query.from) ? req.query.from : null;
  const toDate   = req.query.to   && dateRegex.test(req.query.to)   ? req.query.to   : null;

  try {
    const db = getPool();

    // 1. Sales + Shopify order names (date-filtered when from/to provided)
    const dateClause = fromDate || toDate
      ? ` AND o.order_date >= $2::date AND o.order_date < ($3::date + INTERVAL '1 day')`
      : '';
    const salesParams = fromDate || toDate ? [ids, fromDate || '2000-01-01', toDate || new Date().toISOString().slice(0,10)] : [ids];
    const salesRes = await db.query(`
      SELECT oii.product_id,
        MAX(oii.item_title) AS title,
        SUM(oii.item_quantity::int) AS total_qty,
        ROUND(SUM(oii.item_price::numeric * oii.item_quantity::int), 2) AS total_amount,
        ARRAY_AGG(DISTINCT '#' || o.order_id ORDER BY '#' || o.order_id) AS order_ids
      FROM order_management.order_item_info oii
      JOIN order_management.orders o ON o.id = oii.order_id::bigint
      WHERE oii.product_id = ANY($1::text[])${dateClause}
      GROUP BY oii.product_id
    `, salesParams);

    const salesMap = {};
    for (const r of salesRes.rows) {
      salesMap[r.product_id] = {
        title: r.title,
        total_qty: parseInt(r.total_qty) || 0,
        total_amount: parseFloat(r.total_amount) || 0,
        order_ids: r.order_ids || [],
      };
    }

    // 2. Titles for unsold products
    const unsoldIds = ids.filter(id => !salesMap[id]);
    const titleMap = {};
    if (unsoldIds.length > 0) {
      const titleRes = await db.query(`
        SELECT DISTINCT ON (item_id) item_id, title, status
        FROM listings.shopify_listings
        WHERE item_id = ANY($1::text[]) AND is_parent = 1
        ORDER BY item_id
      `, [unsoldIds]);
      for (const r of titleRes.rows) titleMap[r.item_id] = { title: r.title, status: r.status };
    }

    // 3. Stock via local_inventory_current_stock_location_wise (covers both single + combo products)
    const stockRes = await db.query(`
      SELECT sl.item_id, sl.shopify_handle, COALESCE(SUM(l.stock), 0) AS stock
      FROM listings.shopify_listings sl
      JOIN listings.shopify_listings_parent_child_mapping m ON m.parent_id = sl.id
      JOIN listings.shopify_listings child ON child.id = m.child_id
      JOIN inventory.products p ON p.sku = COALESCE(child.mapped_sku, child.sku)
      JOIN inventory.local_inventory_current_stock_location_wise l ON l.inventory_id = p.id
      WHERE sl.item_id = ANY($1::text[]) AND sl.is_parent = 1
        AND l.warehouse_location = 'UK'
      GROUP BY sl.item_id, sl.shopify_handle
    `, [ids]);

    const stockByItemId = {};
    const handleByItemId = {};
    for (const r of stockRes.rows) {
      stockByItemId[r.item_id] = parseInt(r.stock) || 0;
      if (r.shopify_handle) handleByItemId[r.item_id] = r.shopify_handle;
    }

    // Also grab handles for unsold products (they skip the stock join if no stock rows)
    const allHandleRes = await db.query(`
      SELECT DISTINCT ON (item_id) item_id, shopify_handle
      FROM listings.shopify_listings
      WHERE item_id = ANY($1::text[]) AND is_parent = 1
      ORDER BY item_id
    `, [ids]);
    for (const r of allHandleRes.rows) {
      if (!handleByItemId[r.item_id] && r.shopify_handle) handleByItemId[r.item_id] = r.shopify_handle;
    }

    // 4. Attribution from Neon (AUTH_DATABASE_URL) — silent fail if table not yet created
    const attrMap = {};
    try {
      const neon = getNeonPool();
      const attrDateClause = fromDate || toDate
        ? ` AND order_date >= $2::date AND order_date <= $3::date` : '';
      const attrParams = fromDate || toDate
        ? [ids, fromDate || '2000-01-01', toDate || new Date().toISOString().slice(0,10)] : [ids];
      const attrRes = await neon.query(`
        SELECT product_id,
          SUM(CASE WHEN classification='ORGANIC' THEN qty     ELSE 0 END) AS organic_qty,
          SUM(CASE WHEN classification='ORGANIC' THEN revenue ELSE 0 END) AS organic_rev,
          SUM(CASE WHEN classification='ADS'     THEN qty     ELSE 0 END) AS ads_qty,
          SUM(CASE WHEN classification='ADS'     THEN revenue ELSE 0 END) AS ads_rev
        FROM public.staff_order_attribution
        WHERE product_id = ANY($1::text[])${attrDateClause}
        GROUP BY product_id
      `, attrParams);
      for (const r of attrRes.rows) {
        attrMap[r.product_id] = {
          organic_qty: parseInt(r.organic_qty)   || 0,
          organic_rev: parseFloat(r.organic_rev) || 0,
          ads_qty:     parseInt(r.ads_qty)       || 0,
          ads_rev:     parseFloat(r.ads_rev)     || 0,
        };
      }
    } catch (_) { /* table not yet created — columns will show null */ }

    // 5. Assemble rows
    const rows = ids.map(id => {
      const sale = salesMap[id];
      const info = titleMap[id];
      const attr = attrMap[id] || null;
      return {
        product_id: id,
        title: sale?.title || info?.title || null,
        status: info?.status || (sale ? 'active' : null),
        sold: !!sale,
        total_qty:     sale?.total_qty    || 0,
        total_amount:  sale?.total_amount || 0,
        organic_qty:   attr?.organic_qty  ?? null,
        organic_rev:   attr?.organic_rev  ?? null,
        ads_qty:       attr?.ads_qty      ?? null,
        ads_rev:       attr?.ads_rev      ?? null,
        current_stock: stockByItemId[id]  || 0,
        order_ids:     sale?.order_ids    || [],
        shopify_handle: handleByItemId[id] || null,
      };
    });

    const summary = {
      total: rows.length,
      sold: rows.filter(r => r.sold).length,
      never_sold: rows.filter(r => !r.sold).length,
      total_stock: rows.reduce((s, r) => s + r.current_stock, 0),
      total_revenue: Math.round(rows.reduce((s, r) => s + r.total_amount, 0) * 100) / 100,
    };

    return res.status(200).json({ ok: true, staff: ids_param, summary, rows });
  } catch (err) {
    console.error('staff-id-perf error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
