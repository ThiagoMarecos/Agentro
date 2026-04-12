"""
Schemas de tiendas.
"""

from pydantic import BaseModel


class StoreCreate(BaseModel):
    name: str
    slug: str
    industry: str | None = None
    country: str | None = None
    currency: str = "USD"
    language: str = "en"
    template_id: str | None = None


class StoreUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    industry: str | None = None
    country: str | None = None
    currency: str | None = None
    language: str | None = None
    template_id: str | None = None


class StoreSettingsUpdate(BaseModel):
    """Campos editables de configuración de tienda."""

    name: str | None = None
    slug: str | None = None
    description: str | None = None
    industry: str | None = None
    business_type: str | None = None
    country: str | None = None
    currency: str | None = None
    language: str | None = None
    timezone: str | None = None
    support_email: str | None = None
    support_phone: str | None = None
    logo_url: str | None = None
    favicon_url: str | None = None
    og_image_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    custom_domain: str | None = None
    is_active: bool | None = None


class StoreSettingsResponse(BaseModel):
    """Respuesta completa de settings de tienda."""

    id: str
    name: str
    slug: str
    description: str | None
    industry: str | None
    business_type: str | None
    country: str | None
    currency: str
    language: str
    timezone: str | None
    template_id: str | None
    is_active: bool
    support_email: str | None
    support_phone: str | None
    logo_url: str | None
    favicon_url: str | None
    og_image_url: str | None
    meta_title: str | None
    meta_description: str | None
    custom_domain: str | None = None
    domain_verified: bool = False

    class Config:
        from_attributes = True


class StoreResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    industry: str | None
    country: str | None
    currency: str
    language: str
    template_id: str | None
    is_active: bool
    logo_url: str | None = None
    favicon_url: str | None = None
    og_image_url: str | None = None

    class Config:
        from_attributes = True
