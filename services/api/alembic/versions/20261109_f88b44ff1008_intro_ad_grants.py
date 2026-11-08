"""Introductory free advertising grants (one per controlled publish).

Revision ID: f88b44ff1008
Revises: e77a33ee1007
Create Date: 2026-11-09

Additive: one new table. Members of an employer can read that employer's grants; only system
scope (the publish path) can insert or change them, so a member cannot grant themselves an ad.
Downgrade drops the table; published jobs keep their own expires_at.
"""

from alembic import op

revision = "f88b44ff1008"
down_revision = "e77a33ee1007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """CREATE TABLE intro_ad_grants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
      terms_version varchar(80) NOT NULL,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT ck_intro_ad_grants_window CHECK (ends_at > starts_at)
    )"""
    )
    op.execute("CREATE INDEX ix_intro_ad_grants_job_id ON intro_ad_grants(job_id)")
    op.execute(
        "CREATE INDEX ix_intro_ad_grants_employer_starts ON intro_ad_grants(employer_id, starts_at)"
    )
    op.execute("ALTER TABLE intro_ad_grants ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE intro_ad_grants FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY intro_ad_grants_read ON intro_ad_grants FOR SELECT "
        "USING (app_privileged() OR employer_id = ANY(app_employer_ids()))"
    )
    op.execute(
        "CREATE POLICY intro_ad_grants_insert ON intro_ad_grants FOR INSERT "
        "WITH CHECK (app_privileged())"
    )
    op.execute(
        "CREATE POLICY intro_ad_grants_update ON intro_ad_grants FOR UPDATE "
        "USING (app_privileged()) WITH CHECK (app_privileged())"
    )
    op.execute(
        "CREATE POLICY intro_ad_grants_delete ON intro_ad_grants FOR DELETE USING (app_privileged())"
    )


def downgrade() -> None:
    op.drop_table("intro_ad_grants")
