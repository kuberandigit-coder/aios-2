import csv, json, re, os, html, collections

DATA = os.path.dirname(os.path.abspath(__file__))
def p(name): return os.path.join(DATA, name)

GEN_DATE = "2026-07-07"

# ---- Products (all 5,179, with full collection membership) ----
products = list(csv.DictReader(open(p("2026-07-07_req2-allcol-products-flat.csv"), encoding="utf-8")))
for r in products:
    r["collections"] = r["collections"].split("|") if r["collections"] else []
    r["variant_ids"] = r["variant_ids"].split("|") if r["variant_ids"] else []
    r["skus"] = r["skus"].split("|") if r["skus"] else []

coll_counts = collections.Counter()
for r in products:
    for c in r["collections"]:
        coll_counts[c] += 1
print("total products:", len(products), "| distinct collections referenced:", len(coll_counts))

# ---- Sales (30d), aggregate per product ----
sales_rows = list(csv.DictReader(open(p("2026-07-07_req2-allcol-sales-30d.csv"), encoding="utf-8")))
prod_sales = collections.defaultdict(float)
prod_units = collections.defaultdict(int)
prod_orders = collections.defaultdict(int)
for r in sales_rows:
    prod_sales[r["product_id"]] += float(r["net_sales"])
    prod_units[r["product_id"]] += int(r["net_items_sold"])
    prod_orders[r["product_id"]] += int(r["orders"])

max_sales = max(prod_sales.values()) if prod_sales else 0
print("max product sales (30d):", max_sales)

# ---- Keyword map (product_id -> keyword), merged old+new ----
kw_map = json.load(open(p("2026-07-07_req2-allcol-keyword-map.json")))
kw_source = json.load(open(p("2026-07-07_req2-allcol-keyword-source.json")))

vol = {}
for line in open(p("2026-07-02_req2-semrush-volumes.csv"), encoding="utf-8"):
    line = line.strip()
    if line and ";" in line:
        k, v = line.rsplit(";", 1)
        vol[k] = int(v)
for line in open(p("2026-07-07_req2-allcol-semrush-volumes-new.csv"), encoding="utf-8"):
    line = line.strip()
    if line and ";" in line:
        k, v = line.rsplit(";", 1)
        vol[k] = int(v)
print("total unique keyword->volume entries:", len(vol))

def demand_for(pid):
    kw = kw_map.get(pid)
    if not kw:
        return None
    v = vol.get(kw, 0)
    return (kw, v)

# ---- GA4 organic sessions (all landing pages, true last 30 days, Organic Search only) ----
org = collections.defaultdict(int)
for row in csv.DictReader(open(p("2026-07-07_req2-allcol-ga4-organic-landing-30d.csv"), encoding="utf-8-sig")):
    path = (row["landing_page"] or "").split("?")[0].rstrip("/")
    m = re.search(r"/products/([^/]+)$", path)
    if m:
        org[m.group(1)] += int(float(row["sessions"]))

def organic_for(handle):
    return org.get(handle, 0)

# ---- SEO Priority rule (approved, exact order; PM not required — max sales £{:.2f} < thresholds) ----
def seo_priority(demand, sales, organic):
    if demand is None:
        return ("Low — flag for review", "1/6 (demand unmapped; Low either way)")
    if demand < 100 and sales < 2000:
        return ("Low — flag for review", "1")
    # rule 2: sales>=10000 & PM>=30 -- unreachable, PM not required
    if demand >= 2000 and organic < demand * 0.5:
        return ("High", "3")
    # rule 4: sales>=4000 & PM>=25 & demand>=500 -- unreachable, PM not required
    if demand >= 500 and organic >= demand * 0.5:
        return ("Medium", "5")
    return ("Low", "6")

PRI_LOG = []
rows_out = []
pri_counts = collections.Counter()
for r in products:
    pid = r["product_id"]
    handle = r["handle"]
    sales = round(prod_sales.get(pid, 0.0), 2)
    units = prod_units.get(pid, 0)
    orders = prod_orders.get(pid, 0)
    dm = demand_for(pid)
    demand_val = dm[1] if dm else None
    keyword = dm[0] if dm else None
    organic = organic_for(handle)
    pri, cond = seo_priority(demand_val, sales, organic)
    pri_counts[pri] += 1
    conf = kw_source.get(pid, "AUTO")
    row = {
        "product_id": pid, "handle": handle, "title": r["title"], "status": r["status"],
        "collections": r["collections"], "n_collections": len(r["collections"]),
        "skus": r["skus"], "n_variants": len(r["variant_ids"]),
        "sales": sales, "units": units, "orders": orders,
        "demand": demand_val, "keyword": keyword, "organic": organic,
        "priority": pri, "condition": cond, "confidence": conf,
    }
    rows_out.append(row)
    PRI_LOG.append([pid, handle, r["title"], sales, "" if demand_val is None else demand_val,
                     organic, "N/A (COGS pending)", cond, pri])

print("SEO Priority counts:", dict(pri_counts))

with open(p("2026-07-07_req2-allcol-seo-priority-log.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["product_id", "handle", "title", "sales_gbp_30d", "demand_searches_mo",
                "organic_sessions_30d", "profit_margin", "matched_condition", "seo_priority"])
    w.writerows(PRI_LOG)

json.dump(rows_out, open(p("2026-07-07_req2-allcol-rows.json"), "w"))
print("wrote rows json + priority log")

# ---- Summary numbers for HTML ----
total_sales = sum(r["sales"] for r in rows_out)
total_units = sum(r["units"] for r in rows_out)
total_demand = sum(r["demand"] for r in rows_out if r["demand"])
total_organic = sum(r["organic"] for r in rows_out)
print("TOTALS -> sales: %.2f | units: %d | demand: %d | organic: %d" % (total_sales, total_units, total_demand, total_organic))
print("collections in scope:", len(coll_counts), "| products:", len(rows_out))
