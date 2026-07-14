// SUK-R3 — Slow-Moving Stock Identification (ledsone.de)
// Server-side only: reads SHOPIFY_ADMIN_TOKEN from env, never exposed to the client.
// Read-only Admin GraphQL calls only — no mutations.

const STORE_DOMAIN = 'ledsone-de.myshopify.com';
const API_VERSION = '2024-10';
const DAYS = 90;

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

const PRODUCTS_QUERY = `
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

const ORDERS_QUERY = `
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

async function fetchAllVariants() {
  const variants = [];
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(PRODUCTS_QUERY, { after });
    for (const edge of data.products.edges) {
      const p = edge.node;
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const rawSku = (v.sku || '').toString();
        const trimmedSku = rawSku.trim();
        const tracked = v.inventoryItem ? v.inventoryItem.tracked : false;
        const levels = v.inventoryItem ? v.inventoryItem.inventoryLevels.edges.map(e => e.node) : [];
        // Single approved operational location for ledsone.de (LEDSone DE LTD) —
        // summed across whatever locations Shopify actually reports for this item.
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

async function fetchUnitsSoldByVariant(startISO, endISO) {
  const q = `created_at:>=${startISO} AND created_at:<${endISO}`;
  const soldByVariant = new Map();
  const lastOrderDateByVariant = new Map();
  let after = null;
  let hasNext = true;
  while (hasNext) {
    const data = await shopifyGraphQL(ORDERS_QUERY, { after, q });
    for (const edge of data.orders.edges) {
      const o = edge.node;
      // Exclude cancelled orders and test orders — reliably identifiable via
      // cancelledAt / test fields. VOIDED financial status also excluded as
      // a non-sale transaction.
      if (o.cancelledAt) continue;
      if (o.test) continue;
      if (o.displayFinancialStatus === 'VOIDED') continue;
      for (const liEdge of o.lineItems.edges) {
        const li = liEdge.node;
        if (!li.variant || !li.variant.id) continue;
        // refundableQuantity = quantity still eligible to refund, i.e. quantity
        // already net of any refunded units for this line item — this is the
        // reliably-mapped net units actually sold and kept, per Variant ID.
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

function computeStatus(unitsSold, currentStock, tracked) {
  if (!tracked || currentStock === null) return 'Not Assessable';
  if (unitsSold < 10 && currentStock > 100) return 'Slow-Moving';
  return 'OK';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (!process.env.SHOPIFY_ADMIN_TOKEN) {
      res.status(500).json({ error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
      return;
    }
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = new Date(end.getTime() - DAYS * 24 * 60 * 60 * 1000);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);

    const [variants, { soldByVariant, lastOrderDateByVariant }] = await Promise.all([
      fetchAllVariants(),
      fetchUnitsSoldByVariant(startISO, endISO),
    ]);

    const retrievedAt = new Date().toISOString();
    const rows = variants.map(v => {
      const unitsSold = soldByVariant.get(v.variantId) || 0;
      const avgDaily = unitsSold / DAYS;
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
        status: computeStatus(unitsSold, v.currentStock, v.inventoryTracked),
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
      days: DAYS,
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
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
