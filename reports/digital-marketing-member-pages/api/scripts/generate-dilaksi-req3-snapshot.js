#!/usr/bin/env node
/**
 * Hourly snapshot for Dilaksi Req3 (Pages for Removal). Runs from GitHub
 * Actions, NOT through the deployed Vercel API -- unlike the other snapshot
 * scripts, this one talks to Shopify/GA4/GSC directly, because the full
 * check (482 collection URLs, paced to avoid Shopify rate-limiting) takes
 * 5-7 minutes and Vercel functions here have a hard 300s execution limit
 * (see vercel.json). Confirmed 2026-07-23: even a caller with a long
 * timeout gets nothing back once Vercel kills the function at 300s.
 *
 * Needs these env vars (GitHub Actions secrets):
 *   SHOPIFY_UK_ADMIN_TOKEN
 *   GA4_SERVICE_ACCOUNT_JSON
 *
 * Referring Backlinks (Semrush) stays frozen -- read from
 * api/data/dilaksi-req3-backlinks-frozen.json (2026-07-03 build), same as
 * the live Vercel endpoint (fn=dilaksi-req3-live) already does.
 *
 * Usage: node api/scripts/generate-dilaksi-req3-snapshot.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'dilaksi-req3-live-snapshot.json');

const DILAKSI_UK_STORE_DOMAIN = 'ledsone.myshopify.com';
const DILAKSI_UK_API_VERSION = '2024-10';
const DILAKSI_STORE_HOST = 'https://ledsone.co.uk';
const DILAKSI_GA4_PROPERTY_ID = '408110563';
const DILAKSI_GSC_SITE_URL = 'sc-domain:ledsone.co.uk';

async function dilaksiUkShopifyGraphQL(query, variables) {
  const token = process.env.SHOPIFY_UK_ADMIN_TOKEN;
  if (!token) throw new Error('SHOPIFY_UK_ADMIN_TOKEN missing');
  const res = await fetch(`https://${DILAKSI_UK_STORE_DOMAIN}/admin/api/${DILAKSI_UK_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors || json));
  return json.data;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GA4_SERVICE_ACCOUNT_JSON missing');
  const sa = JSON.parse(raw);
  const crypto = require('node:crypto');

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

function dateNDaysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function fetchDilaksiGA4_365d(accessToken) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${DILAKSI_GA4_PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({
      dateRanges: [{ startDate: '365daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'landingPagePlusQueryString' }],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { matchType: 'EXACT', value: 'Organic Search' } } },
      limit: 100000,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('GA4 Data API error: ' + JSON.stringify(json));
  return json.rows || [];
}

async function fetchDilaksiGSC_365d(accessToken) {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(DILAKSI_GSC_SITE_URL)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
    body: JSON.stringify({ startDate: dateNDaysAgo(365), endDate: dateNDaysAgo(0), dimensions: ['page'], rowLimit: 25000 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Search Console API error: ' + JSON.stringify(json));
  return json.rows || [];
}

function dilaksiPathFromUrl(u) {
  try {
    const url = new URL(u, DILAKSI_STORE_HOST);
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch (e) {
    return u.split('?')[0] || u;
  }
}

const DILAKSI_R3_COLLECTIONS_QUERY = `
query($after: String) {
  collections(first: 100, after: $after) {
    edges { node { handle } }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchDilaksiCollectionsLive() {
  const handles = [];
  let after = null, hasNext = true;
  while (hasNext) {
    const data = await dilaksiUkShopifyGraphQL(DILAKSI_R3_COLLECTIONS_QUERY, { after });
    for (const edge of data.collections.edges) handles.push(edge.node.handle);
    hasNext = data.collections.pageInfo.hasNextPage;
    after = data.collections.pageInfo.endCursor;
  }
  return handles;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDilaksiCollectionStatuses(handles) {
  const results = new Map();
  for (const h of handles) {
    let status = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`${DILAKSI_STORE_HOST}/collections/${h}`);
        status = r.status;
        if (status === 429) { await sleep(1500 * (attempt + 1)); continue; }
        break;
      } catch (e) {
        status = 0;
        break;
      }
    }
    results.set(h, status);
    await sleep(120);
  }
  return results;
}

async function fetchDilaksiNavLinks() {
  const res = await fetch(DILAKSI_STORE_HOST);
  const html = await res.text();
  const headerMatch = /<header[\s\S]*?<\/header>/i.exec(html);
  const footerMatch = /<footer[\s\S]*?<\/footer>/i.exec(html);
  return { headerHtml: headerMatch ? headerMatch[0] : '', footerHtml: footerMatch ? footerMatch[0] : '' };
}

async function main() {
  console.log('Starting Dilaksi Req3 snapshot (this takes 5-7 minutes)...');
  const started = Date.now();

  const backlinksMap = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'dilaksi-req3-backlinks-frozen.json'), 'utf8'));
  const accessToken = await getAccessToken();
  const handles = await fetchDilaksiCollectionsLive();
  console.log(`Found ${handles.length} collections. Checking live status (paced)...`);

  const [ga4Rows, gscRows, statusByHandle, navLinks] = await Promise.all([
    fetchDilaksiGA4_365d(accessToken),
    fetchDilaksiGSC_365d(accessToken),
    fetchDilaksiCollectionStatuses(handles),
    fetchDilaksiNavLinks(),
  ]);

  const ga4ByHandle = new Map();
  for (const r of ga4Rows) {
    const p = dilaksiPathFromUrl(r.dimensionValues[0].value);
    const m = /\/collections\/([^/]+)$/.exec(p);
    if (!m) continue;
    const sessions = Number(r.metricValues[0].value) || 0;
    ga4ByHandle.set(m[1], (ga4ByHandle.get(m[1]) || 0) + sessions);
  }
  const gscByHandle = new Map();
  for (const r of gscRows) {
    const p = dilaksiPathFromUrl(r.keys[0]);
    const m = /\/collections\/([^/]+)$/.exec(p);
    if (!m) continue;
    const impressions = Number(r.impressions) || 0;
    gscByHandle.set(m[1], (gscByHandle.get(m[1]) || 0) + impressions);
  }

  let liveCount = 0, totalSessions = 0, totalImpressions = 0, zeroSignal = 0;
  for (const h of handles) {
    const status = statusByHandle.get(h) || 0;
    if (status === 200) liveCount++;
    const sessions = ga4ByHandle.get(h) || 0;
    const impressions = gscByHandle.get(h) || 0;
    const backlinks = backlinksMap[h] || 0;
    totalSessions += sessions;
    totalImpressions += impressions;
    if (sessions === 0 && impressions === 0 && backlinks === 0) zeroSignal++;
  }

  const payload = {
    success: true,
    generatedAt: new Date().toISOString(),
    summary: {
      liveCollections: liveCount,
      totalCollections: handles.length,
      organicSessions12m: totalSessions,
      gscImpressions12m: totalImpressions,
      zeroSignalCollections: zeroSignal,
    },
    note: 'Referring Backlinks is a frozen snapshot (Semrush not fetched live) from 2026-07-03; all other fields are live as of generatedAt. Generated by a GitHub Actions job (not Vercel) because the full 482-URL check exceeds Vercel\'s 300s function limit.',
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`Done in ${mins}min. Summary:`, payload.summary);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
});
