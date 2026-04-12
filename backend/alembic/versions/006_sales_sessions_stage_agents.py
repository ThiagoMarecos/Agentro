"""Add sales_sessions table and stage agent fields to ai_agents

Revision ID: 006
Revises: 005
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sales_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("store_id", sa.String(36), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", sa.String(36), sa.ForeignKey("ai_agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("conversation_id", sa.String(36), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", sa.String(36), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("channel_id", sa.String(36), sa.ForeignKey("ai_channels.id", ondelete="SET NULL"), nullable=True),
        sa.Column("current_stage", sa.String(50), nullable=False, server_default="incoming"),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("estimated_value", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("blocker_reason", sa.Text, nullable=True),
        sa.Column("last_agent_action", sa.Text, nullable=True),
        sa.Column("next_expected_action", sa.Text, nullable=True),
        sa.Column("follow_up_count", sa.Integer, server_default="0"),
        sa.Column("owner_notified", sa.Boolean, server_default=sa.text("0")),
        sa.Column("requires_manual_review", sa.Boolean, server_default=sa.text("0")),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("stage_entered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notebook", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    with op.batch_alter_table("ai_agents") as batch_op:
        batch_op.add_column(sa.Column("agent_type", sa.String(50), server_default="generic"))
        batch_op.add_column(sa.Column("stage_name", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("display_name", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("tone", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("language", sa.String(10), nullable=True, server_default="es"))
        batch_op.add_column(sa.Column("sales_style", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("enabled_tools", sa.Text, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("ai_agents") as batch_op:
        batch_op.drop_column("enabled_tools")
        batch_op.drop_column("sales_style")
        batch_op.drop_column("language")
        batch_op.drop_column("tone")
        batch_op.drop_column("display_name")
        batch_op.drop_column("stage_name")
        batch_op.drop_column("agent_type")

    op.drop_table("sales_sessions")
