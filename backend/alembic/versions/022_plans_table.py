"""plans table — Starter / Pro / Enterprise tiers definition

Revision ID: 022
Revises: 021
Create Date: 2026-06-25
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "022"
down_revision: Union[str, None] = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.String(36), primary_key=True),
        # Identificador del tier — matchea con stores.subscription_tier
        sa.Column("tier", sa.String(20), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # Precios base en centavos USD (Integer evita floating point)
        sa.Column("price_monthly_cents", sa.Integer, nullable=False),
        sa.Column("price_yearly_cents", sa.Integer, nullable=False),
        sa.Column("setup_fee_cents", sa.Integer, nullable=False, server_default="0"),
        # Add-ons en centavos USD
        sa.Column("store_price_monthly_cents", sa.Integer, nullable=False),
        sa.Column("seller_extra_price_monthly_cents", sa.Integer, nullable=False, server_default="0"),
        sa.Column("conversation_overage_price_cents", sa.Integer, nullable=False, server_default="0"),
        # Límites incluidos en el plan base
        sa.Column("conversations_included_per_month", sa.Integer, nullable=False),
        sa.Column("sellers_included", sa.Integer, nullable=False),
        sa.Column(
            "allow_extra_sellers",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        # Features que incluye — JSON list de strings
        sa.Column("features", sa.Text, nullable=False),
        # Display
        sa.Column(
            "is_active",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("plans")
