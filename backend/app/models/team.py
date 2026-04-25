"""
Modelo de invitaciones de equipo.

Cuando el dueño / manager invita a un nuevo miembro (vendedor, manager),
se crea una TeamInvitation con un token único + expiración. El invitado
recibe un email con un link y al aceptar se crea (o asocia) un User
y se le da una membership en la Store con el rol indicado.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


# Cuántos días dura una invitación antes de vencerse
INVITATION_TTL_DAYS = 7


def _default_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=INVITATION_TTL_DAYS)


class TeamInvitation(Base, UUIDMixin, TimestampMixin):
    """Invitación a unirse al equipo de una tienda."""

    __tablename__ = "team_invitations"

    store_id = Column(
        String(36),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invited_by_user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Email al que se mandó la invitación (puede no existir como User aún)
    email = Column(String(255), nullable=False, index=True)

    # Rol que tendrá el usuario al aceptar (seller / manager / support)
    role = Column(String(50), nullable=False)

    # Token único usado en el link del email
    token = Column(String(64), unique=True, nullable=False, index=True)

    # Cuándo vence
    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_default_expires_at,
    )

    # pending | accepted | expired | revoked
    status = Column(String(20), nullable=False, default="pending")

    accepted_at = Column(DateTime(timezone=True), nullable=True)
    accepted_by_user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relaciones
    store = relationship("Store")
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])
    accepted_by = relationship("User", foreign_keys=[accepted_by_user_id])

    def is_expired(self) -> bool:
        if not self.expires_at:
            return False
        # Algunos drivers devuelven naive datetimes
        exp = self.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > exp

    def is_pending(self) -> bool:
        return self.status == "pending" and not self.is_expired()
