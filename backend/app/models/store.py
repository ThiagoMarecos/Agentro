"""
Modelos de tienda (tenant).
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, Text, Enum, Integer
from sqlalchemy.orm import relationship
import enum

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class Store(Base, UUIDMixin, TimestampMixin):
    """Tienda (tenant principal)."""

    __tablename__ = "stores"

    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Onboarding
    industry = Column(String(100), nullable=True)  # rubro
    country = Column(String(2), nullable=True)
    currency = Column(String(3), default="USD")
    language = Column(String(5), default="en")
    template_id = Column(String(100), nullable=True)

    # Store settings (identity, contact, SEO)
    business_type = Column(String(100), nullable=True)
    support_email = Column(String(255), nullable=True)
    support_phone = Column(String(50), nullable=True)
    logo_url = Column(String(512), nullable=True)
    favicon_url = Column(String(512), nullable=True)
    timezone = Column(String(50), nullable=True)
    meta_title = Column(String(255), nullable=True)
    meta_description = Column(String(512), nullable=True)
    og_image_url = Column(String(512), nullable=True)

    # Custom domain
    custom_domain = Column(String(255), nullable=True, unique=True)
    domain_verified = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)

    # Relaciones
    members = relationship("StoreMember", back_populates="store", cascade="all, delete-orphan")
    theme = relationship("StoreTheme", back_populates="store", uselist=False, cascade="all, delete-orphan")


class StoreMember(Base, UUIDMixin, TimestampMixin):
    """Miembro de una tienda (relación User-Store con rol)."""

    __tablename__ = "store_members"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)  # owner, admin, manager, support

    # Relaciones
    store = relationship("Store", back_populates="members")
    user = relationship("User", back_populates="store_memberships")


class StoreTheme(Base, UUIDMixin, TimestampMixin):
    """Tema/plantilla de una tienda."""

    __tablename__ = "store_themes"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    template_name = Column(String(100), nullable=False)
    custom_css = Column(Text, nullable=True)
    custom_config = Column(Text, nullable=True)  # JSON con configuraciones

    # Relación
    store = relationship("Store", back_populates="theme")


class ThemeVersion(Base, UUIDMixin, TimestampMixin):
    """Historial de versiones de tema."""

    __tablename__ = "theme_versions"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    custom_config = Column(Text, nullable=True)
    template_name = Column(String(100), nullable=True)

    store = relationship("Store")


class TemplateMarketplace(Base, UUIDMixin, TimestampMixin):
    """Plantilla del marketplace."""

    __tablename__ = "template_marketplace"

    name = Column(String(255), nullable=False)
    author = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    preview_image = Column(String(512), nullable=True)
    config = Column(Text, nullable=True)
    downloads = Column(Integer, default=0)
    is_featured = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)


class StorePage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "store_pages"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    blocks = Column(Text, nullable=True)
    is_published = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    store = relationship("Store")
