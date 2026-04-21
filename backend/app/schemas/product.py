"""
Schemas de productos.
"""

import re
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, field_validator


def slug_validator(v: str) -> str:
    import unicodedata
    # Normalizar: convertir acentos (á→a, ñ→n, etc.) y bajar a minúsculas
    normalized = unicodedata.normalize("NFKD", v).encode("ascii", "ignore").decode("ascii")
    # Reemplazar espacios y caracteres inválidos por guión
    cleaned = re.sub(r"[^a-z0-9-]+", "-", normalized.lower().strip())
    # Eliminar guiones múltiples y bordes
    cleaned = re.sub(r"-+", "-", cleaned).strip("-")
    # Si quedó muy corto, usar fallback
    if len(cleaned) < 3:
        cleaned = (cleaned + "-producto").strip("-")
    # Truncar a 100 caracteres
    cleaned = cleaned[:100].rstrip("-")
    return cleaned


def price_non_negative(v: Decimal | None) -> Decimal | None:
    if v is not None and v < 0:
        raise ValueError("El precio no puede ser negativo")
    return v


def sku_max_length(v: str | None) -> str | None:
    if v is not None and len(v) > 100:
        raise ValueError("SKU máximo 100 caracteres")
    return v


class ProductImageCreate(BaseModel):
    url: str
    alt_text: str | None = None
    sort_order: int = 0
    is_cover: bool = False
    variant_id: str | None = None


class ProductImageResponse(BaseModel):
    id: str
    url: str
    alt_text: str | None
    sort_order: int
    is_cover: bool

    class Config:
        from_attributes = True


class ProductVariantCreate(BaseModel):
    name: str
    sku: str | None = None
    price: Decimal
    compare_at_price: Decimal | None = None
    stock_quantity: int = 0
    track_inventory: bool = True
    is_default: bool = False
    option_values: dict[str, Any] | None = None

    _price = field_validator("price")(lambda v: price_non_negative(v) or v)
    _compare = field_validator("compare_at_price")(price_non_negative)
    _sku = field_validator("sku")(sku_max_length)


class ProductVariantResponse(BaseModel):
    id: str
    name: str
    sku: str | None
    price: Decimal
    compare_at_price: Decimal | None
    stock_quantity: int
    track_inventory: bool
    is_default: bool
    is_active: bool
    option_values: dict[str, Any] | None

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str
    slug: str
    short_description: str | None = None
    description: str | None = None
    sku: str | None = None
    price: Decimal
    compare_at_price: Decimal | None = None
    cost: Decimal | None = None
    status: str = "active"
    product_type: str = "simple"
    has_variants: bool = False
    is_featured: bool = False
    is_active: bool = True
    is_digital: bool = False
    track_inventory: bool = True
    stock_quantity: int = 0
    allow_backorder: bool = False
    category_id: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    variants: list[ProductVariantCreate] = []
    images: list[ProductImageCreate] = []

    _slug = field_validator("slug")(slug_validator)
    _price = field_validator("price")(lambda v: price_non_negative(v) or v)
    _compare = field_validator("compare_at_price")(price_non_negative)
    _cost = field_validator("cost")(price_non_negative)
    _sku = field_validator("sku")(sku_max_length)


class ProductUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    short_description: str | None = None
    description: str | None = None
    sku: str | None = None
    price: Decimal | None = None
    compare_at_price: Decimal | None = None
    cost: Decimal | None = None
    status: str | None = None
    product_type: str | None = None
    has_variants: bool | None = None
    is_featured: bool | None = None
    is_active: bool | None = None
    is_digital: bool | None = None
    track_inventory: bool | None = None
    stock_quantity: int | None = None
    allow_backorder: bool | None = None
    category_id: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None

    _slug = field_validator("slug")(lambda v: slug_validator(v) if v is not None else v)
    _price = field_validator("price")(price_non_negative)
    _compare = field_validator("compare_at_price")(price_non_negative)
    _cost = field_validator("cost")(price_non_negative)
    _sku = field_validator("sku")(sku_max_length)


class CategorySummary(BaseModel):
    id: str
    name: str
    slug: str

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    id: str
    name: str
    slug: str
    price: Decimal
    status: str
    stock_quantity: int
    category_id: str | None = None
    category_name: str | None
    cover_image_url: str | None
    updated_at: str | None

    class Config:
        from_attributes = True


class ProductResponse(BaseModel):
    id: str
    store_id: str
    category_id: str | None
    name: str
    slug: str
    short_description: str | None
    description: str | None
    sku: str | None
    price: Decimal
    compare_at_price: Decimal | None
    cost: Decimal | None
    status: str
    product_type: str
    has_variants: bool
    is_featured: bool
    is_active: bool
    is_digital: bool
    track_inventory: bool
    stock_quantity: int
    allow_backorder: bool
    cover_image_url: str | None
    seo_title: str | None
    seo_description: str | None
    variants: list[ProductVariantResponse] = []
    images: list[ProductImageResponse] = []
    category: CategorySummary | None = None
    total_stock: int = 0

    class Config:
        from_attributes = True


class ProductListParams(BaseModel):
    search: str | None = None
    status: str | None = None
    category_id: str | None = None
    sort: str = "updated_at"
    order: str = "desc"
    skip: int = 0
    limit: int = 50


class PaginatedProductResponse(BaseModel):
    items: list[ProductListResponse]
    total: int
    skip: int
    limit: int


class ProductImageReorder(BaseModel):
    image_ids: list[str]


class VariantCreateBody(BaseModel):
    name: str
    sku: str | None = None
    price: Decimal
    compare_at_price: Decimal | None = None
    stock_quantity: int = 0
    track_inventory: bool = True
    is_default: bool = False
    option_values: dict[str, Any] | None = None

    _price = field_validator("price")(lambda v: price_non_negative(v) or v)
    _sku = field_validator("sku")(sku_max_length)


class VariantUpdateBody(BaseModel):
    name: str | None = None
    sku: str | None = None
    price: Decimal | None = None
    compare_at_price: Decimal | None = None
    stock_quantity: int | None = None
    track_inventory: bool | None = None
    is_default: bool | None = None
    option_values: dict[str, Any] | None = None

    _price = field_validator("price")(price_non_negative)
    _compare = field_validator("compare_at_price")(price_non_negative)
    _sku = field_validator("sku")(sku_max_length)


class ImageCreateBody(BaseModel):
    url: str
    alt_text: str | None = None
    sort_order: int = 0
    is_cover: bool = False
    variant_id: str | None = None


class ImageReorderBody(BaseModel):
    image_ids: list[str]
