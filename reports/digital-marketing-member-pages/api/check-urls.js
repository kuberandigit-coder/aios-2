// Checks a small batch of URLs (the ones currently visible on a page of
// results) for liveness, so broken/404 links can be filtered out of the
// displayed table. Deliberately scoped to a caller-supplied batch rather
// than the full dataset — checking thousands of URLs live on every page
// load isn't feasible (timeouts, load on the origin site).
const MAX_URLS = 200;
const TIMEOUT_MS = 6000;
const CONCURRENCY = 10;

// Only 404/410 count as "broken" per the requirement ("do not add any 404
// broken links"). Any other non-2xx (403, 429, 503, etc.) is far more
// likely bot-protection/rate-limiting on the checking request itself
// (Vercel's serverless IPs get treated differently than a normal browser)
// than a genuinely dead page — so those are treated as "assume ok" to
// avoid false positives wiping out real, live pages.
const BROKEN_STATUSES = [404, 410];

async function checkOne(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timer);
    return { url, ok: !BROKEN_STATUSES.includes(res.status), status: res.status };
  } catch (e) {
    clearTimeout(timer);
    // Network error / timeout: don't assume broken, just report unknown-ok
    // so a slow/flaky check never hides a page that's actually fine.
    return { url, ok: true, status: null, checkError: e.message };
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const urls = Array.isArray(body.urls) ? body.urls.slice(0, MAX_URLS) : [];

    const results = [];
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(checkOne));
      results.push(...batchResults);
    }

    const statusByUrl = {};
    results.forEach((r) => { statusByUrl[r.url] = r.ok; });

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.status(200).json({ statusByUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
