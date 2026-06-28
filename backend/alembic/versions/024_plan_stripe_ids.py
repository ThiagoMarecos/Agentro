"""plan stripe product/price IDs — para crear subscriptions

Revision ID: 024
Revises: 023
Create Date: 2026-06-25
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Stripe Product (uno por tier) y Prices (uno por período de facturación)
    op.add_column(
        "plans",
        sa.Column("stripe_product_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "plans",
        sa.Column("stripe_price_monthly_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "plans",
        sa.Column("stripe_price_yearly_id", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("plans", "stripe_price_yearly_id")
    op.drop_column("plans", "stripe_price_monthly_id")
    op.drop_column("plans", "stripe_product_id")
