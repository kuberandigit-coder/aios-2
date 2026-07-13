const crypto = require('crypto');

const SITE_URL = 'sc-domain:ledsone.co.uk';
const SCOPE_PATTERNS = ['/collections/', '/blogs/', '/blog/'];
const CTR_THRESHOLD = 0.02;

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
  const rowLimit = 25000;
  for (;;) {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, startRow })
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GSC API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const batch = data.rows || [];
    rows.push(...batch);
    if (batch.length < rowLimit) break;
    startRow += rowLimit;
  }
  return rows;
}

function inScope(url) {
  return SCOPE_PATTERNS.some((p) => url.includes(p));
}

module.exports = async (req, res) => {
  try {
    const fmt = (d) => d.toISOString().slice(0, 10);
    const isValidDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

    // Ask Google for through yesterday — GSC silently returns only what it actually has,
    // so requesting the tightest possible window means new data shows up the moment
    // Google publishes it, instead of waiting an extra artificial buffer.
    const requestEnd = new Date();
    requestEnd.setUTCDate(requestEnd.getUTCDate() - 1);

    let startDate, endDate;
    if (isValidDate(req.query.start) && isValidDate(req.query.end)) {
      startDate = req.query.start;
      endDate = req.query.end;
    } else {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 180, 1), 365);
      const start = new Date(requestEnd);
      start.setUTCDate(start.getUTCDate() - days);
      startDate = fmt(start);
      endDate = fmt(requestEnd);
    }

    const key = loadKey();
    const token = await getAccessToken(key);
    const allRows = await queryGSC(token, startDate, endDate);

    // Ask Google what the actual most-recent date with data is (cheap, single 'date' dimension
    // query) so the UI can report the real cutoff instead of guessing at a fixed lag.
    let realLatestDate = startDate;
    try {
      const dateRows = await queryGSC(token, startDate, endDate, ['date']);
      for (const r of dateRows) {
        if (r.keys[0] > realLatestDate) realLatestDate = r.keys[0];
      }
    } catch {
      realLatestDate = endDate;
    }

    const scoped = allRows
      .filter((r) => inScope(r.keys[0]))
      .map((r) => {
        const url = r.keys[0];
        const clicks = r.clicks;
        const impressions = r.impressions;
        const ctr = r.ctr;
        const position = r.position;
        const isCollection = url.includes('/collections/');
        const isBlog = url.includes('/blogs/') || url.includes('/blog/');
        return {
          url,
          type: isCollection ? 'collection' : isBlog ? 'blog' : 'other',
          clicks,
          impressions,
          ctr: Math.round(ctr * 10000) / 100,
          position: Math.round(position * 10) / 10,
          lowCtr: ctr < CTR_THRESHOLD
        };
      });

    const totalClicks = scoped.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = scoped.reduce((s, r) => s + r.impressions, 0);
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;
    const lowCtrCount = scoped.filter((r) => r.lowCtr).length;
    const collectionCount = scoped.filter((r) => r.type === 'collection').length;
    const blogCount = scoped.filter((r) => r.type === 'blog').length;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      generatedAt: new Date().toISOString(),
      dateRange: { start: startDate, end: endDate, requested: endDate, latestAvailable: realLatestDate },
      summary: {
        totalPages: scoped.length,
        collectionCount,
        blogCount,
        lowCtrCount,
        avgCtr,
        totalImpressions,
        totalClicks
      },
      pages: scoped
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
