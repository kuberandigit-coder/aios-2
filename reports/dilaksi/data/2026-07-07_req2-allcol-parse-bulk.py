import json, csv, os

DATA = os.path.dirname(os.path.abspath(__file__))
IN = os.path.join(DATA, "2026-07-07_req2-allcol-bulk-products.jsonl")

products = {}  # gid -> dict
order = []

with open(IN, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        parent = obj.get("__parentId")
        if parent is None:
            # top-level product node
            gid = obj["id"]
            products[gid] = {
                "legacyResourceId": obj["legacyResourceId"],
                "title": obj["title"],
                "handle": obj["handle"],
                "status": obj["status"],
                "vendor": obj.get("vendor", ""),
                "collections": [],
                "variants": [],
            }
            order.append(gid)
        else:
            p = products.get(parent)
            if p is None:
                continue
            if "sku" in obj or ("legacyResourceId" in obj and "handle" not in obj):
                p["variants"].append({
                    "legacyResourceId": obj.get("legacyResourceId", ""),
                    "sku": obj.get("sku", "") or "",
                })
            elif "handle" in obj:
                p["collections"].append(obj["handle"])

print("products:", len(products))
total_variants = sum(len(p["variants"]) for p in products.values())
print("variants:", total_variants)
coll_counts = {}
for p in products.values():
    for c in p["collections"]:
        coll_counts[c] = coll_counts.get(c, 0) + 1
print("unique collections referenced:", len(coll_counts))

# write product-level CSV: product_id, handle, title, status, vendor, num_collections, collections(pipe-joined), num_variants, skus(pipe-joined)
OUT = os.path.join(DATA, "2026-07-07_req2-allcol-products-flat.csv")
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["product_id", "handle", "title", "status", "vendor", "collections", "variant_ids", "skus"])
    for gid in order:
        p = products[gid]
        w.writerow([
            p["legacyResourceId"], p["handle"], p["title"], p["status"], p["vendor"],
            "|".join(p["collections"]),
            "|".join(v["legacyResourceId"] for v in p["variants"]),
            "|".join(v["sku"] for v in p["variants"]),
        ])

# write collections summary CSV
OUT2 = os.path.join(DATA, "2026-07-07_req2-allcol-collections-summary.csv")
with open(OUT2, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["collection_handle", "product_count"])
    for c, n in sorted(coll_counts.items(), key=lambda x: -x[1]):
        w.writerow([c, n])

print("wrote:", OUT)
print("wrote:", OUT2)
