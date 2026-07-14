// SUK-R4 — Core GA4 Data for SEO (ledsone.de)
// Server-side only: reads GA4_SERVICE_ACCOUNT_JSON + GA4_PROPERTY_ID from env,
// never exposed to the client. Read-only GA4 Data API + Search Console API
// calls only — no mutations, no writes to either Google product.

const GSC_SITE_URL = 'https://ledsone.de/';
const STORE_HOST = 'https://ledsone.de';
const DAYS = 30;

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Server not configured: GA4_SERVICE_ACCOUNT_JSON missing');
  const sa = JSON.parse(raw);
  const crypto = await import('node:crypto');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claims));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = unsigned + '.' + signature;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error('Google OAuth token error: ' + JSON.stringify(json));
  return json.access_token;
}

async function fetchGA4(accessToken, propertyId) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({
      dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'landingPage' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'engagementRate' },
        { name: 'userEngagementDuration' },
        { name: 'screenPageViewsPerSession' },
        { name: 'purchaseRevenue' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionDefaultChannelGroup',
          stringFilter: { matchType: 'EXACT', value: 'Organic Search' },
        },
      },
      limit: 100000,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('GA4 Data API error: ' + JSON.stringify(json));
  const rows = json.rows || [];
  return rows.map(r => {
    const landingPage = r.dimensionValues[0].value;
    const sessions = Number(r.metricValues[0].value) || 0;
    const users = Number(r.metricValues[1].value) || 0;
    const engagementRate = Number(r.metricValues[2].value) || 0;
    const userEngagementDuration = Number(r.metricValues[3].value) || 0;
    const pagesPerSession = Number(r.metricValues[4].value) || 0;
    const purchaseRevenue = Number(r.metricValues[5].value) || 0;
    return {
      landingPage,
      sessions,
      users,
      engagementRate,
      avgEngagementTimeSec: sessions > 0 ? userEngagementDuration / sessions : 0,
      pagesPerSession,
      purchaseRevenue,
    };
  });
}

async function fetchGSC(accessToken) {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({
      startDate: dateNDaysAgo(DAYS),
      endDate: dateNDaysAgo(0),
      dimensions: ['page', 'query'],
      rowLimit: 25000,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Search Console API error: ' + JSON.stringify(json));
  return json.rows || [];
}

function dateNDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function pathFromUrl(u) {
  try {
    const url = new URL(u, STORE_HOST);
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch (e) {
    return u;
  }
}

function pageType(path) {
  if (path === '/' || path === '') return 'Home';
  if (path.startsWith('/products/')) return 'Product';
  if (path.startsWith('/collections/')) return 'Collection';
  if (path.startsWith('/blogs/') || path.startsWith('/blog/')) return 'Blog';
  if (path.startsWith('/pages/')) return 'Page';
  return 'Other';
}

function fmtEngagementTime(sec) {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
      res.status(500).json({ error: 'Server not configured: GA4_PROPERTY_ID missing' });
      return;
    }
    if (!process.env.GA4_SERVICE_ACCOUNT_JSON) {
      res.status(500).json({ error: 'Server not configured: GA4_SERVICE_ACCOUNT_JSON missing' });
      return;
    }

    const accessToken = await getAccessToken();
    const [ga4Rows, gscRows] = await Promise.all([
      fetchGA4(accessToken, propertyId),
      fetchGSC(accessToken),
    ]);

    // Aggregate GSC by page path
    const gscByPage = new Map();
    for (const r of gscRows) {
      const [pageUrl, query] = r.keys;
      const path = pathFromUrl(pageUrl);
      if (!gscByPage.has(path)) gscByPage.set(path, { clicks: 0, impressions: 0, positionWeighted: 0, queries: [] });
      const agg = gscByPage.get(path);
      agg.clicks += r.clicks;
      agg.impressions += r.impressions;
      agg.positionWeighted += r.position * r.impressions;
      agg.queries.push({ query, clicks: r.clicks, impressions: r.impressions });
    }

    const retrievedAt = new Date().toISOString();
    const seenPaths = new Set();
    const rows = ga4Rows.map(g => {
      const path = pathFromUrl(g.landingPage);
      seenPaths.add(path);
      const gsc = gscByPage.get(path);
      const topQuery = gsc && gsc.queries.length
        ? gsc.queries.slice().sort((a, b) => b.clicks - a.clicks)[0].query
        : null;
      const clicks = gsc ? gsc.clicks : 0;
      const impressions = gsc ? gsc.impressions : 0;
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const avgPosition = gsc && gsc.impressions > 0 ? gsc.positionWeighted / gsc.impressions : null;
      return {
        landingPage: path,
        pageType: pageType(path),
        topQuery,
        sessions: g.sessions,
        users: g.users,
        engagementRate: g.engagementRate,
        avgEngagementTimeSec: g.avgEngagementTimeSec,
        avgEngagementTimeLabel: fmtEngagementTime(g.avgEngagementTimeSec),
        pagesPerSession: g.pagesPerSession,
        purchaseRevenue: g.purchaseRevenue,
        clicks,
        impressions,
        ctr,
        avgPosition,
        url: STORE_HOST + path,
        retrievedAt,
      };
    });

    const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
    const totalUsers = rows.reduce((s, r) => s + r.users, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.purchaseRevenue, 0);
    const avgEngagementRate = rows.length ? rows.reduce((s, r) => s + r.engagementRate, 0) / rows.length : 0;
    const avgEngagementTimeSec = rows.length ? rows.reduce((s, r) => s + r.avgEngagementTimeSec, 0) / rows.length : 0;
    const avgPagesPerSession = rows.length ? rows.reduce((s, r) => s + r.pagesPerSession, 0) / rows.length : 0;
    const distinctQueries = new Set(gscRows.map(r => r.keys[1]));

    const summary = {
      retrievedAt,
      dateRangeStart: dateNDaysAgo(DAYS),
      dateRangeEnd: dateNDaysAgo(0),
      days: DAYS,
      ga4Property: propertyId,
      gscProperty: GSC_SITE_URL,
      organicSessions: totalSessions,
      organicUsers: totalUsers,
      landingPages: rows.length,
      queries: distinctQueries.size,
      purchaseRevenue: totalRevenue,
      avgEngagementRate,
      avgEngagementTimeSec,
      avgEngagementTimeLabel: fmtEngagementTime(avgEngagementTimeSec),
      avgPagesPerSession,
    };

    res.status(200).json({ summary, rows });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
