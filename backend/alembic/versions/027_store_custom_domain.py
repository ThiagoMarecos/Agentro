"""store custom_domain + domain_verified columns"""

from alembic import op
import sqlalchemy as sa

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("stores") as batch_op:
        batch_op.add_column(sa.Column("custom_domain", sa.String(255), nullable=True, unique=True))
        batch_op.add_column(sa.Column("domain_verified", sa.Boolean(), server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("stores") as batch_op:
        batch_op.drop_column("domain_verified")
        batch_op.drop_column("custom_domain")
