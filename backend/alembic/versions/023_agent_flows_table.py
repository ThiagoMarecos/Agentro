"""agent_flows — diagrama de flujo custom del agente (Enterprise feature)

Revision ID: 023
Revises: 022
Create Date: 2026-06-25
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_flows",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "store_id",
            sa.String(36),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # JSON serializado compatible con react-flow
        sa.Column("nodes", sa.Text, nullable=False, server_default=sa.text("'[]'")),
        sa.Column("edges", sa.Text, nullable=False, server_default=sa.text("'[]'")),
        sa.Column(
            "is_active",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
            index=True,
        ),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column(
            "parent_flow_id",
            sa.String(36),
            sa.ForeignKey("agent_flows.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
    # Índice compuesto para queries del runtime: traer el flow activo de una store
    op.create_index(
        "ix_agent_flows_store_active",
        "agent_flows",
        ["store_id", "is_active"],
    )


def downgrade() -> None:
    op.drop_index("ix_agent_flows_store_active", table_name="agent_flows")
    op.drop_table("agent_flows")
