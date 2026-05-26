"""
Modelo InvitationRequest — solicitudes de invitación a la beta cerrada.

Es público: cualquier persona puede llenar el form en la landing
(/request-invite). El admin después aprueba/rechaza/contacta.
"""

from sqlalchemy import Column, String, Boolean, Text, DateTime, ForeignKey
from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


# Estados del workflow
STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
STATUS_CONTACTED = "contacted"
VALID_STATUSES = (STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED, STATUS_CONTACTED)

# Categorías de "¿cómo nos encontraste?" — útiles para tracking de marketing.
REFERRAL_SOURCES = (
    "google",       # Búsqueda en Google
    "ai",           # ChatGPT, Claude, Perplexity, etc.
    "recommendation",  # Alguien me lo recomendó
    "social",       # Instagram, Twitter/X, LinkedIn, TikTok
    "ad",           # Publicidad pagada
    "press",        # Nota, artículo, blog
    "event",        # Evento, conferencia
    "other",        # Otro / no recuerdo
)


class InvitationRequest(Base, UUIDMixin, TimestampMixin):
    """Solicitud pública de invitación a la beta."""

    __tablename__ = "invitation_requests"

    # ── Datos del solicitante ──
    email = Column(String(255), nullable=False, index=True)
    full_name = Column(String(200), nullable=False)
    business_name = Column(String(200), nullable=False)
    business_type = Column(String(50), nullable=False)  # ej: "retail", "gastro", "services", "ecommerce", "other"
    whatsapp = Column(String(50), nullable=True)
    country = Column(String(50), nullable=True)

    # ── Marketing / referral ──
    referral_source = Column(String(50), nullable=True)
    referral_detail = Column(Text, nullable=True)
    expectations = Column(Text, nullable=True)

    # ── Consentimiento ──
    accepts_contact = Column(Boolean, default=True, nullable=False)

    # ── Workflow ──
    status = Column(String(20), default=STATUS_PENDING, nullable=False, index=True)
    notes = Column(Text, nullable=True)  # Notas internas del admin

    # ── Aprobación ──
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # ── Metadata ──
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
