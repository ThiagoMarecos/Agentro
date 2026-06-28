"""subscription_tier + trial + Stripe + beta flags en stores

Revision ID: 021
Revises: 020
Create Date: 2026-06-25
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tier de suscripción: starter | pro | enterprise
    op.add_column(
        "stores",
        sa.Column(
            "subscription_tier",
            sa.String(20),
            server_default=sa.text("'starter'"),
            nullable=False,
        ),
    )

    # Estado de la suscripción: trialing | active | past_due | canceled | paused
    op.add_column(
        "stores",
        sa.Column(
            "subscription_status",
            sa.String(20),
            server_default=sa.text("'active'"),
            nullable=False,
        ),
    )

    # Trial: timestamp donde vence el trial. NULL si nunca estuvo en trial
    # o si ya convirtió a pago.
    op.add_column(
        "stores",
        sa.Column(
            "trial_ends_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Stripe IDs — se llenan cuando el cliente confirma plan + mete tarjeta
    op.add_column(
        "stores",
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "stores",
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
    )

    # Beta users — para "lifetime discount" a early adopters.
    # Mientras is_beta_user=True Y beta_features_until > now() el store tiene
    # acceso a TODAS las features (override del feature gating). Cuando expira,
    # cae al tier que tenga asignado y entra al trial normal.
    op.add_column(
        "stores",
        sa.Column(
            "is_beta_user",
            sa.Boolean,
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "stores",
        sa.Column(
            "beta_features_until",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # Índices para queries frecuentes de billing y analytics
    op.create_index("ix_stores_subscription_status", "stores", ["subscription_status"])
    op.create_index("ix_stores_subscription_tier", "stores", ["subscription_tier"])
    op.create_index("ix_stores_stripe_customer_id", "stores", ["stripe_customer_id"])


def downgrade() -> None:
    op.drop_index("ix_stores_stripe_customer_id", table_name="stores")
    op.drop_index("ix_stores_subscription_tier", table_name="stores")
    op.drop_index("ix_stores_subscription_status", table_name="stores")
    op.drop_column("stores", "beta_features_until")
    op.drop_column("stores", "is_beta_user")
    op.drop_column("stores", "stripe_subscription_id")
    op.drop_column("stores", "stripe_customer_id")
    op.drop_column("stores", "trial_ends_at")
    op.drop_column("stores", "subscription_status")
    op.drop_column("stores", "subscription_tier")
