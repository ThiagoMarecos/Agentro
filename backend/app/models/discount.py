"""
Modelo Discount — descuentos aplicados desde el super admin panel.

Cada Discount es la representación local de un Stripe Coupon + Discount.
Lo guardamos en nuestra DB para listarlos / filtrarlos sin pegarle a Stripe
en cada render, y para que el super admin pueda recordar EL MOTIVO interno
de cada descuento (campo `reason`).

Stripe sigue siendo la fuente de verdad: si se cancela un descuento en Stripe
manualmente, hay que reflejarlo acá (o correr un sync periódico — futuro).
"""

from sqlalchemy import Column, String, ForeignKey, Text, Integer, DateTime
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class Discount(Base, UUIDMixin, TimestampMixin):
    """Descuento aplicado por el super admin a una store específica."""

    __tablename__ = "discounts"

    # A qué store se aplicó
    store_id = Column(
        String(36),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Quién lo aplicó (super admin)
    applied_by_user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Stripe IDs
    stripe_coupon_id = Column(String(255), nullable=False)
    stripe_discount_id = Column(String(255), nullable=True)  # populado al aplicar a la subscription

    # Tipo: 'percent' | 'amount' (fixed_amount)
    discount_type = Column(String(20), nullable=False)
    # Si percent: 1-100; si amount: centavos USD
    discount_value = Column(Integer, nullable=False)

    # Duration: 'once' | 'repeating' | 'forever'
    duration = Column(String(20), nullable=False)
    # Si duration='repeating', cuántos meses dura el descuento
    duration_in_months = Column(Integer, nullable=True)

    # Motivo INTERNO — obligatorio para auditoría futura
    reason = Column(Text, nullable=False)

    # Estado local: 'active' | 'expired' | 'canceled'
    status = Column(String(20), nullable=False, default="active", index=True)

    # Audit
    expires_at = Column(DateTime(timezone=True), nullable=True)
    canceled_at = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    store = relationship("Store")
    applied_by = relationship("User")
