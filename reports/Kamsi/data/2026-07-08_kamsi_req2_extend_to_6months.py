import json

PATH = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req1-slow-moving-products.html"
c = open(PATH, encoding="utf-8").read()

d2_rows = json.load(open(r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req2_6month_d2.json", encoding="utf-8"))
by_day = json.load(open(r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\Kamsi\data\2026-07-08_kamsi_req2_6month_by_day.json", encoding="utf-8"))

total = len(d2_rows)
low_n = sum(1 for r in d2_rows if r[7] == 1)
ok_n = total - low_n
coll_n = sum(1 for r in d2_rows if r[1] == "C")
blog_n = sum(1 for r in d2_rows if r[1] == "B")
total_imp = sum(r[3] for r in d2_rows)
total_clk = sum(r[4] for r in d2_rows)
avg_ctr = round(total_clk / total_imp * 100, 2) if total_imp else 0

d2_json = json.dumps(d2_rows, separators=(",", ":"), ensure_ascii=False).replace("</script", "<\\/script")
by_day_json = json.dumps(by_day, separators=(",", ":")).replace("</script", "<\\/script")

# ---- 1. swap the d2 JSON data-holder tag ----
i = c.find('<script id="d2" type="application/json">')
assert i != -1
j = c.find("</script>", i) + len("</script>")
new_tag = '<script id="d2" type="application/json">' + d2_json + "</script>"
c = c[:i] + new_tag + c[j:]

# ---- 2. swap the d2day JSON data-holder tag ----
i = c.find('<script id="d2day" type="application/json">')
assert i != -1
j = c.find("</script>", i) + len("</script>")
new_tag = '<script id="d2day" type="application/json">' + by_day_json + "</script>"
c = c[:i] + new_tag + c[j:]

# ---- 3. update header sub-text ----
old_sub = 'Google Search Console monthly performance report for all collection and blog pages. &nbsp;·&nbsp; Website: <strong>https://ledsone.co.uk/</strong> &nbsp;·&nbsp; Requested by: <strong>Kamsi</strong> &nbsp;·&nbsp; Last updated: <strong>2026-07-03</strong>'
assert c.count(old_sub) == 1
new_sub = 'Google Search Console performance report for all collection and blog pages, 6-month range. &nbsp;·&nbsp; Website: <strong>https://ledsone.co.uk/</strong> &nbsp;·&nbsp; Requested by: <strong>Kamsi</strong> &nbsp;·&nbsp; Last updated: <strong>2026-07-08</strong>'
c = c.replace(old_sub, new_sub, 1)

# ---- 4. update the Month chip ----
old_chip = 'Month: June 2026 (2026-06-01 &rarr; 2026-06-30) &mdash; last complete month'
if old_chip not in c:
    old_chip = 'Month: June 2026 (2026-06-01 → 2026-06-30) — last complete month'
assert c.count(old_chip) == 1, "chip marker not found"
new_chip = "Date Range: 2026-01-01 to 2026-06-30 (6 months)"
c = c.replace(old_chip, new_chip, 1)

# ---- 5. update KPI cards ----
old_cards = '''<div class="card"><div class="label">Total Pages Checked</div><div class="value">1,385</div><div class="note">1,148 collections · 237 blog pages</div></div>
    <div class="card warn"><div class="label">Low CTR Pages</div><div class="value">1,324</div><div class="note">CTR below 2%</div></div>
    <div class="card"><div class="label">Average CTR</div><div class="value">0.33%</div><div class="note">clicks ÷ impressions, all pages</div></div>
    <div class="card"><div class="label">Total Impressions</div><div class="value">577,976</div><div class="note">June 2026</div></div>
    <div class="card"><div class="label">Total Clicks</div><div class="value">1,894</div><div class="note">June 2026</div></div>'''
assert c.count(old_cards) == 1
new_cards = '''<div class="card"><div class="label">Total Pages Checked</div><div class="value">{total:,}</div><div class="note">{coll:,} collections &middot; {blog:,} blog pages</div></div>
    <div class="card warn"><div class="label">Low CTR Pages</div><div class="value">{low:,}</div><div class="note">CTR below 2%</div></div>
    <div class="card"><div class="label">Average CTR</div><div class="value">{avg_ctr}%</div><div class="note">clicks &divide; impressions, all pages</div></div>
    <div class="card"><div class="label">Total Impressions</div><div class="value">{imp:,}</div><div class="note">Jan&ndash;Jun 2026</div></div>
    <div class="card"><div class="label">Total Clicks</div><div class="value">{clk:,}</div><div class="note">Jan&ndash;Jun 2026</div></div>'''.format(
    total=total, coll=coll_n, blog=blog_n, low=low_n, avg_ctr=avg_ctr, imp=total_imp, clk=total_clk
)
c = c.replace(old_cards, new_cards, 1)

# ---- 6. update cnt2 initial text ----
old_cnt = '<span id="cnt2">All 1,385 pages</span>'
assert c.count(old_cnt) == 1
new_cnt = '<span id="cnt2">All {total:,} pages</span>'.format(total=total)
c = c.replace(old_cnt, new_cnt, 1)

# ---- 7. update date-range picker min/max ----
old_range = 'min="2026-06-01" max="2026-06-30"'
count_range = c.count(old_range)
assert count_range == 2, count_range
new_range = 'min="2026-01-01" max="2026-06-30"'
c = c.replace(old_range, new_range)

open(PATH, "w", encoding="utf-8").write(c)
print("written", len(c) // 1024, "KB")
print("KPIs -> total:", total, "low:", low_n, "ok:", ok_n, "avg_ctr:", avg_ctr, "imp:", total_imp, "clk:", total_clk)
