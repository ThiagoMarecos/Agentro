"""
Modelo de wishlist (lista de deseos).
"""

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class Wishlist(Base, UUIDMixin, TimestampMixin):
    """Item en lista de deseos de un cliente."""

    __tablename__ = "wishlists"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=True)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)

    # Para guest users (sin customer_id)
    session_id = Column(String(255), nullable=True)
