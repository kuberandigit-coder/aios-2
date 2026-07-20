// Merged GSC low-CTR endpoint — serves both UK (Kamsi) and DE (Sukirtha)
// via ?store=uk|de, to stay under the Vercel Hobby-plan 12-function cap.
// Per-store constants/logic below are unchanged copies of the two
// endpoints this replaces (gsc-low-ctr.js store=uk, gsc-sukirtha-low-ctr.js
// store=de) — behavior for existing callers is identical.
const crypto = require('crypto');

const STORE_CONFIG = {
  uk: {
    siteUrl: 'sc-domain:ledsone.co.uk',
    ctrThreshold: 0.02,
    defaultDays: 180,
    extendedFields: false,
  },
  de: {
    siteUrl: 'https://ledsone.de/',
    ctrThreshold: 0.015,
    defaultDays: 182,
    extendedFields: true,
  },
};

const SCOPE_PATTERNS = ['/collections/', '/blogs/', '/blog/'];

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

async function queryGSC(token, siteUrl, startDate, endDate, dimensions = ['page']) {
  const rows = [];
  let startRow = 0;
  let firstIncompleteDate = null;
  const rowLimit = 25000;
  for (;;) {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
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

function typeOfDe(url) {
  if (url.includes('/collections/')) return 'Collection';
  if (url.includes('/blogs/') || url.includes('/blog/')) return 'Blog';
  return 'Other';
}

const RELATED_REASONS = [
  { key: 'pagination', label: 'Pagination (?page= / ?ccp-page=)', test: (u) => /[?&][a-z-]*page=\d+/i.test(u) },
  { key: 'product', label: 'Product pages (/products/)', test: (u) => u.includes('/products/') },
  { key: 'tagged', label: 'Blog tag pages (/tagged/)', test: (u) => u.includes('/tagged/') },
  { key: 'locale', label: 'Locale duplicates (/xx/...)', test: (u) => /^https?:\/\/[^/]+\/[a-z]{2}\/(blogs|collections)\//i.test(u) },
  { key: 'filter', label: 'Faceted filter query (?filter.)', test: (u) => /[?&]filter\./i.test(u) },
  { key: 'facetAll', label: '"/collections/all/<tag>" facet views', test: (u) => /\/collections\/all\//i.test(u) },
  { key: 'nestedCollection', label: 'Nested collection sub-paths (/collections/a/b)', test: (u) => /^https?:\/\/[^/]+\/collections\/[^/?]+\/[^/?]+/i.test(u) },
  { key: 'searchQuery', label: 'Search query filter (?q=)', test: (u) => /[?&]q=/i.test(u) },
  { key: 'recTracking', label: 'Recommendation-widget tracking (pr_*)', test: (u) => /[?&]pr_[a-z_]+=/i.test(u) }
];

function relatedReasonOf(url) {
  for (const r of RELATED_REASONS) {
    if (r.test(url)) return r.key;
  }
  return null;
}

module.exports = async (req, res) => {
  try {
    const store = (req.query.store === 'de') ? 'de' : 'uk';
    const cfg = STORE_CONFIG[store];

    const fmt = (d) => d.toISOString().slice(0, 10);
    const isValidDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

    const requestEnd = new Date();
    requestEnd.setUTCDate(requestEnd.getUTCDate() - 1);

    let startDate, endDate;
    if (isValidDate(req.query.start) && isValidDate(req.query.end)) {
      startDate = req.query.start;
      endDate = req.query.end;
    } else {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || cfg.defaultDays, 1), 365);
      const start = new Date(requestEnd);
      start.setUTCDate(start.getUTCDate() - days);
      startDate = fmt(start);
      endDate = fmt(requestEnd);
    }

    const key = loadKey();
    const token = await getAccessToken(key);
    const allRows = await queryGSC(token, cfg.siteUrl, startDate, endDate);

    let realLatestDate = startDate;
    let firstIncompleteDate = null;
    try {
      const dateRows = await queryGSC(token, cfg.siteUrl, startDate, endDate, ['date']);
      for (const r of dateRows) {
        if (r.keys[0] > realLatestDate) realLatestDate = r.keys[0];
      }
      firstIncompleteDate = dateRows.firstIncompleteDate || null;
    } catch {
      realLatestDate = endDate;
    }
    let finalDataThrough = realLatestDate;
    if (firstIncompleteDate) {
      const d = new Date(firstIncompleteDate + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      finalDataThrough = fmt(d);
    }

    let scoped = allRows
      .filter((r) => inScope(r.keys[0]))
      .map((r) => {
        const url = r.keys[0];
        const clicks = r.clicks;
        const impressions = r.impressions;
        const ctr = r.ctr;
        const position = r.position;

        if (!cfg.extendedFields) {
          const isCollection = url.includes('/collections/');
          const isBlog = url.includes('/blogs/') || url.includes('/blog/');
          return {
            url,
            type: isCollection ? 'collection' : isBlog ? 'blog' : 'other',
            clicks,
            impressions,
            ctr: Math.round(ctr * 10000) / 100,
            position: Math.round(position * 10) / 10,
            lowCtr: ctr < cfg.ctrThreshold
          };
        }

        const relatedReason = relatedReasonOf(url);
        return {
          url,
          type: typeOfDe(url),
          clicks,
          impressions,
          ctr: Math.round(ctr * 10000) / 100,
          position: Math.round(position * 10) / 10,
          lowCtr: ctr < cfg.ctrThreshold,
          status: ctr < cfg.ctrThreshold ? 'Low CTR' : 'OK',
          related: relatedReason !== null,
          relatedReason
        };
      });

    if (cfg.extendedFields) {
      scoped = scoped.sort((a, b) => a.ctr - b.ctr);
    }

    const clean = cfg.extendedFields ? scoped.filter((r) => !r.related) : scoped;
    const totalClicks = clean.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = clean.reduce((s, r) => s + r.impressions, 0);
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;
    const lowCtrCount = clean.filter((r) => r.lowCtr).length;
    const collectionCount = clean.filter((r) => r.type === 'collection' || r.type === 'Collection').length;
    const blogCount = clean.filter((r) => r.type === 'blog' || r.type === 'Blog').length;
    const relatedCount = cfg.extendedFields ? scoped.filter((r) => r.related).length : undefined;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    const summary = {
      totalPages: clean.length,
      collectionCount,
      blogCount,
      lowCtrCount,
      avgCtr,
      totalImpressions,
      totalClicks,
    };
    if (cfg.extendedFields) summary.relatedCount = relatedCount;

    const payload = {
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: startDate,
        end: endDate,
        requested: endDate,
        latestAvailable: realLatestDate,
        finalDataThrough,
        firstIncompleteDate
      },
      summary,
      pages: scoped
    };
    if (cfg.extendedFields) payload.relatedReasons = RELATED_REASONS.map((r) => ({ key: r.key, label: r.label }));

    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
