"""
Modelo de configuraciones globales de la plataforma (API keys, etc.)
Solo accesible por superadmin.
Los valores sensibles se guardan encriptados con Fernet (AES-128-CBC).
"""

from sqlalchemy import Column, String, Text, Boolean
from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class PlatformSetting(Base, UUIDMixin, TimestampMixin):
    """Configuración global key-value de la plataforma."""

    __tablename__ = "platform_settings"

    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)          # valor encriptado si is_secret=True
    is_secret = Column(Boolean, default=True)     # si True, se encripta y se muestra ofuscado
    label = Column(String(200), nullable=True)    # nombre amigable para el frontend
    category = Column(String(50), nullable=True)  # grupo: google_oauth, openai, whatsapp, etc.
