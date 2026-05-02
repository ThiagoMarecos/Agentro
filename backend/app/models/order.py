"""
Modelos de pedidos.
"""

from sqlalchemy import Column, String, ForeignKey, Numeric, Integer, Text, Enum
from sqlalchemy.orm import relationship
import enum

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class OrderStatus(str, enum.Enum):
    """Estados de pedido."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Order(Base, UUIDMixin, TimestampMixin):
    """Pedido de una tienda."""

    __tablename__ = "orders"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)

    order_number = Column(String(50), nullable=False, index=True)
    status = Column(String(50), default=OrderStatus.PENDING.value)

    subtotal = Column(Numeric(12, 2), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=0)
    shipping_amount = Column(Numeric(12, 2), default=0)
    discount_amount = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False)

    currency = Column(String(3), default="USD")
    notes = Column(Text, nullable=True)

    # ── POS / multi-canal (Sesión POS-1) ──
    # source: pos | chat | storefront | manual
    # Para distinguir el origen y filtrar reportes (ventas en local vs online).
    source = Column(String(20), nullable=True, default="manual")

    # Método de pago elegido (FK a PaymentMethod, opcional)
    payment_method_id = Column(String(36), ForeignKey("payment_methods.id", ondelete="SET NULL"), nullable=True)
    # Estado de pago: pending | paid | failed | refunded | partial_refund
    payment_status = Column(String(20), nullable=True, default="pending")
    # Monto recibido (efectivo) — sirve para calcular vuelto
    payment_received = Column(Numeric(12, 2), nullable=True)
    # Comprobante (URL imagen subida o texto del cliente)
    payment_proof = Column(Text, nullable=True)
    # Quién hizo la venta en POS
    created_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # Caja de POS asociada (para cierre Z)
    cash_register_id = Column(String(36), ForeignKey("cash_registers.id", ondelete="SET NULL"), nullable=True)

    # Relaciones
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base, UUIDMixin, TimestampMixin):
    """Ítem de un pedido."""

    __tablename__ = "order_items"

    order_id = Column(String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    variant_id = Column(String(36), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(255), nullable=False)
    sku = Column(String(100), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)

    # Relación
    order = relationship("Order", back_populates="items")
