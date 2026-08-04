// api/muguntha.js — Management Employee Performance dashboard (muguntha.html)
// Currently scoped to Sonya only. Read-only PostgreSQL (SELECT only), reuses
// the same getPool() connection pattern as api/requirement.js (DATABASE_URL /
// PGHOST env vars, no new credential). Supplies ONLY the ADS Cost by month —
// Sales/Net/ROAS come from the existing Shopify-backed endpoints
// (api/sales25.js and api/salesuk.js, group=sonya) which muguntha.html calls
// directly per month, exactly like every other staff dashboard already does.

const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString && !process.env.PGHOST) {
      throw new Error('Server not configured: DATABASE_URL (or PGHOST/PGUSER/PGPASSWORD) missing');
    }
    pool = new Pool({
      connectionString: connectionString || undefined,
      host: connectionString ? undefined : process.env.PGHOST,
      port: connectionString ? undefined : (process.env.PGPORT ? Number(process.env.PGPORT) : 5432),
      database: connectionString ? undefined : process.env.PGDATABASE,
      user: connectionString ? undefined : process.env.PGUSER,
      password: connectionString ? undefined : process.env.PGPASSWORD,
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000,
      statement_timeout: 20000,
      max: 3,
    });
  }
  return pool;
}

// Scoped to the LEDSone Google Ads account's "Sonya" campaign group
// (google_ads.campaigns.group_name = 'Sonya', account_id 4503486236 —
// matches the "Campaign group: Sonya" filter in the Google Ads UI).
// IMPORTANT: campaign_name ILIKE '%sonya%' alone is NOT safe — a completely
// unrelated Google Ads account ("Vintagelite", account_id 3278683670) also
// has an internal group named "Sonya" (different campaigns, e.g. "Suki |
// PMax..."), which inflated Jan-2025 cost from the true £422.23 to
// £675.66 when both accounts were summed together (caught 2026-08-04 by
// cross-checking against the Google Ads UI screenshot for Jan 1-31, 2025).
const LEDSONE_ACCOUNT_ID = 4503486236;
const COST_QUERY = `
  SELECT to_char(cp.date, 'YYYY-MM') AS month, SUM(cp.cost) AS cost
  FROM google_ads.campaign_performance cp
  JOIN google_ads.campaigns c ON c.campaign_id = cp.campaign_id
  WHERE c.group_name = 'Sonya' AND c.account_id = ${LEDSONE_ACCOUNT_ID}
    AND to_char(cp.date, 'YYYY-MM') = ANY($1::text[])
  GROUP BY 1
`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const months = (req.query && req.query.months ? String(req.query.months) : '')
    .split(',').map((m) => m.trim()).filter((m) => /^\d{4}-\d{2}$/.test(m));
  if (!months.length) {
    res.status(400).json({ success: false, error: 'Provide ?months=2025-01,2025-02,...' });
    return;
  }
  try {
    const client = await getPool().connect();
    let rows;
    try {
      const result = await client.query(COST_QUERY, [months]);
      rows = result.rows;
    } finally {
      client.release();
    }
    const cost = {};
    for (const m of months) cost[m] = 0;
    for (const r of rows) cost[r.month] = Math.round(Number(r.cost) * 100) / 100;
    res.status(200).json({ success: true, employee: 'sonya', source: `google_ads.campaign_performance JOIN google_ads.campaigns WHERE group_name='Sonya' AND account_id=${LEDSONE_ACCOUNT_ID} (LEDSone account only)`, cost });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
