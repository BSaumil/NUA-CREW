"""Record the employer's first promotion discount and the exact checkout price."""

import sqlalchemy as sa
from alembic import op

revision = "a16b83ae1009"
down_revision = "f88b44ff1008"
branch_labels = None
depends_on = None

HISTORIC_AMOUNTS = "amount_minor IN (1900, 3000, 4900, 7900)"
DISCOUNTED_AMOUNTS = (
    "(action = 'promote_existing' AND amount_minor = 1500) OR "
    "(action = 'new_promoted_ad' AND amount_minor = 6400)"
)


def upgrade() -> None:
    op.add_column(
        "employers",
        sa.Column(
            "first_job_promotion_redeemed", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
    )
    op.add_column(
        "billing_orders",
        sa.Column(
            "first_promotion_discount", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
    )
    op.drop_constraint("ck_order_amount", "billing_orders", type_="check")
    op.create_check_constraint(
        "ck_order_amount",
        "billing_orders",
        f"(first_promotion_discount AND ({DISCOUNTED_AMOUNTS})) OR "
        f"(NOT first_promotion_discount AND {HISTORIC_AMOUNTS})",
    )


def downgrade() -> None:
    op.drop_constraint("ck_order_amount", "billing_orders", type_="check")
    # PostgreSQL rejects this downgrade if discounted orders exist, preserving billing history.
    op.create_check_constraint("ck_order_amount", "billing_orders", HISTORIC_AMOUNTS)
    op.drop_column("billing_orders", "first_promotion_discount")
    op.drop_column("employers", "first_job_promotion_redeemed")
