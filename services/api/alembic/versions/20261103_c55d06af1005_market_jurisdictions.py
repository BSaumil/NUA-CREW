"""Nullable country codes with evidence-only AU backfill.

Revision ID: c55d06af1005
Revises: b44c05ef1004
Create Date: 2026-11-03
"""
import sqlalchemy as sa
from alembic import op

revision = "c55d06af1005"
down_revision = "b44c05ef1004"
branch_labels = None
depends_on = None

TABLES = ("employers", "jobs", "shifts", "pay_assessments")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column("country_code", sa.String(2), nullable=True))
        op.create_check_constraint(
            f"ck_{table}_country_code",
            table,
            "country_code IS NULL OR country_code ~ '^[A-Z]{2}$'",
        )
    # ABN is an AU business identifier, not proof that every site is in AU.
    op.execute(
        """
        UPDATE employers SET country_code = 'AU'
        WHERE country_code IS NULL AND abn ~ '^[0-9]{11}$'
        """
    )
    # A linked workplace with an AU state, postcode and AUD currency is evidence.
    # Unlinked/foreign/ambiguous jobs stay NULL for review.
    op.execute(
        """
        UPDATE jobs AS j SET country_code = 'AU'
        FROM locations AS l
        WHERE j.location_id = l.id
          AND j.country_code IS NULL
          AND l.country = 'AU'
          AND l.state IN ('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
          AND l.postcode ~ '^[0-9]{4}$'
          AND j.pay_currency = 'AUD'
        """
    )
    op.execute(
        """
        UPDATE shifts AS s SET country_code = 'AU'
        FROM jobs AS j
        WHERE s.job_id = j.id AND s.country_code IS NULL AND j.country_code = 'AU'
        """
    )
    op.execute(
        """
        UPDATE pay_assessments AS p SET country_code = 'AU'
        FROM jobs AS j
        WHERE p.job_id = j.id AND p.country_code IS NULL AND j.country_code = 'AU'
        """
    )


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_constraint(f"ck_{table}_country_code", table, type_="check")
        op.drop_column(table, "country_code")
