"""Add WhatsApp/Evolution API fields to ai_channels

Revision ID: 008
Revises: 007
Create Date: 2026-03-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("ai_channels") as batch_op:
        batch_op.add_column(sa.Column("instance_name", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("instance_token", sa.String(512), nullable=True))
        batch_op.add_column(sa.Column("webhook_secret", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("whatsapp_number", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("connection_status", sa.String(50), nullable=True, server_default="disconnected"))
        batch_op.create_unique_constraint("uq_ai_channels_instance_name", ["instance_name"])


def downgrade() -> None:
    with op.batch_alter_table("ai_channels") as batch_op:
        batch_op.drop_constraint("uq_ai_channels_instance_name", type_="unique")
        batch_op.drop_column("connection_status")
        batch_op.drop_column("whatsapp_number")
        batch_op.drop_column("webhook_secret")
        batch_op.drop_column("instance_token")
        batch_op.drop_column("instance_name")
