"""Enforce confirmed commitment exclusion in the database.

Revision ID: a31c91e5a401
Revises: d04d303111e7
"""

from alembic import op

revision = "a31c91e5a401"
down_revision = "d04d303111e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extensions are provisioned by the database administrator, never the runtime role.
    op.execute("""
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
            RAISE EXCEPTION 'Install btree_gist using db/roles/bootstrap.sql before migrating';
          END IF;
        END $$
    """)
    # Existing overlaps intentionally stop migration; never silently discard booked work.
    op.execute("""
        ALTER TABLE commitments ADD CONSTRAINT ex_commitments_confirmed_overlap
        EXCLUDE USING gist (
            candidate_id WITH =,
            tstzrange(starts_at, ends_at, '[)') WITH &&
        ) WHERE (status = 'confirmed')
    """)


def downgrade() -> None:
    op.drop_constraint("ex_commitments_confirmed_overlap", "commitments")
    # btree_gist can be shared by other schemas; leave its lifecycle to the administrator.
