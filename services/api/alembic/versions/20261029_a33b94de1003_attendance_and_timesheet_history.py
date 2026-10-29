"""Append-only attendance events and timesheet version history with forced RLS.

Revision ID: a33b94de1003
Revises: f22a93cd1002
"""

import sqlalchemy as sa
from alembic import op

revision = "a33b94de1003"
down_revision = "f22a93cd1002"
branch_labels = None
depends_on = None

TABLES = ("shift_attendance_events", "shift_timesheet_versions")


def upgrade() -> None:
    op.create_table(
        "shift_attendance_events",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "booking_id",
            sa.UUID(),
            sa.ForeignKey("shift_bookings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("actor_role", sa.String(10), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("claimed_at", sa.DateTime(timezone=True)),
        sa.Column("claim_kind", sa.String(10)),
        sa.Column(
            "ref_event_id",
            sa.UUID(),
            sa.ForeignKey("shift_attendance_events.id", ondelete="RESTRICT"),
        ),
        sa.Column("time_zone", sa.String(64), nullable=False),
        sa.Column("note", sa.String(1000)),
        sa.CheckConstraint(
            "kind IN ('check_in', 'check_out', 'correction_requested', 'correction_approved', "
            "'correction_rejected', 'no_show_marked', 'no_show_reversed')",
            name="ck_attendance_kind",
        ),
        sa.CheckConstraint("actor_role IN ('candidate', 'employer')", name="ck_attendance_actor"),
    )
    op.create_index(
        "ix_shift_attendance_events_booking_id", "shift_attendance_events", ["booking_id"]
    )
    op.create_table(
        "shift_timesheet_versions",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "booking_id",
            sa.UUID(),
            sa.ForeignKey("shift_bookings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("break_minutes", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(1000)),
        sa.Column("review_note", sa.String(1000)),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("booking_id", "version", "status", name="uq_timesheet_version_status"),
    )
    op.create_index(
        "ix_shift_timesheet_versions_booking_id", "shift_timesheet_versions", ["booking_id"]
    )
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        # Visible only through a booking the caller can already see (candidate or employer team).
        op.execute(
            f"CREATE POLICY {table}_read ON {table} FOR SELECT USING (app_privileged() OR "  # noqa: S608
            "EXISTS (SELECT 1 FROM shift_bookings b WHERE b.id = booking_id))"
        )
        op.execute(
            f"CREATE POLICY {table}_insert ON {table} FOR INSERT WITH CHECK (app_privileged())"
        )
        # Updates/deletes pass RLS for system scope so the append-only trigger is the wall.
        op.execute(f"CREATE POLICY {table}_update ON {table} FOR UPDATE USING (app_privileged())")
        op.execute(f"CREATE POLICY {table}_delete ON {table} FOR DELETE USING (app_privileged())")
        op.execute(
            f"CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation()"
        )


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"DROP TABLE {table}")
