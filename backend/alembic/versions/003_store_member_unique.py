"""Add unique constraint on store_members (store_id, user_id)

Revision ID: 003
Revises: 002
Create Date: 2025-03-07

"""
from typing import Sequence, Union

from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite no soporta ALTER ADD CONSTRAINT, usar batch mode
    with op.batch_alter_table("store_members") as batch_op:
        batch_op.create_unique_constraint(
            "uq_store_members_store_user",
            ["store_id", "user_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("store_members") as batch_op:
        batch_op.drop_constraint("uq_store_members_store_user", type_="unique")
