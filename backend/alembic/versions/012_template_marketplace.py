"""add template_marketplace table"""

from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "template_marketplace",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("preview_image", sa.String(512), nullable=True),
        sa.Column("config", sa.Text(), nullable=True),
        sa.Column("downloads", sa.Integer(), server_default="0"),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("template_marketplace")
