"""
Modelo de próximos drops (lanzamientos).
"""

from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class NextDropItem(Base, UUIDMixin, TimestampMixin):
    """Item de próximo drop/lanzamiento."""

    __tablename__ = "next_drop_items"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    drop_date = Column(DateTime(timezone=True), nullable=True)
    image_url = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
