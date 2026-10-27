"""Shift offers, atomic booking and timesheet review with forced RLS.

Revision ID: e11a92bc1001
Revises: a31c91e5a401
"""

import sqlalchemy as sa
from alembic import op

revision = "e11a92bc1001"
down_revision = "a31c91e5a401"
branch_labels = None
depends_on = None


def columns():
    return [
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "shifts",
        *columns(),
        sa.Column(
            "employer_id",
            sa.UUID(),
            sa.ForeignKey("employers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id", sa.UUID(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("time_zone", sa.String(64), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("hourly_rate_minor", sa.Integer(), nullable=False),
        sa.Column("super_included", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="open"),
        sa.CheckConstraint("ends_at > starts_at", name="ck_shift_window"),
        sa.CheckConstraint("capacity BETWEEN 1 AND 50", name="ck_shift_capacity"),
        sa.CheckConstraint("hourly_rate_minor > 0", name="ck_shift_rate"),
        sa.CheckConstraint("status IN ('open', 'cancelled')", name="ck_shift_status"),
    )
    op.create_table(
        "shift_bookings",
        *columns(),
        sa.Column(
            "shift_id", sa.UUID(), sa.ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "employer_id",
            sa.UUID(),
            sa.ForeignKey("employers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "candidate_id",
            sa.UUID(),
            sa.ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "conversation_id",
            sa.UUID(),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("candidate_label", sa.String(200), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="offered"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "commitment_id",
            sa.UUID(),
            sa.ForeignKey("commitments.id", ondelete="RESTRICT"),
            unique=True,
        ),
        sa.Column("reason", sa.String(1000)),
        sa.UniqueConstraint("shift_id", "candidate_id", name="uq_shift_candidate"),
        sa.CheckConstraint(
            "status IN ('offered', 'confirmed', 'declined', 'cancelled')", name="ck_booking_status"
        ),
    )
    op.create_table(
        "shift_timesheets",
        *columns(),
        sa.Column(
            "booking_id",
            sa.UUID(),
            sa.ForeignKey("shift_bookings.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("break_minutes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="submitted"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("note", sa.String(1000)),
        sa.Column("review_note", sa.String(1000)),
        sa.CheckConstraint(
            "ends_at > starts_at AND break_minutes >= 0", name="ck_timesheet_window"
        ),
        sa.CheckConstraint(
            "status IN ('submitted', 'approved', 'disputed')", name="ck_timesheet_status"
        ),
    )
    # No candidate profile identifiers are returned to employers by the HTTP schemas.
    # System scope performs cross-party writes; participants can only read their records.
    visibility = {
        "shift_bookings": "candidate_id = app_candidate_id() OR employer_id = ANY(app_employer_ids())",
        "shifts": "employer_id = ANY(app_employer_ids()) OR EXISTS (SELECT 1 FROM shift_bookings b WHERE b.shift_id = shifts.id AND b.candidate_id = app_candidate_id())",
        "shift_timesheets": "EXISTS (SELECT 1 FROM shift_bookings b WHERE b.id = booking_id)",
    }
    for table, rule in visibility.items():
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_read ON {table} FOR SELECT USING (app_privileged() OR {rule})"
        )
        for action in ("INSERT", "UPDATE", "DELETE"):
            clause = (
                "WITH CHECK (app_privileged())"
                if action == "INSERT"
                else "USING (app_privileged())"
            )
            if action == "UPDATE":
                clause += " WITH CHECK (app_privileged())"
            op.execute(f"CREATE POLICY {table}_{action.lower()} ON {table} FOR {action} {clause}")


def downgrade() -> None:
    op.drop_table("shift_timesheets")
    op.drop_table("shift_bookings")
    op.drop_table("shifts")
