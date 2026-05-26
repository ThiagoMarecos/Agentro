"""invitation_requests — formulario público de pedir invitación a la beta

Revision ID: 020
Revises: 019
Create Date: 2026-05-26
"""

from typing import Union
from alembic import op
import sqlalchemy as sa


revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invitation_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        # Datos del solicitante
        sa.Column("email", sa.String(255), nullable=False, index=True),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("business_name", sa.String(200), nullable=False),
        sa.Column("business_type", sa.String(50), nullable=False),
        sa.Column("whatsapp", sa.String(50), nullable=True),
        sa.Column("country", sa.String(50), nullable=True),
        # Marketing
        sa.Column("referral_source", sa.String(50), nullable=True),
        sa.Column("referral_detail", sa.Text, nullable=True),
        sa.Column("expectations", sa.Text, nullable=True),
        # Consentimiento
        sa.Column("accepts_contact", sa.Boolean, server_default=sa.text("true"), nullable=False),
        # Estado workflow
        sa.Column("status", sa.String(20), server_default=sa.text("'pending'"), nullable=False, index=True),
        sa.Column("notes", sa.Text, nullable=True),
        # Audit / approval
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by_user_id", sa.String(36), nullable=True),
        # Metadata
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_invitation_requests_status_created", "invitation_requests", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_invitation_requests_status_created", table_name="invitation_requests")
    op.drop_table("invitation_requests")
