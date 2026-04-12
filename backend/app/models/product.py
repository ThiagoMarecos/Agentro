"""
Modelos de productos y categorías.
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, Text, Numeric, Integer, Index, JSON
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class Category(Base, UUIDMixin, TimestampMixin):
    """Categoría de productos (por tienda)."""

    __tablename__ = "categories"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    # Relaciones
    products = relationship("Product", back_populates="category")


class Product(Base, UUIDMixin, TimestampMixin):
    """Producto de una tienda."""

    __tablename__ = "products"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(String(36), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    supplier_id = Column(String(36), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    short_description = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    sku = Column(String(100), nullable=True)

    status = Column(String(50), default="active")  # draft, active, archived
    product_type = Column(String(50), default="simple")  # simple, variant
    has_variants = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    cover_image_url = Column(String(512), nullable=True)

    price = Column(Numeric(12, 2), nullable=False)
    compare_at_price = Column(Numeric(12, 2), nullable=True)
    cost = Column(Numeric(12, 2), nullable=True)

    is_active = Column(Boolean, default=True)
    is_digital = Column(Boolean, default=False)
    track_inventory = Column(Boolean, default=True)
    stock_quantity = Column(Integer, default=0)
    allow_backorder = Column(Boolean, default=False)

    seo_title = Column(String(255), nullable=True)
    seo_description = Column(String(512), nullable=True)

    # Relaciones
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    category = relationship("Category", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")

    __table_args__ = (
        Index("ix_products_store_slug", "store_id", "slug", unique=True),
        Index("ix_products_store_status", "store_id", "status"),
    )


class ProductVariant(Base, UUIDMixin, TimestampMixin):
    """Variante de producto (talla, color, etc.)."""

    __tablename__ = "product_variants"

    product_id = Column(String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)  # ej: "Small / Rojo"
    sku = Column(String(100), nullable=True)
    price = Column(Numeric(12, 2), nullable=False)
    compare_at_price = Column(Numeric(12, 2), nullable=True)
    stock_quantity = Column(Integer, default=0)
    track_inventory = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    option_values = Column(JSON, nullable=True)  # {"size":"S","color":"Rojo"}

    # Relación
    product = relationship("Product", back_populates="variants")


class ProductImage(Base, UUIDMixin, TimestampMixin):
    """Imagen de producto."""

    __tablename__ = "product_images"

    product_id = Column(String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    variant_id = Column(String(36), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    url = Column(String(512), nullable=False)
    alt_text = Column(String(255), nullable=True)
    sort_order = Column(Integer, default=0)
    is_cover = Column(Boolean, default=False)

    # Relación
    product = relationship("Product", back_populates="images")
