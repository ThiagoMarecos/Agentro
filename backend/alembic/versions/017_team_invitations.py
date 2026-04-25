"""Team invitations table

Soporta el flujo del sistema de equipos:
  - Owner / manager invita un nuevo miembro por email + rol
  - Se genera un token único con TTL de 7 días
  - Invitado abre /team-invite/[token], crea cuenta y se asocia a la tienda

Revision ID: 017
Revises: 016
Create Date: 2026-04-25
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "team_invitations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "store_id",
            sa.String(36),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invited_by_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("email", sa.String(255), nullable=False, index=True),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("token", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "accepted_by_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(
        "ix_team_invitations_store_status",
        "team_invitations",
        ["store_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_team_invitations_store_status", table_name="team_invitations")
    op.drop_table("team_invitations")
