# -*- coding: utf-8 -*-
import json, re, io

SP = r"C:\Users\PC\AppData\Local\Temp\claude\C--Users-PC-OneDrive-Desktop-kuberan-web\18f4c0f8-1aae-4623-9a3a-a13693d41601\scratchpad"

def load(path):
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)["data"]["rows"]

d_full = load(SP + r"\req3_fullrange_raw.json")
d7 = load(SP + r"\req3_7d_raw.json")
d30 = load(SP + r"\req3_30d_raw.json")

def f(v):
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

seven = {}
for r in d7:
    key = (r["search_term"], r["campaign_id"], r["match_type"])
    seven[key] = {"cost": f(r["cost_7d"]), "va": f(r["conv_value_7d"])}

thirty = {}
for r in d30:
    key = (r["search_term"], r["campaign_id"], r["match_type"])
    thirty[key] = {"cost": f(r["cost_30d"]), "va": f(r["conv_value_30d"])}

# ---------------------------------------------------------------
# Query intent classifier (same as before)
# ---------------------------------------------------------------
COMPETITOR_TERMS = [
    "amazon", "ebay", "ikea", "obi", "hornbach", "bauhaus", "wayfair",
    "lampenwelt", "westwing", "otto.de", " otto ", "conrad", "segmuller",
    "segmüller", "poco", "moebel", "möbel", "hagebau", "toom", "globus baumarkt",
    "leroy merlin", "casa", "made.com",
]

NONDE_MARKERS = [
    " the ", " and ", " for ", " with ", " cheap ", " best ", " buy ",
    "light fixture", "ceiling light", "pendant light", "wall light",
    "chandelier", "led strip light", "light bulb", "lamp shade",
]

LOW_INTENT_TERMS = [
    "gunstig", "günstig", "billig", "gebraucht", "kostenlos", "free",
    "cheap", "cheapest", "discount", "rabatt", "sale", "sonderangebot",
    "second hand", "gebrauchte",
]

HIGH_INTENT_PRODUCT_WORDS = [
    "lampe", "leuchte", "leuchten", "beleuchtung", "led", "pendelleuchte",
    "deckenlampe", "wandlampe", "stehlampe", "tischlampe", "lampenschirm",
    "kronleuchter", "strahler", "spot", "trafo", "led-streifen", "lichterkette",
    "hangeleuchte", "hängeleuchte", "kabel", "fassung", "e27", "gu10",
]

GERMAN_MARKERS = [
    "ü", "ö", "ä", "ß", "für", "mit", "und", "aus", "an ", "decke", "wand",
    "netzteil", "abzweigdose", "leitung", "kabel", "stecker", "dimmbar",
    "schalter", "halterung", "birne", "flach", "volt", "watt", "warmweiss",
    "kaltweiss", "dimmer", "wasserdicht", "aussen", "innen", "steckdose",
    "verlaengerung", "verlängerung", "adapter", "anschluss", "buchse",
]


def classify_intent(term):
    t = " " + term.lower().strip() + " "

    for c in COMPETITOR_TERMS:
        if c in t:
            return "Competitor brand"

    has_de_marker = any(m in t for m in GERMAN_MARKERS) or any(
        w in t for w in HIGH_INTENT_PRODUCT_WORDS
    )
    non_ascii = re.findall(r"[^\x00-\x7F]", term)
    looks_english_phrase = any(m in t for m in NONDE_MARKERS)
    if looks_english_phrase and not has_de_marker and not non_ascii:
        return "Non-DE / mixed language"

    if any(w in t for w in LOW_INTENT_TERMS):
        return "Low-intent / bargain"

    if any(w in t for w in HIGH_INTENT_PRODUCT_WORDS):
        return "Generic - high"

    return "Generic - medium"


def recommended_action(conversions, intent):
    if conversions > 0:
        return "Keep"
    if intent == "Competitor brand":
        return "Exclude - competitor term, add as negative phrase"
    if intent == "Non-DE / mixed language":
        return "Exclude - low volume, non-native phrasing"
    return "Exclude - add as negative exact match"


def trend(roas7, roas30, conversions):
    if conversions == 0 and roas7 == roas30:
        return "-> Flat, no conv."
    if roas7 > roas30:
        return "up Rising"
    if roas7 < roas30:
        return "down Slight dip"
    return "-> Flat"


def priority(action, roas, cost):
    if action.startswith("Exclude"):
        return "High" if cost >= 5 else ("Medium" if cost > 0 else "Low")
    if action == "Keep":
        if roas >= 2:
            return "High"
        return "Medium"
    return "Low"


out = []
for r in d_full:
    term = r["search_term"] or ""
    campaign_id = r["campaign_id"]
    campaign_name = r["campaign_name"]
    match_type_raw = r["match_type"]
    match_type = "Performance Max (category)" if match_type_raw == "Performance Max" else match_type_raw

    impressions = f(r["impressions"])
    clicks = f(r["clicks"])
    cost = r["cost"]
    cost_val = f(cost)
    conversions = f(r["conversions"])
    conv_value = f(r["conversions_value"])
    category_label = r.get("category_label")

    cost_is_na = cost is None

    ctr = (clicks / impressions) if impressions > 0 else 0.0
    avg_cpc = (cost_val / clicks) if clicks > 0 and not cost_is_na else None
    conv_rate = (conversions / clicks) if clicks > 0 else 0.0
    roas_full = (conv_value / cost_val) if cost_val > 0 else 0.0
    cost_per_conv = (cost_val / conversions) if conversions > 0 and not cost_is_na else None

    key = (term, campaign_id, match_type_raw)
    s7 = seven.get(key, {"cost": 0.0, "va": 0.0})
    s30 = thirty.get(key, {"cost": 0.0, "va": 0.0})
    roas7 = (s7["va"] / s7["cost"]) if s7["cost"] > 0 else 0.0
    roas30 = (s30["va"] / s30["cost"]) if s30["cost"] > 0 else 0.0

    intent = classify_intent(term)
    action = recommended_action(conversions, intent)
    tr = trend(roas7, roas30, conversions)
    prio = priority(action, roas_full, cost_val)

    out.append({
        "search_term": term,
        "campaign": campaign_name,
        "match_type": match_type,
        "impressions": int(impressions),
        "clicks": int(clicks),
        "ctr": round(ctr * 100, 2),
        "avg_cpc": None if avg_cpc is None else round(avg_cpc, 2),
        "cost": None if cost_is_na else round(cost_val, 2),
        "conversions": round(conversions, 2),
        "conv_rate": round(conv_rate * 100, 2),
        "conv_value": round(conv_value, 2),
        "roas": round(roas_full, 2) if cost_val > 0 else 0,
        "cost_per_conv": None if cost_per_conv is None else round(cost_per_conv, 2),
        "query_intent": intent,
        "existing_negative_kw": "No",
        "roas_7d": round(roas7, 2) if s7["cost"] > 0 else 0,
        "roas_30d": round(roas30, 2) if s30["cost"] > 0 else 0,
        "trend": tr,
        "priority": prio,
        "action": action,
        "category_label": category_label,
        "cost_na": cost_is_na,
    })

out.sort(key=lambda x: (x["cost"] if x["cost"] is not None else -1), reverse=True)

summary = {
    "total_terms": len(out),
    "total_cost": round(sum(x["cost"] for x in out if x["cost"] is not None), 2),
    "total_conv_value": round(sum(x["conv_value"] for x in out), 2),
    "keep_count": sum(1 for x in out if x["action"] == "Keep"),
    "exclude_count": sum(1 for x in out if x["action"].startswith("Exclude")),
    "cost_na_count": sum(1 for x in out if x["cost_na"]),
    "pmax_rows": sum(1 for x in out if "Performance Max" in x["match_type"]),
    "search_rows": sum(1 for x in out if x["match_type"] == "EXACT"),
}
summary["overall_roas"] = round(summary["total_conv_value"] / summary["total_cost"], 2) if summary["total_cost"] > 0 else 0

print(json.dumps(summary, indent=2))

with io.open(SP + r"\req3_fullrange_rows.json", "w", encoding="utf-8") as fo:
    json.dump({"summary": summary, "rows": out}, fo, ensure_ascii=False)

print("wrote", len(out), "rows")
