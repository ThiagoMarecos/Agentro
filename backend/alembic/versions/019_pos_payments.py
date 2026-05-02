"""POS y metodos de pago dinamicos

- Tabla payment_methods (configurada por tienda, segun catalogo de providers)
- Tabla cash_registers (caja por usuario con apertura/cierre Z)
- Tabla refunds (devoluciones de ventas)
- Order.source + payment_method_id + payment_status + payment_received +
  payment_proof + created_by_user_id + cash_register_id

Revision ID: 019
Revises: 018
Create Date: 2026-04-27
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── payment_methods ──
    op.create_table(
        "payment_methods",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "store_id",
            sa.String(36),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("provider", sa.String(50), nullable=False, index=True),
        sa.Column("display_name", sa.String(120), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("config", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_payment_methods_store_active", "payment_methods", ["store_id", "is_active"])

    # ── cash_registers ──
    op.create_table(
        "cash_registers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "store_id",
            sa.String(36),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("opening_cash", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expected_cash", sa.Numeric(12, 2), nullable=True),
        sa.Column("counted_cash", sa.Numeric(12, 2), nullable=True),
        sa.Column("cash_difference", sa.Numeric(12, 2), nullable=True),
        sa.Column("sales_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("sales_total", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(
        "ix_cash_registers_store_user_open",
        "cash_registers",
        ["store_id", "user_id", "closed_at"],
    )

    # ── refunds ──
    op.create_table(
        "refunds",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "store_id",
            sa.String(36),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "order_id",
            sa.String(36),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "refunded_by_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("is_full_refund", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── Order: campos POS ──
    with op.batch_alter_table("orders") as batch_op:
        batch_op.add_column(sa.Column("source", sa.String(20), nullable=True, server_default="manual"))
        batch_op.add_column(sa.Column(
            "payment_method_id",
            sa.String(36),
            sa.ForeignKey("payment_methods.id", ondelete="SET NULL"),
            nullable=True,
        ))
        batch_op.add_column(sa.Column("payment_status", sa.String(20), nullable=True, server_default="pending"))
        batch_op.add_column(sa.Column("payment_received", sa.Numeric(12, 2), nullable=True))
        batch_op.add_column(sa.Column("payment_proof", sa.Text, nullable=True))
        batch_op.add_column(sa.Column(
            "created_by_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ))
        batch_op.add_column(sa.Column(
            "cash_register_id",
            sa.String(36),
            sa.ForeignKey("cash_registers.id", ondelete="SET NULL"),
            nullable=True,
        ))


def downgrade() -> None:
    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_column("cash_register_id")
        batch_op.drop_column("created_by_user_id")
        batch_op.drop_column("payment_proof")
        batch_op.drop_column("payment_received")
        batch_op.drop_column("payment_status")
        batch_op.drop_column("payment_method_id")
        batch_op.drop_column("source")

    op.drop_table("refunds")
    op.drop_index("ix_cash_registers_store_user_open", table_name="cash_registers")
    op.drop_table("cash_registers")
    op.drop_index("ix_payment_methods_store_active", table_name="payment_methods")
    op.drop_table("payment_methods")
