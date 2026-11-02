"""Add nullable employment jurisdictions without relabelling existing data.

Revision ID: c55d06a11005
Revises: b44c05ef1004
Create Date: 2026-11-03

No data backfill: job postings, source observations and historical pay assessments
are not automatically classified as Australian. Existing locations retain the
pre-existing AU default; that is not evidence for other legacy records.
Existing RLS policies are unaffected because these are existing protected tables.
"""

import sqlalchemy as sa
from alembic import op

revision = "c55d06a11005"
down_revision = "b44c05ef1004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employers", sa.Column("country_code", sa.String(2), nullable=True))
    op.add_column("jobs", sa.Column("country_code", sa.String(2), nullable=True))
    op.add_column("shifts", sa.Column("country_code", sa.String(2), nullable=True))
    op.add_column("pay_assessments", sa.Column("country_code", sa.String(2), nullable=True))
    op.add_column("pay_assessments", sa.Column("ruleset_code", sa.String(64), nullable=True))

    for table in ("employers", "jobs", "shifts", "pay_assessments"):
        op.create_check_constraint(
            f"ck_{table}_country_code",
            table,
            "country_code IS NULL OR country_code ~ '^[A-Z]{2}$'",
        )
    op.create_check_constraint(
        "ck_locations_country_iso",
        "locations",
        "country ~ '^[A-Z]{2}$'",
    )
    op.create_index("ix_jobs_country_code", "jobs", ["country_code"])


def downgrade() -> None:
    op.drop_index("ix_jobs_country_code", table_name="jobs")
    op.drop_constraint("ck_locations_country_iso", "locations", type_="check")
    for table in ("pay_assessments", "shifts", "jobs", "employers"):
        op.drop_constraint(f"ck_{table}_country_code", table, type_="check")
    op.drop_column("pay_assessments", "ruleset_code")
    for table in ("pay_assessments", "shifts", "jobs", "employers"):
        op.drop_column(table, "country_code")
