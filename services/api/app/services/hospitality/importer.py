"""Idempotent import of the committed hospitality seed (app/data/hospitality/*.json).

Works on a plain synchronous connection so the Alembic migration, the CLI and tests share one
implementation:  ``await conn.run_sync(import_seed)``  or  ``import_seed(op.get_bind())``.

Re-running never duplicates rows: roles, aliases, classifications, rate versions and penalty
rules are upserted on their natural keys. Verification state (``data_status``/``verified_*``)
set by an administrator is preserved when the same figures are re-imported; if the seed changes a
figure, the row returns to ``supplied_unverified`` so a changed number can never stay "verified".
"""

import json
import uuid
from datetime import date
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, insert

from app.services.hospitality.normalize import normalize

DATA = Path(__file__).resolve().parents[2] / "data" / "hospitality"
meta = sa.MetaData()

departments = sa.Table(
    "hospitality_departments",
    meta,
    sa.Column("code", sa.String, primary_key=True),
    sa.Column("name", sa.String),
    sa.Column("workstream", sa.String),
    sa.Column("sort_order", sa.Integer),
)
roles = sa.Table(
    "hospitality_roles",
    meta,
    sa.Column("code", sa.String, primary_key=True),
    sa.Column("title", sa.String),
    sa.Column("title_norm", sa.String),
    sa.Column("department_code", sa.String),
    sa.Column("tier", sa.Integer),
    sa.Column("workstream", sa.String),
    sa.Column("sort_order", sa.Integer),
    sa.Column("scope_text", sa.String),
    sa.Column("compliance_note", sa.Text),
    sa.Column("source_url", sa.Text),
    sa.Column("indicative_text", sa.String),
    sa.Column("indicative_level_min", sa.Integer),
    sa.Column("indicative_level_max", sa.Integer),
    sa.Column("duties_based", sa.Boolean),
    sa.Column("apprentice", sa.Boolean),
    sa.Column("introductory", sa.Boolean),
    sa.Column("needs_review", sa.Boolean),
    sa.Column("status", sa.String),
)
aliases = sa.Table(
    "hospitality_role_aliases",
    meta,
    sa.Column("role_code", sa.String),
    sa.Column("alias", sa.String),
    sa.Column("alias_norm", sa.String),
)
venue_types = sa.Table(
    "venue_types",
    meta,
    sa.Column("code", sa.String, primary_key=True),
    sa.Column("name", sa.String),
    sa.Column("award_leads", ARRAY(sa.String)),
    sa.Column("coverage_confidence", sa.String),
)
compat = sa.Table(
    "role_venue_compatibility",
    meta,
    sa.Column("role_code", sa.String, primary_key=True),
    sa.Column("venue_code", sa.String, primary_key=True),
)
instruments = sa.Table(
    "industrial_instruments",
    meta,
    sa.Column("code", sa.String, primary_key=True),
    sa.Column("title", sa.String),
    sa.Column("kind", sa.String),
    sa.Column("source_url", sa.Text),
    sa.Column("status", sa.String),
)
classifications = sa.Table(
    "award_classifications",
    meta,
    sa.Column("id", sa.Uuid, primary_key=True),
    sa.Column("instrument_code", sa.String),
    sa.Column("code", sa.String),
    sa.Column("label", sa.String),
    sa.Column("description", sa.Text),
    sa.Column("kind", sa.String),
    sa.Column("sort_order", sa.Integer),
)
rates = sa.Table(
    "award_rate_versions",
    meta,
    sa.Column("id", sa.Uuid, primary_key=True),
    sa.Column("classification_id", sa.Uuid),
    sa.Column("effective_from", sa.Date),
    sa.Column("effective_to", sa.Date),
    sa.Column("weekly_minor", sa.Integer),
    sa.Column("hourly_minor", sa.Integer),
    sa.Column("supplied_casual_ordinary_minor", sa.Integer),
    sa.Column("annual_minimum_minor", sa.Integer),
    sa.Column("source_url", sa.Text),
    sa.Column("data_status", sa.String),
    sa.Column("source_note", sa.Text),
    sa.Column("verified_by", sa.Uuid),
    sa.Column("verified_at", sa.DateTime(timezone=True)),
)
penalties = sa.Table(
    "penalty_rule_versions",
    meta,
    sa.Column("id", sa.Uuid, primary_key=True),
    sa.Column("instrument_code", sa.String),
    sa.Column("employment", sa.String),
    sa.Column("classification_codes", ARRAY(sa.String)),
    sa.Column("day_kind", sa.String),
    sa.Column("multiplier_bp", sa.Integer),
    sa.Column("effective_from", sa.Date),
    sa.Column("effective_to", sa.Date),
    sa.Column("source_url", sa.Text),
    sa.Column("data_status", sa.String),
    sa.Column("source_note", sa.Text),
    sa.Column("verified_by", sa.Uuid),
    sa.Column("verified_at", sa.DateTime(timezone=True)),
)


def load(name: str) -> dict[str, Any]:
    return json.loads((DATA / name).read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def import_seed(conn: sa.Connection) -> dict[str, int]:
    roles_doc, awards_doc = load("roles.json"), load("awards.json")
    counts: dict[str, int] = {}

    def upsert(
        table: sa.Table, rows: list[dict[str, Any]], keys: list[str], skip: set[str]
    ) -> None:
        if not rows:
            return
        stmt = insert(table)
        update = {c.name: stmt.excluded[c.name] for c in table.columns if c.name not in skip}
        conn.execute(stmt.on_conflict_do_update(index_elements=keys, set_=update), rows)

    upsert(departments, roles_doc["departments"], ["code"], {"code"})
    role_rows = []
    alias_rows = []
    for r in roles_doc["roles"]:
        role_rows.append(
            {
                **{
                    k: r[k]
                    for k in (
                        "code",
                        "title",
                        "department_code",
                        "tier",
                        "workstream",
                        "sort_order",
                        "scope_text",
                        "compliance_note",
                        "source_url",
                        "indicative_text",
                        "indicative_level_min",
                        "indicative_level_max",
                        "duties_based",
                        "apprentice",
                        "introductory",
                        "needs_review",
                    )
                },
                "title_norm": normalize(r["title"]),
                "status": "active",
            }
        )
        for a in r["aliases"]:
            alias_rows.append(
                {"role_code": r["code"], "alias": a["alias"], "alias_norm": normalize(a["alias"])}
            )
    upsert(roles, role_rows, ["code"], {"code"})
    # Aliases: natural key (role_code, alias_norm); drop aliases no longer in the seed.
    conn.execute(sa.text("DELETE FROM hospitality_role_aliases"))
    if alias_rows:
        conn.execute(insert(aliases), alias_rows)
    counts["roles"] = len(role_rows)
    counts["aliases"] = len(alias_rows)
    counts["departments"] = len(roles_doc["departments"])

    upsert(
        venue_types,
        awards_doc["venue_types"],
        ["code"],
        {"code"},
    )
    conn.execute(sa.text("DELETE FROM role_venue_compatibility"))
    compat_rows = [
        {"role_code": r["code"], "venue_code": v}
        for r in roles_doc["roles"]
        for v in roles_doc["department_venues"][r["department_code"]]
    ]
    conn.execute(insert(compat), compat_rows)

    upsert(
        instruments,
        [{**i, "kind": "award", "status": "active"} for i in awards_doc["instruments"]],
        ["code"],
        {"code"},
    )

    existing = {
        (r.instrument_code, r.code): r.id
        for r in conn.execute(
            sa.select(
                classifications.c.id, classifications.c.instrument_code, classifications.c.code
            )
        )
    }
    new_class = []
    for c in awards_doc["classifications"]:
        key = (c["instrument_code"], c["code"])
        cid = existing.get(key)
        if cid is None:
            cid = uuid.uuid4()
            existing[key] = cid
        new_class.append({"id": cid, **c})
    upsert(classifications, new_class, ["id"], {"id", "instrument_code", "code"})
    counts["classifications"] = len(new_class)

    # Rate versions: keep an administrator's verification only if every figure is unchanged.
    current = {(r.classification_id, r.effective_from): r for r in conn.execute(sa.select(rates))}
    rate_rows = []
    for rv in awards_doc["rate_versions"]:
        cid = existing[(rv["instrument_code"], rv["classification_code"])]
        eff = date.fromisoformat(rv["effective_from"])
        old = current.get((cid, eff))
        row = {
            "id": old.id if old else uuid.uuid4(),
            "classification_id": cid,
            "effective_from": eff,
            "effective_to": None,
            **{
                k: rv[k]
                for k in (
                    "weekly_minor",
                    "hourly_minor",
                    "supplied_casual_ordinary_minor",
                    "annual_minimum_minor",
                    "source_url",
                    "source_note",
                )
            },
            "data_status": "supplied_unverified",
            "verified_by": None,
            "verified_at": None,
        }
        if (
            old
            and old.data_status == "verified"
            and (
                old.weekly_minor,
                old.hourly_minor,
                old.annual_minimum_minor,
            )
            == (row["weekly_minor"], row["hourly_minor"], row["annual_minimum_minor"])
        ):
            row["data_status"], row["verified_by"], row["verified_at"] = (
                "verified",
                old.verified_by,
                old.verified_at,
            )
        rate_rows.append(row)
    upsert(
        rates,
        rate_rows,
        ["classification_id", "effective_from"],
        {"id", "classification_id", "effective_from", "effective_to"},
    )
    counts["rate_versions"] = len(rate_rows)

    current_pen = {
        (
            r.instrument_code,
            r.employment,
            r.day_kind,
            r.effective_from,
            tuple(r.classification_codes),
        ): r
        for r in conn.execute(sa.select(penalties))
    }
    pen_rows = []
    for p in awards_doc["penalty_rules"]:
        eff = date.fromisoformat(p["effective_from"])
        pkey = (
            p["instrument_code"],
            p["employment"],
            p["day_kind"],
            eff,
            tuple(p["classification_codes"]),
        )
        old = current_pen.get(pkey)
        row = {
            "id": old.id if old else uuid.uuid4(),
            "instrument_code": p["instrument_code"],
            "employment": p["employment"],
            "classification_codes": p["classification_codes"],
            "day_kind": p["day_kind"],
            "multiplier_bp": p["multiplier_bp"],
            "effective_from": eff,
            "effective_to": None,
            "source_url": p["source_url"],
            "source_note": p["source_note"],
            "data_status": "supplied_unverified",
            "verified_by": None,
            "verified_at": None,
        }
        if old and old.data_status == "verified" and old.multiplier_bp == row["multiplier_bp"]:
            row["data_status"], row["verified_by"], row["verified_at"] = (
                "verified",
                old.verified_by,
                old.verified_at,
            )
        pen_rows.append(row)
    for row in pen_rows:
        stmt = insert(penalties).values(row)
        conn.execute(
            stmt.on_conflict_do_update(
                constraint="uq_penalty_rule",
                set_={
                    k: stmt.excluded[k]
                    for k in (
                        "multiplier_bp",
                        "source_url",
                        "source_note",
                        "data_status",
                        "verified_by",
                        "verified_at",
                    )
                },
            )
        )
    counts["penalty_rules"] = len(pen_rows)
    return counts
