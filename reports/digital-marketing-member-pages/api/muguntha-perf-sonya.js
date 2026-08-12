// api/muguntha-perf-sonya.js — batched Performance-tab data for Sonya
// (muguntha.html "Performance" tab). Pilot for the snapshot-batching
// approach, added 2026-08-12: instead of the browser firing ~40 separate
// HTTP requests (one per month per data-type — see loadAll() in
// muguntha.html), this single endpoint calls the exact same handler
// modules (api/salesuk.js, api/sales25.js, api/muguntha.js) in-process
// for every month and returns everything in one response.
//
// This does NOT duplicate any business logic (static-snapshot fast path,
// order-override patching, DM-cost fallback rules) — it reuses the real
// handler functions unchanged by invoking them with a synthetic
// req/res pair and capturing the JSON they would have sent, so behaviour
// stays identical to calling each endpoint directly.

const salesukHandler = require('./salesuk.js');
const sales25Handler = require('./sales25.js');
const mugunthaHandler = require('./muguntha.js');

const MONTHS_2025 = ['2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12'];
const MONTHS_2026 = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'];

// Calls a handler(req, res) function in-process and resolves with whatever
// JSON payload it would have sent to the client, instead of an actual HTTP
// round trip.
function callInProcess(handlerFn, query) {
  return new Promise((resolve, reject) => {
    const fakeReq = { query };
    let statusCode = 200;
    const fakeRes = {
      setHeader() {},
      status(code) { statusCode = code; return fakeRes; },
      json(data) { resolve({ statusCode, data }); },
    };
    Promise.resolve(handlerFn(fakeReq, fakeRes)).catch(reject);
  });
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(new Array(Math.min(limit, items.length)).fill(0).map(worker));
  return results;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const forceRefresh = req.query && req.query.refresh === '1';
  const member = 'sonya';

  try {
    const [sales25Arr, sales26Arr, cost25Arr, cost26Arr] = await Promise.all([
      mapLimit(MONTHS_2025, 20, (m) =>
        callInProcess(sales25Handler, { group: member, month: m })),
      mapLimit(MONTHS_2026, 20, (m) =>
        callInProcess(salesukHandler, { group: member, month: m, refresh: (forceRefresh && m === '2026-08') ? '1' : undefined })),
      mapLimit(MONTHS_2025, 20, (m) =>
        callInProcess(mugunthaHandler, { employee: member, month: m })),
      mapLimit(MONTHS_2026, 20, (m) =>
        callInProcess(mugunthaHandler, { employee: member, month: m, refresh: (forceRefresh && m === '2026-08') ? '1' : undefined })),
    ]);

    const sales25ByMonth = {}, sales26ByMonth = {}, cost25ByMonth = {}, cost26ByMonth = {};
    MONTHS_2025.forEach((m, i) => {
      const r = sales25Arr[i];
      sales25ByMonth[m] = (r.statusCode === 200 && r.data.success !== false && r.data.combinedSummary) ? r.data.combinedSummary.netSales : null;
      cost25ByMonth[m] = (cost25Arr[i].statusCode === 200 && cost25Arr[i].data.success !== false) ? cost25Arr[i].data : null;
    });
    MONTHS_2026.forEach((m, i) => {
      const r = sales26Arr[i];
      sales26ByMonth[m] = (r.statusCode === 200 && r.data.success !== false && r.data.combinedSummary) ? r.data.combinedSummary.netSales : null;
      cost26ByMonth[m] = (cost26Arr[i].statusCode === 200 && cost26Arr[i].data.success !== false) ? cost26Arr[i].data : null;
    });

    res.status(200).json({
      success: true,
      member,
      sales25ByMonth,
      sales26ByMonth,
      cost25ByMonth,
      cost26ByMonth,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
};
