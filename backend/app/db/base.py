"""
Base para modelos SQLAlchemy.
Incluye mixins comunes: timestamps, soft delete, etc.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, String, func

from app.db.session import Base


def generate_uuid():
    """Genera UUID4 como string."""
    return str(uuid4())


class TimestampMixin:
    """Mixin para created_at y updated_at."""

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UUIDMixin:
    """Mixin para id como UUID (String para compatibilidad SQLite y PostgreSQL)."""

    id = Column(String(36), primary_key=True, default=generate_uuid)
