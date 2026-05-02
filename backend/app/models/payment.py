"""
Modelos de pagos y caja registradora del POS.
"""

from sqlalchemy import Column, String, ForeignKey, Boolean, Text, Numeric, DateTime, Integer
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class PaymentMethod(Base, UUIDMixin, TimestampMixin):
    """
    Método de pago configurado por una tienda.
    El catálogo de providers soportados está en services/payment_providers.py.
    """

    __tablename__ = "payment_methods"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)

    # Key del provider (ej: "mercadopago", "ueno_bank", "efectivo")
    # Debe coincidir con una key del catálogo en payment_providers.PAYMENT_PROVIDERS
    provider = Column(String(50), nullable=False, index=True)

    # Nombre display (puede sobrescribir el del catálogo)
    display_name = Column(String(120), nullable=True)

    # Si está activo aparece en el POS y en el storefront
    is_active = Column(Boolean, default=True, nullable=False)

    # Orden de aparición (menor = primero)
    sort_order = Column(Integer, default=0, nullable=False)

    # Config específica del provider (JSON serializado).
    # Los valores secretos se guardan encriptados con encrypt_value() del
    # platform_settings_service para no exponerlos en logs / dumps.
    config = Column(Text, nullable=True)

    # Relaciones
    store = relationship("Store")


class CashRegister(Base, UUIDMixin, TimestampMixin):
    """
    Sesión de caja del POS — apertura con efectivo inicial → ventas → cierre Z.

    Modelo "por usuario": cada vendedor abre/cierra su propia caja.
    Una sesión está abierta mientras closed_at IS NULL.
    """

    __tablename__ = "cash_registers"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Apertura
    opened_at = Column(DateTime(timezone=True), nullable=False)
    opening_cash = Column(Numeric(12, 2), nullable=False, default=0)

    # Cierre (null = caja abierta)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    expected_cash = Column(Numeric(12, 2), nullable=True)  # calculado: opening + ventas efectivo
    counted_cash = Column(Numeric(12, 2), nullable=True)   # ingresado manualmente al cerrar
    cash_difference = Column(Numeric(12, 2), nullable=True)  # counted - expected

    # Totales del turno (snapshot al cerrar)
    sales_count = Column(Integer, default=0, nullable=False)
    sales_total = Column(Numeric(12, 2), default=0, nullable=False)

    # Notas del cierre
    notes = Column(Text, nullable=True)

    # Relaciones
    store = relationship("Store")
    user = relationship("User")


class Refund(Base, UUIDMixin, TimestampMixin):
    """
    Devolución de una venta (total o parcial).
    Se crea desde /app/orders/[id] → botón "Anular venta".
    """

    __tablename__ = "refunds"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    refunded_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    amount = Column(Numeric(12, 2), nullable=False)
    reason = Column(Text, nullable=True)

    # Si fue total → la order pasa a 'cancelled' + repone stock
    # Si fue parcial → solo se descuenta el monto refundeado
    is_full_refund = Column(Boolean, default=True, nullable=False)

    # Relaciones
    order = relationship("Order")
    store = relationship("Store")
