import csv, json, re, os

DATA = os.path.dirname(os.path.abspath(__file__))
def p(name): return os.path.join(DATA, name)

# --- load existing (2026-07-02) keyword map, re-key by product_id only (collection-agnostic) ---
old_map = json.load(open(p("2026-07-02_req2-keyword-map.json")))
existing_by_pid = {}
for k, kw in old_map.items():
    coll, pid = k.split("|", 1)
    existing_by_pid[pid] = kw

# also pull the curated top-30 map straight from the req2 page-builder source (hardcoded PROD_DEMAND keys)
curated_pids = {
"15086824259970","15071739019650","4417272086624","15260815720834","7105746796705",
"6898632065185","15023091188098","7982911619322","8011075125498","14872946311554",
"7053693649057","6852374102177","14881058324866","7630664532218","4552643903584",
"15260060582274","14879664472450","15270960234882","14907263746434","14934429958530",
"7819052286202","15322580779394","6024708292769","15097952764290","6024708718753",
"14929097884034","7651373547770","7982927741178","7985931354362","8073532997882",
}

STOP_BRAND = {"ledsone","ledsone uk ltd","uk","ltd"}
NOISE_TOKENS = re.compile(
    r"\b(\d+\s*-?\s*pack|pack\s*of\s*\d+|\d+\s*x|\d+w|\d+v|\d+mm|\d+cm|\d+m\b|\d+\.\d+m|"
    r"ip\d+|e14|e27|b22|gu10|g9|g4|led|smd|dimmable|non[- ]dimmable|warm white|cool white|"
    r"daylight|\d+k\b|st64|a60|g95|filament|screw|bayonet)\b", re.IGNORECASE)
TRAILING_CODE = re.compile(r"[~#]\s*\d+\s*$")
QTY_PREFIX = re.compile(r"^\s*\d+\s*[-x]?\s*pack[- ]?", re.IGNORECASE)
NUMS = re.compile(r"\b\d+([.,]\d+)?\b")

LIGHT_NOUNS = ["pendant light","wall light","ceiling light","table lamp","chandelier",
    "spider light","plug in light","ceiling rose","lamp holder","bulb holder","led bulb",
    "transformer","driver","cable","fabric cable","lampshade","shade","wall lamp",
    "hanging light","flush light","spotlight","light bulb","lamp","light","lighting"]

def clean_title(title):
    t = TRAILING_CODE.sub("", title)
    t = QTY_PREFIX.sub("", t)
    t = t.lower()
    for b in STOP_BRAND:
        t = t.replace(b, " ")
    t = NOISE_TOKENS.sub(" ", t)
    t = NUMS.sub(" ", t)
    t = re.sub(r"[|,~#/\-]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def derive_keyword(title):
    t = clean_title(title)
    if not t:
        return None
    words = t.split()
    # find the longest matching light-noun phrase present in the cleaned title
    best = None
    for noun in LIGHT_NOUNS:
        if noun in t:
            if best is None or len(noun) > len(best):
                best = noun
    if best:
        # prepend up to 2 preceding descriptive words for specificity
        idx = t.find(best)
        pre = t[:idx].split()
        pre = [w for w in pre if len(w) > 2][-2:]
        kw = " ".join(pre + best.split())
        kw = " ".join(kw.split()[:5])
        return kw.strip()
    # fallback: last 3-4 significant words of cleaned title
    sig = [w for w in words if len(w) > 2]
    if not sig:
        return None
    return " ".join(sig[-4:])

rows = list(csv.DictReader(open(p("2026-07-07_req2-allcol-products-flat.csv"), encoding="utf-8")))
print("total products:", len(rows))

kw_map = {}  # product_id -> (keyword, source)
unmapped = 0
for r in rows:
    pid = r["product_id"]
    if pid in existing_by_pid:
        kw_map[pid] = (existing_by_pid[pid], "CURATED" if pid in curated_pids else "AUTO-2026-07-02")
        continue
    kw = derive_keyword(r["title"])
    if kw:
        kw_map[pid] = (kw, "AUTO-2026-07-07")
    else:
        unmapped += 1

print("mapped:", len(kw_map), "unmapped (no keyword derivable):", unmapped)
unique_kw = sorted(set(kw for kw, _ in kw_map.values()))
print("unique keywords needed:", len(unique_kw))

# how many of these unique keywords are already known-volume from the 2026-07-02 pull?
old_vol = {}
for line in open(p("2026-07-02_req2-semrush-volumes.csv"), encoding="utf-8"):
    line = line.strip()
    if line and ";" in line:
        k, v = line.rsplit(";", 1)
        old_vol[k] = int(v)
new_kw_needed = [k for k in unique_kw if k not in old_vol]
print("already have volume for:", len(unique_kw) - len(new_kw_needed))
print("NEW keywords needing Semrush lookup:", len(new_kw_needed))

json.dump({pid: kw for pid, (kw, src) in kw_map.items()}, open(p("2026-07-07_req2-allcol-keyword-map.json"), "w"), indent=0)
json.dump({pid: src for pid, (kw, src) in kw_map.items()}, open(p("2026-07-07_req2-allcol-keyword-source.json"), "w"), indent=0)
with open(p("2026-07-07_req2-allcol-new-keywords-needed.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(new_kw_needed))
print("wrote keyword map, source map, and new-keywords-needed list")
