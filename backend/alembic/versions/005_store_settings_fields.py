"""Add store settings fields

Revision ID: 005
Revises: 004
Create Date: 2025-03-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("stores", sa.Column("support_email", sa.String(255), nullable=True))
    op.add_column("stores", sa.Column("support_phone", sa.String(50), nullable=True))
    op.add_column("stores", sa.Column("logo_url", sa.String(512), nullable=True))
    op.add_column("stores", sa.Column("favicon_url", sa.String(512), nullable=True))
    op.add_column("stores", sa.Column("timezone", sa.String(50), nullable=True))
    op.add_column("stores", sa.Column("meta_title", sa.String(255), nullable=True))
    op.add_column("stores", sa.Column("meta_description", sa.String(512), nullable=True))
    op.add_column("stores", sa.Column("business_type", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("stores", "business_type")
    op.drop_column("stores", "meta_description")
    op.drop_column("stores", "meta_title")
    op.drop_column("stores", "timezone")
    op.drop_column("stores", "favicon_url")
    op.drop_column("stores", "logo_url")
    op.drop_column("stores", "support_phone")
    op.drop_column("stores", "support_email")
