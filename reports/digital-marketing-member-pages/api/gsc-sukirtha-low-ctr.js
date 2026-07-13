const crypto = require('crypto');

const SITE_URL = 'https://ledsone.de/';
const SCOPE_PATTERNS = ['/collections/', '/blogs/', '/blog/'];
const CTR_THRESHOLD = 0.015;

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function loadKey() {
  const raw = process.env.GSC_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GSC_SERVICE_ACCOUNT_KEY env var not set');
  return JSON.parse(raw);
}

async function getAccessToken(key) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claim));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(key.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = unsigned + '.' + signature;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token request failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function queryGSC(token, startDate, endDate, dimensions = ['page']) {
  const rows = [];
  let startRow = 0;
  let firstIncompleteDate = null;
  const rowLimit = 25000;
  for (;;) {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        // dataState:'all' includes fresh/provisional days Google hasn't fully
        // finalized yet (matches the GSC UI's default view) instead of only
        // fully-settled data — cuts the effective reporting lag from ~3 days
        // to ~1 day. metadata.firstIncompleteDate tells us which days are
        // still provisional so we can disclose that honestly in the UI.
        body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, startRow, dataState: 'all' })
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GSC API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const batch = data.rows || [];
    rows.push(...batch);
    if (data.metadata && data.metadata.firstIncompleteDate) firstIncompleteDate = data.metadata.firstIncompleteDate;
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }
  rows.firstIncompleteDate = firstIncompleteDate;
  return rows;
}

function inScope(url) {
  return SCOPE_PATTERNS.some((p) => url.includes(p));
}

function typeOf(url) {
  if (url.includes('/collections/')) return 'Collection';
  if (url.includes('/blogs/') || url.includes('/blog/')) return 'Blog';
  return 'Other';
}

// "Related" = noise URLs that aren't real, canonical Blog/Collection content:
// pagination, product pages nested under a collection path, blog tag/archive
// pages, and locale-variant duplicates of the canonical (no-prefix) URL.
function isRelated(url) {
  if (/[?&]page=\d+/i.test(url)) return true; // pagination, e.g. ?page=2
  if (url.includes('/products/')) return true; // product page nested under /collections/
  if (url.includes('/tagged/')) return true; // blog tag/archive listing
  if (/^https?:\/\/[^/]+\/[a-z]{2}\/(blogs|collections)\//i.test(url)) return true; // locale-prefixed duplicate, e.g. /da/blogs/...
  return false;
}

module.exports = async (req, res) => {
  try {
    const fmt = (d) => d.toISOString().slice(0, 10);
    const isValidDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

    const requestEnd = new Date();
    requestEnd.setUTCDate(requestEnd.getUTCDate() - 1);

    let startDate, endDate;
    if (isValidDate(req.query.start) && isValidDate(req.query.end)) {
      startDate = req.query.start;
      endDate = req.query.end;
    } else {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 182, 1), 365);
      const start = new Date(requestEnd);
      start.setUTCDate(start.getUTCDate() - days);
      startDate = fmt(start);
      endDate = fmt(requestEnd);
    }

    const key = loadKey();
    const token = await getAccessToken(key);
    const allRows = await queryGSC(token, startDate, endDate);

    let realLatestDate = startDate;
    let firstIncompleteDate = null;
    try {
      const dateRows = await queryGSC(token, startDate, endDate, ['date']);
      for (const r of dateRows) {
        if (r.keys[0] > realLatestDate) realLatestDate = r.keys[0];
      }
      firstIncompleteDate = dateRows.firstIncompleteDate || null;
    } catch {
      realLatestDate = endDate;
    }
    // Last fully-finalized date = the day before Google's first still-provisional day.
    let finalDataThrough = realLatestDate;
    if (firstIncompleteDate) {
      const d = new Date(firstIncompleteDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      finalDataThrough = fmt(d);
    }

    const scoped = allRows
      .filter((r) => inScope(r.keys[0]))
      .map((r) => {
        const url = r.keys[0];
        const clicks = r.clicks;
        const impressions = r.impressions;
        const ctr = r.ctr;
        const position = r.position;
        return {
          url,
          type: typeOf(url),
          clicks,
          impressions,
          ctr: Math.round(ctr * 10000) / 100,
          position: Math.round(position * 10) / 10,
          lowCtr: ctr < CTR_THRESHOLD,
          status: ctr < CTR_THRESHOLD ? 'Low CTR' : 'OK',
          related: isRelated(url)
        };
      })
      .sort((a, b) => a.ctr - b.ctr);

    // Summary cards reflect clean canonical content only (related/noise
    // URLs excluded), since they're not real distinct SEO-relevant pages.
    const clean = scoped.filter((r) => !r.related);
    const totalClicks = clean.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = clean.reduce((s, r) => s + r.impressions, 0);
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;
    const lowCtrCount = clean.filter((r) => r.lowCtr).length;
    const collectionCount = clean.filter((r) => r.type === 'Collection').length;
    const blogCount = clean.filter((r) => r.type === 'Blog').length;
    const relatedCount = scoped.filter((r) => r.related).length;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: startDate,
        end: endDate,
        requested: endDate,
        latestAvailable: realLatestDate,
        finalDataThrough,
        firstIncompleteDate
      },
      summary: {
        totalPages: clean.length,
        collectionCount,
        blogCount,
        lowCtrCount,
        avgCtr,
        totalImpressions,
        totalClicks,
        relatedCount
      },
      pages: scoped
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
