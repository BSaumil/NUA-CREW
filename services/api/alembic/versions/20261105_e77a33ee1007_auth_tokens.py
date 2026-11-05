"""One-time email tokens for password reset and email verification.

Revision ID: e77a33ee1007
Revises: d66e11cc1006
Create Date: 2026-11-05

Additive: one new table. Only the SHA-256 of each token is stored. The table is reachable only in
system scope (the same policy as refresh_tokens), so the runtime role cannot read or write tokens
on behalf of a signed-in user. Downgrade drops the table; outstanding tokens simply stop working.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "e77a33ee1007"
down_revision = "d66e11cc1006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("purpose", sa.String(32), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "purpose IN ('password_reset', 'email_verification')", name="ck_auth_tokens_purpose"
        ),
        sa.UniqueConstraint("token_hash", name="uq_auth_tokens_token_hash"),
    )
    op.create_index("ix_auth_tokens_user_purpose", "auth_tokens", ["user_id", "purpose"])
    op.execute("ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE auth_tokens FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY auth_tokens_system ON auth_tokens FOR ALL "
        "USING (app_privileged()) WITH CHECK (app_privileged())"
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS auth_tokens_system ON auth_tokens")
    op.drop_index("ix_auth_tokens_user_purpose", table_name="auth_tokens")
    op.drop_table("auth_tokens")
