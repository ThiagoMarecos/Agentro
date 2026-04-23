"""Agent learning mode + lessons + conversation metrics

Revision ID: 015
Revises: 014
Create Date: 2026-04-21
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Conversation metrics ──
    with op.batch_alter_table("conversations") as batch_op:
        batch_op.add_column(sa.Column("tool_calls_count", sa.Integer, nullable=True, server_default="0"))
        batch_op.add_column(sa.Column("total_tokens", sa.Integer, nullable=True, server_default="0"))
        batch_op.add_column(sa.Column("outcome", sa.String(50), nullable=True, server_default="ongoing"))
        batch_op.add_column(sa.Column("outcome_reason", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("last_stage_reached", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("estimated_value", sa.Numeric(12, 2), nullable=True))

    # ── AIAgent: learning mode ──
    with op.batch_alter_table("ai_agents") as batch_op:
        batch_op.add_column(
            sa.Column("learning_mode_enabled", sa.Boolean, nullable=True, server_default=sa.text("false"))
        )

    # ── New table: agent_lessons ──
    op.create_table(
        "agent_lessons",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", sa.String(36), sa.ForeignKey("ai_agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_conversation_id", sa.String(36), sa.ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("lesson_text", sa.Text, nullable=False),
        sa.Column("bad_response_example", sa.Text, nullable=True),
        sa.Column("correct_response", sa.Text, nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("priority", sa.Integer, nullable=True, server_default="5"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_agent_lessons_agent_active", "agent_lessons", ["agent_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_agent_lessons_agent_active", table_name="agent_lessons")
    op.drop_table("agent_lessons")

    with op.batch_alter_table("ai_agents") as batch_op:
        batch_op.drop_column("learning_mode_enabled")

    with op.batch_alter_table("conversations") as batch_op:
        batch_op.drop_column("estimated_value")
        batch_op.drop_column("last_stage_reached")
        batch_op.drop_column("outcome_reason")
        batch_op.drop_column("outcome")
        batch_op.drop_column("total_tokens")
        batch_op.drop_column("tool_calls_count")
