const fs = require('fs');

const IN = "C:\\Users\\PC\\OneDrive\\Desktop\\kuberan web\\reports\\sukirtha\\data\\2026-07-14_suk-r2_bulk_products.jsonl";
const OUT_ROWS = "C:\\Users\\PC\\OneDrive\\Desktop\\kuberan web\\reports\\sukirtha\\data\\2026-07-14_suk-r2_variant_rows.json";
const OUT_GROUPS = "C:\\Users\\PC\\OneDrive\\Desktop\\kuberan web\\reports\\sukirtha\\data\\2026-07-14_suk-r2_sku_groups.json";

const lines = fs.readFileSync(IN, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));

// Bulk JSONL: parent products come first, then variant nodes carry a "__parentId" back to the product.
const products = new Map();
const variants = [];

for (const rec of lines) {
  if (rec.id && rec.id.includes('/Product/') && !rec.__parentId) {
    products.set(rec.id, rec);
  } else if (rec.id && rec.id.includes('/ProductVariant/')) {
    variants.push(rec);
  }
}

const retrievedAt = new Date().toISOString();

const rows = variants.map(v => {
  const p = products.get(v.__parentId);
  const rawSku = (v.sku || '').toString();
  const trimmedSku = rawSku.trim();
  const normSku = trimmedSku.toLowerCase();
  return {
    productId: p ? p.id : null,
    productTitle: p ? p.title : null,
    handle: p ? p.handle : null,
    status: p ? p.status : null,
    productUpdatedAt: p ? p.updatedAt : null,
    variantId: v.id,
    variantTitle: v.title,
    skuRaw: rawSku,
    skuNorm: normSku,
    missingSku: trimmedSku === '',
    price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
    compareAtPrice: v.compareAtPrice !== null && v.compareAtPrice !== undefined ? Number(v.compareAtPrice) : null,
    variantUpdatedAt: v.updatedAt,
    url: p ? `https://ledsone.de/products/${p.handle}` : null,
  };
});

// Group by normalised SKU (non-empty only)
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

  // compare-at state: null vs value counts as different states
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

const totalProducts = products.size;
const totalVariants = rows.length;
const withSku = rows.filter(r => !r.missingSku).length;
const missingSku = rows.filter(r => r.missingSku).length;
const uniqueSkus = skuGroups.length;
const duplicateSkus = skuGroups.filter(g => g.duplicate).length;
const duplicateListings = skuGroups.filter(g => g.duplicate).reduce((a, g) => a + g.listingCount, 0);
const moreThanTwo = skuGroups.filter(g => g.duplicate && g.listingCount > 2).length;
const priceMismatches = skuGroups.filter(g => g.priceMismatch).length;
const compareMismatches = skuGroups.filter(g => g.compareMismatch).length;

const summary = {
  retrievedAt,
  totalProducts,
  totalVariants,
  withSku,
  missingSku,
  uniqueSkus,
  duplicateSkus,
  duplicateListings,
  moreThanTwo,
  priceMismatches,
  compareMismatches,
};

console.log(JSON.stringify(summary, null, 2));

fs.writeFileSync(OUT_GROUPS, JSON.stringify({ summary, groups: skuGroups }, null, 0));
fs.writeFileSync(OUT_ROWS, JSON.stringify(rows, null, 0));
