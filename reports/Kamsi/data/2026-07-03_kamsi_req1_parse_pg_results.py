# Kamsi Req 1 — parse Postgres MCP tool-result files (python-repr rows) into CSVs
# Usage: python 2026-07-03_kamsi_req1_parse_pg_results.py <mode:orders|stock> <result-file> <out-csv>
import json, sys, csv, ast, datetime

mode, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
txt = json.load(open(src, encoding="utf-8"))["result"][0]["text"]

# Safely evaluate the python-repr list containing datetime.date(...)
class _D:
    def date(self, y, m, d): return f"{y}-{m:02d}-{d:02d}"
tree = ast.parse(txt, mode="eval")

def conv(node):
    if isinstance(node, ast.List): return [conv(e) for e in node.elts]
    if isinstance(node, ast.Dict):
        return {conv(k): conv(v) for k, v in zip(node.keys, node.values)}
    if isinstance(node, ast.Constant): return node.value
    if isinstance(node, ast.Call):
        f = node.func
        if isinstance(f, ast.Attribute) and f.attr == "date":
            a = [conv(x) for x in node.args]
            return f"{a[0]}-{a[1]:02d}-{a[2]:02d}"
        name = f.id if isinstance(f, ast.Name) else getattr(f, "attr", "")
        if name == "Decimal":
            v = conv(node.args[0])
            fv = float(v)
            return int(fv) if fv == int(fv) else fv
        raise ValueError(f"unexpected call: {name}")
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        return -conv(node.operand)
    raise ValueError(f"unexpected node {ast.dump(node)[:80]}")

rows = conv(tree.body)
with open(out, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    if mode == "orders":
        w.writerow(["sku", "units_sold_90d", "last_order_date"])
        for r in rows: w.writerow([r["sku"], r["units_90d"], r["last_order"]])
    else:
        w.writerow(["sku", "stock"])
        for r in rows: w.writerow([r["sku"], r["stock"]])
print(f"parsed {len(rows)} rows -> {out}")
