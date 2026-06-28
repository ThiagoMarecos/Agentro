"""discounts — registros de descuentos aplicados por super admin

Revision ID: 025
Revises: 024
Create Date: 2026-06-25
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "discounts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "store_id",
            sa.String(36),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "applied_by_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # Stripe IDs
        sa.Column("stripe_coupon_id", sa.String(255), nullable=False),
        sa.Column("stripe_discount_id", sa.String(255), nullable=True),
        # Datos del descuento
        sa.Column("discount_type", sa.String(20), nullable=False),   # 'percent' | 'amount'
        sa.Column("discount_value", sa.Integer, nullable=False),
        sa.Column("duration", sa.String(20), nullable=False),         # 'once' | 'repeating' | 'forever'
        sa.Column("duration_in_months", sa.Integer, nullable=True),
        # Motivo + estado
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'active'"),
            index=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index(
        "ix_discounts_store_status",
        "discounts",
        ["store_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_discounts_store_status", table_name="discounts")
    op.drop_table("discounts")
