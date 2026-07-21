// SUK-R2 (Duplicate Listing & Price Check) + SUK-R3 (Slow-Moving Stock
// Identification), merged into one serverless function to stay under the
// Vercel Hobby plan's 12-function-per-deployment cap (2026-07-20).
// Dispatch via ?req=2 (default) or ?req=3 query param.
// Server-side only: reads SHOPIFY_ADMIN_TOKEN from env, never exposed to the client.
// Read-only Admin GraphQL calls only — no mutations.

const STORE_DOMAIN = 'ledsone-de.myshopify.com';
const API_VERSION = '2024-10';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shopifyGraphQL(query, variables) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
    const json = await res.json();
    const throttled = json.errors && json.errors.some(e => e.extensions && e.extensions.code === 'THROTTLED');
    if (throttled) {
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
  }
  throw new Error('Shopify API error: exceeded retries due to throttling');
}

// ==================== SUK-R2: Duplicate Listing & Price Check ====================

const R2_PRODUCTS_QUERY = `
query($after: String) {
  products(first: 100, after: $after) {
    edges {
      node {
        id
        title
        handle
        status
        updatedAt
        variants(first: 100) {
          edges {
            node {
              id
              title
              sku
              price
              compareAtPrice
              updatedAt
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function r2FetchAllVariantRows() {
  const rows = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R2_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      const p = edge.node;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const rawSku = (v.sku || '').toString();
        const trimmedSku = rawSku.trim();
        rows.push({
          productId: p.id,
          productTitle: p.title,
          handle: p.handle,
          status: p.status,
          productUpdatedAt: p.updatedAt,
          variantId: v.id,
          variantTitle: v.title,
          skuRaw: rawSku,
          skuNorm: trimmedSku.toLowerCase(),
          missingSku: trimmedSku === '',
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          compareAtPrice: v.compareAtPrice !== null && v.compareAtPrice !== undefined ? Number(v.compareAtPrice) : null,
          variantUpdatedAt: v.updatedAt,
          url: `https://ledsone.de/products/${p.handle}`,
        });
      }
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return rows;
}

function r2BuildGroups(rows) {
  const productIds = new Set(rows.map(r => r.productId));
  const groups = new Map();
  for (const r of rows) {
    if (r.missingSku) continue;
    if (!groups.has(r.skuNorm)) groups.set(r.skuNorm, []);
    groups.get(r.skuNorm).push(r);
  }
  const skuGroups = [];
  for (const [norm, list] of groups.entries()) {
    const distinctVariantIds = new Set(list.map(r => r.variantId));
    const isDuplicate = distinctVariantIds.size > 1;
    const distinctPrices = new Set(list.filter(r => r.price !== null).map(r => r.price));
    const priceMismatch = isDuplicate && distinctPrices.size > 1;
    const compareStates = new Set(list.map(r => r.compareAtPrice === null ? 'null' : String(r.compareAtPrice)));
    const compareMismatch = isDuplicate && compareStates.size > 1;
    skuGroups.push({
      skuRaw: list[0].skuRaw,
      skuNorm: norm,
      listings: list,
      listingCount: list.length,
      duplicate: isDuplicate,
      priceMismatch,
      compareMismatch,
    });
  }
  const missingSkuRows = rows.filter(r => r.missingSku);
  for (const r of missingSkuRows) {
    skuGroups.push({
      skuRaw: r.skuRaw,
      skuNorm: '',
      listings: [r],
      listingCount: 1,
      duplicate: 'Not Checked',
      priceMismatch: 'Not Checked',
      compareMismatch: 'Not Checked',
      missingSku: true,
    });
  }

  const summary = {
    retrievedAt: new Date().toISOString(),
    totalProducts: productIds.size,
    totalVariants: rows.length,
    withSku: rows.filter(r => !r.missingSku).length,
    missingSku: missingSkuRows.length,
    uniqueSkus: groups.size,
    duplicateSkus: skuGroups.filter(g => g.duplicate === true).length,
    duplicateListings: skuGroups.filter(g => g.duplicate === true).reduce((a, g) => a + g.listingCount, 0),
    moreThanTwo: skuGroups.filter(g => g.duplicate === true && g.listingCount > 2).length,
    priceMismatches: skuGroups.filter(g => g.priceMismatch === true).length,
    compareMismatches: skuGroups.filter(g => g.compareMismatch === true).length,
  };

  return { summary, groups: skuGroups };
}

async function handleReq2(req, res) {
  const rows = await r2FetchAllVariantRows();
  const result = r2BuildGroups(rows);
  res.status(200).json(result);
}

// ==================== SUK-R3: Slow-Moving Stock Identification ====================

const R3_DAYS = 90;

const R3_PRODUCTS_QUERY = `
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

const R3_ORDERS_QUERY = `
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

async function r3FetchAllVariants() {
  const variants = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R3_PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      const p = edge.node;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const rawSku = (v.sku || '').toString();
        const trimmedSku = rawSku.trim();
        const tracked = v.inventoryItem ? v.inventoryItem.tracked : false;
        const levels = v.inventoryItem ? v.inventoryItem.inventoryLevels.edges.map(e => e.node) : [];
        const currentStock = tracked
          ? levels.reduce((sum, l) => {
              const avail = l.quantities.find(q => q.name === 'available');
              return sum + (avail ? avail.quantity : 0);
            }, 0)
          : null;
        const locationNames = levels.map(l => l.location.name).join(', ') || null;
        variants.push({
          productId: p.id,
          productTitle: p.title,
          handle: p.handle,
          productStatus: p.status,
          category: p.productType || null,
          productUpdatedAt: p.updatedAt,
          variantId: v.id,
          variantTitle: v.title,
          skuRaw: rawSku,
          missingSku: trimmedSku === '',
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          inventoryTracked: tracked,
          currentStock,
          inventoryLocation: locationNames,
          url: `https://ledsone.de/products/${p.handle}`,
          unitsSold90d: 0,
        });
      }
    }
    hasNext = data.products.pageInfo.hasNextPage;
    after = data.products.pageInfo.endCursor;
  }
  return variants;
}

async function r3FetchUnitsSoldByVariant(startISO, endISO) {
  const q = `created_at:>=${startISO} AND created_at:<${endISO}`;
  const soldByVariant = new Map();
  const lastOrderDateByVariant = new Map();
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(R3_ORDERS_QUERY, { after, q });
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

function r3ComputeStatus(unitsSold, currentStock, tracked) {
  if (!tracked || currentStock === null) return 'Not Assessable';
  if (unitsSold < 10 && currentStock > 100) return 'Slow-Moving';
  return 'OK';
}

async function handleReq3(req, res) {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - R3_DAYS * 24 * 60 * 60 * 1000);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

  const [variants, { soldByVariant, lastOrderDateByVariant }] = await Promise.all([
    r3FetchAllVariants(),
    r3FetchUnitsSoldByVariant(startISO, endISO),
  ]);

  const retrievedAt = new Date().toISOString();
  const rows = variants.map(v => {
    const unitsSold = soldByVariant.get(v.variantId) || 0;
    const avgDaily = unitsSold / R3_DAYS;
    let daysOfStock;
    if (!v.inventoryTracked || v.currentStock === null) {
      daysOfStock = 'Not Assessable';
    } else if (avgDaily > 0) {
      daysOfStock = Math.round((v.currentStock / avgDaily) * 10) / 10;
    } else {
      daysOfStock = 'N/A — No sales';
    }
    return {
      ...v,
      unitsSold90d: unitsSold,
      avgDailyUnitsSold: Math.round(avgDaily * 1000) / 1000,
      daysOfStockRemaining: daysOfStock,
      lastOrderDate: lastOrderDateByVariant.get(v.variantId) || null,
      status: r3ComputeStatus(unitsSold, v.currentStock, v.inventoryTracked),
    };
  });

  const totalProducts = new Set(rows.map(r => r.productId)).size;
  const totalVariants = rows.length;
  const withSku = rows.filter(r => !r.missingSku).length;
  const missingSku = rows.filter(r => r.missingSku).length;
  const invTracked = rows.filter(r => r.inventoryTracked).length;
  const invNotTracked = rows.filter(r => !r.inventoryTracked).length;
  const totalCurrentStock = rows.filter(r => r.currentStock !== null).reduce((s, r) => s + r.currentStock, 0);
  const totalUnitsSold = rows.reduce((s, r) => s + r.unitsSold90d, 0);
  const slowMoving = rows.filter(r => r.status === 'Slow-Moving');
  const slowMovingUnits = slowMoving.reduce((s, r) => s + (r.currentStock || 0), 0);
  const okCount = rows.filter(r => r.status === 'OK').length;
  const notAssessable = rows.filter(r => r.status === 'Not Assessable').length;

  const summary = {
    retrievedAt,
    dateRangeStart: startISO,
    dateRangeEnd: endISO,
    days: R3_DAYS,
    inventoryLocations: [...new Set(rows.map(r => r.inventoryLocation).filter(Boolean))],
    totalProducts,
    totalVariants,
    withSku,
    missingSku,
    inventoryTracked: invTracked,
    inventoryNotTracked: invNotTracked,
    totalCurrentStock,
    totalUnitsSold90d: totalUnitsSold,
    slowMovingCount: slowMoving.length,
    slowMovingStockUnits: slowMovingUnits,
    okCount,
    notAssessableCount: notAssessable,
  };

  res.status(200).json({ summary, rows });
}

// ==================== Dispatcher ====================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (!process.env.SHOPIFY_ADMIN_TOKEN) {
      res.status(500).json({ error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
      return;
    }
    const reqNum = req.query && req.query.req === '3' ? '3' : '2';
    if (reqNum === '3') {
      await handleReq3(req, res);
    } else {
      await handleReq2(req, res);
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
