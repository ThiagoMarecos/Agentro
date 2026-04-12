"""
Modelos de clientes y direcciones.
"""

from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class Customer(Base, UUIDMixin, TimestampMixin):
    """Cliente de una tienda (comprador)."""

    __tablename__ = "customers"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)

    email = Column(String(255), nullable=False, index=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)

    # Relaciones
    addresses = relationship("Address", back_populates="customer", cascade="all, delete-orphan")


class Address(Base, UUIDMixin, TimestampMixin):
    """Dirección de envío/facturación."""

    __tablename__ = "addresses"

    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)

    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(2), nullable=False)

    is_default = Column(String(10), nullable=True)  # 'shipping' | 'billing' | null

    # Relación
    customer = relationship("Customer", back_populates="addresses")
