"""Allow new A$49 ads and A$79 ad + promotion orders while retaining historic prices.

Revision ID: d66e11cc1006
Revises: c55d06a11005
Create Date: 2026-11-05

The old catalogue charged 1900 for an ad and 4900 for a promoted ad.
Historic orders are immutable and must remain valid. The new catalogue uses
4900 for an ad and 7900 for a promoted ad; 3000 for promotion is unchanged.
No existing rows are rewritten. Production migration requires independent approval.
"""

import sqlalchemy as sa
from alembic import op

revision = "d66e11cc1006"
down_revision = "c55d06a11005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_order_amount", "billing_orders", type_="check")
    op.create_check_constraint(
        "ck_order_amount",
        "billing_orders",
        "amount_minor IN (1900, 3000, 4900, 7900)",
    )


def downgrade() -> None:
    connection = op.get_bind()
    has_new_bundles = connection.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM billing_orders WHERE amount_minor = 7900)")
    ).scalar_one()
    if has_new_bundles:
        raise RuntimeError(
            "Cannot downgrade billing prices while A$79 orders exist; "
            "preserve settled/pending orders and use an approved roll-forward plan."
        )
    op.drop_constraint("ck_order_amount", "billing_orders", type_="check")
    op.create_check_constraint(
        "ck_order_amount",
        "billing_orders",
        "amount_minor IN (1900, 3000, 4900)",
    )
