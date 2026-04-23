"""Add origin_type, lead_time_days, internal_notes to products

Revision ID: 014
Revises: 013
Create Date: 2026-04-21
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(
            sa.Column(
                "origin_type",
                sa.String(50),
                nullable=True,
                server_default="external_supplier",
            )
        )
        batch_op.add_column(sa.Column("lead_time_days", sa.Integer, nullable=True))
        batch_op.add_column(sa.Column("internal_notes", sa.Text, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("internal_notes")
        batch_op.drop_column("lead_time_days")
        batch_op.drop_column("origin_type")
