"""agent_mode en stores — elegir entre pre-entrenado o custom flow

Revision ID: 026
Revises: 025
Create Date: 2026-06-26
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 'pretrained' = usa el agente curado de Agentro (default — funciona out of the box)
    # 'custom_flow' = usa el AgentFlow activo de la store (Pro+ con flow diseñado)
    op.add_column(
        "stores",
        sa.Column(
            "agent_mode",
            sa.String(20),
            server_default=sa.text("'pretrained'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("stores", "agent_mode")
