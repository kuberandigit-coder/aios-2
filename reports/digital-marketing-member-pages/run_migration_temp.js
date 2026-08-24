const fs = require('fs');
const { Client } = require('pg');

const envText = fs.readFileSync('C:\\Users\\PC\\OneDrive\\Desktop\\kuberan web\\reports\\digital-marketing-member-pages\\.env.vercel.pulled', 'utf8');
let connStr = null;
envText.split('\n').forEach(l => {
  const m = l.match(/^NEON_DATABASE_URL=(.*)$/);
  if (m) { let v = m[1].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); connStr = v; }
});
if (!connStr) { console.error('NEON_DATABASE_URL not found'); process.exit(1); }

const sqlFile = process.argv[2];
const mode = process.argv[3] || 'run'; // 'precheck' or 'run'

(async () => {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (mode === 'precheck') {
      const r1 = await client.query('SELECT current_database() AS db, current_user AS usr');
      console.log('current_database/user:', r1.rows[0]);
      const r2 = await client.query("SELECT to_regclass('public.users') IS NOT NULL AS looks_like_app_db");
      console.log('looks_like_app_db:', r2.rows[0]);
      const r3 = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'thivajini_feed%' ORDER BY tablename");
      console.log('existing thivajini_feed_* tables:', r3.rows.map(r => r.tablename));
    } else {
      const sql = fs.readFileSync(sqlFile, 'utf8');
      console.log('Running', sqlFile, '(', sql.length, 'chars )...');
      await client.query(sql);
      console.log('SUCCESS');
    }
  } finally {
    await client.end();
  }
})().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
