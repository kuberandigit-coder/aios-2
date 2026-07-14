// SUK-R2 — Duplicate Listing & Price Check (ledsone.de)
// Server-side only: reads SHOPIFY_ADMIN_TOKEN from env, never exposed to the client.
// Read-only Admin GraphQL calls only — no mutations.

const STORE_DOMAIN = 'ledsone-de.myshopify.com';
const API_VERSION = '2024-10';

async function shopifyGraphQL(query, variables) {
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
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const PRODUCTS_QUERY = `
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

async function fetchAllVariantRows() {
  const rows = [];
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

function buildGroups(rows) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    if (!process.env.SHOPIFY_ADMIN_TOKEN) {
      res.status(500).json({ error: 'Server not configured: SHOPIFY_ADMIN_TOKEN missing' });
      return;
    }
    const rows = await fetchAllVariantRows();
    const result = buildGroups(rows);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
