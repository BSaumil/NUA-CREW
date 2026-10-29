"""Builds the committed hospitality seed JSON from the supplied workbook.

    cd services/api
    uv run --with openpyxl python scripts/build_hospitality_seed.py \
        ../../docs/imports/hospitality/NUA_Crew_Hospitality_Roles_and_Paygrades_2026.xlsx

Output (deterministic, reviewable in git): app/data/hospitality/{roles,awards}.json.

Everything taken from the workbook or the PDF is marked ``supplied_unverified``: the figures have
not been reconciled against the live Fair Work pay guides. An administrator verifies a rate
version in the API; nothing here claims a Fair Work determination.
"""

import hashlib
import json
import re
import sys
from pathlib import Path

import openpyxl

OUT = Path(__file__).resolve().parent.parent / "app" / "data" / "hospitality"
EFFECTIVE_FROM = "2026-07-01"
SOURCE_NOTE = (
    "Supplied NUA Crew workbook/PDF edition 29 October 2026 (adult minimum ordinary rates from "
    "the first full pay period starting on or after 1 July 2026). Not yet reconciled against "
    "the official Fair Work pay guide."
)

DEPARTMENTS = {
    "Corporate and venue leadership": ("corporate-leadership", "management"),
    "Café and casual dining": ("cafe-casual-dining", "foh"),
    "Restaurant and fine-dining FOH": ("restaurant-fine-dining-foh", "foh"),
    "Bars pubs and beverage": ("bars-pubs-beverage", "foh"),
    "Kitchen and culinary": ("kitchen-culinary", "boh"),
    "Pastry bakery and dessert": ("pastry-bakery-dessert", "boh"),
    "Banquets weddings and events": ("banquets-events", "foh"),
    "Catering production and delivery": ("catering-production-delivery", "boh"),
    "Hotel front office and guest relations": ("hotel-front-office", "foh"),
    "Hotel housekeeping and accommodation": ("hotel-housekeeping", "support"),
    "Gaming and licensed clubs": ("gaming-licensed-clubs", "foh"),
    "Stewarding kitchen support and cleaning": ("stewarding-kitchen-support", "boh"),
    "Sales marketing finance admin and HR": ("sales-marketing-finance-hr", "support"),
    "Maintenance security wellness and stores": ("maintenance-security-stores", "support"),
}

# NUA curation (not a legal source): where a role is commonly found. Lets the employer flow
# narrow the role list by venue type. The award starting points mirror the PDF section 01 table.
VENUE_TYPES = {
    "cafe": ("Café", ["MA000119"], "likely"),
    "takeaway": ("Takeaway / quick service", ["MA000003"], "review"),
    "restaurant": ("Restaurant / bistro", ["MA000119"], "likely"),
    "fine_dining": ("Fine dining", ["MA000119"], "likely"),
    "bar_pub": ("Bar / pub", ["MA000009"], "review"),
    "club": ("Registered club / RSL", ["MA000058"], "likely"),
    "hotel_resort": ("Hotel / resort", ["MA000009"], "likely"),
    "banquet_venue": ("Function / banquet venue", ["MA000119", "MA000009"], "review"),
    "catering": ("Catering", ["MA000009", "MA000119"], "review"),
}
ALL_VENUES = list(VENUE_TYPES)
DEPARTMENT_VENUES = {
    "corporate-leadership": ALL_VENUES,
    "cafe-casual-dining": ["cafe", "takeaway", "restaurant"],
    "restaurant-fine-dining-foh": ["restaurant", "fine_dining", "hotel_resort"],
    "bars-pubs-beverage": ["bar_pub", "club", "restaurant", "hotel_resort"],
    "kitchen-culinary": ALL_VENUES,
    "pastry-bakery-dessert": [
        "cafe",
        "restaurant",
        "fine_dining",
        "hotel_resort",
        "banquet_venue",
        "catering",
    ],
    "banquets-events": ["banquet_venue", "hotel_resort", "catering"],
    "catering-production-delivery": ["catering", "banquet_venue"],
    "hotel-front-office": ["hotel_resort"],
    "hotel-housekeeping": ["hotel_resort"],
    "gaming-licensed-clubs": ["club"],
    "stewarding-kitchen-support": [
        "restaurant",
        "fine_dining",
        "hotel_resort",
        "club",
        "banquet_venue",
        "catering",
        "bar_pub",
    ],
    "sales-marketing-finance-hr": [
        "hotel_resort",
        "restaurant",
        "banquet_venue",
        "catering",
        "club",
    ],
    "maintenance-security-stores": ["hotel_resort", "club", "restaurant", "banquet_venue"],
}

# Curated spoken-language synonyms, keyed by lower-cased canonical title.
SYNONYMS = {
    "waiter / waitress": ["waiter", "waitress", "waitstaff", "wait staff", "server", "floor staff"],
    "senior waiter / section waiter": ["senior waiter", "section waiter", "station waiter"],
    "banquet waiter / waitress": ["banquet waiter", "function waiter", "function waitress"],
    "food and beverage attendant": [
        "f&b attendant",
        "fb attendant",
        "food and beverage staff",
        "waitstaff",
        "floor attendant",
    ],
    "club food and beverage attendant": ["club f&b attendant", "club waiter"],
    "banquet food and beverage attendant": ["banquet f&b attendant", "function staff"],
    "kitchen hand": ["kitchenhand", "kitchen assistant", "kitchen attendant"],
    "dishwasher / kitchen porter": [
        "dishwasher",
        "kitchen porter",
        "dish pig",
        "dishie",
        "plate washer",
    ],
    "pot washer / scullery attendant": ["pot washer", "scullery hand", "pot wash"],
    "chef de partie (cdp)": ["cdp", "chef de partie", "section chef", "station chef"],
    "qualified commis chef": ["commis", "commis chef", "trade commis"],
    "commis chef (unqualified)": ["commis", "commis chef", "junior cook"],
    "demi chef": ["demi chef de partie", "demi cdp"],
    "chef de cuisine / head chef": ["head chef", "chef de cuisine", "kitchen manager"],
    "sous chef": ["second chef", "sous"],
    "prep cook / kitchen cook": ["prep cook", "kitchen cook", "line cook"],
    "cook grade 1": ["cook gr 1", "cook level 1", "line cook"],
    "cook grade 2": ["cook gr 2", "cook level 2", "line cook"],
    "maître d'hôtel / maître d'": [
        "maitre d",
        "maitre d'hotel",
        "maitre d hotel",
        "restaurant host manager",
    ],
    "host / hostess": ["host", "hostess", "greeter", "front of house host"],
    "host / greeter": ["host", "greeter", "hostess"],
    "bussers / table clearer": ["busser", "bus boy", "table clearer", "clearer"],
    "busser / clearing attendant": ["busser", "bus boy", "table clearer"],
    "food runner": ["runner", "food expo", "expediter runner"],
    "barback": ["bar back", "bar-back", "bar assistant"],
    "glassy / glass collector": ["glassy", "glassie", "glass collector", "glass hand"],
    "bartender": ["barman", "barmaid", "barperson", "bar tender", "mixologist"],
    "bar attendant": ["bar staff", "barperson", "bar hand", "bar person"],
    "bottle shop attendant": ["bottle-o", "bottle o", "bottleshop", "liquor attendant"],
    "barista": ["coffee maker", "coffee person", "coffee artist"],
    "café all-rounder": ["cafe all rounder", "cafe hand", "cafe staff", "all rounder"],
    "counter attendant": ["counter staff", "front counter", "counter hand"],
    "cashier / pos attendant": ["cashier", "pos operator", "till operator", "front counter"],
    "gaming attendant": ["pokies attendant", "gaming room attendant", "gaming host"],
    "receptionist / front desk agent": [
        "receptionist",
        "front desk",
        "front desk agent",
        "front office agent",
    ],
    "room attendant / housekeeper": [
        "room attendant",
        "housekeeper",
        "room maid",
        "cleaner",
        "hotel cleaner",
    ],
    "porter / bell attendant": [
        "porter",
        "bellhop",
        "bell boy",
        "bell attendant",
        "luggage porter",
    ],
    "door attendant": ["doorman", "doorperson", "door person"],
    "doorperson / security officer": [
        "bouncer",
        "security guard",
        "crowd controller",
        "door security",
    ],
    "sommelier": ["wine waiter", "wine steward", "wine expert"],
    "executive chef": ["exec chef", "head of kitchen"],
    "bar / pub manager": ["pub manager", "bar manager", "licensee", "hotel manager"],
    "duty manager": ["dm", "duty mgr", "shift manager"],
    "shift supervisor": ["shift lead", "team leader", "shift leader"],
    "food and beverage supervisor": ["f&b supervisor", "fb supervisor"],
    "catering delivery driver": ["catering driver", "delivery driver", "van driver"],
    "event host / usher": ["usher", "event host", "event staff", "event crew"],
    "casual event crew": ["event crew", "event staff", "crew"],
    "pizza chef": ["pizzaiolo", "pizza maker", "pizzaiola"],
    "sushi chef": ["sushi itamae", "sushi maker", "itamae"],
    "baker": ["bread maker", "bakery hand"],
    "apprentice chef year 1": ["first year apprentice chef", "1st year apprentice chef"],
    "apprentice chef year 2": ["second year apprentice chef", "2nd year apprentice chef"],
    "apprentice chef year 3": ["third year apprentice chef", "3rd year apprentice chef"],
    "apprentice chef year 4": ["fourth year apprentice chef", "4th year apprentice chef"],
}


def norm(text: str) -> str:
    """Accent-insensitive search key (mirrors app.services.hospitality.catalogue.normalize)."""
    import unicodedata

    s = unicodedata.normalize("NFKD", text)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = s.replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()


def parse_indicative(text: str) -> dict:
    t = text.strip()
    low = t.lower()
    m = re.search(r"\bL(\d{1,2})(?:\s*[–-]\s*L?(\d{1,2}))?", t)
    level_min = level_max = None
    if m and "clubs l6–l13" not in low:
        level_min = int(m.group(1))
        level_max = int(m.group(2)) if m.group(2) else level_min
    needs_review = any(
        w in low
        for w in (
            "review",
            "check",
            "determine",
            "other award",
            "not employee",
            "apprentice",
            "introductory",
            "management",
            "managerial",
            "coverage",
            "supervisor",
            "trade",
            "electrical",
            "plumbing",
        )
    )
    # A single stated level is still only a lead, but it is not flagged as needing review by
    # itself; every classification is employer-confirmed in the pay assessment regardless.
    return {
        "indicative_text": t,
        "indicative_level_min": level_min,
        "indicative_level_max": level_max,
        "duties_based": "duties" in low or "qualif" in low or "if supervisor" in low,
        "apprentice": "apprentice" in low,
        "introductory": "introductory" in low,
        "needs_review": needs_review,
    }


def cents(value: object) -> int:
    from decimal import Decimal

    return int((Decimal(str(value)) * 100).quantize(Decimal("1")))


def build_roles(wb) -> tuple[list[dict], list[dict], dict]:
    rows = [r for r in wb["ROLE CATALOGUE"].iter_rows(min_row=2, values_only=True) if r[0]]
    depts: dict[str, dict] = {}
    roles = []
    for i, r in enumerate(rows, start=1):
        code, dept_name, tier, title, indicative, scope, note, url = (
            str(c).strip() if c is not None else "" for c in r[:8]
        )
        slug, workstream = DEPARTMENTS[dept_name]
        depts.setdefault(
            slug,
            {
                "code": slug,
                "name": dept_name,
                "workstream": workstream,
                "sort_order": len(depts) + 1,
            },
        )
        tier_n = int(tier)
        aliases: dict[str, str] = {}
        parts = [p.strip() for p in re.split(r"\s/\s", title)]
        for p in parts:
            paren = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", p)
            variants = [paren.group(1), paren.group(2)] if paren else [p]
            for v in variants:
                if v and norm(v) and norm(v) != norm(title):
                    aliases.setdefault(norm(v), v)
        for s in SYNONYMS.get(title.lower(), []):
            if norm(s) != norm(title):
                aliases.setdefault(norm(s), s)
        roles.append(
            {
                "code": code,
                "title": title,
                "department_code": slug,
                "tier": tier_n,
                "workstream": "management" if tier_n <= 4 else workstream,
                "sort_order": i,
                "scope_text": scope,
                "compliance_note": note,
                "source_url": url,
                "aliases": [{"alias": a, "kind": "variant"} for a in aliases.values()],
                **parse_indicative(indicative),
            }
        )
    venue_map = {slug: DEPARTMENT_VENUES[slug] for slug in depts if slug in DEPARTMENT_VENUES}
    return list(depts.values()), roles, venue_map


def build_awards(wb) -> dict:
    instruments = [
        {
            "code": "MA000119",
            "title": "Restaurant Industry Award 2020",
            "source_url": "https://awards.fairwork.gov.au/MA000119.html",
        },
        {
            "code": "MA000009",
            "title": "Hospitality Industry (General) Award 2020",
            "source_url": "https://awards.fairwork.gov.au/MA000009.html",
        },
        {
            "code": "MA000003",
            "title": "Fast Food Industry Award 2020",
            "source_url": "https://awards.fairwork.gov.au/MA000003.html",
        },
        {
            "code": "MA000058",
            "title": "Registered and Licensed Clubs Award 2020",
            "source_url": "https://awards.fairwork.gov.au/MA000058.html",
        },
    ]
    classifications: list[dict] = []
    rates: list[dict] = []

    def add(
        inst: str,
        code: str,
        label: str,
        desc: str,
        kind: str,
        order: int,
        weekly,
        hourly,
        casual,
        annual,
        url: str,
    ):
        classifications.append(
            {
                "instrument_code": inst,
                "code": code,
                "label": label,
                "description": desc,
                "kind": kind,
                "sort_order": order,
            }
        )
        rates.append(
            {
                "instrument_code": inst,
                "classification_code": code,
                "effective_from": EFFECTIVE_FROM,
                "weekly_minor": cents(weekly),
                "hourly_minor": cents(hourly),
                "supplied_casual_ordinary_minor": cents(casual),
                "annual_minimum_minor": cents(annual) if annual else None,
                "source_url": url,
                "data_status": "supplied_unverified",
                "source_note": SOURCE_NOTE,
            }
        )

    for r in wb["RESTAURANT + HOSPITALITY"].iter_rows(min_row=2, values_only=True):
        if not r[0]:
            continue
        inst = "MA000119" if "MA000119" in str(r[0]) else "MA000009"
        label = str(r[1])
        code = "INTRO" if label == "Introductory" else "L" + label.split()[-1]
        order = 0 if code == "INTRO" else int(code[1:])
        add(inst, code, label, str(r[2]), "operative", order, r[3], r[4], r[5], None, str(r[7]))
    for n, r in enumerate(
        wb["FAST FOOD"].iter_rows(min_row=2, max_row=5, values_only=True), start=1
    ):
        code = ["FF1", "FF2", "FF3A", "FF3B"][n - 1]
        add(
            "MA000003",
            code,
            str(r[0]),
            str(r[5]),
            "operative",
            n,
            r[1],
            r[2],
            r[3],
            None,
            str(r[6]),
        )
    for r in wb["LICENSED CLUBS"].iter_rows(min_row=2, values_only=True):
        if not r[0]:
            continue
        label = str(r[0])
        if label == "Introductory":
            code, kind, order = "INTRO", "operative", 0
        elif label == "Level 6 - Manager":
            code, kind, order = "L6M", "manager", 6
        else:
            n = int(label.split()[-1])
            code, kind, order = f"L{n}", ("manager" if n >= 7 else "operative"), n
        add(
            "MA000058",
            code,
            label,
            str(r[1]),
            kind,
            order,
            r[2],
            r[3],
            r[4],
            r[5] or None,
            str(r[6]),
        )

    def rule(inst, emp, codes, day, bp, note=""):
        return {
            "instrument_code": inst,
            "employment": emp,
            "classification_codes": codes,
            "day_kind": day,
            "multiplier_bp": bp,
            "effective_from": EFFECTIVE_FROM,
            "source_url": next(i["source_url"] for i in instruments if i["code"] == inst),
            "data_status": "supplied_unverified",
            "source_note": "PDF section 04 / workbook PENALTIES + SPECIAL RULES; " + note,
        }

    # Multipliers are basis points of the permanent ordinary hourly rate; casual rows include the
    # 25% loading (the PDF's own worked example: casual Sunday 150% x $27.08 = $40.62).
    r_all = ["INTRO", "L1", "L2", "L3", "L4", "L5", "L6"]
    r_low, r_high = ["INTRO", "L1", "L2"], ["L3", "L4", "L5", "L6"]
    penalties = []
    for inst in ("MA000119", "MA000009"):
        for day, bp in (
            ("weekday", 10000),
            ("saturday", 12500),
            ("sunday", 15000),
            ("public_holiday", 22500),
        ):
            penalties.append(rule(inst, "permanent", r_all, day, bp))
    for day, bp in (
        ("weekday", 12500),
        ("saturday", 15000),
        ("sunday", 15000),
        ("public_holiday", 25000),
    ):
        penalties.append(rule("MA000119", "casual", r_low, day, bp))
    for day, bp in (
        ("weekday", 12500),
        ("saturday", 15000),
        ("sunday", 17500),
        ("public_holiday", 25000),
    ):
        penalties.append(rule("MA000119", "casual", r_high, day, bp))
        penalties.append(rule("MA000009", "casual", r_all, day, bp))
    ff = {
        ("permanent", ("FF1",)): (10000, 12500, 12500, 22500),
        ("permanent", ("FF2", "FF3A", "FF3B")): (10000, 12500, 15000, 22500),
        ("casual", ("FF1",)): (12500, 15000, 15000, 25000),
        ("casual", ("FF2", "FF3A", "FF3B")): (12500, 15000, 17500, 25000),
    }
    for (emp, codes), bps in ff.items():
        for day, bp in zip(("weekday", "saturday", "sunday", "public_holiday"), bps, strict=True):
            penalties.append(rule("MA000003", emp, list(codes), day, bp))
    # Clubs: only ordinary weekday and the casual loading are stated unambiguously in the
    # supplied rate sheet. Weekend and public-holiday clubs rules are "common F&B grades" only
    # and vary by category, so they are deliberately NOT encoded (the engine reports them as
    # missing_source rather than guessing).
    clubs_all = [c["code"] for c in classifications if c["instrument_code"] == "MA000058"]
    penalties.append(rule("MA000058", "permanent", clubs_all, "weekday", 10000, "ordinary rate"))
    penalties.append(
        rule("MA000058", "casual", clubs_all, "weekday", 12500, "25% casual loading per rate sheet")
    )
    return {
        "effective_from": EFFECTIVE_FROM,
        "instruments": instruments,
        "classifications": classifications,
        "rate_versions": rates,
        "penalty_rules": penalties,
        "venue_types": [
            {"code": k, "name": v[0], "award_leads": v[1], "coverage_confidence": v[2]}
            for k, v in VENUE_TYPES.items()
        ],
    }


def main(path: str) -> None:
    wb = openpyxl.load_workbook(path, data_only=True)
    departments, roles, venue_map = build_roles(wb)
    awards = build_awards(wb)
    OUT.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    meta = {
        "source_workbook": Path(path).name,
        "source_sha256": digest,
        "edition": "2026-10-29",
        "role_count": len(roles),
        "department_count": len(departments),
    }
    (OUT / "roles.json").write_text(
        json.dumps(
            {
                "meta": meta,
                "departments": departments,
                "roles": roles,
                "department_venues": venue_map,
            },
            ensure_ascii=False,
            indent=1,
            sort_keys=False,
        )
        + "\n",
        encoding="utf-8",
    )
    (OUT / "awards.json").write_text(
        json.dumps({"meta": meta, **awards}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print(
        f"roles={len(roles)} departments={len(departments)} "
        f"aliases={sum(len(r['aliases']) for r in roles)} "
        f"classifications={len(awards['classifications'])} rates={len(awards['rate_versions'])} "
        f"penalty_rules={len(awards['penalty_rules'])}"
    )


if __name__ == "__main__":
    main(sys.argv[1])
