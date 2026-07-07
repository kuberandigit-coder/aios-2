import json, re, csv, os, collections

DATA = os.path.dirname(os.path.abspath(__file__))
def p(name): return os.path.join(DATA, name)

IN = p("2026-07-07_kamsi_req5_bulk_products_v2.jsonl")

products = {}
order = []

with open(IN, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        parent = obj.get("__parentId")
        if parent is None:
            gid = obj["id"]
            products[gid] = {
                "legacyResourceId": obj["legacyResourceId"],
                "handle": obj["handle"],
                "onlineStoreUrl": obj.get("onlineStoreUrl") or "",
                "title": obj["title"],
                "descriptionHtml": obj.get("descriptionHtml") or "",
                "productType": (obj.get("productType") or "").strip(),
                "tags": obj.get("tags") or [],
                "updatedAt": obj.get("updatedAt") or "",
                "seoTitle": (obj.get("seo") or {}).get("title") or "",
                "seoDescription": (obj.get("seo") or {}).get("description") or "",
                "collections": [],
            }
            order.append(gid)
        else:
            prod = products.get(parent)
            if prod is not None and "title" in obj:
                prod["collections"].append(obj["title"])

print("total products:", len(products))

# ---- Normalization helpers ----
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

def strip_html(s):
    return TAG_RE.sub(" ", s or "")

def normalize(s):
    s = strip_html(s)
    s = WS_RE.sub(" ", s).strip()
    return s

def normalize_lower(s):
    return normalize(s).lower()

# ---- Collection Type priority: 1) product_type 2) first collection title 3) first tag 4) Not Available ----
def collection_type(prod):
    if prod["productType"]:
        return prod["productType"]
    if prod["collections"]:
        return prod["collections"][0]
    if prod["tags"]:
        return prod["tags"][0]
    return "Not Available"

rows = []
title_blank = title_auto = title_ok = 0
desc_blank = desc_auto = desc_ok = 0
action_counts = collections.Counter()

for gid in order:
    r = products[gid]
    title_norm = normalize_lower(r["title"])
    desc_text = normalize(r["descriptionHtml"])
    desc_norm = desc_text.lower()
    desc_first160_norm = desc_norm[:160]

    seo_title_raw = r["seoTitle"].strip()
    seo_desc_raw = r["seoDescription"].strip()
    seo_title_norm = normalize_lower(seo_title_raw)
    seo_desc_norm = normalize_lower(seo_desc_raw)

    # Title state: blank / auto (equals product title) / ok
    if not seo_title_raw:
        title_state = "blank"
    elif seo_title_norm == title_norm:
        title_state = "auto"
    else:
        title_state = "ok"

    # Description state: blank / auto (equals full desc OR equals first-160-chars of desc) / ok
    if not seo_desc_raw:
        desc_state = "blank"
    elif seo_desc_norm == desc_norm or seo_desc_norm == desc_first160_norm:
        desc_state = "auto"
    else:
        desc_state = "ok"

    if title_state == "blank": title_blank += 1
    elif title_state == "auto": title_auto += 1
    else: title_ok += 1
    if desc_state == "blank": desc_blank += 1
    elif desc_state == "auto": desc_auto += 1
    else: desc_ok += 1

    # Meta Title Missing / Meta Description Missing (boolean, per Step 3: blank OR auto-generated counts as missing)
    title_missing = title_state in ("blank", "auto")
    desc_missing = desc_state in ("blank", "auto")

    # Action Needed — priority order exactly as specified in the task, top to bottom
    if title_state == "blank" and desc_state == "blank":
        action = "Add Meta Title and Meta Description"
    elif title_state == "blank":
        action = "Add Meta Title"
    elif desc_state == "blank":
        action = "Add Meta Description"
    elif title_state == "auto":
        action = "Rewrite Meta Title"
    elif desc_state == "auto":
        action = "Rewrite Meta Description"
    else:
        action = "OK"
    action_counts[action] += 1

    title_len = len(seo_title_raw) if seo_title_raw else 0
    desc_len = len(seo_desc_raw) if seo_desc_raw else 0

    rows.append({
        "page_url": "/products/%s" % r["handle"],
        "collection_type": collection_type(r),
        "product_title": r["title"],
        "product_description": desc_text,
        "meta_title": seo_title_raw,
        "meta_description": seo_desc_raw,
        "title_length": title_len,
        "description_length": desc_len,
        "last_updated": r["updatedAt"],
        "action_needed": action,
        "title_missing": title_missing,
        "desc_missing": desc_missing,
    })

print("Title states -> blank: %d, auto: %d, ok: %d" % (title_blank, title_auto, title_ok))
print("Desc states  -> blank: %d, auto: %d, ok: %d" % (desc_blank, desc_auto, desc_ok))
print("Action Needed counts:", dict(action_counts))

# ---- Save CSV (evidence / re-derivable dataset) ----
OUT_CSV = p("2026-07-07_kamsi_req5_missing_meta_log.csv")
with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["page_url", "collection_type", "product_title", "product_description",
                "meta_title", "meta_description", "title_length", "description_length",
                "last_updated", "action_needed"])
    for r in rows:
        w.writerow([r["page_url"], r["collection_type"], r["product_title"], r["product_description"][:500],
                    r["meta_title"], r["meta_description"], r["title_length"], r["description_length"],
                    r["last_updated"], r["action_needed"]])
print("wrote CSV:", OUT_CSV)

OUT_JSON = p("2026-07-07_kamsi_req5_rows.json")
json.dump(rows, open(OUT_JSON, "w", encoding="utf-8"))
print("wrote JSON:", OUT_JSON, "rows:", len(rows))

# KPI summary
total = len(rows)
missing_title_n = sum(1 for r in rows if r["title_missing"])
missing_desc_n = sum(1 for r in rows if r["desc_missing"])
both_missing_n = sum(1 for r in rows if r["title_missing"] and r["desc_missing"])
ok_n = sum(1 for r in rows if r["action_needed"] == "OK")
print("KPIs -> total: %d, missing title: %d, missing desc: %d, both missing: %d, OK: %d" % (
    total, missing_title_n, missing_desc_n, both_missing_n, ok_n))
