import re

BASE = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\digital-marketing-member-pages\pages"
current_path = r"C:\Users\PC\OneDrive\Desktop\kuberan web\reports\kamsi\data\2026-07-07_kamsi_req1req2req3_merged_backup.html"
req4_path = BASE + r"\kamsi-req4-product-priority-guidance.html"
req5_path = BASE + r"\kamsi-req5-missing-meta-detection.html"
out_path = BASE + r"\kamsi-req1-slow-moving-products.html"

current = open(current_path, encoding="utf-8").read()
req4 = open(req4_path, encoding="utf-8").read()
req5 = open(req5_path, encoding="utf-8").read()


def extract(src):
    i_style = src.find("<style>")
    i_head_end = src.find("</head>")
    style_css = ""
    pos = i_style
    while True:
        s = src.find("<style>", pos)
        if s == -1 or s > i_head_end:
            break
        e = src.find("</style>", s) + len("</style>")
        style_css += src[s + len("<style>"):e - len("</style>")] + "\n"
        pos = e
    i_body = src.find("<body>")
    i_nav_end = src.find("</nav>", src.find('<a class="back"', i_body)) + len("</nav>")
    i_first_script = re.search(r"<script", src[i_nav_end:]).start() + i_nav_end
    panel_html = src[i_nav_end:i_first_script].rstrip()
    assert panel_html.endswith("</div>"), panel_html[-80:]
    panel_html = panel_html[: -len("</div>")].rstrip()

    json_script_tags = []
    code_script_body = None
    pos = i_first_script
    while True:
        s = src.find("<script", pos)
        if s == -1:
            break
        tag_end = src.find(">", s) + 1
        close = src.find("</script>", tag_end)
        tag_open = src[s:tag_end]
        inner = src[tag_end:close]
        if 'type="application/json"' in tag_open or ("type=" in tag_open and "javascript" not in tag_open):
            json_script_tags.append(src[s:close + len("</script>")])
        else:
            assert code_script_body is None, "found more than one executable script block"
            code_script_body = inner
        pos = close + len("</script>")

    assert code_script_body is not None
    panel_html = panel_html + "\n" + "\n".join(json_script_tags)
    return style_css, panel_html, code_script_body


r4_css, r4_html, r4_script = extract(req4)
r5_css, r5_html, r5_script = extract(req5)

print("r4 html", len(r4_html), "script", len(r4_script))
print("r5 html", len(r5_html), "script", len(r5_script))


def rename_ids(html, script, mapping):
    for old, new in mapping.items():
        old_attr, new_attr = f'id="{old}"', f'id="{new}"'
        old_get, new_get = f"getElementById('{old}')", f"getElementById('{new}')"
        found = (old_attr in html) or (old_get in script)
        assert found, f"pattern not found for {old}"
        html = html.replace(old_attr, new_attr)
        script = script.replace(old_get, new_get)
    return html, script


# ---- req4 (panel 4): rename colliding ids ----
r4_map = {
    "q": "q4", "rowsContainer": "rowsContainer4",
    "pageInfo": "pageInfo4", "prevPage": "prevPage4", "nextPage": "nextPage4",
    "collsel": "collsel4",
}
r4_html, r4_script = rename_ids(r4_html, r4_script, r4_map)

# ---- req5 (panel 5): rename colliding ids ----
r5_map = {
    "q": "q5", "rowsContainer": "rowsContainer5",
    "pageInfo": "pageInfo5", "prevPage": "prevPage5", "nextPage": "nextPage5",
    "collsel": "collsel5",
}
r5_html, r5_script = rename_ids(r5_html, r5_script, r5_map)

# ---- update tab-nav: Req4/Req5 links -> showTab buttons ----
old_nav_r4 = '<a class="tab-btn" href="kamsi-req4-product-priority-guidance.html">Requirement 4<span class="tab-label">Product Priority Guidance</span></a>'
new_nav_r4 = '<button class="tab-btn" onclick="showTab(4)">Requirement 4<span class="tab-label">Product Priority Guidance</span></button>'
assert old_nav_r4 in current
current = current.replace(old_nav_r4, new_nav_r4)

old_nav_r5 = '<a class="tab-btn" href="kamsi-req5-missing-meta-detection.html">Requirement 5<span class="tab-label">Missing Meta Title &amp; Description</span></a>'
new_nav_r5 = '<button class="tab-btn" onclick="showTab(5)">Requirement 5<span class="tab-label">Missing Meta Title &amp; Description</span></button>'
assert old_nav_r5 in current
current = current.replace(old_nav_r5, new_nav_r5)

# ---- insert req4/req5 styles into <head> ----
insert_style_marker = "<style>\n\n.tab-panel{display:none;}\n.tab-panel.active{display:block;}\n\n</style>\n</head>"
assert insert_style_marker in current
current = current.replace(
    insert_style_marker,
    "<style>\n" + r4_css + "\n</style>\n<style>\n" + r5_css + "\n</style>\n" + insert_style_marker,
    1,
)

# ---- insert tab-panel-4 and tab-panel-5 right after tab-panel-3's closing </div>, before outer </div> ----
panel3_close_marker = "\n</div>\n\n</div>\n<script>"
assert panel3_close_marker in current, "panel3 close marker not found"
panels_45_block = (
    '\n</div>\n\n<div id="tab-panel-4" class="tab-panel">\n' + r4_html + "\n</div>\n\n"
    '<div id="tab-panel-5" class="tab-panel">\n' + r5_html + "\n</div>\n\n</div>\n<script>"
)
current = current.replace(panel3_close_marker, panels_45_block, 1)

# ---- insert req4/req5 IIFEs before the closing </script> ----
closing_script_marker = "\n</script>\n</body>\n</html>"
assert current.count(closing_script_marker) == 1
iife_45 = "(function(){\n" + r4_script + "\n})();\n(function(){\n" + r5_script + "\n})();\n"
current = current.replace(closing_script_marker, "\n" + iife_45 + "</script>\n</body>\n</html>", 1)

open(out_path, "w", encoding="utf-8").write(current)
print("written:", out_path, len(current) // 1024, "KB")
