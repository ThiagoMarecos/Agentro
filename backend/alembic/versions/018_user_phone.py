"""User.phone para notificaciones WhatsApp internas

Cuando se asigna un chat a un vendedor, le mandamos un WhatsApp con el
resumen + link al chat. Necesitamos el numero del seller para eso.

Revision ID: 018
Revises: 017
Create Date: 2026-04-25
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("phone", sa.String(50), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("phone")
