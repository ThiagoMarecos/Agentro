"""add og_image_url to stores"""

from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.batch_alter_table("stores") as batch_op:
        batch_op.add_column(sa.Column("og_image_url", sa.String(512), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table("stores") as batch_op:
        batch_op.drop_column("og_image_url")
