import re

SRC = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\dilaksi-req2-all-products.html"
OUT = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages\kamsi-req4-product-priority-guidance.html"

c = open(SRC, encoding="utf-8").read()
orig_len = len(c)

# 1. <title>
old_title = "<title>Dilaksi Requirement 2 — Product Priority Guidance — All Collections</title>"
new_title = "<title>Kamsi Requirement 4 — Product Priority Guidance — All Collections</title>"
assert old_title in c, "title not found"
c = c.replace(old_title, new_title)

# 2. tab-nav block (Dilaksi R1-R3) -> Kamsi R1-R4, R4 active
old_nav = (
    '<nav class="tab-nav" role="tablist" aria-label="Dilaksi requirements">\n'
    '  <a class="tab-btn" href="dilaksi.html">Requirement 1<span class="tab-label">GA4 SEO Organic Report</span></a>\n'
    '  <a class="tab-btn active" href="dilaksi-req2-all-products.html">Requirement 2<span class="tab-label">Product Priority Guidance</span></a>\n'
    '  <a class="tab-btn" href="dilaksi-req3-pages-for-removal.html">Requirement 3<span class="tab-label">Pages for Removal</span></a>\n'
    '</nav>'
)
new_nav = (
    '<nav class="tab-nav" role="tablist" aria-label="Kamsi requirements">\n'
    '  <a class="tab-btn" href="kamsi-req1-slow-moving-products.html">Requirement 1<span class="tab-label">Slow-Moving Products</span></a>\n'
    '  <a class="tab-btn" href="kamsi-req2-low-ctr-pages.html">Requirement 2<span class="tab-label">Low CTR Pages</span></a>\n'
    '  <a class="tab-btn" href="kamsi-req3-core-ga4-seo.html">Requirement 3<span class="tab-label">Core GA4 Data for SEO</span></a>\n'
    '  <a class="tab-btn active" href="kamsi-req4-product-priority-guidance.html">Requirement 4<span class="tab-label">Product Priority Guidance</span></a>\n'
    '</nav>'
)
assert old_nav in c, "tab-nav block not found"
c = c.replace(old_nav, new_nav)

# 3. eyebrow label
old_eyebrow = 'Requirement 2 — All Collections (Scope Expanded)'
new_eyebrow = 'Requirement 4 — All Collections (Scope Expanded) — duplicated from Dilaksi Requirement 2'
assert old_eyebrow in c, "eyebrow not found"
c = c.replace(old_eyebrow, new_eyebrow)

# 4. "Requested by: Dilaksi" -> "Requested by: Kamsi"
old_reqby = 'Requested by: <strong>Dilaksi</strong>'
new_reqby = 'Requested by: <strong>Kamsi</strong>'
assert old_reqby in c, "requested-by not found"
c = c.replace(old_reqby, new_reqby)

# 5. rule note attribution
old_rule = 'approved Dilaksi Requirement 2 business rule (6 conditions, exact order)'
new_rule = 'approved Dilaksi Requirement 2 business rule (6 conditions, exact order; reused as-is for Kamsi Requirement 4, unchanged)'
assert old_rule in c, "rulenote text not found"
c = c.replace(old_rule, new_rule)

# 6. footer: prefix a duplication notice before the existing Scope change line
old_foot_start = '<div class="foot">\n  <strong>Scope change:</strong>'
new_foot_start = ('<div class="foot">\n'
    '  <strong>Kamsi Requirement 4 note:</strong> this page is an exact duplicate of Dilaksi Requirement 2 '
    '(same UI, table structure, metrics, logic, and data — no new data was collected or recalculated for Kamsi). '
    'See AIOS evidence: <code>evidence/Kamsi/2026-07-07_kamsi_req4_duplicate_evidence.md</code>.<br>\n'
    '  <strong>Scope change:</strong>')
assert old_foot_start in c, "footer start not found"
c = c.replace(old_foot_start, new_foot_start)

open(OUT, "w", encoding="utf-8").write(c)
print("input length:", orig_len, "output length:", len(c))
print("written:", OUT)

# sanity: confirm no other Dilaksi/dilaksi label references remain except inside data attribution we intentionally kept
remaining = [m.start() for m in re.finditer("Dilaksi", c)]
print("remaining 'Dilaksi' mentions (should be 2: rulenote + foot-note references):", len(remaining))
for pos in remaining:
    print(" -", repr(c[max(0,pos-40):pos+40]))
