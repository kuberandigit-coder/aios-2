// Kamsi live data — Requirements 1, 5, 6 (ledsone.co.uk), merged into one
// serverless function (?req=1|5|6) to stay under the Vercel Hobby-plan
// 12-function cap. Each branch below is an unchanged copy of the logic
// from the original separate files (kamsi-req1-slow-moving-products.js,
// kamsi-req5-missing-meta-detection.js, kamsi-req6-duplicate-price-check.js).
// Server-side only: reads SHOPIFY_UK_ADMIN_TOKEN from env, never exposed to
// the client. Read-only Admin GraphQL calls only — no mutations.

const STORE_DOMAIN = process.env.SHOPIFY_UK_STORE_DOMAIN || 'ledsone.myshopify.com';
const API_VERSION = process.env.SHOPIFY_UK_API_VERSION || '2024-10';
const TOKEN = process.env.SHOPIFY_UK_ADMIN_TOKEN;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shopifyGraphQL(query, variables) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (e) {
      await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
      continue;
    }
    if (res.status === 429 || (res.status >= 500 && res.status <= 504)) {
      await sleep(500 * Math.pow(2, attempt) + Math.random() * 250);
      continue;
    }
    if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
    const json = await res.json();
    const throttled = json.errors && Array.isArray(json.errors) && json.errors.some(e => e.extensions && e.extensions.code === 'THROTTLED');
    if (throttled) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    if (json.errors) throw new Error('Shopify GraphQL error: ' + JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error('Shopify API: exceeded retries (throttling / transient errors)');
}

// ============================== Requirement 1 ==============================
const DAYS_R1 = 90;

const R1_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 50, after: $after) {
    edges {
      node {
        id
        title
        handle
        status
        productType
        updatedAt
        variants(first: 100) {
          edges {
            node {
              id
              title
              sku
              price
              inventoryItem {
                id
                tracked
                inventoryLevels(first: 5) {
                  edges {
                    node {
                      location { id name }
                      quantities(names: ["available"]) { name quantity }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const R1_ORDERS_QUERY = `
query($after: String, $q: String) {
  orders(first: 100, after: $after, query: $q) {
    edges {
      node {
        id
        createdAt
        cancelledAt
        test
        displayFinancialStatus
        lineItems(first: 100) {
          edges {
            node {
              sku
              quantity
              refundableQuantity
              variant { id }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchAllVariantsR1() {
  const variants = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R1_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      const p = edge.node;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const rawSku = (v.sku || '').toString().trim();
        const tracked = v.inventoryItem ? v.inventoryItem.tracked : false;
        const levels = v.inventoryItem ? v.inventoryItem.inventoryLevels.edges.map(e => e.node) : [];
        const currentStock = tracked
          ? levels.reduce((sum, l) => {
              const avail = l.quantities.find(q => q.name === 'available');
              return sum + (avail ? avail.quantity : 0);
            }, 0)
          : null;
        variants.push({
          productId: p.id,
          handle: p.handle,
          title: p.title,
          category: p.productType || 'Uncategorized',
          sku: rawSku,
          variantId: v.id,
          currentStock,
          inventoryTracked: tracked,
        });
      }
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return variants;
}

async function fetchUnitsSoldByVariantR1(startISO, endISO) {
  const q = `created_at:>=${startISO} AND created_at:<${endISO}`;
  const soldByVariant = new Map();
  const lastOrderDateByVariant = new Map();
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R1_ORDERS_QUERY, { after, q });
    for (const edge of data.orders.edges) {
      const o = edge.node;
      if (o.cancelledAt) continue;
      if (o.test) continue;
      if (o.displayFinancialStatus === 'VOIDED') continue;
      for (const liEdge of o.lineItems.edges) {
        const li = liEdge.node;
        if (!li.variant || !li.variant.id) continue;
        const netQty = typeof li.refundableQuantity === 'number' ? li.refundableQuantity : li.quantity;
        soldByVariant.set(li.variant.id, (soldByVariant.get(li.variant.id) || 0) + netQty);
        const prevDate = lastOrderDateByVariant.get(li.variant.id);
        if (!prevDate || o.createdAt > prevDate) {
          lastOrderDateByVariant.set(li.variant.id, o.createdAt);
        }
      }
    }
    hasNext = data.orders.pageInfo.hasNextPage;
    after = data.orders.pageInfo.endCursor;
  }
  return { soldByVariant, lastOrderDateByVariant };
}

async function handleReq1(req, res) {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - DAYS_R1 * 24 * 60 * 60 * 1000);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

  const [variants, { soldByVariant, lastOrderDateByVariant }] = await Promise.all([
    fetchAllVariantsR1(),
    fetchUnitsSoldByVariantR1(startISO, endISO),
  ]);

  const retrievedAt = new Date().toISOString();
  const rows = variants.map(v => {
    const unitsSold = soldByVariant.get(v.variantId) || 0;
    const lastOrderIso = lastOrderDateByVariant.get(v.variantId) || null;
    const stock = v.inventoryTracked && v.currentStock !== null ? v.currentStock : -1;
    const slow = (unitsSold < 10 && stock > 100) ? 1 : 0;
    return [v.sku, v.handle, v.title, v.category, unitsSold, stock, lastOrderIso ? lastOrderIso.slice(0, 10) : '—', slow];
  });

  const totalProducts = new Set(variants.map(v => v.productId)).size;
  const slowMovingCount = rows.filter(r => r[7] === 1).length;
  const stockInSlowMoving = rows.filter(r => r[7] === 1).reduce((s, r) => s + (r[5] > 0 ? r[5] : 0), 0);

  const summary = {
    retrievedAt,
    dateRangeStart: startISO,
    dateRangeEnd: endISO,
    days: DAYS_R1,
    totalProductsChecked: rows.length,
    totalDistinctProducts: totalProducts,
    slowMovingProducts: slowMovingCount,
    activeProducts: rows.length - slowMovingCount,
    stockInSlowMoving,
  };

  res.status(200).json({ summary, rows });
}

// ============================== Requirement 5 ==============================
const R5_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 100, after: $after) {
    edges {
      node {
        id
        title
        handle
        description
        productType
        updatedAt
        seo { title description }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchAllProductsR5() {
  const products = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R5_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      products.push(edge.node);
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return products;
}

function normalizeR5(s) {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/~\d+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function metaStatusR5(seoValue, sourceValue) {
  const seoTrim = (seoValue || '').trim();
  if (!seoTrim) return 'Missing';
  if (normalizeR5(seoValue) === normalizeR5(sourceValue)) return 'Auto-generated';
  return 'Custom';
}

function actionNeededR5(mts, mds) {
  const titleBad = mts !== 'Custom';
  const descBad = mds !== 'Custom';
  if (titleBad && descBad) return 'Add Custom Meta Title and Meta Description';
  if (titleBad) return 'Add Custom Meta Title';
  if (descBad) return 'Add Custom Meta Description';
  return 'OK';
}

async function handleReq5(req, res) {
  const products = await fetchAllProductsR5();
  const retrievedAt = new Date().toISOString();

  const rows = products.map(p => {
    const seoTitle = p.seo && p.seo.title ? p.seo.title : '';
    const seoDesc = p.seo && p.seo.description ? p.seo.description : '';
    const mts = metaStatusR5(seoTitle, p.title);
    const mds = metaStatusR5(seoDesc, p.description);
    return {
      u: '/products/' + p.handle,
      c: p.productType || 'Uncategorized',
      t: p.title,
      d: p.description || '',
      mt: seoTitle,
      md: seoDesc,
      mts,
      mds,
      tl: seoTitle.length,
      dl: seoDesc.length,
      a: actionNeededR5(mts, mds),
      lu: p.updatedAt,
    };
  });

  const summary = {
    retrievedAt,
    totalProductsChecked: rows.length,
    missingMetaTitle: rows.filter(r => r.mts === 'Missing').length,
    autoGeneratedMetaTitle: rows.filter(r => r.mts === 'Auto-generated').length,
    missingMetaDescription: rows.filter(r => r.mds === 'Missing').length,
    autoGeneratedMetaDescription: rows.filter(r => r.mds === 'Auto-generated').length,
    okProducts: rows.filter(r => r.a === 'OK').length,
  };

  res.status(200).json({ summary, rows });
}

// ============================== Requirement 6 ==============================
const R6_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 100, after: $after) {
    edges {
      node {
        id
        title
        handle
        status
        publishedAt
        updatedAt
        variants(first: 100) {
          edges {
            node {
              id
              sku
              price
              compareAtPrice
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function fetchAllVariantRowsR6() {
  const rows = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R6_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      const p = edge.node;
      const status = p.status === 'ACTIVE' && !p.publishedAt ? 'UNLISTED' : p.status;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const rawSku = (v.sku || '').toString().trim();
        rows.push({
          sku: rawSku,
          skuNorm: rawSku.toLowerCase(),
          missingSku: rawSku === '',
          url: '/products/' + p.handle,
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          compareAtPrice: v.compareAtPrice !== null && v.compareAtPrice !== undefined ? Number(v.compareAtPrice) : null,
          status,
        });
      }
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return rows;
}

async function handleReq6(req, res) {
  const variantRows = await fetchAllVariantRowsR6();
  const lc = new Date().toISOString().slice(0, 10);

  const groups = new Map();
  const blankRows = [];
  for (const r of variantRows) {
    if (r.missingSku) { blankRows.push(r); continue; }
    if (!groups.has(r.skuNorm)) groups.set(r.skuNorm, []);
    groups.get(r.skuNorm).push(r);
  }

  const rows = [];
  for (const [, list] of groups.entries()) {
    const isDuplicate = list.length > 1;
    const distinctPrices = new Set(list.filter(r => r.price !== null).map(r => r.price));
    const priceMismatch = isDuplicate && distinctPrices.size > 1;
    rows.push({
      s: list[0].sku,
      u: list[0].url,
      cp: list[0].price,
      xp: list[0].compareAtPrice,
      all: list.map(r => ({ u: r.url, cp: r.price, xp: r.compareAtPrice })),
      d: isDuplicate,
      dc: list.length,
      pm: priceMismatch,
      st: list[0].status,
      lc,
    });
  }
  for (const r of blankRows) {
    rows.push({
      s: r.sku,
      u: r.url,
      cp: r.price,
      xp: r.compareAtPrice,
      all: [{ u: r.url, cp: r.price, xp: r.compareAtPrice }],
      d: false,
      dc: 1,
      pm: false,
      st: r.status,
      lc,
    });
  }

  const summary = {
    retrievedAt: new Date().toISOString(),
    totalVariantRowsChecked: variantRows.length,
    uniqueSkusChecked: groups.size,
    duplicateSkus: rows.filter(r => r.d).length,
    rowsWithDuplicateSku: rows.filter(r => r.d).reduce((s, r) => s + r.dc, 0),
    priceMismatchSkus: rows.filter(r => r.pm).length,
    blankSkuRows: blankRows.length,
  };

  res.status(200).json({ summary, rows });
}

// ============================== Router ==============================
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (!TOKEN) {
      res.status(500).json({ error: 'Server not configured: SHOPIFY_UK_ADMIN_TOKEN missing' });
      return;
    }
    const which = String(req.query.req || '1');
    if (which === '1') return await handleReq1(req, res);
    if (which === '5') return await handleReq5(req, res);
    if (which === '6') return await handleReq6(req, res);
    res.status(400).json({ error: 'Invalid ?req= value. Expected 1, 5, or 6.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
};
