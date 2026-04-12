"""
Modelo de proveedores.
"""

from sqlalchemy import Column, String, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class Supplier(Base, UUIDMixin, TimestampMixin):
    """Proveedor de una tienda."""

    __tablename__ = "suppliers"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    website = Column(String(512), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    products = relationship("Product", back_populates="supplier")
