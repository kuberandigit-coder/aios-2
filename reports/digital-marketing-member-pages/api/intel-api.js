// Intel API — routes by ?service=seo|germany|organic
// ?service=seo     → SEO Intelligence (?module=exec|products|keywords|landing|actions|technical|semrush|geo)
// ?service=germany → Germany dashboard (?type=marketplace-gap|uk-bundle)
// ?service=organic → Organic revenue (?type=overview|by-page|trend|by-type)

const { Client } = require('pg');
const https = require('https');

// ══════════════════════════════════════════════════════════════════════════════
// SEO SERVICE — full seo.js
// ══════════════════════════════════════════════════════════════════════════════

const ADS_ACCOUNT    = 4503486236;
const GSC_SUB_SOURCE = 104;

function makeSeoClient(connStr) {
  return new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    statement_timeout: 30000,
  });
}

function errResponse(res, err) {
  const msg = err.message || '';
  let cause = 'unknown';
  if (/password|authentication|SASL/i.test(msg))                 cause = 'authentication';
  else if (/timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(msg)) cause = 'network_timeout';
  else if (/ssl|TLS/i.test(msg))                                 cause = 'ssl';
  else if (/permission denied/i.test(msg))                       cause = 'missing_permissions';
  return res.status(500).json({ ok: false, cause, error: msg });
}

/* ─── EXEC ─────────────────────────────────────────────────── */

async function handleGscMonthly(client, res) {
  const { rows } = await client.query(`
    SELECT
      DATE_TRUNC('month', date)::date                                        AS month,
      COUNT(DISTINCT date)::int                                               AS days_with_data,
      SUM(clicks)::int                                                        AS clicks,
      SUM(impressions)::int                                                   AS impressions,
      ROUND((SUM(clicks)::numeric/NULLIF(SUM(impressions),0))*100, 3)        AS ctr_pct,
      ROUND(AVG(position)::numeric, 2)                                        AS avg_position
    FROM google_search_console.overview
    WHERE sub_source = $1 AND search_type = 'web'
    GROUP BY DATE_TRUNC('month', date)
    ORDER BY month ASC
  `, [GSC_SUB_SOURCE]);
  return res.status(200).json({
    ok: true,
    data_note: 'PostgreSQL GSC pipeline — clicks ≈ 50% of Google Search Console totals.',
    rows,
  });
}

async function handlePositionDist(client, res) {
  const { rows } = await client.query(`
    SELECT
      CASE
        WHEN position <= 3  THEN 'pos_1_3'
        WHEN position <= 10 THEN 'pos_4_10'
        WHEN position <= 20 THEN 'pos_11_20'
        WHEN position <= 50 THEN 'pos_21_50'
        ELSE                     'pos_51_100'
      END AS bucket,
      COUNT(DISTINCT query)::int AS query_count,
      SUM(clicks)::int           AS clicks,
      SUM(impressions)::int      AS impressions
    FROM google_search_console.query
    WHERE sub_source = $1 AND search_type = 'web'
      AND date >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY bucket
    ORDER BY MIN(position)
  `, [GSC_SUB_SOURCE]);
  return res.status(200).json({ ok: true, rows });
}

async function handleAdsMonthly(client, res) {
  const { rows } = await client.query(`
    SELECT
      DATE_TRUNC('month', cp.date)::date                                  AS month,
      COUNT(DISTINCT cp.campaign_id)::int                                  AS active_campaigns,
      SUM(cp.clicks)::int                                                  AS clicks,
      SUM(cp.impressions)::int                                             AS impressions,
      ROUND(SUM(cp.cost)::numeric, 2)                                      AS cost_gbp,
      ROUND(SUM(cp.conversion_value)::numeric, 2)                          AS conv_value_gbp,
      ROUND((SUM(cp.conversion_value)/NULLIF(SUM(cp.cost),0))::numeric, 4) AS roas
    FROM google_ads.campaign_performance cp
    JOIN google_ads.campaigns c ON c.campaign_id = cp.campaign_id
    WHERE c.account_id = $1
    GROUP BY DATE_TRUNC('month', cp.date)
    ORDER BY month ASC
  `, [ADS_ACCOUNT]);
  return res.status(200).json({ ok: true, rows });
}

async function handleDataQuality(client, res) {
  const [gscQ, adsQ] = await Promise.all([
    client.query(`SELECT MIN(date) AS earliest, MAX(date) AS latest, COUNT(DISTINCT date)::int AS total_days
                  FROM google_search_console.overview WHERE sub_source=$1 AND search_type='web'`, [GSC_SUB_SOURCE]),
    client.query(`SELECT MIN(cp.date) AS earliest, MAX(cp.date) AS latest
                  FROM google_ads.campaign_performance cp
                  JOIN google_ads.campaigns c ON c.campaign_id=cp.campaign_id
                  WHERE c.account_id=$1`, [ADS_ACCOUNT]),
  ]);
  return res.status(200).json({
    ok: true,
    sources: {
      semrush:    { status:'static_csv', coverage:'Jul 2023–Jun 2026', months:36, note:'Loaded from master dataset CSV.' },
      gsc:        { status:'live', earliest:gscQ.rows[0].earliest, latest:gscQ.rows[0].latest, total_days:gscQ.rows[0].total_days, note:'Clicks ≈ 50% of true GSC totals.' },
      google_ads: { status:'live', earliest:adsQ.rows[0].earliest, latest:adsQ.rows[0].latest, account_id:ADS_ACCOUNT, note:'UK account GBP. cost column is already GBP.' },
      ga4:        { status:'limited', coverage:'Mar–Apr 2026 aggregate only', note:'Not reliable for monthly KPIs.' },
      shopify:    { status:'unavailable', note:'MCP connection failed. Organic revenue not available.' },
    },
  });
}

async function handleGscWeekly(client, res) {
  const [ovRes, kwRes] = await Promise.all([
    client.query(`
      SELECT
        DATE_TRUNC('week', date)::date                                        AS week_start,
        SUM(clicks)::int                                                       AS clicks,
        SUM(impressions)::int                                                  AS impressions,
        ROUND((SUM(clicks)::numeric/NULLIF(SUM(impressions),0))*100, 3)       AS ctr_pct,
        ROUND(AVG(position)::numeric, 2)                                       AS avg_position,
        COUNT(DISTINCT date)::int                                              AS days_in_week
      FROM google_search_console.overview
      WHERE sub_source=$1 AND search_type='web'
        AND date >= CURRENT_DATE - INTERVAL '26 weeks'
      GROUP BY DATE_TRUNC('week', date)
      ORDER BY week_start ASC
    `, [GSC_SUB_SOURCE]),
    client.query(`
      SELECT
        DATE_TRUNC('week', date)::date                                         AS week_start,
        COUNT(DISTINCT CASE WHEN position <= 3  THEN query END)::int           AS kw_top3,
        COUNT(DISTINCT CASE WHEN position <= 10 THEN query END)::int           AS kw_top10
      FROM google_search_console.query
      WHERE sub_source=$1 AND search_type='web'
        AND date >= CURRENT_DATE - INTERVAL '26 weeks'
      GROUP BY DATE_TRUNC('week', date)
      ORDER BY week_start ASC
    `, [GSC_SUB_SOURCE]),
  ]);
  const kwMap = {};
  kwRes.rows.forEach(r => {
    kwMap[String(r.week_start).slice(0,10)] = {
      kw_top3:  parseInt(r.kw_top3)  || 0,
      kw_top10: parseInt(r.kw_top10) || 0,
    };
  });
  const rows = ovRes.rows.map(r => {
    const ws = String(r.week_start).slice(0,10);
    const kw = kwMap[ws] || { kw_top3: 0, kw_top10: 0 };
    return {
      week_start:   ws,
      clicks:       parseInt(r.clicks)       || 0,
      impressions:  parseInt(r.impressions)  || 0,
      ctr_pct:      parseFloat(r.ctr_pct)    || 0,
      avg_position: parseFloat(r.avg_position)|| 0,
      kw_top3:      kw.kw_top3,
      kw_top10:     kw.kw_top10,
      days_in_week: parseInt(r.days_in_week) || 0,
    };
  });
  return res.status(200).json({ ok: true, rows });
}

/* ─── PRODUCTS ──────────────────────────────────────────────── */

async function handleProductPages(client, res, from, to) {
  const [pagesRes, kwRes] = await Promise.all([
    client.query(`
      SELECT page,
        SUM(clicks)::int                                                    AS clicks,
        SUM(impressions)::int                                               AS impressions,
        ROUND((SUM(clicks)::numeric/NULLIF(SUM(impressions),0))*100, 3)    AS ctr_pct,
        ROUND(AVG(position)::numeric, 1)                                    AS avg_position,
        COUNT(DISTINCT date)::int                                           AS days_with_data
      FROM google_search_console.page
      WHERE sub_source=$1 AND search_type='web'
        AND page ILIKE '%ledsone.co.uk/products/%'
        AND date BETWEEN $2 AND $3
      GROUP BY page ORDER BY clicks DESC LIMIT 2000
    `, [GSC_SUB_SOURCE, from, to]),
    client.query(`
      WITH ranked AS (
        SELECT qp.page, qp.query, SUM(qp.clicks)::int AS kw_clicks,
          ROW_NUMBER() OVER (PARTITION BY qp.page ORDER BY SUM(qp.clicks) DESC) AS rn
        FROM google_search_console.query_page qp
        WHERE qp.sub_source=$1 AND qp.search_type='web'
          AND qp.page ILIKE '%ledsone.co.uk/products/%'
          AND qp.date BETWEEN $2 AND $3
        GROUP BY qp.page, qp.query
      )
      SELECT page, query AS top_query, kw_clicks AS top_query_clicks FROM ranked WHERE rn=1
    `, [GSC_SUB_SOURCE, from, to]),
  ]);
  const kwMap = {};
  kwRes.rows.forEach(r => { kwMap[r.page] = { top_query:r.top_query, top_query_clicks:parseInt(r.top_query_clicks)||0 }; });
  const rows = pagesRes.rows.map(r => ({
    page:             r.page,
    clicks:           parseInt(r.clicks)||0,
    impressions:      parseInt(r.impressions)||0,
    ctr_pct:          parseFloat(r.ctr_pct)||0,
    avg_position:     parseFloat(r.avg_position)||0,
    days_with_data:   parseInt(r.days_with_data)||0,
    top_query:        kwMap[r.page]?.top_query || null,
    top_query_clicks: kwMap[r.page]?.top_query_clicks || null,
  }));
  return res.status(200).json({ ok: true, from, to, total:rows.length, data_note:'clicks ≈ 50% of true GSC totals.', rows });
}

async function handleListings(client, res) {
  const { rows } = await client.query(`
    SELECT shopify_handle AS handle, title
    FROM listings.shopify_listings
    WHERE sub_source=$1 AND is_parent=1
    ORDER BY shopify_handle
  `, [GSC_SUB_SOURCE]);
  return res.status(200).json({ ok:true, count:rows.length, rows });
}

/* ─── KEYWORDS ──────────────────────────────────────────────── */

async function getLatestDate(client) {
  const { rows } = await client.query(
    `SELECT MAX(date) AS latest FROM google_search_console.query WHERE sub_source=$1`, [GSC_SUB_SOURCE]);
  return rows[0].latest ? new Date(rows[0].latest) : new Date();
}
function addDays(d, n) { const r=new Date(d); r.setDate(r.getDate()+n); return r.toISOString().slice(0,10); }

async function handleKwTop(client, res, from, to) {
  const [kwRes, pageRes] = await Promise.all([
    client.query(`
      SELECT query,
        SUM(clicks)::int                                                 AS clicks,
        SUM(impressions)::int                                            AS impressions,
        ROUND((SUM(clicks)::numeric/NULLIF(SUM(impressions),0))*100,3)  AS ctr_pct,
        ROUND(AVG(position)::numeric,1)                                  AS avg_position
      FROM google_search_console.query
      WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
      GROUP BY query ORDER BY clicks DESC LIMIT 500
    `, [GSC_SUB_SOURCE, from, to]),
    client.query(`
      WITH top_kw AS (
        SELECT query FROM google_search_console.query
        WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
        GROUP BY query ORDER BY SUM(clicks) DESC LIMIT 500
      ), ranked AS (
        SELECT qp.query, qp.page,
          ROW_NUMBER() OVER (PARTITION BY qp.query ORDER BY SUM(qp.clicks) DESC) AS rn
        FROM google_search_console.query_page qp
        JOIN top_kw t ON t.query=qp.query
        WHERE qp.sub_source=$1 AND qp.search_type='web' AND qp.date BETWEEN $2 AND $3
        GROUP BY qp.query, qp.page
      )
      SELECT query, page AS top_page FROM ranked WHERE rn=1
    `, [GSC_SUB_SOURCE, from, to]),
  ]);
  const pageMap = {};
  pageRes.rows.forEach(r => { pageMap[r.query] = r.top_page; });
  const rows = kwRes.rows.map(r => ({
    query: r.query, clicks: parseInt(r.clicks)||0, impressions: parseInt(r.impressions)||0,
    ctr_pct: parseFloat(r.ctr_pct)||0, avg_position: parseFloat(r.avg_position)||0,
    top_page: pageMap[r.query] || null,
  }));
  return res.status(200).json({ ok:true, type:'top', from, to, total:rows.length, rows });
}

async function handleKwOpportunity(client, res, from, to) {
  const { rows: raw } = await client.query(`
    SELECT query,
      SUM(clicks)::int                                                 AS clicks,
      SUM(impressions)::int                                            AS impressions,
      ROUND((SUM(clicks)::numeric/NULLIF(SUM(impressions),0))*100,3)  AS ctr_pct,
      ROUND(AVG(position)::numeric,1)                                  AS avg_position
    FROM google_search_console.query
    WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
    GROUP BY query
    HAVING AVG(position) BETWEEN 4 AND 20 AND SUM(impressions)>=50
    ORDER BY SUM(impressions) DESC LIMIT 300
  `, [GSC_SUB_SOURCE, from, to]);
  const rows = raw.map(r => {
    const pos=parseFloat(r.avg_position)||0, imp=parseInt(r.impressions)||0, ctr=parseFloat(r.ctr_pct)||0;
    let score=0;
    if      (pos<=3)  score+=0;
    else if (pos<=10) score+=40;
    else if (pos<=20) score+=70;
    else if (pos<=50) score+=50;
    else              score+=20;
    score += Math.min(imp/100,30);
    score -= Math.min(ctr*10,20);
    score = Math.max(0,Math.min(100,Math.round(score)));
    let action='Monitor';
    if      (pos<=7  && imp>=200) action='Quick Win — Top 3 Push';
    else if (pos<=10 && imp>=200) action='CTR Boost — Title/Meta';
    else if (pos<=15 && imp>=200) action='Page 2 Rescue';
    else if (pos<=20 && imp>=200) action='Content Depth Needed';
    else if (imp>=10000)          action='High Volume Priority';
    return { query:r.query, clicks:parseInt(r.clicks)||0, impressions:imp, ctr_pct:ctr, avg_position:pos, opp_score:score, action };
  });
  rows.sort((a,b)=>b.opp_score-a.opp_score);
  return res.status(200).json({ ok:true, type:'opportunity', from, to, total:rows.length, rows });
}

async function handleKwMovers(client, res, direction) {
  const latest  = await getLatestDate(client);
  const curTo   = addDays(latest, 0);
  const curFrom = addDays(latest, -29);
  const prvTo   = addDays(latest, -30);
  const prvFrom = addDays(latest, -59);
  const dirCond = direction === 'rising' ? '> 0.5' : '< -0.5';
  const { rows } = await client.query(`
    WITH current_period AS (
      SELECT query,
        ROUND(AVG(position)::numeric,1) AS cur_pos,
        SUM(clicks)::int AS cur_clicks, SUM(impressions)::int AS cur_imp
      FROM google_search_console.query
      WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
      GROUP BY query HAVING SUM(impressions)>=10
    ), prior_period AS (
      SELECT query,
        ROUND(AVG(position)::numeric,1) AS prv_pos,
        SUM(clicks)::int AS prv_clicks, SUM(impressions)::int AS prv_imp
      FROM google_search_console.query
      WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $4 AND $5
      GROUP BY query HAVING SUM(impressions)>=10
    )
    SELECT c.query, c.cur_pos, p.prv_pos,
      ROUND((p.prv_pos-c.cur_pos)::numeric,1) AS pos_change,
      c.cur_clicks, c.cur_imp, p.prv_clicks, p.prv_imp
    FROM current_period c JOIN prior_period p ON p.query=c.query
    WHERE (p.prv_pos-c.cur_pos) ${dirCond}
    ORDER BY ABS(p.prv_pos-c.cur_pos) DESC LIMIT 200
  `, [GSC_SUB_SOURCE, curFrom, curTo, prvFrom, prvTo]);
  return res.status(200).json({
    ok:true, type:direction,
    cur_period:{from:curFrom,to:curTo}, prv_period:{from:prvFrom,to:prvTo},
    total:rows.length,
    rows:rows.map(r=>({
      query:r.query, cur_pos:parseFloat(r.cur_pos)||0, prv_pos:parseFloat(r.prv_pos)||0,
      pos_change:parseFloat(r.pos_change)||0, cur_clicks:parseInt(r.cur_clicks)||0,
      cur_imp:parseInt(r.cur_imp)||0, prv_clicks:parseInt(r.prv_clicks)||0, prv_imp:parseInt(r.prv_imp)||0,
    })),
  });
}

/* ─── LANDING PAGES ─────────────────────────────────────────── */

function classifyPage(page) {
  if (!page) return 'other';
  const p = page.replace(/^https?:\/\/[^/]+/,'').toLowerCase();
  if (p==='/'||p==='')             return 'home';
  if (p.startsWith('/products/'))  return 'product';
  if (p.startsWith('/collections/')) return 'collection';
  if (p.startsWith('/blogs/')||p.startsWith('/pages/')) return 'content';
  if (p.startsWith('/search'))     return 'search';
  return 'other';
}

async function handleLpPages(client, res, from, to) {
  const { rows: raw } = await client.query(`
    SELECT page,
      SUM(clicks)::int                                                 AS clicks,
      SUM(impressions)::int                                            AS impressions,
      ROUND((SUM(clicks)::numeric/NULLIF(SUM(impressions),0))*100,3)  AS ctr_pct,
      ROUND(AVG(position)::numeric,1)                                  AS avg_position,
      COUNT(DISTINCT date)::int                                        AS days_with_data
    FROM google_search_console.page
    WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
    GROUP BY page ORDER BY clicks DESC LIMIT 500
  `, [GSC_SUB_SOURCE, from, to]);
  const rows = raw.map(r => ({
    page:r.page, page_type:classifyPage(r.page),
    clicks:parseInt(r.clicks)||0, impressions:parseInt(r.impressions)||0,
    ctr_pct:parseFloat(r.ctr_pct)||0, avg_position:parseFloat(r.avg_position)||0,
    days_with_data:parseInt(r.days_with_data)||0,
  }));
  return res.status(200).json({ ok:true, type:'pages', from, to, total:rows.length, rows });
}

async function handleLpByType(client, res, from, to) {
  const { rows: raw } = await client.query(`
    SELECT page, SUM(clicks)::int AS clicks, SUM(impressions)::int AS impressions, AVG(position) AS avg_pos
    FROM google_search_console.page
    WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
    GROUP BY page
  `, [GSC_SUB_SOURCE, from, to]);
  const buckets = {};
  for (const r of raw) {
    const t = classifyPage(r.page);
    if (!buckets[t]) buckets[t] = { page_type:t, clicks:0, impressions:0, pos_sum:0, page_count:0 };
    buckets[t].clicks      += parseInt(r.clicks)||0;
    buckets[t].impressions += parseInt(r.impressions)||0;
    buckets[t].pos_sum     += parseFloat(r.avg_pos)||0;
    buckets[t].page_count  += 1;
  }
  const rows = Object.values(buckets).map(b => ({
    page_type:b.page_type, clicks:b.clicks, impressions:b.impressions,
    ctr_pct: b.impressions>0 ? parseFloat(((b.clicks/b.impressions)*100).toFixed(3)):0,
    avg_position: b.page_count>0 ? parseFloat((b.pos_sum/b.page_count).toFixed(1)):0,
    page_count:b.page_count,
  })).sort((a,b)=>b.clicks-a.clicks);
  return res.status(200).json({ ok:true, type:'by-type', from, to, rows });
}

async function handleLpMoM(client, res) {
  const { rows: latest } = await client.query(
    `SELECT MAX(date) AS d FROM google_search_console.page WHERE sub_source=$1`, [GSC_SUB_SOURCE]);
  const latestDate = latest[0].d ? new Date(latest[0].d) : new Date();
  const curYear=latestDate.getFullYear(), curMonth=latestDate.getMonth();
  const curFrom=`${curYear}-${String(curMonth+1).padStart(2,'0')}-01`;
  const curTo=latestDate.toISOString().slice(0,10);
  const prvDate=new Date(curYear,curMonth-1,1);
  const prvFrom=`${prvDate.getFullYear()}-${String(prvDate.getMonth()+1).padStart(2,'0')}-01`;
  const prvTo=new Date(curYear,curMonth,0).toISOString().slice(0,10);

  const [curRes,prvRes] = await Promise.all([
    client.query(`SELECT page, SUM(clicks)::int AS clicks, SUM(impressions)::int AS impressions,
                  ROUND(AVG(position)::numeric,1) AS avg_position
                  FROM google_search_console.page
                  WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
                  GROUP BY page ORDER BY clicks DESC LIMIT 20`,
      [GSC_SUB_SOURCE,curFrom,curTo]),
    client.query(`SELECT page, SUM(clicks)::int AS clicks, SUM(impressions)::int AS impressions,
                  ROUND(AVG(position)::numeric,1) AS avg_position
                  FROM google_search_console.page
                  WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
                  GROUP BY page`,
      [GSC_SUB_SOURCE,prvFrom,prvTo]),
  ]);
  const prvMap={};
  prvRes.rows.forEach(r=>{prvMap[r.page]={clicks:parseInt(r.clicks)||0,impressions:parseInt(r.impressions)||0,avg_position:parseFloat(r.avg_position)||0};});
  const rows=curRes.rows.map(r=>{
    const prv=prvMap[r.page]||null;
    return {
      page:r.page, page_type:classifyPage(r.page),
      cur_clicks:parseInt(r.clicks)||0, cur_impressions:parseInt(r.impressions)||0, cur_position:parseFloat(r.avg_position)||0,
      prv_clicks:prv?prv.clicks:null, prv_impressions:prv?prv.impressions:null, prv_position:prv?prv.avg_position:null,
    };
  });
  return res.status(200).json({
    ok:true, type:'top-pages', cur_period:{from:curFrom,to:curTo}, prv_period:{from:prvFrom,to:prvTo}, total:rows.length, rows,
  });
}

/* ─── ACTIONS ───────────────────────────────────────────────── */

async function handleActionPriorities(client, res, from, to) {
  const latest = await getLatestDate(client);
  const curTo   = addDays(latest, 0);
  const curFrom = addDays(latest, -29);
  const prvTo   = addDays(latest, -30);
  const prvFrom = addDays(latest, -59);

  const [oppRes, decRes, ctrRes] = await Promise.all([
    client.query(`
      SELECT query,
        SUM(clicks)::int                                                AS clicks,
        SUM(impressions)::int                                           AS impressions,
        ROUND((SUM(clicks)::numeric/NULLIF(SUM(impressions),0))*100,3) AS ctr_pct,
        ROUND(AVG(position)::numeric,1)                                 AS avg_position
      FROM google_search_console.query
      WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
      GROUP BY query
      HAVING AVG(position) BETWEEN 4 AND 20 AND SUM(impressions) >= 100
      ORDER BY SUM(impressions) DESC LIMIT 80
    `, [GSC_SUB_SOURCE, from, to]),
    client.query(`
      WITH current_period AS (
        SELECT query,
          ROUND(AVG(position)::numeric,1) AS cur_pos,
          SUM(clicks)::int AS cur_clicks, SUM(impressions)::int AS cur_imp
        FROM google_search_console.query
        WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
        GROUP BY query HAVING SUM(impressions)>=20
      ), prior_period AS (
        SELECT query,
          ROUND(AVG(position)::numeric,1) AS prv_pos,
          SUM(clicks)::int AS prv_clicks
        FROM google_search_console.query
        WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $4 AND $5
        GROUP BY query HAVING SUM(impressions)>=20
      )
      SELECT c.query, c.cur_pos, p.prv_pos,
        ROUND((p.prv_pos-c.cur_pos)::numeric,1) AS pos_change,
        c.cur_clicks, c.cur_imp, p.prv_clicks
      FROM current_period c JOIN prior_period p ON p.query=c.query
      WHERE (p.prv_pos-c.cur_pos) < -2
      ORDER BY (p.prv_pos-c.cur_pos) ASC LIMIT 30
    `, [GSC_SUB_SOURCE, curFrom, curTo, prvFrom, prvTo]),
    client.query(`
      SELECT query,
        SUM(clicks)::int                                                AS clicks,
        SUM(impressions)::int                                           AS impressions,
        ROUND((SUM(clicks)::numeric/NULLIF(SUM(impressions),0))*100,3) AS ctr_pct,
        ROUND(AVG(position)::numeric,1)                                 AS avg_position
      FROM google_search_console.query
      WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
      GROUP BY query
      HAVING AVG(position) BETWEEN 1 AND 10
        AND SUM(impressions) >= 200
        AND (SUM(clicks)::numeric/NULLIF(SUM(impressions),0)) < 0.03
      ORDER BY SUM(impressions) DESC LIMIT 30
    `, [GSC_SUB_SOURCE, from, to]),
  ]);

  const actions = [];
  for (const r of oppRes.rows) {
    const pos=parseFloat(r.avg_position)||0, imp=parseInt(r.impressions)||0, ctr=parseFloat(r.ctr_pct)||0;
    let score=0;
    if      (pos<=7)  score=90;
    else if (pos<=10) score=75;
    else if (pos<=15) score=60;
    else              score=45;
    score += Math.min(imp/200, 10);
    score = Math.min(100, Math.round(score));
    let category, action_label, why;
    if (pos<=7 && imp>=200) {
      category='quick-win'; action_label='Push to Top 3';
      why=`Ranking #${pos} with ${imp} impressions — a 1-3 position improvement could 3× clicks.`;
    } else if (pos<=10) {
      category='ctr-boost'; action_label='Optimise Title/Meta';
      why=`On page 1 at #${pos} but CTR is ${ctr.toFixed(1)}% — meta description and title relevance review needed.`;
    } else if (pos<=15) {
      category='rescue'; action_label='Page 2 Rescue';
      why=`Stuck on page 2 at #${pos} with ${imp} impressions — content depth or internal links likely limiting.`;
    } else {
      category='content'; action_label='Build Content Authority';
      why=`Position ${pos} with ${imp} impressions — page authority and topical depth need strengthening.`;
    }
    actions.push({ id: `opp-${r.query}`, category, priority_score: score, query: r.query,
      cur_pos: pos, impressions: imp, clicks: parseInt(r.clicks)||0, ctr_pct: ctr,
      action_label, why, pos_change: null });
  }
  for (const r of decRes.rows) {
    const drop = Math.abs(parseFloat(r.pos_change)||0);
    const score = Math.min(100, Math.round(55 + drop * 1.2));
    actions.push({ id: `dec-${r.query}`, category: 'decline', priority_score: score,
      query: r.query, cur_pos: parseFloat(r.cur_pos)||0, impressions: parseInt(r.cur_imp)||0,
      clicks: parseInt(r.cur_clicks)||0, ctr_pct: null,
      action_label: 'Investigate Drop',
      why: `Position fell ${drop} places (was #${r.prv_pos}, now #${r.cur_pos}) in last 30 days.`,
      pos_change: parseFloat(r.pos_change)||0 });
  }
  for (const r of ctrRes.rows) {
    const pos=parseFloat(r.avg_position)||0, imp=parseInt(r.impressions)||0, ctr=parseFloat(r.ctr_pct)||0;
    const bench = pos<=3 ? 15 : pos<=7 ? 5 : 2;
    const gap   = Math.max(0, bench - ctr);
    const score = Math.min(100, Math.round(50 + gap * 2 + Math.min(imp/500, 15)));
    if (!actions.find(a => a.query === r.query)) {
      actions.push({ id: `ctr-${r.query}`, category: 'ctr-boost', priority_score: score,
        query: r.query, cur_pos: pos, impressions: imp, clicks: parseInt(r.clicks)||0,
        ctr_pct: ctr, action_label: 'Fix CTR — Title/Meta',
        why: `Ranking #${pos} with ${imp} impressions but only ${ctr.toFixed(1)}% CTR (benchmark ~${bench}%).`,
        pos_change: null });
    }
  }
  actions.sort((a,b) => b.priority_score - a.priority_score);
  const ranked = actions.map((a,i) => ({
    ...a,
    rank: i+1,
    priority: a.priority_score >= 85 ? 'P1' : a.priority_score >= 70 ? 'P2' : a.priority_score >= 55 ? 'P3' : 'P4',
  }));
  const summary = { quick_win:0, ctr_boost:0, rescue:0, content:0, decline:0 };
  ranked.forEach(a => { if (summary[a.category.replace('-','_')] !== undefined) summary[a.category.replace('-','_')]++; });
  return res.status(200).json({
    ok:true, type:'priorities', from, to,
    date_range_movers: { cur_period:{from:curFrom,to:curTo}, prv_period:{from:prvFrom,to:prvTo} },
    summary, total:ranked.length, rows:ranked,
  });
}

/* ─── TECHNICAL SEO ─────────────────────────────────────────── */

async function handleLpPageTrend(client, res, page) {
  if (!page) return res.status(400).json({ ok:false, error:'page param required' });
  const { rows } = await client.query(`
    SELECT DATE_TRUNC('month', date)::date AS month,
           SUM(clicks)::int                AS clicks,
           SUM(impressions)::int           AS impressions,
           ROUND(AVG(position)::numeric,1) AS avg_position
    FROM google_search_console.page
    WHERE sub_source=$1 AND search_type='web' AND page=$2
    GROUP BY DATE_TRUNC('month', date)
    ORDER BY month ASC
  `, [GSC_SUB_SOURCE, page]);
  return res.status(200).json({ ok:true, page, rows });
}

async function handleRankDist(client, res, from, to) {
  const { rows } = await client.query(`
    SELECT
      DATE_TRUNC('month', date)::date                                        AS month,
      COUNT(DISTINCT CASE WHEN position <= 3            THEN query END)::int AS pos_1_3,
      COUNT(DISTINCT CASE WHEN position > 3  AND position <= 10 THEN query END)::int AS pos_4_10,
      COUNT(DISTINCT CASE WHEN position > 10 AND position <= 20 THEN query END)::int AS pos_11_20,
      COUNT(DISTINCT CASE WHEN position > 20 AND position <= 50 THEN query END)::int AS pos_21_50,
      COUNT(DISTINCT CASE WHEN position > 50             THEN query END)::int AS pos_51_plus
    FROM google_search_console.query
    WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
    GROUP BY DATE_TRUNC('month', date)
    ORDER BY month ASC
  `, [GSC_SUB_SOURCE, from, to]);
  return res.status(200).json({ ok:true, rows });
}

async function handleKwHistory(client, res, query) {
  if (!query) return res.status(400).json({ ok:false, error:'q param required' });
  const { rows } = await client.query(`
    SELECT DATE_TRUNC('month', date)::date   AS month,
           ROUND(AVG(position)::numeric, 1)  AS avg_position,
           SUM(clicks)::int                  AS clicks,
           SUM(impressions)::int             AS impressions,
           ROUND(AVG(ctr)::numeric*100, 2)   AS ctr_pct
    FROM google_search_console.query
    WHERE sub_source=$1 AND search_type='web' AND query=$2
      AND date >= NOW() - INTERVAL '18 months'
    GROUP BY DATE_TRUNC('month', date)
    ORDER BY month ASC
  `, [GSC_SUB_SOURCE, query]);
  return res.status(200).json({ ok:true, query, rows });
}

async function handleTechCoverage(client, res, from, to) {
  const [coverRes, shopifyRes, freshRes] = await Promise.all([
    client.query(`
      SELECT
        COUNT(DISTINCT page)                                                                       AS total_indexed,
        COUNT(DISTINCT CASE WHEN page ILIKE '%/products/%'    THEN page END)                      AS products,
        COUNT(DISTINCT CASE WHEN page ILIKE '%/collections/%' THEN page END)                      AS collections,
        COUNT(DISTINCT CASE WHEN page NOT ILIKE '%/products/%'
                             AND page NOT ILIKE '%/collections/%'
                             AND page NOT ILIKE '%ledsone.co.uk/$'
                             AND page NOT ILIKE '%ledsone.co.uk'   THEN page END)                  AS other,
        MIN(date) AS earliest, MAX(date) AS latest
      FROM google_search_console.page
      WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
    `, [GSC_SUB_SOURCE, from, to]),
    client.query(`
      SELECT COUNT(*) AS total_products
      FROM listings.shopify_listings
      WHERE sub_source=$1 AND is_parent=1
    `, [GSC_SUB_SOURCE]),
    client.query(`
      SELECT
        CASE
          WHEN days_cnt <= 7   THEN 'new_7d'
          WHEN days_cnt <= 30  THEN 'active_30d'
          WHEN days_cnt <= 60  THEN 'active_60d'
          ELSE                      'established'
        END AS freshness_bucket,
        COUNT(*) AS page_count
      FROM (
        SELECT page, COUNT(DISTINCT date) AS days_cnt
        FROM google_search_console.page
        WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
        GROUP BY page
      ) sub
      GROUP BY freshness_bucket
    `, [GSC_SUB_SOURCE, from, to]),
  ]);
  const cov = coverRes.rows[0];
  const totalProducts  = parseInt(shopifyRes.rows[0].total_products) || 0;
  const indexedProducts= parseInt(cov.products) || 0;
  const coverageRatio  = totalProducts > 0 ? parseFloat(((indexedProducts/totalProducts)*100).toFixed(1)) : 0;
  const freshness = {};
  freshRes.rows.forEach(r => { freshness[r.freshness_bucket] = parseInt(r.page_count)||0; });
  return res.status(200).json({
    ok: true, type: 'coverage', from, to,
    stats: {
      total_indexed:      parseInt(cov.total_indexed)||0,
      indexed_products:   indexedProducts,
      indexed_collections:parseInt(cov.collections)||0,
      indexed_other:      parseInt(cov.other)||0,
      total_shopify_products: totalProducts,
      product_coverage_pct:   coverageRatio,
      earliest: cov.earliest,
      latest:   cov.latest,
    },
    freshness,
  });
}

async function handleTechCannib(client, res, from, to) {
  const { rows: raw } = await client.query(`
    WITH page_kw AS (
      SELECT query, page, SUM(clicks)::int AS clicks
      FROM google_search_console.query_page
      WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
      GROUP BY query, page
      HAVING SUM(clicks) >= 1
    ),
    multi_page AS (
      SELECT query, COUNT(DISTINCT page)::int AS competing_pages, SUM(clicks)::int AS total_clicks
      FROM page_kw
      GROUP BY query
      HAVING COUNT(DISTINCT page) >= 2
      ORDER BY SUM(clicks) DESC
      LIMIT 60
    )
    SELECT mp.query, mp.competing_pages, mp.total_clicks,
           pk.page, pk.clicks AS page_clicks
    FROM multi_page mp
    JOIN page_kw pk ON pk.query = mp.query
    ORDER BY mp.total_clicks DESC, mp.query, pk.clicks DESC
  `, [GSC_SUB_SOURCE, from, to]);
  const grouped = {};
  for (const r of raw) {
    if (!grouped[r.query]) {
      grouped[r.query] = { query:r.query, competing_pages:parseInt(r.competing_pages), total_clicks:parseInt(r.total_clicks), pages:[] };
    }
    grouped[r.query].pages.push({ page:r.page, clicks:parseInt(r.page_clicks)||0 });
  }
  const rows = Object.values(grouped);
  return res.status(200).json({ ok:true, type:'cannibalization', from, to, total:rows.length, rows });
}

async function handleTechZeroClick(client, res, from, to) {
  const { rows } = await client.query(`
    SELECT
      page,
      SUM(clicks)::int                                                    AS clicks,
      SUM(impressions)::int                                               AS impressions,
      ROUND(AVG(position)::numeric,1)                                     AS avg_position,
      COUNT(DISTINCT date)::int                                           AS days_with_data
    FROM google_search_console.page
    WHERE sub_source=$1 AND search_type='web' AND date BETWEEN $2 AND $3
    GROUP BY page
    HAVING SUM(clicks) = 0 AND SUM(impressions) >= 20
    ORDER BY SUM(impressions) DESC
    LIMIT 300
  `, [GSC_SUB_SOURCE, from, to]);
  return res.status(200).json({
    ok: true, type:'zero-click', from, to, total:rows.length,
    rows: rows.map(r => ({
      page:           r.page,
      page_type:      classifyPage(r.page),
      impressions:    parseInt(r.impressions)||0,
      avg_position:   parseFloat(r.avg_position)||0,
      days_with_data: parseInt(r.days_with_data)||0,
    })),
  });
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(data.slice(0, 300))); }
      });
    }).on('error', reject);
  });
}

async function handleCwv(res, strategy) {
  try {
    const key    = process.env.PSI_KEY || '';
    const target = 'https://ledsone.co.uk';
    const strat  = strategy === 'desktop' ? 'desktop' : 'mobile';
    const url    = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(target)}&strategy=${strat}&category=performance${key ? '&key=' + key : ''}`;
    const data = await httpsGetJson(url);
    if (data.error) {
      const msg = data.error.message || 'PSI API error';
      const blocked = /403|blocked|access denied|firewall/i.test(msg) || msg.includes('Something went wrong');
      return res.status(502).json({ ok:false, blocked, error: msg });
    }
    return res.status(200).json({ ok:true, strategy: strat, data });
  } catch (e) {
    return res.status(502).json({ ok:false, blocked: true, error: e.message || 'PageSpeed fetch failed' });
  }
}

/* ─── SEMRUSH ────────────────────────────────────────────────── */

async function handleSemrush(type, res, req) {
  const NEON_URL = process.env.NEON_DATABASE_URL;
  if (!NEON_URL) return res.status(500).json({ ok:false, cause:'no_neon_url', error:'NEON_DATABASE_URL not set' });
  const nc = makeSeoClient(NEON_URL);
  try {
    await nc.connect();
    if (type === 'history') {
      const { rows } = await nc.query(`
        SELECT month, rank, organic_keywords, kw_top3, kw_top4_10, kw_top11_20,
               kw_top21_100, traffic_est, traffic_cost_gbp, paid_keywords, paid_traffic
        FROM semrush_history ORDER BY month ASC`);
      return res.json({ ok:true, rows });
    }
    if (type === 'competitors') {
      const { rows } = await nc.query(`
        SELECT domain, month, rank, organic_keywords, traffic_est, traffic_cost_gbp
        FROM semrush_competitor_history
        WHERE domain IN ('lightingcompany.co.uk','ledhut.co.uk','industville.co.uk','thevintagelightbulbcompany.com','lampspares.co.uk')
        ORDER BY domain, month ASC`);
      return res.json({ ok:true, rows });
    }
    if (type === 'backlinks') {
      const { rows } = await nc.query(`
        SELECT snapshot_date, authority_score, total_backlinks, referring_domains, referring_ips, follow_links, nofollow_links
        FROM semrush_backlinks ORDER BY snapshot_date ASC`);
      return res.json({ ok:true, rows });
    }
    if (type === 'backlinks-history') {
      const { rows } = await nc.query(`
        SELECT snapshot_date, total_backlinks, referring_domains
        FROM semrush_backlinks_history ORDER BY snapshot_date ASC`);
      return res.json({ ok:true, rows });
    }
    if (type === 'lost-domains') {
      const { rows: snaps } = await nc.query(`
        SELECT DISTINCT snapshot_date FROM semrush_refdomains
        ORDER BY snapshot_date DESC LIMIT 2`);
      if (snaps.length < 1) return res.json({ ok:true, latest: null, previous: null, lost:[], gained:[], current:[] });
      const latest   = snaps[0].snapshot_date;
      const previous = snaps[1] ? snaps[1].snapshot_date : null;
      const [latestRes, prevRes] = await Promise.all([
        nc.query(`SELECT domain, authority_score, backlinks_count, first_seen, last_seen FROM semrush_refdomains WHERE snapshot_date=$1 ORDER BY backlinks_count DESC`, [latest]),
        previous ? nc.query(`SELECT domain FROM semrush_refdomains WHERE snapshot_date=$1`, [previous]) : Promise.resolve({ rows:[] })
      ]);
      const latestDomains = new Set(latestRes.rows.map(r => r.domain));
      const prevDomains   = new Set(prevRes.rows.map(r => r.domain));
      const lost   = previous ? prevRes.rows.filter(r => !latestDomains.has(r.domain)).map(r => r.domain) : [];
      const gained = previous ? latestRes.rows.filter(r => !prevDomains.has(r.domain)) : [];
      return res.json({ ok:true, latest, previous, current: latestRes.rows, lost, gained });
    }
    if (type === 'keywords') {
      const { rows } = await nc.query(`
        SELECT keyword, position, prev_position, volume, cpc, url, traffic, keyword_difficulty, intent, snapshot_date
        FROM semrush_keywords
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM semrush_keywords)
        ORDER BY traffic DESC LIMIT 100`);
      return res.json({ ok:true, rows });
    }
    if (type === 'pages') {
      const { rows } = await nc.query(`
        SELECT page_url, traffic, keywords_count, traffic_share, page_type, snapshot_date
        FROM semrush_pages
        WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM semrush_pages)
        ORDER BY traffic DESC LIMIT 50`);
      return res.json({ ok:true, rows });
    }
    if (type === 'gap-competitors') {
      const { rows } = await nc.query(`
        SELECT competitor_domain, COUNT(*) AS kw_count, MAX(snapshot_date) AS snapshot_date
        FROM semrush_keyword_gap
        GROUP BY competitor_domain
        ORDER BY kw_count DESC`);
      return res.json({ ok:true, rows });
    }
    if (type === 'keyword-gap') {
      const competitor = req.query.competitor || 'ledhut.co.uk';
      const { rows } = await nc.query(`
        SELECT keyword, competitor_domain, competitor_position, volume,
               competitor_traffic, competitor_url, keyword_difficulty, intent,
               ledsone_position, opportunity_score, snapshot_date
        FROM semrush_keyword_gap
        WHERE competitor_domain = $1
        ORDER BY opportunity_score DESC, volume DESC
        LIMIT 100`, [competitor]);
      return res.json({ ok:true, rows, competitor });
    }
    return res.status(400).json({ ok:false, error:`semrush: unknown type "${type}"` });
  } catch (err) {
    return errResponse(res, err);
  } finally {
    try { await nc.end(); } catch (_) {}
  }
}

/* ─── GEO ────────────────────────────────────────────────────── */

async function handleGeo(type, query, res) {
  const NEON_URL = process.env.NEON_DATABASE_URL;
  if (!NEON_URL) return res.status(500).json({ ok:false, error:'NEON_DATABASE_URL not set' });
  const nc = makeSeoClient(NEON_URL);
  try {
    await nc.connect();
    await nc.query(`
      CREATE TABLE IF NOT EXISTS geo_checklist (
        item_key VARCHAR(60) PRIMARY KEY,
        label    TEXT NOT NULL,
        done     BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT NOW()
      )`);
    await nc.query(`
      INSERT INTO geo_checklist (item_key, label) VALUES
        ('faqpage_schema',    'Add FAQPage schema to top 20 product pages'),
        ('aggregate_rating',  'Add aggregateRating schema to products with reviews'),
        ('sameas_org',        'Add sameAs array to Organization schema (social + trade directories)'),
        ('wikidata_entity',   'Create Wikidata entity for LEDSone brand'),
        ('author_schema',     'Add author/Person schema to blog posts'),
        ('credentials_schema','Add trade body memberships to Organization schema (hasCredential)'),
        ('blog_30_posts',     'Expand blog to 30+ posts targeting informational keywords'),
        ('link_building_5',   'Earn 5 UK electrical/LED trade publication backlinks')
      ON CONFLICT (item_key) DO NOTHING`);
    if (type === 'toggle') {
      const { key, done } = query;
      if (!key) return res.json({ ok:false, error:'key required' });
      await nc.query(`UPDATE geo_checklist SET done=$1, updated_at=NOW() WHERE item_key=$2`, [done === 'true', key]);
      return res.json({ ok:true });
    }
    const [blR, histR, kwR, clR] = await Promise.all([
      nc.query(`SELECT authority_score, referring_domains, total_backlinks FROM semrush_backlinks ORDER BY snapshot_date DESC LIMIT 1`),
      nc.query(`SELECT organic_keywords, kw_top3, traffic_est FROM semrush_history ORDER BY month DESC LIMIT 1`),
      nc.query(`SELECT COUNT(*)::int AS total,
                  COUNT(CASE WHEN position<=3  THEN 1 END)::int AS top3,
                  COUNT(CASE WHEN position<=10 THEN 1 END)::int AS top10
                FROM semrush_keywords
                WHERE snapshot_date=(SELECT MAX(snapshot_date) FROM semrush_keywords)`),
      nc.query(`SELECT item_key, label, done FROM geo_checklist ORDER BY item_key`),
    ]);
    const bl   = blR.rows[0]   || {};
    const hist = histR.rows[0] || {};
    const kw   = kwR.rows[0]   || {};
    const checklist = clR.rows;
    const AI_BOTS = ['GPTBot','ChatGPT-User','ClaudeBot','PerplexityBot','Google-Extended'];
    let robotsBots = {};
    try {
      const rtxt = await fetch('https://ledsone.co.uk/robots.txt', { signal: AbortSignal.timeout(6000) }).then(r => r.text());
      for (const agent of AI_BOTS) {
        const re = new RegExp(`User-agent:\\s*${agent}[\\s\\S]{0,80}?(Allow|Disallow):\\s*(\\S+)`, 'i');
        const m = rtxt.match(re);
        if (!m) { robotsBots[agent] = 'not_mentioned'; continue; }
        robotsBots[agent] = m[1].toLowerCase() === 'allow' ? 'allow' : 'disallow';
      }
    } catch(_) { AI_BOTS.forEach(b => { robotsBots[b] = 'check_failed'; }); }
    let schemaTypes = [], hasSameAs = false, hasOgTags = false;
    try {
      const html = await fetch('https://ledsone.co.uk/', {
        headers: { 'User-Agent': 'ClaudeBot/1.0' },
        signal: AbortSignal.timeout(8000),
      }).then(r => r.text());
      const ldBlocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
      for (const m of ldBlocks) {
        try {
          const obj = JSON.parse(m[1]);
          const types = Array.isArray(obj) ? obj.map(o => o['@type']) : [obj['@type']];
          schemaTypes.push(...types.filter(Boolean));
          if (JSON.stringify(obj).includes('"sameAs"')) hasSameAs = true;
        } catch(_) {}
      }
      hasOgTags = /property=["']og:title["']/.test(html);
    } catch(_) {}
    const cl = (k) => checklist.find(c => c.item_key === k)?.done || false;
    const authorityScore = parseInt(bl.authority_score) || 0;
    const refDomains     = parseInt(bl.referring_domains) || 0;
    const orgKws         = parseInt(hist.organic_keywords) || 0;
    const top3           = parseInt(kw.top3) || 0;
    const trafficEst     = parseInt(hist.traffic_est) || 0;
    const allowedBots    = Object.values(robotsBots).filter(v => v === 'allow').length;
    const hasFaqSchema   = schemaTypes.includes('FAQPage') || cl('faqpage_schema');
    const hasAggRating   = schemaTypes.includes('AggregateRating') || cl('aggregate_rating');
    const hasOrgSchema   = schemaTypes.some(t => t === 'Organization' || t === 'WebSite');
    const hasSameAsFinal = hasSameAs || cl('sameas_org');
    let dim_crawler  = Math.min(10, allowedBots * 2);
    let dim_auth     = authorityScore >= 50 ? 9 : authorityScore >= 40 ? 7 : authorityScore >= 30 ? 4 : authorityScore >= 20 ? 2 : 1;
    if (refDomains < 700) dim_auth = Math.max(1, dim_auth - 1);
    let dim_entity   = 2 + (hasOrgSchema ? 2 : 0) + (hasSameAsFinal ? 2 : 0) + (cl('wikidata_entity') ? 2 : 0) + (hasOgTags ? 1 : 0);
    dim_entity       = Math.min(10, dim_entity);
    let dim_content  = 3 + (orgKws >= 10000 ? 2 : orgKws >= 5000 ? 1 : 0) + (top3 >= 100 ? 2 : top3 >= 50 ? 1 : 0) + (hasFaqSchema ? 2 : 0);
    dim_content      = Math.min(10, dim_content);
    let dim_eeat     = 2 + (hasAggRating ? 2 : 0) + (cl('author_schema') ? 2 : 0) + (cl('credentials_schema') ? 2 : 0);
    dim_eeat         = Math.min(10, dim_eeat);
    let dim_foot     = 2 + (orgKws >= 10000 ? 3 : orgKws >= 5000 ? 2 : 0) + (top3 >= 100 ? 2 : top3 >= 50 ? 1 : 0) + (trafficEst >= 5000 ? 2 : 0);
    dim_foot         = Math.min(10, dim_foot);
    let dim_schema   = 1 + (hasOrgSchema ? 1 : 0) + (hasOgTags ? 1 : 0) + (hasFaqSchema ? 3 : 0) + (hasAggRating ? 2 : 0) + (hasSameAsFinal ? 1 : 0);
    dim_schema       = Math.min(10, dim_schema);
    const totalScore = Math.round((dim_crawler + dim_auth + dim_entity + dim_content + dim_eeat + dim_foot + dim_schema) / 70 * 100);
    return res.json({
      ok: true,
      score: totalScore,
      dimensions: [
        { key:'crawler_access',   label:'AI Crawler Access',    score:dim_crawler, max:10, details:{ bots:robotsBots } },
        { key:'authority',        label:'Domain Authority',      score:dim_auth,    max:10, details:{ authority_score:authorityScore, referring_domains:refDomains, total_backlinks:parseInt(bl.total_backlinks)||0 } },
        { key:'entity_clarity',   label:'Brand Entity Clarity',  score:dim_entity,  max:10, details:{ has_org_schema:hasOrgSchema, has_sameas:hasSameAsFinal, has_wikidata:cl('wikidata_entity'), has_og_tags:hasOgTags } },
        { key:'content_format',   label:'Content & Format',      score:dim_content, max:10, details:{ organic_keywords:orgKws, top3_keywords:top3, has_faq_schema:hasFaqSchema } },
        { key:'eeat',             label:'E-E-A-T Signals',       score:dim_eeat,    max:10, details:{ has_agg_rating:hasAggRating, has_author_schema:cl('author_schema') } },
        { key:'organic_footprint',label:'Organic Footprint',     score:dim_foot,    max:10, details:{ organic_keywords:orgKws, top3_keywords:top3, traffic_est:trafficEst } },
        { key:'structured_data',  label:'Structured Data',       score:dim_schema,  max:10, details:{ schema_types:schemaTypes, has_faq:hasFaqSchema, has_agg_rating:hasAggRating, has_sameas:hasSameAsFinal } },
      ],
      checklist,
      robots: robotsBots,
      schema_types: schemaTypes,
    });
  } catch (err) {
    return errResponse(res, err);
  } finally {
    try { await nc.end(); } catch(_) {}
  }
}

/* ─── SEO main sub-handler ──────────────────────────────────── */

async function handleSEO(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const module_ = (req.query.module || '').trim();
  const type    = (req.query.type   || '').trim();
  const DB_URL  = process.env.DATABASE_URL;
  if (!DB_URL) return res.status(500).json({ ok:false, cause:'no_db_url', error:'DATABASE_URL not set' });
  const from = req.query.from || '2026-03-20';
  const to   = req.query.to   || new Date().toISOString().slice(0,10);
  const client = makeSeoClient(DB_URL);
  try {
    await client.connect();
    switch (module_) {
      case 'exec':
        switch (type) {
          case 'gsc-monthly':   return await handleGscMonthly(client, res);
          case 'gsc-weekly':    return await handleGscWeekly(client, res);
          case 'position-dist': return await handlePositionDist(client, res);
          case 'ads-monthly':   return await handleAdsMonthly(client, res);
          case 'data-quality':  return await handleDataQuality(client, res);
          default: return res.status(400).json({ ok:false, error:`exec: unknown type "${type}"` });
        }
      case 'products':
        switch (type) {
          case 'pages':    return await handleProductPages(client, res, from, to);
          case 'listings': return await handleListings(client, res);
          default: return res.status(400).json({ ok:false, error:`products: unknown type "${type}"` });
        }
      case 'keywords':
        switch (type) {
          case 'top':         return await handleKwTop(client, res, from, to);
          case 'opportunity': return await handleKwOpportunity(client, res, from, to);
          case 'rising':      return await handleKwMovers(client, res, 'rising');
          case 'declining':   return await handleKwMovers(client, res, 'declining');
          case 'kw-history':  return await handleKwHistory(client, res, req.query.q);
          case 'rank-dist':   return await handleRankDist(client, res, from, to);
          default: return res.status(400).json({ ok:false, error:`keywords: unknown type "${type}"` });
        }
      case 'landing':
        switch (type) {
          case 'pages':      return await handleLpPages(client, res, from, to);
          case 'by-type':    return await handleLpByType(client, res, from, to);
          case 'top-pages':  return await handleLpMoM(client, res);
          case 'page-trend': return await handleLpPageTrend(client, res, req.query.page);
          default: return res.status(400).json({ ok:false, error:`landing: unknown type "${type}"` });
        }
      case 'actions':
        switch (type) {
          case 'priorities': return await handleActionPriorities(client, res, from, to);
          default: return res.status(400).json({ ok:false, error:`actions: unknown type "${type}"` });
        }
      case 'technical':
        switch (type) {
          case 'coverage':         return await handleTechCoverage(client, res, from, to);
          case 'cannibalization':  return await handleTechCannib(client, res, from, to);
          case 'zero-click':       return await handleTechZeroClick(client, res, from, to);
          case 'cwv':              return await handleCwv(res, req.query.strategy);
          default: return res.status(400).json({ ok:false, error:`technical: unknown type "${type}"` });
        }
      case 'semrush':
        await client.end();
        return await handleSemrush(type, res, req);
      case 'geo':
        await client.end();
        return await handleGeo(type, req.query, res);
      default:
        return res.status(400).json({ ok:false, error:`Unknown module "${module_}". Valid: exec, products, keywords, landing, actions, technical, semrush, geo` });
    }
  } catch (err) {
    return errResponse(res, err);
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GERMANY SERVICE
// ══════════════════════════════════════════════════════════════════════════════

function makeGermanyClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    statement_timeout: 55000,
  });
}

const EBAY_ACCOUNTS = [
  { id: 1,   name: 'led_sone' },
  { id: 4,   name: 'sunsone' },
  { id: 22,  name: 'electricalsone' },
  { id: 27,  name: 'ledsonede' },
  { id: 28,  name: 'huettenlampen' },
  { id: 222, name: 'homin_gmbh' },
];

function ebayAccountCTEs(id) {
  return `
  raw_ebay_${id} AS (
    SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END AS base
    FROM listings.ebay_listings
    WHERE site = 'Germany' AND all_list = 1 AND sub_source = ${id} AND sku IS NOT NULL AND sku != ''
  ),
  ecov_${id} AS (
    SELECT DISTINCT unnest(string_to_array(base, '+')) AS covered_sku FROM raw_ebay_${id}
    UNION
    SELECT DISTINCT array_to_string(parts[1:n], '+') AS covered_sku
    FROM (SELECT base, string_to_array(base,'+') AS parts, generate_series(1,array_length(string_to_array(base,'+'),1)) AS n FROM raw_ebay_${id}) x
  )`;
}

async function handleMarketplaceGap(client, req, res) {
  const { rows } = await client.query(`
    WITH stock AS (
      SELECT p.sku, SUM(licsl.stock)::int AS st
      FROM inventory.products p
      JOIN inventory.local_inventory_current_stock_location_wise licsl ON licsl.inventory_id = p.id
      WHERE licsl.warehouse_location = 'Germany' AND licsl.stock > 0
      GROUP BY p.sku
    ),
    raw_amz AS (
      SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END AS base
      FROM listings.amazon_listings WHERE site = 'Germany' AND sku IS NOT NULL AND sku != ''
    ),
    amz_coverage AS (
      SELECT DISTINCT unnest(string_to_array(base, '+')) AS covered_sku FROM raw_amz
      UNION
      SELECT DISTINCT array_to_string(parts[1:n], '+') AS covered_sku
      FROM (SELECT base, string_to_array(base,'+') AS parts, generate_series(1,array_length(string_to_array(base,'+'),1)) AS n FROM raw_amz) x
    ),
    raw_ebay AS (
      SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END AS base
      FROM listings.ebay_listings WHERE site = 'Germany' AND all_list = 1 AND sku IS NOT NULL AND sku != ''
    ),
    ebay_coverage AS (
      SELECT DISTINCT unnest(string_to_array(base, '+')) AS covered_sku FROM raw_ebay
      UNION
      SELECT DISTINCT array_to_string(parts[1:n], '+') AS covered_sku
      FROM (SELECT base, string_to_array(base,'+') AS parts, generate_series(1,array_length(string_to_array(base,'+'),1)) AS n FROM raw_ebay) x
    ),
    raw_shop AS (
      SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END AS base
      FROM listings.shopify_listings WHERE site = 'Germany' AND all_list = 1 AND sku IS NOT NULL AND sku != ''
    ),
    shop_coverage AS (
      SELECT DISTINCT unnest(string_to_array(base, '+')) AS covered_sku FROM raw_shop
      UNION
      SELECT DISTINCT array_to_string(parts[1:n], '+') AS covered_sku
      FROM (SELECT base, string_to_array(base,'+') AS parts, generate_series(1,array_length(string_to_array(base,'+'),1)) AS n FROM raw_shop) x
    ),
    ${EBAY_ACCOUNTS.map(acc => ebayAccountCTEs(acc.id)).join(',')}
    SELECT
      s.sku AS s, s.st,
      MAX(CASE WHEN ac.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS a,
      MAX(CASE WHEN ec.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e,
      MAX(CASE WHEN sc.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS sh,
      MAX(CASE WHEN e1.covered_sku  IS NOT NULL THEN 1 ELSE 0 END)::int AS e1,
      MAX(CASE WHEN e4.covered_sku  IS NOT NULL THEN 1 ELSE 0 END)::int AS e4,
      MAX(CASE WHEN e22.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e22,
      MAX(CASE WHEN e27.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e27,
      MAX(CASE WHEN e28.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e28,
      MAX(CASE WHEN e222.covered_sku IS NOT NULL THEN 1 ELSE 0 END)::int AS e222
    FROM stock s
    LEFT JOIN amz_coverage   ac  ON ac.covered_sku  = s.sku
    LEFT JOIN ebay_coverage  ec  ON ec.covered_sku  = s.sku
    LEFT JOIN shop_coverage  sc  ON sc.covered_sku  = s.sku
    LEFT JOIN ecov_1         e1  ON e1.covered_sku  = s.sku
    LEFT JOIN ecov_4         e4  ON e4.covered_sku  = s.sku
    LEFT JOIN ecov_22        e22 ON e22.covered_sku = s.sku
    LEFT JOIN ecov_27        e27 ON e27.covered_sku = s.sku
    LEFT JOIN ecov_28        e28 ON e28.covered_sku = s.sku
    LEFT JOIN ecov_222       e222 ON e222.covered_sku = s.sku
    GROUP BY s.sku, s.st ORDER BY s.st DESC
  `);
  const total          = rows.length;
  const notAnywhere    = rows.filter(r => !r.a && !r.e && !r.sh).length;
  const missingAmazon  = rows.filter(r => !r.a).length;
  const missingEbay    = rows.filter(r => !r.e).length;
  const missingShopify = rows.filter(r => !r.sh).length;
  const allThree       = rows.filter(r => r.a && r.e && r.sh).length;
  const ebayAccounts = EBAY_ACCOUNTS.map(acc => {
    const col = 'e' + acc.id;
    return { id: acc.id, name: acc.name, listed: rows.filter(r => r[col] === 1).length, missing: rows.filter(r => r[col] === 0).length };
  });
  if (req.query.debug) {
    const drow = rows.find(r => r.s === req.query.debug);
    return res.status(200).json({ ok: true, debug_sku: req.query.debug, result: drow || null });
  }
  return res.status(200).json({
    ok: true,
    refreshed_at: new Date().toISOString(),
    summary: { total, notAnywhere, missingAmazon, missingEbay, missingShopify, allThree },
    ebayAccounts,
    rows,
  });
}

async function handleUkBundle(client, res) {
  const { rows } = await client.query(`
    WITH uk_bundles AS (
      SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END AS bundle_sku
      FROM listings.ebay_listings WHERE site = 'UK' AND sku LIKE '%+%' AND all_list = 1 AND sku IS NOT NULL AND sku != ''
      UNION
      SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END
      FROM listings.amazon_listings WHERE site = 'UK' AND sku LIKE '%+%' AND sku IS NOT NULL AND sku != ''
      UNION
      SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END
      FROM listings.shopify_listings WHERE site = 'UK' AND sku LIKE '%+%' AND all_list = 1 AND sku IS NOT NULL AND sku != ''
    ),
    de_bundles AS (
      SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END AS bundle_sku
      FROM listings.ebay_listings WHERE site = 'Germany' AND sku LIKE '%+%' AND all_list = 1 AND sku IS NOT NULL AND sku != ''
      UNION
      SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END
      FROM listings.amazon_listings WHERE site = 'Germany' AND sku LIKE '%+%' AND sku IS NOT NULL AND sku != ''
      UNION
      SELECT DISTINCT CASE WHEN sku LIKE '%-IDE' THEN LEFT(sku, LENGTH(sku)-4) ELSE sku END
      FROM listings.shopify_listings WHERE site = 'Germany' AND sku LIKE '%+%' AND all_list = 1 AND sku IS NOT NULL AND sku != ''
    ),
    de_stock AS (
      SELECT p.sku, SUM(licsl.stock)::int AS de_qty
      FROM inventory.products p
      JOIN inventory.local_inventory_current_stock_location_wise licsl ON licsl.inventory_id = p.id
      WHERE licsl.warehouse_location = 'Germany' AND licsl.stock > 0
      GROUP BY p.sku
    ),
    uk_components AS (
      SELECT ub.bundle_sku, unnest(string_to_array(ub.bundle_sku, '+')) AS component_sku FROM uk_bundles ub
    ),
    bundle_check AS (
      SELECT
        uc.bundle_sku,
        COUNT(uc.component_sku)::int AS tc,
        COUNT(ds.sku)::int AS fc,
        (COUNT(uc.component_sku) - COUNT(ds.sku))::int AS mc,
        bool_and(ds.sku IS NOT NULL) AS ready,
        array_agg(DISTINCT uc.component_sku ORDER BY uc.component_sku) AS components,
        array_remove(array_agg(CASE WHEN ds.sku IS NOT NULL THEN uc.component_sku END ORDER BY uc.component_sku), NULL) AS found,
        array_remove(array_agg(CASE WHEN ds.sku IS NULL THEN uc.component_sku END ORDER BY uc.component_sku), NULL) AS missing
      FROM uk_components uc
      LEFT JOIN de_stock ds ON ds.sku = uc.component_sku
      GROUP BY uc.bundle_sku
    )
    SELECT bc.bundle_sku AS b, bc.tc, bc.fc, bc.mc, bc.ready,
      CASE WHEN db.bundle_sku IS NOT NULL THEN 1 ELSE 0 END AS de_exists,
      bc.components, bc.found, bc.missing
    FROM bundle_check bc
    LEFT JOIN de_bundles db ON db.bundle_sku = bc.bundle_sku
    ORDER BY bc.ready DESC, bc.tc DESC, bc.bundle_sku
  `);
  const totalUK        = rows.length;
  const alreadyInDE    = rows.filter(r => r.de_exists === 1).length;
  const notInDE        = rows.filter(r => r.de_exists === 0).length;
  const readyForReview = rows.filter(r => r.de_exists === 0 && r.ready).length;
  const missingComps   = rows.filter(r => r.de_exists === 0 && !r.ready).length;
  const outputRows = rows.filter(r => r.de_exists === 0).map(r => ({
    b: r.b, tc: r.tc, fc: r.fc, mc: r.mc, ready: r.ready,
    components: r.components || [], found: r.found || [], missing: r.missing || [],
  }));
  return res.status(200).json({
    ok: true,
    refreshed_at: new Date().toISOString(),
    summary: { totalUK, alreadyInDE, notInDE, readyForReview, missingComps },
    rows: outputRows,
  });
}

async function handleGermany(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const type = req.query.type;
  if (!type) return res.status(400).json({ ok: false, error: 'Missing ?type= (marketplace-gap | uk-bundle)' });
  if (!['marketplace-gap', 'uk-bundle'].includes(type)) {
    return res.status(400).json({ ok: false, error: `Unknown type: ${type}` });
  }
  if (!process.env.DATABASE_URL) return res.status(500).json({ ok: false, error: 'DATABASE_URL not configured' });
  const client = makeGermanyClient();
  try {
    await client.connect();
    if (type === 'marketplace-gap') return await handleMarketplaceGap(client, req, res);
    if (type === 'uk-bundle')       return await handleUkBundle(client, res);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    await client.end().catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ORGANIC REVENUE SERVICE
// ══════════════════════════════════════════════════════════════════════════════

function makeOrganicClient() {
  return new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    statement_timeout: 30000,
  });
}

const PAGE_TYPE_SQL = `
  CASE
    WHEN landing_page = '/'                    THEN 'Home'
    WHEN landing_page LIKE '/products/%'       THEN 'Product'
    WHEN landing_page LIKE '/collections/%'    THEN 'Collection'
    WHEN landing_page LIKE '/blogs/%'          THEN 'Content'
    WHEN landing_page LIKE '/pages/%'          THEN 'Content'
    ELSE 'Other'
  END
`;

async function handleOrganicOverview(client, res) {
  const [totals, top10, latest] = await Promise.all([
    client.query(`
      SELECT
        SUM(sessions)::bigint             AS total_sessions,
        SUM(ecommerce_purchases)::bigint  AS total_orders,
        ROUND(SUM(purchase_revenue)::numeric, 2) AS total_revenue,
        COUNT(DISTINCT landing_page)::int AS total_pages,
        COUNT(DISTINCT CASE WHEN purchase_revenue > 0 THEN landing_page END)::int AS revenue_pages
      FROM google_analytics.organic_landing_page_revenue
      WHERE run_date = (SELECT MAX(run_date) FROM google_analytics.organic_landing_page_revenue)
        AND session_default_channel_group = 'Organic Search'
    `),
    client.query(`
      SELECT
        landing_page,
        ${PAGE_TYPE_SQL} AS page_type,
        SUM(sessions)::int                      AS sessions,
        SUM(ecommerce_purchases)::int           AS orders,
        ROUND(SUM(purchase_revenue)::numeric,2) AS revenue,
        ROUND(SUM(purchase_revenue) / NULLIF(SUM(sessions),0)::numeric, 4) AS rev_per_session,
        ROUND(SUM(purchase_revenue) / NULLIF(SUM(ecommerce_purchases),0)::numeric, 2) AS avg_order_value
      FROM google_analytics.organic_landing_page_revenue
      WHERE run_date = (SELECT MAX(run_date) FROM google_analytics.organic_landing_page_revenue)
        AND session_default_channel_group = 'Organic Search'
        AND purchase_revenue > 0
      GROUP BY landing_page
      ORDER BY SUM(purchase_revenue) DESC
      LIMIT 10
    `),
    client.query(`
      SELECT
        MAX(run_date)::date   AS last_updated,
        MAX(date_end)::date   AS data_through,
        MIN(date_start)::date AS data_from
      FROM google_analytics.organic_landing_page_revenue
    `),
  ]);
  const t = totals.rows[0] || {};
  const meta = latest.rows[0] || {};
  return res.status(200).json({
    ok: true,
    meta: { last_updated: meta.last_updated, data_through: meta.data_through, data_from: meta.data_from },
    totals: {
      total_sessions:  t.total_sessions,
      total_orders:    t.total_orders,
      total_revenue:   t.total_revenue,
      total_pages:     t.total_pages,
      revenue_pages:   t.revenue_pages,
      rev_per_session: t.total_sessions > 0 ? (parseFloat(t.total_revenue) / parseInt(t.total_sessions)).toFixed(4) : '0',
      avg_order_value: t.total_orders > 0 ? (parseFloat(t.total_revenue) / parseInt(t.total_orders)).toFixed(2) : '0',
    },
    top10: top10.rows,
  });
}

async function handleOrganicByPage(client, res) {
  const { rows } = await client.query(`
    SELECT
      landing_page,
      ${PAGE_TYPE_SQL} AS page_type,
      SUM(sessions)::int                      AS sessions,
      SUM(active_users)::int                  AS active_users,
      SUM(ecommerce_purchases)::int           AS orders,
      ROUND(SUM(purchase_revenue)::numeric,2) AS revenue,
      ROUND(SUM(purchase_revenue) / NULLIF(SUM(sessions),0)::numeric, 4) AS rev_per_session,
      ROUND(SUM(purchase_revenue) / NULLIF(SUM(ecommerce_purchases),0)::numeric, 2) AS avg_order_value,
      MAX(run_date)::date AS last_seen
    FROM google_analytics.organic_landing_page_revenue
    WHERE run_date = (SELECT MAX(run_date) FROM google_analytics.organic_landing_page_revenue)
      AND session_default_channel_group = 'Organic Search'
    GROUP BY landing_page
    ORDER BY SUM(purchase_revenue) DESC
    LIMIT 1000
  `);
  return res.status(200).json({ ok: true, rows });
}

async function handleOrganicTrend(client, res) {
  const { rows } = await client.query(`
    SELECT
      DATE_TRUNC('month', run_date)::date      AS month,
      MAX(run_date)::date                      AS run_date,
      SUM(sessions)::int                       AS sessions,
      SUM(ecommerce_purchases)::int            AS orders,
      ROUND(SUM(purchase_revenue)::numeric, 2) AS revenue,
      COUNT(DISTINCT landing_page)::int        AS pages,
      COUNT(DISTINCT CASE WHEN purchase_revenue > 0 THEN landing_page END)::int AS revenue_pages
    FROM google_analytics.organic_landing_page_revenue
    WHERE session_default_channel_group = 'Organic Search'
    GROUP BY DATE_TRUNC('month', run_date)
    ORDER BY month ASC
  `);
  return res.status(200).json({ ok: true, rows });
}

async function handleOrganicByType(client, res) {
  const { rows } = await client.query(`
    SELECT
      ${PAGE_TYPE_SQL} AS page_type,
      SUM(sessions)::int                       AS sessions,
      SUM(ecommerce_purchases)::int            AS orders,
      ROUND(SUM(purchase_revenue)::numeric, 2) AS revenue,
      COUNT(DISTINCT landing_page)::int        AS pages,
      COUNT(DISTINCT CASE WHEN purchase_revenue > 0 THEN landing_page END)::int AS revenue_pages,
      ROUND(SUM(purchase_revenue) / NULLIF(SUM(sessions),0)::numeric, 4) AS rev_per_session,
      ROUND(SUM(purchase_revenue) / NULLIF(SUM(ecommerce_purchases),0)::numeric, 2) AS avg_order_value
    FROM google_analytics.organic_landing_page_revenue
    WHERE run_date = (SELECT MAX(run_date) FROM google_analytics.organic_landing_page_revenue)
      AND session_default_channel_group = 'Organic Search'
    GROUP BY page_type
    ORDER BY SUM(purchase_revenue) DESC
  `);
  return res.status(200).json({ ok: true, rows });
}

async function handleOrganic(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const type = req.query.type || 'overview';
  const client = makeOrganicClient();
  try {
    await client.connect();
    switch (type) {
      case 'overview': return await handleOrganicOverview(client, res);
      case 'by-page':  return await handleOrganicByPage(client, res);
      case 'trend':    return await handleOrganicTrend(client, res);
      case 'by-type':  return await handleOrganicByType(client, res);
      default:
        return res.status(400).json({ ok: false, error: `Unknown type "${type}". Valid: overview, by-page, trend, by-type` });
    }
  } catch (err) {
    return errResponse(res, err);
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ROUTER
// ══════════════════════════════════════════════════════════════════════════════

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const service = (req.query.service || '').trim();
  if (service === 'seo')     return handleSEO(req, res);
  if (service === 'germany') return handleGermany(req, res);
  if (service === 'organic') return handleOrganic(req, res);
  return res.status(400).json({ ok: false, error: 'Missing ?service= (seo|germany|organic)' });
};
