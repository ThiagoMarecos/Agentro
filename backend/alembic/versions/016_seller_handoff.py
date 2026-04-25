"""Seller handoff: campos de asignacion en Conversation + indices

Soporta el flujo del diagrama Agentro v2:
  - El agente IA hace pre-venta y escala (FASE 5)
  - La conversacion queda con needs_seller_assignment=True
  - Owner/manager asigna a un seller via UI
  - Seller toma control: agent_paused=True
  - handoff_summary guarda el JSON estructurado generado por el agente

Tambien agrega un indice util para listar conversaciones pendientes de asignacion.

Revision ID: 016
Revises: 015
Create Date: 2026-04-25
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("conversations") as batch_op:
        batch_op.add_column(
            sa.Column("agent_paused", sa.Boolean, nullable=True, server_default=sa.text("false"))
        )
        batch_op.add_column(
            sa.Column("needs_seller_assignment", sa.Boolean, nullable=True, server_default=sa.text("false"))
        )
        batch_op.add_column(
            sa.Column(
                "assigned_user_id",
                sa.String(36),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            )
        )
        batch_op.add_column(sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("handoff_summary", sa.Text, nullable=True))

    # Indice para "bandeja sin asignar" por tienda (la consulta mas comun)
    op.create_index(
        "ix_conversations_needs_assignment",
        "conversations",
        ["store_id", "needs_seller_assignment"],
    )
    # Indice para "mis chats" del seller
    op.create_index(
        "ix_conversations_assigned_user",
        "conversations",
        ["assigned_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_conversations_assigned_user", table_name="conversations")
    op.drop_index("ix_conversations_needs_assignment", table_name="conversations")

    with op.batch_alter_table("conversations") as batch_op:
        batch_op.drop_column("handoff_summary")
        batch_op.drop_column("assigned_at")
        batch_op.drop_column("assigned_user_id")
        batch_op.drop_column("needs_seller_assignment")
        batch_op.drop_column("agent_paused")
