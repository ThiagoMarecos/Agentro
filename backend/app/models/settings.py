"""
Modelo de configuraciones por tienda.
"""

from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class Setting(Base, UUIDMixin, TimestampMixin):
    """Configuración key-value por tienda o global."""

    __tablename__ = "settings"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=True)  # Null = global
    key = Column(String(100), nullable=False)
    value = Column(Text, nullable=True)
